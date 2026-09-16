import { afterAll, describe, expect, it } from 'vitest'
import { hashPassword } from 'better-auth/crypto'
import { eq } from 'drizzle-orm'
import { app } from '../../app'
import { closeDb, getDb } from '../../db'
import { users } from '../(authenticated)/users/users.entity'
import { accounts, sessions } from './auth.entity'

function id(prefix: string) {
  return `auth-route-test-${prefix}-${crypto.randomUUID()}`
}

async function credentialUser(statusCode: 'active' | 'non_active') {
  const db = getDb()
  const userId = id(statusCode)
  const email = `${userId}@example.invalid`
  await db.insert(users).values({ id: userId, name: 'Auth Test User', email, statusCode })
  await db.insert(accounts).values({
    id: id('account'),
    accountId: userId,
    providerId: 'credential',
    userId,
    password: await hashPassword('test-password'),
  })
  return { userId, email }
}

describe('authentication session admission', () => {
  afterAll(() => closeDb())

  it('creates sessions for active credentials and rejects inactive credentials', async () => {
    const active = await credentialUser('active')
    const inactive = await credentialUser('non_active')
    const origin = 'http://frontend.example:4173'
    const signIn = (email: string) => app.request('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify({ email, password: 'test-password' }),
    })

    const activeResponse = await signIn(active.email)
    expect(activeResponse.status).toBe(200)
    expect(activeResponse.headers.get('Access-Control-Allow-Origin')).toBe(origin)
    expect((await getDb().select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, active.userId)))).toHaveLength(1)

    const inactiveResponse = await signIn(inactive.email)
    expect(inactiveResponse.status).toBe(401)
    expect(await getDb().select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, inactive.userId))).toHaveLength(0)
  })
})
