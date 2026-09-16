# Plan 024: Prove shared form controls once

Optional follow-up, not a prerequisite for the standard-module skill trial.
The short path reuses current control contracts and retains focused proof for
known gaps. Do not claim these proposed helpers already exist.

## Status

- Priority: P1
- Effort: M
- Risk: MED
- Category: tests, dx
- Depends on: None
- Planned at: `9720b43`, 2026-09-14
- Status: IMPLEMENTED — 2026-09-14 at `218b325`, evidence below

## Why this matters

Module workers repeat lookup and calendar interaction tests and repair their
selectors. Framework unit tests cover some behavior, but mocked controls leave
browser gaps. Close those gaps at the framework owner. Keep module tests focused
on actual field configuration, business rules and persistence.

## Current state

- `packages/loom/src/components/composites/__tests__/LookupInput.spec.ts`
  replaces Dialog and Table with `vi.mock`. It proves selection state and label
  hydration, not real dialog operation.
- `packages/loom/src/components/inputs/__tests__/datepicker-popup.spec.ts`
  uses `vi.mock('@vuepic/vue-datepicker', ...)`. It proves wrapper behavior,
  not selection through the real calendar.
- `packages/loom/src/components/views/__tests__/views.spec.ts` already tests
  `resets filters without clearing search or limit` and asserts `page: 1`.
- `packages/loom/src/fields/__tests__/behavior.spec.ts` already tests
  `resets a field when the resetWhen identity changes`.
- `packages/loom/src/components/views/__tests__/ListView.browser.spec.ts`
  is an existing browser pattern: mount with `createApp`, install the router
  and FrameworkPlugin, unmount after each case. Its current case tests switching
  collection presentation, not filter controls.
- `packages/loom/vitest.browser.config.ts` has an explicit `test.include` list
  and a Chromium provider. Add selected files to that list.
- `apps/web/e2e/fixtures.ts` owns application browser fixtures. Its API health
  wait does not establish that navigation reached the intended form.

These tests were inspected, not run, during planning. A test name is not proof
of a current pass. The revised skill ownership rule requires actual evidence.

## Scope and boundaries

When selected for execution, this plan permits framework **test** changes:
the named Loom test files, new LookupInput/DateInput browser specs beside them,
small test-only helpers/fixtures, and `vitest.browser.config.ts`. It also permits
one shared application E2E control-helper file and a focused helper regression
spec under `apps/web/e2e/`. Reuse existing helpers if they meet the contract.
Update this plan, `plans/README.md`, and the module UI automation reference with
exact verified helper and test pointers.

Do not change production components, business modules, public exports, package
dependencies, database data or existing application acceptance requirements.
Do not create a generic driver framework or a new test runner. Preserve dirty
work. Do not commit or push. Report a component accessibility defect if it
prevents stable control use; this plan does not authorize a production repair.

## Steps and checks

1. Run `git diff 9720b43 -- packages/loom apps/web/e2e` and compare the owners
   above with current code. Inspect only direct control owners and existing
   helpers needed for these tests. Record reused coverage and the exact gap.
   Run `pnpm --dir packages/loom test` and
   `pnpm --dir packages/loom test:browser`. Expected: existing cases pass;
   preserve any baseline failure separately.
2. Add focused real-browser lookup and date tests using the existing mount
   pattern. Cover selection/commit and initial edit value display. Operate the
   actual dialog/table/calendar; stub only the data service. Use explicit dates
   and named records. Check focus return or overlay closure where it affects
   completion. Extend the existing ListView browser test only for an uncovered
   real filter-control integration; reuse existing query/reset state tests.
   Run `pnpm --dir packages/loom test:browser`. Expected: selected new cases
   execute and pass, with no control replaced by a mock.
