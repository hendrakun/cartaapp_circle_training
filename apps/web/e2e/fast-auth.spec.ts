import type { BrowserContext } from '@playwright/test'
import { test, expect } from './fixtures'

let firstContext: BrowserContext | undefined
let firstSession: string | undefined

test.describe('first fast session', () => {
  test.use({ fastAuth: true })

  test('loads Dashboard with fast auth', async ({ authenticatedPage: page }) => {
    firstContext = page.context()
    firstSession = (await firstContext.cookies()).find(({ name }) => name.includes('session'))?.value
    expect(firstSession).toBeTruthy()
    await page.goto('/dashboard')
    await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible()
    const response = await page.request.get(`${process.env.E2E_API_URL ?? 'http://127.0.0.1:5180'}/me`)
    expect(response.ok()).toBe(true)
  })
})

test('a UI session can log out', async ({ authenticatedPage: page }) => {
  const apiUrl = process.env.E2E_API_URL ?? 'http://127.0.0.1:5180'
  await page.request.post(`${apiUrl}/api/auth/sign-out`, {
    headers: { Origin: process.env.E2E_WEB_URL ?? 'http://127.0.0.1:5181' },
  })
  await page.context().clearCookies()
  expect((await page.request.get(`${apiUrl}/me`)).status()).toBe(401)
})

test.describe('second fast session', () => {
  test.use({ fastAuth: true })

  test('reuses fast auth in a fresh browser context', async ({ authenticatedPage: page }) => {
    expect(page.context()).not.toBe(firstContext)
    const session = (await page.context().cookies()).find(({ name }) => name.includes('session'))?.value
    if (process.env.E2E_ITERATION === '1') expect(session).toBe(firstSession)
    await page.goto('/dashboard')
    await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible()
    const response = await page.request.get(`${process.env.E2E_API_URL ?? 'http://127.0.0.1:5180'}/me`)
    expect(response.ok()).toBe(true)
  })
})
