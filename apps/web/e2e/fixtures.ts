import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
import { test as base, expect, type Page, type APIRequestContext, type TestInfo } from '@playwright/test'
import { isE2eIteration, prepareForTest } from './state'

const apiRoot = resolve(__dirname, '../../api')
const knownSecrets = new Set<string>()

function localEnv() {
  const env = {
    ...parse(readFileSync(resolve(apiRoot, '.env'))),
    ...parse(readFileSync(resolve(apiRoot, '.env.e2e'))),
  }
  for (const value of [env.CARTA_ADMIN_EMAIL, env.CARTA_ADMIN_PASSWORD]) if (value) knownSecrets.add(value)
  return env
}

async function waitForApi(page: Page) {
  const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:5180'
  await expect
    .poll(async () => (await page.request.get(`${apiUrl}/health`)).ok(), {
      timeout: 30_000,
      message: 'The E2E API health route did not respond.',
    })
    .toBe(true)
}

async function login(page: Page) {
  const env = localEnv()
  const email = env.CARTA_ADMIN_EMAIL
  const password = env.CARTA_ADMIN_PASSWORD
  if (!email || !password) throw new Error('The local administrator credentials are missing.')

  await page.goto('/auth/login')
  await page.getByRole('textbox').first().fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'))
}

let fastAuthState: Awaited<ReturnType<APIRequestContext['storageState']>> | undefined

function diagnostics(page: Page, testInfo: TestInfo) {
  const values = { console: [] as string[], pageErrors: [] as string[], requests: [] as object[], responses: [] as object[] }
  const dropped = { console: 0, pageErrors: 0, requests: 0, responses: 0 }
  const add = <K extends keyof typeof values>(key: K, value: (typeof values)[K][number]) => {
    if (values[key].length < 100) values[key].push(value as never)
    else dropped[key]++
  }
  const cleanText = (value: string) => {
    for (const secret of knownSecrets) value = value.replaceAll(secret, '[redacted]')
    return value.slice(0, 1_000)
  }
  const cleanUrl = (value: string) => {
    const url = new URL(value)
    if (url.pathname.startsWith('/api/auth/')) return `${url.origin}/api/auth/[omitted]`
    return `${url.origin}${url.pathname}`
  }
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === 'warning' || message.type() === 'error') add('console', cleanText(message.text()))
  }
  const onPageError = (error: Error) => add('pageErrors', cleanText(error.message))
  const onRequestFailed = (request: { method(): string; url(): string; failure(): null | { errorText: string } }) =>
    add('requests', { method: request.method(), url: cleanUrl(request.url()), error: cleanText(request.failure()?.errorText ?? 'unknown') })
  const onResponse = (response: { status(): number; url(): string; request(): { method(): string } }) => {
    if (response.status() >= 400) add('responses', { method: response.request().method(), url: cleanUrl(response.url()), status: response.status() })
  }
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  page.on('requestfailed', onRequestFailed)
  page.on('response', onResponse)
  return async () => {
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
    page.off('requestfailed', onRequestFailed)
    page.off('response', onResponse)
    if (testInfo.status !== testInfo.expectedStatus) {
      try {
        await testInfo.attach('diagnostics.json', { body: Buffer.from(JSON.stringify({ ...values, dropped }, null, 2)), contentType: 'application/json' })
      } catch {
        // Keep the original test failure.
      }
    }
  }
}

export const test = base.extend<{ authenticatedPage: Page; e2eState: void; fastAuth: boolean; failureDiagnostics: void }>({
  fastAuth: [false, { option: true }],
  e2eState: [
    async ({ browserName: _browserName }, use) => {
      prepareForTest()
      await use()
    },
    { auto: true },
  ],
  storageState: async ({ e2eState: _e2eState, fastAuth, playwright }, use) => {
    if (!fastAuth || !isE2eIteration()) {
      await use({ cookies: [], origins: [] })
      return
    }
    if (!fastAuthState) {
      const env = localEnv()
      const email = env.CARTA_ADMIN_EMAIL
      const password = env.CARTA_ADMIN_PASSWORD
      if (!email || !password) throw new Error('The local administrator credentials are missing.')
      const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:5180'
      const webUrl = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5181'
      const request = await playwright.request.newContext({ baseURL: apiUrl })
      try {
        const signIn = await request.post('/api/auth/sign-in/email', {
          data: { email, password },
          headers: { Origin: webUrl },
        })
        if (!signIn.ok()) throw new Error(`Fast E2E sign-in failed with status ${signIn.status()}.`)
        const me = await request.get('/me')
        if (!me.ok()) throw new Error(`Fast E2E identity check failed with status ${me.status()}.`)
        const identity = (await me.json()).data
        if (identity.user.email !== 'admin@example.com' || !identity.roleCodes.includes('administrator')) {
          throw new Error('Fast E2E identity did not match the seeded administrator.')
        }
        fastAuthState = await request.storageState()
      } finally {
        await request.dispose()
      }
    }
    await use(fastAuthState)
  },
  failureDiagnostics: [
    async ({ page }, use, testInfo) => {
      const finish = diagnostics(page, testInfo)
      try {
        await use()
      } finally {
        await finish()
      }
    },
    { auto: true },
  ],
  authenticatedPage: async ({ page, fastAuth }, use) => {
    await waitForApi(page)
    if (!fastAuth || !isE2eIteration()) await login(page)
    await use(page)
  },
})

export { expect }
