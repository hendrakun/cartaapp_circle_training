import { afterAll, describe, expect, it } from 'vitest'
import { hashPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { app } from '../../../app'
import { closeDb, getDb } from '../../../db'
import { accounts, sessions } from '../../auth/auth.entity'
import { getAuth } from '../../auth/auth'
import { permissions } from '../permissions/permissions.entity'
import { rolePermissions, roles, roleAssignments } from '../roles/roles.entity'
import { users } from './users.entity'

function id(prefix: string) {
  return `user-create-test-${prefix}-${crypto.randomUUID()}`
}

async function session(withPermission: boolean, permissionCodes = ['create-users']) {
  const db = getDb()
  const userId = id(withPermission ? 'admin' : 'limited')
  const email = `${userId}@example.invalid`
  await db.insert(users).values({ id: userId, name: 'Test User', email })
  await db.insert(accounts).values({
    id: id('account'),
    accountId: userId,
    providerId: 'credential',
    userId,
    password: await hashPassword('test-password'),
  })
  let roleId: string | undefined
  if (withPermission) {
    roleId = id('role')
    await db.insert(roles).values({ id: roleId, roleCode: id('role-code'), name: 'Test Role' })
    for (const permissionCode of permissionCodes) {
      await db.insert(permissions).values({ id: `permission-${permissionCode}-${crypto.randomUUID()}`, permissionCode, name: permissionCode }).onConflictDoNothing()
      const permission = await db.select({ id: permissions.id }).from(permissions).where(eq(permissions.permissionCode, permissionCode)).limit(1)
      await db.insert(rolePermissions).values({ roleId, permissionId: permission[0]!.id })
    }
    await db.insert(roleAssignments).values({ userId, roleId })
  }
  const signedIn = await getAuth().api.signInEmail({ body: { email, password: 'test-password' }, returnHeaders: true })
  return { cookie: signedIn.headers.get('set-cookie')?.split(';')[0] ?? '', roleId, userId }
}

function request(body: unknown, cookie = '') {
  return app.request('/users/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
}

describe('user credential creation route', () => {
  afterAll(() => closeDb())

  it('creates a user with a valid credential payload', async () => {
    const sessionState = await session(true)
    const secondRoleId = id('second-role')
    await getDb().insert(roles).values({ id: secondRoleId, roleCode: id('second-role-code'), name: 'Second Role' })
    const response = await request({ name: 'Created User', email: `${id('created')}@example.invalid`, password: 'password-123', roleIds: [sessionState.roleId!, secondRoleId] }, sessionState.cookie)

    expect(response.status).toBe(201)
    const user = (await response.json()).data
    expect(user).toMatchObject({ name: 'Created User' })
    expect(await getDb().select({ roleId: roleAssignments.roleId }).from(roleAssignments).where(eq(roleAssignments.userId, user.id))).toHaveLength(2)
  })

  it('rejects invalid input at the route boundary', async () => {
    const sessionState = await session(true)
    const response = await request({ name: '', email: 'not-an-email', password: 'short', roleIds: [sessionState.roleId!] }, sessionState.cookie)

    expect(response.status).toBe(400)
  })

  it('rejects duplicate emails', async () => {
    const sessionState = await session(true)
    const email = `${id('duplicate')}@example.invalid`
    const first = { name: 'First User', email, password: 'password-123', roleIds: [sessionState.roleId!] }
    expect((await request(first, sessionState.cookie)).status).toBe(201)

    const second = await request({ ...first, name: 'Second User' }, sessionState.cookie)
    expect(second.status).toBe(409)
  })

  it('requires create-users permission', async () => {
    expect((await request({})).status).toBe(401)
    expect((await request({}, (await session(false)).cookie)).status).toBe(403)
  })

  it('rejects duplicate, missing, and inactive initial roles before account creation', async () => {
    const sessionState = await session(true)
    const inactiveRoleId = id('inactive-role')
    await getDb().insert(roles).values([
      { id: inactiveRoleId, roleCode: id('inactive-role-code'), name: 'Inactive Role', active: false },
    ])
    const cases = [
      { roleIds: [sessionState.roleId!, sessionState.roleId!], status: 400 },
      { roleIds: [id('missing-role')], status: 422 },
      { roleIds: [inactiveRoleId], status: 422 },
    ]
    for (const testCase of cases) {
      const email = `${id('rejected')}@example.invalid`
      const response = await request({ name: 'Rejected User', email, password: 'password-123', roleIds: testCase.roleIds }, sessionState.cookie)
      expect(response.status).toBe(testCase.status)
      expect(await getDb().select({ id: users.id }).from(users).where(eq(users.email, email))).toHaveLength(0)
    }
  })

  it('rejects invalid status codes without changing the user', async () => {
    const sessionState = await session(true, ['create-users', 'update-users'])
    const response = await app.request(`/users/update/${sessionState.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionState.cookie },
      body: JSON.stringify({ statusCode: 'inactive' }),
    })

    expect(response.status).toBe(400)
    expect((await getDb().select({ statusCode: users.statusCode }).from(users).where(eq(users.id, sessionState.userId))).at(0)?.statusCode).toBe('active')
  })

  it('deletes sessions when an active user is disabled', async () => {
    const sessionState = await session(true, ['create-users', 'update-users'])
    const before = await getDb().select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, sessionState.userId))
    expect(before).toHaveLength(1)
    const response = await app.request(`/users/update/${sessionState.userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: sessionState.cookie },
      body: JSON.stringify({ statusCode: 'non_active' }),
    })
    expect(response.status).toBe(200)
    expect(await getDb().select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, sessionState.userId))).toHaveLength(0)
    expect((await app.request('/me', { headers: { Cookie: sessionState.cookie } })).status).toBe(401)
  })
})
