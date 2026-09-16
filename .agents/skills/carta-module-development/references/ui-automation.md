# Playwright UI evidence

This reference is for a separate, explicitly requested browser-testing task.
Never load or execute it as part of Carta module delivery, planning or review.
The design owns the visible
outcomes; the executor selects cases and data that demonstrate them.

## Scripted acceptance

Use saved Playwright Test TypeScript cases for that separate task. Agents run commands and
review reports; computer-controlled clicks are optional diagnosis, not a delivery
gate. Select actors, fixtures, steps and assertions from the approved outcomes.
Use IDs only when the full-process record has them; standard work needs no
journey inventory. Name meaningful steps. Keep UI-owned assertions
in browser tests and exhaustive access/state combinations at the API.

## Journey and data

Use focused Playwright cases with named steps that map to acceptance IDs.
Select only the separate task's requested paths. Give each selected journey an independent record and distinct
test title. Include child navigation when it changes. Exercise those actions through the visible authenticated UI, then
verify the persisted outcome by reload or navigation. API setup can create
fixtures and establish authenticated actors; it does not replace the interaction
being tested. For an approval journey, seed the pre-approval state and approve
through the UI. Loading an already-approved fixture proves display/reload only.
Start near the target action; test prerequisite creation separately.
Use full sequences when the sequence itself is an acceptance obligation.

Use the guarded E2E target, its dedicated database/storage and documented fixture
owners. Inspect the current `apps/api` E2E scripts, guard and `.env.e2e` setup;
never use the Vitest or development database/bucket for E2E reset. Serialize
preparation and tests sharing that target. Establish known fixtures once, then
rerun focused checks after a justified fix. Reprepare when a prior run changed
the required starting state. Seeded reference data is not disposable by default.

Confirm target configuration and service health. Use the package's Playwright
configuration and supported setup; it owns ports, projects, report paths and
server lifecycle. A development-only visual inspection does not establish the
required automated journey.

Reuse existing control helpers. Resolve the active page and named field before
operating a control; a matching control on the previous page is not readiness.
Keep framework control mechanics in shared test helpers, not module-specific
selector sequences. Use role and accessible-name locators, then stable test IDs when needed.
Select named fixture records; avoid the first arbitrary row. Fix the clock or
provide explicit dates for time-sensitive behavior. Wait for an observable
result, not a fixed delay. Keep test data isolated and cleanup tied to returned
record IDs, including after a failed assertion.

Shared control helpers now exist and pass. Use them. Do not copy new selector
sequences for the same controls. They use real Loom output. No test
attributes were added to production.

- `apps/web/e2e/form-controls.ts`: `waitForFormField(page, target, field, wait?)`,
  `selectLookupOption(page, target, field, option, wait?)`,
  `fillDateField(page, target, field, value, wait?)`. Page scope uses the target
  heading. Field scope uses `.is-form-field` plus `label[for="field-<key>"]`
  for the trigger and the input. Both overlays portal to `body`: the lookup
  dialog via DialogPortal, the date menu via datepicker teleport. Helpers use
  the single visible body overlay, then prove ownership by scoped value
  change. Lookup opens `div.overlay`, asserts one visible dialog, clicks the
  dialog table row by name, clicks `Simpan`, waits for dialog close. A
  missing record rejects and closes the dialog with Escape. Date clicks
  scoped `.dp__input`, clicks the body menu `.dp__cell_inner` day from the
  ISO value, waits for scoped input change. No order use. No current month
  use. No application submit text use. No business assertions in helpers.
- `apps/web/e2e/form-controls.spec.ts`: proves helpers act on the target form
  while the previous live control stays present. Two lookup fields prove
  correct field scope. Explicit date `2026-02-20`. Missing record rejects
  with idle fields and closed dialog. Wrong field rejects.
- Run: `pnpm --dir apps/web exec playwright test --config playwright.control-helpers.config.ts`.
  Isolated config. No app server. No setup use. No API or database access.
- Framework proof: `packages/loom/src/components/composites/__tests__/LookupInput.browser.spec.ts`
  uses the real Dialog and Table. `packages/loom/src/components/inputs/__tests__/DateInput.browser.spec.ts`
  uses the real calendar. Run: `pnpm --dir packages/loom test:browser`.

## Evidence and diagnosis

Use the existing Playwright runner. Record final evidence under the
[verification strategy](verification-strategy.md#evidence-interface). Before execution, check the target and selected case IDs.
After execution, read JSON results and produce a compact summary: required,
executed, passed, failed and skipped IDs; failed step/assertion; report and attachment
paths. A missing case or an unexplained retry pass leaves its obligation incomplete.
The orchestrator checks assertions and source before granting acceptance.


Use the current focused `test:e2e` command and exact spec/test selector. Confirm
the expected cases actually ran, including denied/empty/failure cases selected
for the approved outcomes. Reuse a passing run when code, tests, relevant dependencies,
fixtures and environment are still applicable. A valid run need not be repeated
merely because it was initially called a debug run.

Preserve the configured JSON/HTML reports and relevant attachments under a
unique `plans/<feature>/reports/<run>/` directory before another run overwrites
working outputs. Preserve relative attachment layout or adjust links when
copying. Record the exact command, working directory, source state, environment
identity and cases/steps covered. Add the design revision and input snapshot
when the full process requires them.

Inspect the failed assertion and logs first, then screenshots, trace or DOM
snapshots as needed. Use interactive browser diagnosis only when artifacts leave
the cause unclear. Inspect these before changing selectors. A selector repair must still test the required interaction. Keep the
failed result and record its replacement pass. A screenshot alone does not
prove persistence, permission enforcement or successful submission.

When visual quality is required, capture selected Playwright screenshots for
review; functional assertions alone do not prove layout quality. Use image
comparison only against an approved baseline.

Use the separate task's scope for acceptance. A selected browser obligation without executable browser evidence
remains blocked; backend, lint and type checks do not silently replace it.