3. Reuse or add the smallest application test helpers for page readiness,
   named lookup selection and date input. Their inputs identify the target page,
   field and value; they must not depend on field order, the current month or
   application submit text. Keep assertions about business outcomes in callers.
   Add a browser regression with a local fixture that starts on a previous page
   with a matching control, then reaches the target form. Prove the helper acts
   on the target field, including when two lookups exist. Use Playwright's local
   page fixture without database preparation; do not inherit the application
   reset fixture for this test. Run the focused spec with the installed
   Playwright runner and an isolated test-only config with no app webServer or
   setup dependency. Record the exact command. Expected: real browser pass with
   no API/database access. Include that config in the permitted test-only files.
4. Run `pnpm --dir packages/loom test`,
   `pnpm --dir packages/loom test:browser`,
   `pnpm --dir packages/loom type-check`, and `pnpm test:module-tooling`.
   Expected: all pass. Record commands, revision, tested behavior and gaps in
   the handoff; link the exact helpers from the UI automation reference. Run
   `git diff --check`; expected exit 0. Review the diff against scope.

## Done criteria

- Real lookup/calendar cases pass in the existing framework browser runner.
- The helper regression fails if it acts on the previous page or wrong field.
- Existing state tests remain authoritative; no repeated module control matrix
  or copied field-list assertions are added.
- All commands above pass, or the plan remains blocked with exact failed checks.
- Evidence and exact helper pointers are recorded. Update the index after review.

## STOP conditions and maintenance

Stop affected work if a stable helper requires a production component change,
new dependency, live data reset or an out-of-scope repair. After two failures
at one interaction, inspect the active page and artifacts before another edit.
Future control changes update these tests and helpers at their owner. Module
tests still prove actual schema, relations, access and stored effects.

## Evidence — 2026-09-14 at `218b325`

Drift: `git diff 9720b43 -- packages/loom apps/web/e2e` is empty. Owners are
unchanged. Reused coverage stays valid. Gap stays as planned: mocked Dialog
and Table in `LookupInput.spec.ts`, mocked picker in
`datepicker-popup.spec.ts`. State tests in `views.spec.ts` and
`behavior.spec.ts` stay authoritative. No repeat of that state cover.

New framework browser proof, no `vi.mock` on controls:

- `packages/loom/src/components/composites/__tests__/LookupInput.browser.spec.ts`
  opens the real Dialog, clicks the row for Option two in the real Table,
  clicks Simpan, and checks model `two`, label Option two, and dialog close.
  It also checks initial scalar `one` shows Option one by stub `loadDetail`.
- `packages/loom/src/components/inputs/__tests__/DateInput.browser.spec.ts`
  mounts DateInput with the real picker inline. It shows initial
  `2026-02-15` as active day 15, clicks day 20, and checks model
  `2026-02-20` and active day 20. It also checks empty stays null until a
  calendar day commits.
- `packages/loom/vitest.browser.config.ts` adds the two new specs to the
  explicit `test.include` list. Chromium provider stays.

New application helper proof, local fixture only, no API or database use.
Fixture mirrors real Loom output, with portals. No invented
`data-form-field`, `combobox`, `listbox`, or `option` roles.

Portal behavior, verified in owners:

- Lookup Dialog renders via reka DialogPortal to `body`
  (`DialogContent.vue`). The Loom browser spec finds it with
  `document.body.querySelector('[role="dialog"]')`. The dialog holds no
  field key. Only one dialog is visible at a time.
- Datepicker menu teleports to `body` by default (`DateInput.vue`
  `:teleport` default true). The Loom browser spec mounts with
  `teleport: false` and `inline: true` only for test mount. Helpers match
  production and use body scope.

Real DOM selectors used:

- Page scope: `section` with heading name, e.g. Target Form. This proves
  navigation reached the target form. API health alone does not prove it.
- Field scope: `.is-form-field` with `label[for="field-<key>"]`. This is
  the Form.vue contract. Field `<key>` is `assignee`, `reviewer`, `due`.
  Scope covers the trigger and the input, never the portal.
