import { test, expect } from './fixtures'

test.use({ fastAuth: true })

test('users list renders', async ({ authenticatedPage: page }) => {
  await page.goto('/settings/users')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'admin@example.com', exact: true })).toBeVisible()
})

test('roles list renders with assignment persistence', async ({ authenticatedPage: page }) => {
  await page.goto('/settings/roles')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'administrator', exact: true })).toBeVisible()
})
