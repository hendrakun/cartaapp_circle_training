# Plan 022: Report raw interactive controls for UI review

## Status

- Priority: P1
- Effort: S
- Risk: MED — a new review result can affect callers
- Category: tests, dx
- Depends on: None
- Planned at: `c9b11b7`, 2026-09-14, with the uncommitted skill revision from this task
- Status: DONE — 2026-09-14, in working tree uncommitted (no commit per scope)

## Why this matters

The UI checker accepts a raw button beside a declared View. This can hide a
replacement for a supported framework control. Report that control for source
review. A raw element is not automatically a defect, and a static check cannot
decide whether a framework gap is valid.

## Current state

- `scripts/module-ui-check.test.mjs:22` accepts
  `check(page.replace('<Button>Close</Button>', '<button>Close</button>')).errors`
  as an empty array.
- `scripts/module-ui-check.mjs`, `checkUiContract`, walks the Vue template AST.
  It collects component tags and slots, then returns `{ errors, review }`.
  Native interactive tags currently add no review item.
- Its CLI uses exit 0 for static pass, 1 for defects, and 2 for required review.
- `.agents/skills/web-ui-surfaces/references/ui-contract.md` defines the current
  surface `gap`, reviewer responsibility, and these exit codes.
- The test `CLI keeps an exception separate from a passing check` in
  `scripts/module-ui-check.test.mjs` is the CLI example to extend.

Use the existing Vue AST walk and Node test runner. Keep the current contract
shape; a second parser or exception registry is unnecessary. The application
uses shared Loom controls, but native layout elements are normal HTML.

## Scope and git workflow

Change only `scripts/module-ui-check.mjs`, `scripts/module-ui-check.test.mjs`,
`.agents/skills/web-ui-surfaces/references/ui-contract.md`, and this plan/index.
Do not edit framework packages, application controls, or unrelated checker rules.
Read `writing-for-agents` and `skill-creator` before the skill reference edit.
Preserve existing working changes. Do not commit or push.

## Commands and steps

Run from the repository root.

1. Run `git diff c9b11b7 -- scripts/module-ui-check.mjs scripts/module-ui-check.test.mjs .agents/skills/web-ui-surfaces/references/ui-contract.md`.
   Compare live behavior with the excerpts and run
   `node --test scripts/module-ui-check.test.mjs`. Expected: current tests pass.
   Find callers with `rg -n 'module-ui-check|checkUiContract' scripts .agents/skills`.
   Confirm that the existing exit-2 review path remains usable.
2. Extend the AST walk to add a review item for native `button`, visible `input`,
   `select`, and `textarea` controls. Include file, line and tag. Exclude literal
   `input type="hidden"`; a dynamic type needs review. Preserve `errors` for
   actual structural failures. A surface gap can explain a control, but cannot
   automatically approve it. Use the existing review list and gap field.
   Run `node --test scripts/module-ui-check.test.mjs` after adding cases for each
   tag, hidden/dynamic input types, and native layout wrappers.
   Expected: raw controls require review; framework controls and layout remain valid.
3. Extend the CLI test to prove exit 2 for a raw control, exit 0 for a standard
   framework control, and exit 1 for an unresolved component. Update the reference
   to state what the checker detects and how the reviewer resolves it.
   Run `node --test scripts/module-ui-check.test.mjs scripts/module-skills.test.mjs`.
   Expected: all tests pass, including reference validation.
4. Run `git diff --check`, inspect the complete diff, and update this plan/index.
   Expected: no whitespace error and no new changes outside scope.

## Done criteria

- Tests prove native controls reach `review`, with file and line information.
- Standard framework controls, hidden inputs and layout elements retain their behavior.
- CLI exit codes remain 0/1/2 with their current meanings.
- Both selected Node test files pass. The reference describes static limits.

## STOP conditions

Stop if a caller treats exit 2 as acceptance and cannot be corrected inside this
scope, or the installed AST does not expose the required tag/attribute data.
Do not extend this into a general accessibility linter or automatic UI rewrite.
After three failed runs of one check, report the evidence before further work.

## Maintenance

Review framework reuse from actual source. This check covers explicit native
controls only; dynamic components and behavior inside child components still
need source review. Add another tag only after an observed omission justifies it.

## Results — 2026-09-14

- Drift check: `git diff c9b11b7 -- scripts/module-ui-check.mjs scripts/module-ui-check.test.mjs .agents/skills/web-ui-surfaces/references/ui-contract.md` exits 0. No drift.
- Baseline before the change: 8 tests pass. Caller search finds no live
  caller of `checkUiContract` or `module-ui-check` outside the checker,
  its test, plans, and reports, so no caller treats exit 2 as acceptance.
  The existing exit-2 path (surface `gap`) stays usable; the new items
  reuse the same review list and exit code.
- Change: the AST walk reports each native `button`, visible `input`,
  `select`, and `textarea` as `file:line: native <tag> needs source review
  against the shared controls`. A literal `type="hidden"` input stays
  silent; an absent, dynamic, or spread type needs review. Native layout
  elements add no item. `errors` still carry structural failures only,
  and a surface `gap` explains a requirement without approving the item.
- Reference update states what the checker detects and how the reviewer
  resolves each item (replace with the shared control or keep it for the
  named `gap` requirement). It repeats the static limits: explicit native
  controls only, child-component behavior still needs source review.
- `node --test scripts/module-ui-check.test.mjs scripts/module-skills.test.mjs`:
  18 pass, 0 fail (11 checker + 7 skills, including reference-link validation).
- `git diff --check`: exit 0.
- Changed files: `scripts/module-ui-check.mjs`,
  `scripts/module-ui-check.test.mjs`,
  `.agents/skills/web-ui-surfaces/references/ui-contract.md`, this plan.
