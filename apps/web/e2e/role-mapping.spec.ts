import { test, expect } from './fixtures'

test.use({ fastAuth: true })

test('A-1 A-3 permission paging and optimistic updates', async ({ authenticatedPage: page }) => {
  await page.goto('/settings/roles')
  await expect(page.getByRole('table')).toBeVisible()

  const administrator = page.getByRole('row', { name: /administrator/ }).first()
  await administrator
    .getByRole('link', { name: /view|detail|lihat/i })
    .first()
    .click()
    .catch(async () => {
      await administrator.click()
    })
  await expect(page).toHaveURL(/\/settings\/roles\/.+\/detail/)

  const permissions = page.locator('section.is-list-view', { hasText: 'Permissions' }).last()
  await expect(permissions.getByRole('table')).toBeVisible()
  await expect(permissions.locator('nav[aria-label="Pagination"]')).toBeVisible()
  await expect(permissions.getByText(/Showing data \d+–\d+ out of \d+/)).toBeVisible()

  const switchChecked = (value: boolean) => permissions.locator(`[data-permission] button[aria-checked="${value}"]`).first()

  await expect(switchChecked(true).first()).toBeVisible()
  await expect(permissions.locator('nav[aria-label="Pagination"]')).toContainText('1 / 2')
  await permissions.getByRole('button', { name: 'Next page' }).click()
  await expect(permissions.locator('nav[aria-label="Pagination"]')).toContainText('2 / 2')
  await expect(permissions.getByText(/Showing data 11–20 out of 20/)).toBeVisible()
  await permissions.getByRole('button', { name: 'Previous page' }).click()
  await expect(permissions.locator('nav[aria-label="Pagination"]')).toContainText('1 / 2')

  const target = switchChecked(true).first()
  await expect(target).toBeEnabled()
  await target.click()
  await expect(permissions.locator('nav[aria-label="Pagination"]')).toContainText('1 / 2')
})

test('A-3 failed permission update', async ({ authenticatedPage: page }) => {
  await page.goto('/settings/roles')
  await expect(page.getByRole('table')).toBeVisible()

  const administrator = page.getByRole('row', { name: /administrator/ }).first()
  await administrator
    .getByRole('link', { name: /view|detail|lihat/i })
    .first()
    .click()
    .catch(async () => {
      await administrator.click()
    })
  await expect(page).toHaveURL(/\/settings\/roles\/.+\/detail/)

  const permissions = page.locator('section.is-list-view', { hasText: 'Permissions' }).last()
  await expect(permissions.getByRole('table')).toBeVisible()

  await page.route('**/roles/*/permissions/*', async (route) => {
    if (route.request().method() === 'PUT' || route.request().method() === 'DELETE') {
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ message: 'Denied' }) })
      return
    }
    await route.continue()
  })

  const target = permissions.locator('[data-permission] button').first()
  const before = await target.getAttribute('aria-checked')
  await expect(target).toBeEnabled()
  await target.click()
  await expect(page.getByText('Denied')).toBeVisible({ timeout: 10_000 })
  await expect(target).toHaveAttribute('aria-checked', before ?? 'false')
})
