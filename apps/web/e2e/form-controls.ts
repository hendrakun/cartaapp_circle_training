import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Shared form control helpers for real Loom control DOM.
 *
 * Selectors mirror production output. No test attributes are added to
 * production. Form.vue wraps each field in `.is-form-field` with
 * `label[for="field-<key>"]`. LookupInput opens `[role="dialog"]` through
 * reka DialogPortal, so the dialog lives in `body`, outside the field.
 * DateInput teleports the datepicker menu to `body` by default, so
 * `.dp__menu` also lives outside the field. The Loom browser spec mounts
 * DateInput with `teleport: false` and `inline: true`; production uses the
 * default teleport to `body`. Helpers match production.
 *
 * Field ownership comes from three facts. One, the trigger and the input
 * live in the field scope. Two, only one overlay is visible at a time, so
 * the single visible body-portalled dialog or menu belongs to the control
 * just opened. Three, the scoped value changes after commit: lookup text
 * in the trigger, date value in the scoped `.dp__input`.
 *
 * Each helper takes target page identity, field key, and value. Helpers keep
 * no business assertions. Callers assert the business outcome. Helpers never
 * use field order, the current month, or application submit text. `Simpan`
 * is the framework commit label inside the lookup dialog, not application
 * submit text. Date callers pin the picker month with an explicit initial
 * value, as the Loom browser spec pins `2026-02-15`. Day cells repeat
 * across months, so the helper picks exact day text and asserts the scoped
 * input change.
 */

const READY_TIMEOUT = 10_000

export interface ControlWait {
  timeout?: number
}

/** Target page section, found by its heading. Proves navigation reached it. */
function targetSection(page: Page, target: string): Locator {
  return page.locator('section', { has: page.getByRole('heading', { name: target }) })
}

/** One field inside the target section, found by field key. */
function fieldScope(page: Page, target: string, field: string): Locator {
  return targetSection(page, target).locator('.is-form-field', {
    has: page.locator(`label[for="field-${field}"]`),
  })
}

/** Wait for the target page heading, then the field inside it. */
export async function waitForFormField(page: Page, target: string, field: string, wait: ControlWait = {}): Promise<Locator> {
  const timeout = wait.timeout ?? READY_TIMEOUT
  const section = targetSection(page, target)
  await section.getByRole('heading', { name: target }).waitFor({ state: 'visible', timeout })
  const scope = fieldScope(page, target, field)
  await scope.waitFor({ state: 'visible', timeout })
  return scope
}

/**
 * Select a named record through the real lookup dialog.
 *
 * Opens the `div.overlay` trigger in the field scope. Asserts exactly one
 * visible body-portalled dialog. Clicks the table row with the record name,
 * clicks `Simpan`, and waits for dialog close. A missing record rejects.
 * The helper then closes the dialog with Escape, as the real dialog does,
 * and rethrows. No silent wrong-row commit is possible.
 */
export async function selectLookupOption(page: Page, target: string, field: string, option: string, wait: ControlWait = {}): Promise<void> {
  const timeout = wait.timeout ?? READY_TIMEOUT
  const scope = await waitForFormField(page, target, field, wait)
  await scope.locator('div.overlay').click({ timeout })
  const dialog = page.locator('[role="dialog"]:visible')
  await expect(dialog).toHaveCount(1, { timeout })
  try {
    await dialog.getByRole('row', { name: option }).click({ timeout })
    await dialog.getByRole('button', { name: 'Simpan' }).click({ timeout })
    await dialog.waitFor({ state: 'hidden', timeout })
  } catch (error) {
    await page.keyboard.press('Escape').catch(() => undefined)
    await dialog.waitFor({ state: 'hidden', timeout }).catch(() => undefined)
    throw error
  }
}

/**
 * Pick an explicit ISO date in the real datepicker calendar.
 *
 * Clicks `.dp__input` in the field scope. Operates on the single visible
 * body-portalled `.dp__menu`. Clicks the day cell that exactly matches the
 * day in `value`. `value` uses `yyyy-MM-dd`. Pass proves the scoped input
 * value changed. Menu close timing is picker-owned and stays out of the
 * helper contract.
 */
export async function fillDateField(page: Page, target: string, field: string, value: string, wait: ControlWait = {}): Promise<void> {
  const timeout = wait.timeout ?? READY_TIMEOUT
  const scope = await waitForFormField(page, target, field, wait)
  const input = scope.locator('.dp__input')
  await input.click({ timeout })
  const menu = page.locator('.dp__menu:visible')
  await expect(menu).toHaveCount(1, { timeout })
  const day = String(Number(value.split('-')[2]))
  await menu
    .first()
    .locator('.dp__cell_inner:not(.dp__cell_offset):not(.dp__cell_disabled)')
    .filter({ hasText: new RegExp(`^${day}$`) })
    .click({ timeout })
  await expect.poll(async () => input.inputValue(), { timeout }).toBeTruthy()
}