- Lookup trigger: `div.overlay` in the field scope. This is the
  LookupInput.vue trigger.
- Lookup dialog: single visible `[role="dialog"]` at page scope, found
  after the scoped trigger click. `toHaveCount(1)` proves no second
  dialog. Table row: `getByRole('row', { name: option })` on `table`
  with `thead` and `tbody`, e.g. Option two. Row click follows the
  TableContent `tr` row-click contract. Commit: `getByRole('button',
  { name: 'Simpan' })`, the framework commit label in the dialog. Close is
  proved by wait for dialog hidden. A missing record rejects. The helper
  then sends Escape and waits for close, then rethrows. No silent
  wrong-row commit is possible. The fixture dialog holds a SearchBox
  input, as real LookupInput does.
- Date: `.dp__input` click in the field scope opens body-level
  `.dp__menu`. The fixture nests no menu in the field. Day click uses
  `.dp__cell_inner:not(.dp__cell_offset):not(.dp__cell_disabled)` with
  exact day text from the ISO value, e.g. `2026-02-20` picks day `20`.
  Pass proves the scoped input value changed. Menu close timing is
  picker-owned and stays out of the helper contract.

- `apps/web/e2e/form-controls.ts` owns `waitForFormField(page, target,
  field, wait?)`, `selectLookupOption(page, target, field, option,
  wait?)`, and `fillDateField(page, target, field, value, wait?)`. Each
  takes target page identity, field key, value. Locators use page and
  field scope for trigger and input, page scope for the single visible
  portal. No order use. No current month use. No application submit text
  use. No business assertions in helpers.
- `apps/web/e2e/form-controls.spec.ts` keeps both previous page and target
  form present. Target starts hidden. Readiness fails while hidden. Past
  that, it proves helper acts on reviewer Option two while target
  assignee stays idle and dialog closes, then on target assignee Option
  one while the previous live assignee stays at Option one and dialog
  closes, then date due `2026-02-20` in the scoped input. Negative cases:
  readiness rejects before target opens; missing record Option nine
  rejects, both fields stay at prior text, previous stays idle, dialog is
  hidden; wrong field `owner` rejects; previous page holds no target
  heading. Rejects use short timeouts to keep run time sane.
- `apps/web/playwright.control-helpers.config.ts` is the isolated test-only
  config. No app webServer. No setup use.

Commands run, all pass:

- `pnpm --dir packages/loom test`: 57 files pass, 447 tests pass.
- `pnpm --dir packages/loom test:browser`: 7 files pass, 25 tests pass.
  New specs add 4 tests to prior 21.
- `pnpm --dir packages/loom type-check`: pass.
- `pnpm test:module-tooling`: 96 Node tests pass, 3 Python tests pass.
- `pnpm --dir apps/web exec playwright test --config playwright.control-helpers.config.ts`:
  1 test passes in real Chromium, no server start.
- `git diff --check`: exit 0.
- Note: `pnpm --dir apps/web type-check` fails on clean tree too. It reports
  a missing `divisionId` type in app user code. This failure is out of scope.
  Plan scope needs no app type-check. Required loom type-check passes.

Tested behavior: real lookup select and commit, initial lookup label,
real calendar day select and commit, helper page and field scope on
target form with live previous-page control present, missing-record
reject with closed dialog and idle fields.
Gaps: overlay focus return is not asserted. Dialog warns it lacks Title
and Description in test mount. ListView browser file gains no new filter
case. Existing state tests cover reset behavior. The local helper
fixture mirrors Loom DOM with portals but is not the live app. Date helper waits
for input value change, not menu close. Date callers must pin the
picker month with an explicit initial value for a fixed day pick.

Helper pointers: use `apps/web/e2e/form-controls.ts` for page readiness,
named lookup choice, and date fill. See case in
`apps/web/e2e/form-controls.spec.ts`. See framework proof in the two new
Loom browser specs. UI reference links these files.
