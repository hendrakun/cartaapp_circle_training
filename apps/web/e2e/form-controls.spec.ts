import { test, expect } from '@playwright/test'
import { fillDateField, selectLookupOption, waitForFormField } from './form-controls'

/**
 * Local fixture that mirrors real Loom form output.
 *
 * Form.vue wraps each field in `.is-form-field` with
 * `label[for="field-<key>"]`. LookupInput shows a `div.overlay` trigger with
 * the display text. The dialog is a single body-level `[role="dialog"]`
 * with a SearchBox input, a `table` of `tbody tr` rows, and a `Simpan`
 * commit button, as reka DialogPortal renders to `body`. The datepicker
 * menu is a body-level `.dp__menu`, as DateInput teleports to `body` by
 * default. Neither overlay lives inside the field.
 *
 * Both the previous page and the target form stay present. The target form
 * starts hidden to mimic a page not yet reached. Helpers must fail while it
 * is hidden and pass after it opens. The previous `assignee` control stays
 * live, so an unscoped helper would act on the wrong field.
 */

const fixture = `
  <main>
    <section aria-label="previous page" data-page="previous">
      <h1>Previous Page</h1>
      <div class="is-form-field">
        <label for="field-assignee">Assignee</label>
        <div>
          <div class="overlay"><p>Option one</p></div>
        </div>
      </div>
    </section>
    <section aria-label="target form" data-page="target" hidden>
      <h1>Target Form</h1>
      <form>
        <div class="is-form-field">
          <label for="field-assignee">Assignee</label>
          <div>
            <div class="overlay" data-trigger="assignee"><p>Choose option</p></div>
          </div>
        </div>
        <div class="is-form-field">
          <label for="field-reviewer">Reviewer</label>
          <div>
            <div class="overlay" data-trigger="reviewer"><p>Choose option</p></div>
          </div>
        </div>
        <div class="is-form-field">
          <label for="field-due">Due</label>
          <div>
            <div class="dp__input_wrap"><input class="dp__input" value="" readonly /></div>
          </div>
        </div>
        <output data-result=""></output>
      </form>
    </section>
    <div role="dialog" data-dialog hidden>
      <input placeholder="Search..." />
      <table>
        <thead><tr><th>Name</th></tr></thead>
        <tbody>
          <tr><td>Option one</td></tr>
          <tr><td>Option two</td></tr>
        </tbody>
      </table>
      <button>Simpan</button>
    </div>
    <div class="dp__menu" data-menu hidden>
      <button type="button" class="dp__cell_inner">20</button>
    </div>
    <script>
      document.querySelector('[data-page="target"]').hidden = true
      const dialog = document.querySelector('[data-dialog]')
      const menu = document.querySelector('[data-menu]')
      let activeTrigger = null
      for (const trigger of document.querySelectorAll('[data-trigger]')) {
        trigger.addEventListener('click', () => {
          activeTrigger = trigger
          dialog.hidden = false
        })
      }
      for (const row of dialog.querySelectorAll('tbody tr')) {
        row.addEventListener('click', () => {
          dialog.dataset.picked = row.textContent.trim()
        })
      }
      dialog.querySelector('button').addEventListener('click', () => {
        if (activeTrigger) activeTrigger.querySelector('p').textContent = dialog.dataset.picked
        const scope = activeTrigger?.closest('.is-form-field')
        const label = scope?.querySelector('label')?.getAttribute('for')?.replace('field-', '')
        document.querySelector('[data-result]').dataset.result = label + ':' + dialog.dataset.picked
        dialog.hidden = true
        dialog.dataset.picked = ''
      })
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          dialog.hidden = true
          dialog.dataset.picked = ''
        }
      })
      const dateInput = document.querySelector('[data-page="target"] .dp__input')
      dateInput?.addEventListener('click', () => { menu.hidden = false })
      menu?.querySelector('.dp__cell_inner')?.addEventListener('click', () => {
        dateInput.value = '2026-02-20'
        document.querySelector('[data-result]').dataset.result = 'due:2026-02-20'
        menu.hidden = true
      })
    </script>
  </main>
`

test('control helpers act on the target form field', async ({ page }) => {
  await page.setContent(fixture)
  const previousAssignee = page.locator('[data-page="previous"] .overlay p')
  await expect(previousAssignee).toHaveText('Option one')

  // The target form is not reached yet. Field-scoped readiness fails.
  await expect(waitForFormField(page, 'Target Form', 'assignee', { timeout: 2_000 })).rejects.toThrow()

  // Reach the target form. The previous matching control stays live.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-page="target"]')!.hidden = false
  })
  await expect(previousAssignee).toHaveText('Option one')

  // Act on reviewer while two lookups exist. Assignee stays idle.
  await selectLookupOption(page, 'Target Form', 'reviewer', 'Option two')
  const result = page.locator('[data-page="target"] [data-result]')
  await expect(result).toHaveAttribute('data-result', 'reviewer:Option two')
  await expect(page.locator('[data-page="target"] [data-trigger="assignee"] p')).toHaveText('Choose option')
  await expect(page.locator('[role="dialog"]')).toBeHidden()

  // The previous page holds no target heading, so target scope cannot
  // match the wrong-page control.
  await expect(page.locator('[data-page="previous"]', { has: page.getByRole('heading', { name: 'Target Form' }) })).toHaveCount(0)

  // Act on the second lookup. The previous-page control stays idle.
  await selectLookupOption(page, 'Target Form', 'assignee', 'Option one')
  await expect(result).toHaveAttribute('data-result', 'assignee:Option one')
  await expect(previousAssignee).toHaveText('Option one')
  await expect(page.locator('[role="dialog"]')).toBeHidden()

  // Set an explicit date through the body-portalled calendar. Ownership is
  // proved by the scoped input value, not by menu nesting.
  await fillDateField(page, 'Target Form', 'due', '2026-02-20')
  await expect(result).toHaveAttribute('data-result', 'due:2026-02-20')
  const dueInput = page.locator('[data-page="target"] .is-form-field', { has: page.locator('label[for="field-due"]') }).locator('.dp__input')
  await expect(dueInput).toHaveValue('2026-02-20')

  // Missing record rejects and commits nothing. Both fields stay idle and
  // the dialog closes.
  await expect(selectLookupOption(page, 'Target Form', 'reviewer', 'Option nine', { timeout: 2_500 })).rejects.toThrow()
  await expect(page.locator('[data-page="target"] [data-trigger="reviewer"] p')).toHaveText('Option two')
  await expect(page.locator('[data-page="target"] [data-trigger="assignee"] p')).toHaveText('Option one')
  await expect(previousAssignee).toHaveText('Option one')
  await expect(page.locator('[role="dialog"]')).toBeHidden()

  // Wrong field fails: no owner field exists in the target form.
  await expect(selectLookupOption(page, 'Target Form', 'owner', 'Option one', { timeout: 2_000 })).rejects.toThrow()
})
