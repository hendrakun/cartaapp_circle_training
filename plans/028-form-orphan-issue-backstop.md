# Plan 028: Make silent Form validation failures impossible (orphan-issue backstop)

> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 783ac5d..HEAD -- packages/loom/src/components/core/Form.vue packages/loom/src/validation/select.ts packages/loom/src/components/core/__tests__/form.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Authority note**: this plan touches `packages/loom` (framework). Per
> `AGENTS.md`, framework changes need explicit user authority. The user
> authorized exploring this backstop as a plan; DO NOT implement until the
> operator confirms framework authority for Loom in the execution request. If
> the dispatch message does not name Loom authority, STOP before Step 2.

## Review record (parent review, 2026-09-15)

APPROVED with no revision. Parent independently verified: full loom jsdom
suite 57 files/450 tests pass (includes existing `:455` initialData pattern +
3 new tests), loom type-check exit 0, `git diff --check` clean. No other
`validateDraftAsync` callers exist (only Form.vue; barrel re-export
untouched). `visibleKeys` naming collision with table-preferences code is
cosmetic only (separate scopes, no shared import). Known limit (subagent
declared): prod toast+alert branch is review-only — jsdom runs
`NODE_ENV=test` → dev-throw branch; parent read the prod branch and confirms
it mirrors the existing root-issue toast pattern. Loom authority was granted
by the operator before dispatch.

## Status

- **Priority**: P2 (defense in depth; plans 026+027 are the gate)
- **Effort**: S
- **Risk**: MED — touches shared Form behavior; must not break the valid
  `initialData`-supplied pattern
- **Depends on**: plans/026-form-write-schema-seam.md (the type seam is the
  primary fix; this plan never substitutes for it)
- **Category**: correctness | dx
- **Planned at**: commit `783ac5d`, 2026-09-15
- **Issue**: omit (no `--issues` flag)

## Why this matters

Even with the type seam, schemas can still fail at runtime (refinements,
unions, nested paths, server-driven rules). Today such a failure can be
SILENT: `Form.vue` shows only issues mapped to visible fields
(`displayedIssues`, Form.vue:177) and toasts only root-path issues
(submit(), Form.vue:357). An issue whose `path[0]` names a valid-but-absent
field (the reported `createdByUserId` case) renders nowhere and blocks submit
with an enabled button. The existing `assertNoHiddenRequiredFields`
(`validation/select.ts:59`) covers only behavior-hidden keys, not absent keys.

This plan adds a narrow invariant: **a failed validation issue with no visible
input must never pass silently.** In development it throws (visible in
`exposed().submit()` rejections and console); in production it toasts and
renders a form-level alert. This is explicitly NOT the delivery gate (module
delivery runs no Form submit path — E2E excluded per the verification
strategy); it is the last-resort visibility net.

## Current state

Facts inlined; the implementer has not seen prior conversation.

- `packages/loom/src/components/core/Form.vue`:
  - `:177` — `displayedIssues` filters to `issue.path.length === 0 ||
    submitAttempted || touched[path[0]]`; rendering matches per-field via
    `issueFor(key)` (`:178-180`).
  - `:254` — `validate()`; `:350` — `submit()`; `:355-360` — on failure,
    toasts only `displayedIssues` with `path.length === 0`, then
    `focusFirstInvalid()` and return (submit action never called).
  - `:324-328` — `watch(hiddenKeys, ...)` already drops issues for hidden fields.
- `packages/loom/src/validation/select.ts`:
  - `:59-69` — `assertNoHiddenRequiredFields(schema, hiddenKeys)` throws only
    for `requiredKeys ∩ hiddenKeys`. No absent-key check.
  - `:103-122` — `validateDraftAsync` orchestrates schema + custom validators.
