# Plan 021: Generate browser submissions without a copy dependency

## Status

- Priority: P1
- Effort: S
- Risk: LOW
- Category: bug, tests
- Depends on: None
- Planned at: `c9b11b7`, 2026-09-14, with the uncommitted skill revision from this task
- Status: DONE — 2026-09-14, in working tree uncommitted (no commit per scope)

## Why this matters

Generated browser tests select English button text. The application can use
`Simpan`, so a correct form can fail its generated test. Submit through the
existing native submit control and keep the create/edit/reload assertions.

## Current state

- `scripts/scaffold-bounded-module.mjs:819` and `:831` generate:
  `await page.getByRole('button', { name: /save|submit/i }).click()`.
- `scripts/scaffold-bounded-module.test.mjs:301` asserts that exact selector.
- `packages/loom/src/components/views/FormView.vue:205` uses
  `<Button type="submit" ...>`. Its label comes from framework UI defaults.
- `scripts/scaffold-bounded-module.test.mjs:292` has the existing
  `slim browser journey proves create, edit, and reload persistence` test.
  Reuse its temporary workspace and generated-spec setup.
- The generator already omits the former web integration copy tests. Preserve
  that behavior. A generated journey is proof only of its actual assertions.

Carta uses Node ESM for tools, Node's test runner for tool tests, and Playwright
for application browser tests. Use installed dependencies. No package change is
needed to select the existing native submit button.

## Scope and git workflow

Change only `scripts/scaffold-bounded-module.mjs`,
`scripts/scaffold-bounded-module.test.mjs`, and this plan/index status.
Temporary browser fixtures belong in an owned temporary directory. Do not edit
`packages/`, application source, existing module journeys, dependency files or
the user's untracked Divisions/Employees/Projects work. Do not commit or push.

## Commands and steps

Run all commands from the repository root.

1. Check drift with `git diff c9b11b7 -- scripts/scaffold-bounded-module.mjs scripts/scaffold-bounded-module.test.mjs`.
   Expected: the excerpts above still identify the two submit sites and test.
   Also inspect `git status --short`; preserve unrelated changes.
2. Add a browser regression in the existing Node test file. Generate the journey
   in its temporary workspace. Execute the generated submit step against a small
   real browser form with `Save`, `Submit`, and `Simpan` labels. The form must
   observe a submit event; include an unrelated button to catch broad selection.
   Load Playwright from the installed web package with `createRequire`, following
   the existing tool pattern. This needs no database or app server.
   Run `node --test --test-name-pattern='submit' scripts/scaffold-bounded-module.test.mjs`.
   Expected before the fix: the non-English case fails for the selector, not setup.
3. Change both generated submit sites to use the native submit control, scoped
   to the active form when needed. Keep response waits, submitted values, edit
   behavior and reload checks intact. Do not force a label on application forms.
   Run the same focused command. Expected: all selected cases pass, with no skip.
4. Run `node --test scripts/scaffold-bounded-module.test.mjs` and
   `git diff --check`. Expected: all tests pass and no whitespace errors.
   Inspect the diff, then update this plan and `plans/README.md` with results.

## Done criteria

- Generated create and edit submit steps work with all three labels.
- The test observes native submission, rather than only matching source text.
- Existing create/edit/reload and generator-scope tests pass.
- `git diff --check` exits 0; only the permitted files changed for this plan.

## STOP conditions

Stop and report if the native submit control is no longer available, browser
binaries are unavailable, or the fix needs framework/application edits. Report
setup failures separately from regression failures. After three failed runs of
the same check, report the evidence and cause before further work.

## Maintenance

If form submission changes, review this generator contract with FormView. Keep
locale-specific product copy outside standard generated assertions. This plan
does not fix the hand-written journeys from the forward test.

## Results — 2026-09-14

- Drift check: `git diff c9b11b7 -- scripts/...` exits 0. No drift.
  Tree is otherwise clean except untracked `opencode.jsonc`.
- New regression `generated submit steps work with translated submit labels`
  extracts both generated submit steps and runs them verbatim through
  real Chromium against `Save`, `Submit`, and `Simpan` forms.
  Before the fix it fails with a 30s timeout on
  `getByRole('button', { name: /save|submit/i })` for the `Simpan` label.
- Fix: both generated sites now emit
  `await page.locator('form button[type="submit"]').click()`.
  FormView renders one `Button type="submit"` per form
  (`FormView.vue:205`, inside `Form.vue:390` `<form>`).
  No label is forced on application forms. Waits, values, edit, and
  reload checks are intact.
- `node --test scripts/scaffold-bounded-module.test.mjs`: 21 pass, 0 fail.
- `git diff --check`: exit 0.
- Changed files: `scripts/scaffold-bounded-module.mjs`,
  `scripts/scaffold-bounded-module.test.mjs`, this plan.
