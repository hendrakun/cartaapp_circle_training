import { test, expect } from './fixtures'
import { requiredE2eValue } from './state'

test('session lifecycle: login, dashboard, reload, logout', async ({ authenticatedPage: page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible()
  await page.reload()
  await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible()
  const apiUrl = requiredE2eValue('E2E_API_URL')
  const me = await page.request.get(`${apiUrl}/me`)
  expect(me.ok()).toBe(true)
  const identity = (await me.json()).data
  expect(identity.user.email).toBe('admin@example.com')
  expect(identity.roleCodes).toContain('administrator')
  const adminCookies = await page.context().cookies()
  await page.request.post(`${apiUrl}/api/auth/sign-out`, { headers: { Origin: requiredE2eValue('E2E_WEB_URL') } })
  await page.context().clearCookies()
  const after = await page.request.get(`${apiUrl}/me`)
  expect(after.status()).toBe(401)
  expect(adminCookies.length).toBeGreaterThan(0)
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/auth\/login/)
})

test('unauthenticated /me is 401', async ({ page }) => {
  const apiUrl = requiredE2eValue('E2E_API_URL')
  const response = await page.request.get(`${apiUrl}/me`)
  expect(response.status()).toBe(401)
})