- Valid pattern that MUST keep working
  (`form.spec.ts:455` "keeps initial data for fields outside the rendered
  form projection"): schema requires `projectId`, no rendered field, value
  supplied via `initialData` → validation SUCCEEDS → submit called with
  `{ projectId, name }`. The backstop fires on FAILED issues only, so this
  stays green.
- Test pattern: `packages/loom/src/components/core/__tests__/form.spec.ts`
  mounts `Form` via `mountCore(Form, props, { renderers/inputProps })` and
  drives `view.exposed().submit()` / `form` submit events; `vue-sonner` toast
  is mocked (`mocks.toastError`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Loom type-check | `pnpm --filter @southneuhof/loom type-check` | exit 0 |
| Loom focused test | `pnpm --filter @southneuhof/loom test -- src/components/core/__tests__/form.spec.ts src/validation/__tests__/validation.spec.ts` (from repo root via turbo `pnpm test --filter ...` or `pnpm --dir packages/loom test -- <paths>`; use the repo's observed command) | all pass |
| Lint | repo's loom lint command in check mode | exit 0 |

Observed root commands: `pnpm test` (turbo across packages), `pnpm
type-check` (turbo), `pnpm lint` (turbo). Prefer package-scoped variants
above; record the exact command used.

## Suggested implementation toolkit

- None beyond the Loom sources named here.

## Scope

**In scope** (the only files you should modify):
- `packages/loom/src/validation/select.ts` (orphan-issue detection helper +
  wiring into `validateDraftAsync`, OR a pure helper exported for Form — pick
  one owner, not both)
- `packages/loom/src/components/core/Form.vue` (partition failed issues;
  dev-throw; production toast + form-level `role="alert"`)
- `packages/loom/src/components/core/__tests__/form.spec.ts` (three new tests)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):
- `apps/**` — app migration is plan 027.
- `apps/web/src/framework/hono/entity.ts` — plan 026's seam; do not rework it here.
- Any renderer, behavior, query, router, or style change.
- `validateDraft` sync path semantics beyond adding the same guard if trivially
  shared; do not redesign validation orchestration.

## Git workflow

- Stay on the current session branch/worktree; do NOT create a branch.
- Default: uncommitted changes for parent review. No push, no PR.

## Steps

### Step 1: Confirm authority and the silence reproduction

**Do**:
1. Confirm the dispatch message explicitly authorizes `packages/loom`
   changes. If not, STOP (report "framework authority missing").
2. Write a scratch reproduction (NOT committed): mount `Form` with fields
   `{ name }`, schema `z.object({ name: z.string(), createdByUserId:
   z.string() })`, no value for `createdByUserId`; submit; observe: submit
   NOT called, no `[role="alert"]` names `createdByUserId`, no toast.
   Delete the scratch file after observing.

**Verify**: silence reproduced (submit not called, nothing visible) → the
gap this plan closes is real on this checkout. If instead an error IS shown,
STOP and report (the premise changed).

### Step 2: Add orphan-issue detection (one owner)

**Do**: In `validation/select.ts` (preferred) add and export:

```ts
export function orphanValidationIssues(
  issues: readonly ValidationIssue[],
  visibleKeys: readonly string[],
): ValidationIssue[] {
  const visible = new Set(visibleKeys)
  return issues.filter((issue) => issue.path.length > 0 && !visible.has(String(issue.path[0])))
}
```

Wire into `validateDraftAsync`: after `schemaResult` fails, compute orphans
against `options.hiddenKeys` is NOT enough — the caller (Form) must pass
visible keys. Smallest change honoring "one owner": extend
`AsyncDraftValidationOptions` with optional `visibleKeys?: readonly string[]`
and, when a failed schema result has orphans AND `visibleKeys` was provided:
- development (`process.env.NODE_ENV !== 'production'`): throw
  `Error('[loom] Form validation failed for fields with no visible input:
  <keys>. ...')` naming each `path.join('.')` + message and the fix
  ("add the field, supply the value with initialData/load, or remove the key
  from the form schema").
- production: attach `orphanIssues` to the returned result (mirror the
  existing `operationalIssues` pattern, `:99-121`) so Form can render them;
  do NOT throw.

Keep `assertNoHiddenRequiredFields` untouched.

**Verify**: loom `type-check` → exit 0.

### Step 3: Form renders/throws orphans (never silent)

**Do**: In `Form.vue` `validate()`/`submit()`:
1. Pass `visibleKeys.value` (already computed, `:137`) into
   `validateDraftAsync`.
2. In `submit()` failure branch: if result carries `orphanIssues` (or recompute
   via the helper from `issues.value` + `visibleKeys.value` — pick ONE source):
   - dev: let the throw propagate (do NOT swallow in try/catch); ensure
     `exposed().submit()` rejects so jsdom tests observe it.
   - prod: `toast.error(...)` naming the keys AND render a form-level
     `<p role="alert">` (or existing error container if one exists — check the
     template first; do not add a second competing container) listing them.
3. Do NOT change `displayedIssues` filtering for mapped issues; do NOT change
   the valid `initialData`-supplied pattern (no issues → no orphan path).

**Verify**: type-check exit 0.

### Step 4: Three tests + full focused suites

**Do**: Append to `form.spec.ts`:
1. `rejects submit with the orphan-field error when a required key has no
   visible input` — schema requires absent key, no value → `await
   expect(view.exposed().submit()).rejects.toThrow('no visible input')`;
   submit mock NOT called.
2. `submits when the unrendered required value is supplied with initialData`
   (locks the `projectId` pattern): same schema shape, value in
   `initialData` → submit called with the full payload.
3. `reports a nested orphan path` (e.g. `address.city` required, no field) →
   rejects naming `address.city`.
4. Run the FULL `form.spec.ts` + `validation.spec.ts` suites → all pass
   (proves no regression to mapped errors, hidden-field behavior, validators).

**Verify**: new tests pass; full focused suites pass; lint exits 0;
`git status --short` shows only in-scope files; `git diff --check` clean.

## Test plan

- The three tests above, modeled on existing `mountCore` + `submit()`-rejects
  patterns in `form.spec.ts` (e.g. the renderer/schema compatibility test
  at `:181-201` uses `await expect(view.exposed().submit()).rejects.toThrow`).
- No new runtime spec files. No E2E (excluded from module delivery by policy).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Loom `type-check` exits 0
- [ ] Three new `form.spec.ts` tests exist and pass
- [ ] Full `form.spec.ts` + `validation.spec.ts` suites pass
- [ ] Valid `initialData`-supplied pattern still submits (test 2 + existing
      `:455` test pass)
- [ ] Only in-scope files modified; `git diff --check` clean
- [ ] Authority for `packages/loom` is recorded in the execution report

## STOP conditions

Stop and report back (do not improvise) if:

- Framework authority for Loom is absent from the dispatch.
- "Current state" excerpts don't match (drift).
- Step 1 does NOT reproduce silence (premise changed).
- The throw breaks `form.spec.ts:455` or any existing suite beyond the three
  new tests — the trigger condition is wrong (must be failed-issues-only).
- The fix needs renderer/behavior/query/router changes, or any `apps/**` edit.
- Verification fails twice after a reasonable fix attempt.

## Maintenance notes

- This backstop catches runtime-only failures (refinements, unions, nested
  paths) that types cannot see. It is the net, not the gate: plans 026+027
  prevent the defect class at type-check; this plan makes any escape visible.
- Reviewer: scrutinize the dev/prod branch (`NODE_ENV` check) and that the
  dev throw cannot reach production bundles. Also confirm the form-level
  alert uses a single `role="alert"` container (no duplicate live regions).
- If `validateDraftAsync` gains more callers, each must pass `visibleKeys`
  or accept no orphan detection — document the parameter as required for
  form surfaces.
