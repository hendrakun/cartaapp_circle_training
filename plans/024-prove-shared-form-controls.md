# Plan 024: Prove shared form controls once

## Status

- Priority: P1
- Effort: M
- Risk: MED
- Category: tests, dx
- Depends on: None
- Planned at: `9720b43`, 2026-09-14
- Status: TODO

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
