import { afterAll, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { app } from '../../../app'
import { closeDb, getDb } from '../../../db'
import { cleanupSessions, createSystemSession, testId } from '../../../testing/session'
import { permissions } from '../permissions/permissions.entity'
import { rolePermissions, roles } from './roles.entity'

afterAll(() => closeDb())

it('paginates active permissions and protects mapping writes', async () => {
  const db = getDb()
  const admin = await createSystemSession(['list-role-permissions', 'create-role-permissions', 'delete-role-permissions'])
  const reader = await createSystemSession(['list-role-permissions'])
  const roleId = testId('mapping-role')
  const prefix = testId('mapping-permission')
  const fixtures = Array.from({ length: 12 }, (_, index) => ({
    id: `${prefix}-${String(index).padStart(2, '0')}`,
    permissionCode: `${prefix}-${String(index).padStart(2, '0')}`,
    name: 'Same name',
    description: `${prefix} description`,
    active: index < 11,
  }))
  const request = (query = '', cookie = admin.cookie) => app.request(`/roles/${roleId}/permissions${query}`, { headers: { Cookie: cookie } })
  const write = (method: string, cookie = admin.cookie) => app.request(`/roles/${roleId}/permissions/${fixtures[0]!.id}`, { method, headers: { Cookie: cookie } })
  const stored = () => db.select({ active: rolePermissions.active }).from(rolePermissions).where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, fixtures[0]!.id)))
  try {
    await db.insert(roles).values({ id: roleId, roleCode: roleId, name: 'Mapping role' })
    await db.insert(permissions).values(fixtures)
    const first = await request(`?search=${prefix}`)
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ total: 11, data: fixtures.slice(0, 10).map(({ id }) => ({ id, assigned: false })) })
    const second = await (await request(`?search=${prefix}&page=2&limit=10`)).json()
    expect(second.total).toBe(11)
    expect(second.data.map((row: { id: string }) => row.id)).toEqual([fixtures[10]!.id])
    expect((await (await request(`?search=${prefix}&page=3&limit=10`)).json()).data).toEqual([])
    const sorted = await (await request(`?search=${prefix}&limit=2&sort_by=permissionCode&sort=desc`)).json()
    expect(sorted.data.map((row: { id: string }) => row.id)).toEqual([fixtures[10]!.id, fixtures[9]!.id])
    const tied = await (await request(`?search=${prefix}&limit=2&sort_by=name&sort=desc`)).json()
    expect(tied.data.map((row: { id: string }) => row.id)).toEqual([fixtures[0]!.id, fixtures[1]!.id])
    for (const query of ['page=0', 'page=1.5', 'limit=0', 'limit=101', 'limit=bad', 'sort_by=unknown', 'sort=bad']) {
      expect((await request(`?${query}`)).status, query).toBe(400)
    }
    expect((await request('', '')).status).toBe(401)
    expect((await write('PUT', reader.cookie)).status).toBe(403)
    expect(await stored()).toEqual([])
    expect((await write('PUT')).status).toBe(200)
    expect(await stored()).toEqual([{ active: true }])
    expect((await (await request(`?search=${fixtures[0]!.permissionCode}`)).json()).data[0].assigned).toBe(true)
    expect((await write('DELETE', reader.cookie)).status).toBe(403)
    expect(await stored()).toEqual([{ active: true }])
    expect((await write('DELETE')).status).toBe(200)
    expect(await stored()).toEqual([{ active: false }])
    expect((await (await request(`?search=${fixtures[0]!.permissionCode}`)).json()).data[0].assigned).toBe(false)
  } finally {
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId))
    await db.delete(roles).where(eq(roles.id, roleId))
    await db.delete(permissions).where(inArray(permissions.id, fixtures.map(({ id }) => id)))
    await cleanupSessions()
  }
}, 60_000)
