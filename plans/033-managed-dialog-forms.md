# Plan 033: Make managed dialog forms the normal path

## Status

- Priority: P1
- Effort: M
- Risk: MED
- Category: migration
- Depends on: None
- Planned at: `5cafda4`, 2026-09-17
- Status: DONE — implemented and independently reviewed on 2026-09-17

## Implementation evidence

- The completion-order regression failed before the fix: the submitted
  listener received open state `[true]` instead of `[false]`; the other 24
  focused tests passed.
- Focused DialogForm and TableInput tests: 30 passed.
- Loom type check: passed.
- Loom suite: 454 passed.
- Web consumer type check: passed; route generation produced no diff.
- Web consumer suite: 229 passed.
- Both changed skill folders passed `quick_validate.py`.
- `git diff --check`: passed.
- The named forward-test stash and database were not used.

Execute this plan only when implementation is requested. Read it in full first.
Update the row in `plans/README.md` after implementation and review.

## Why this matters

A managed form in a dialog should own visibility. Ordinary callers should supply
the action, fields and trigger without open refs or manual close assignments.
Use one dialog per action or record; a shared dialog with changing props is an
advanced choice, not the default. Keep controlled visibility available for an
explicit coordination or measured performance need.

The user approved these requirements: failed submission preserves input and
keeps the dialog open; success closes it before application listeners run;
a later refresh failure does not become a failed save. No new public session,
controller, global manager or shared action state is required.

## Current state

- `packages/loom/src/components/composites/DialogForm.vue:29` already declares
  `defineModel<boolean>('open', { default: false })`. Without an external binding,
  Vue keeps this state in the component. Preserve this supported default.
- `DialogForm.vue:118` currently completes in the wrong order:

  ```ts
  function handleSubmitted(result: unknown) {
    emit('submitted', result)
    if (props.closeOnSubmitted) open.value = false
  }
  ```

- Its `#trigger` slot supplies the existing trigger bindings and `setOpen`.
  `beforeClose`, validation, pending-input handling and `closeOnSubmitted: false`
  are existing contracts to preserve.
- `packages/loom/src/components/composites/form-inputs/TableInput.vue:92` and
  `:119` already use separate trigger-owned create and row-edit dialogs. This is
  the implementation example to follow. It updates form-owned rows without RPC.
- `packages/loom/src/components/composites/__tests__/DialogForm.spec.ts:49`
  provides a harness that always passes an external `open` ref and listener.
  It proves controlled behavior but gives weak evidence for the intended default.
  It mocks the base dialog. Preserve those focused tests and add a real-base
  integration test for trigger behavior.
- `packages/loom/src/components/core/Form.vue:374` awaits the submit target and
  emits `submitted`. Its catch reports rejected writes. It cannot infer which
  part of an arbitrary callback is a write and which part is refresh.
- `packages/loom/src/resources/actionResource.ts:580` and `:609` await standard
  resource invalidation before returning. These objects are cached and shared;
  they must not own per-dialog visibility or draft state.
- `.agents/skills/web-ui-surfaces/references/surfaces.md:66` shows an external
  `v-model:open` in the standard example. Change this example to the managed path.
- The forward-test application is absent from this checkout. It is saved in the
  named stash `penilaian-kerja-rekanan forward-test 20260917` and backup branch
  `backup/penilaian-forward-test-20260917`. Do not apply, drop or edit that stash.
  The current production `DialogForm` callers are the two `TableInput` sites.
- `DESIGN.md` requires shared controls, bottom-right form actions, preserved
  input on failure, and separate saved/stale-data feedback. Preserve these rules.

## Target usage and ownership

```vue
<DialogForm v-bind="entries.update({ id: record.id })" title="Edit Entry">
  <template #trigger>
    <Button>Edit</Button>
  </template>
</DialogForm>
```

Place this inside the existing row-action slot only where contextual editing is
required. Keep standard routed Edit actions elsewhere. Use stable record keys
for repeated dialogs. Custom forms retain the current `schema`, `fields`, and
`submit` props. They need no new resource or state wrapper.

Default: dialog-owned visibility. Advanced option: existing `v-model:open` for
an explicitly coordinated caller. Retain the existing name and type; do not add
a second component, alias or mode flag. Document the advanced option separately.

On success, update visibility before emitting `submitted`. On validation or write
failure, keep the same form and draft available. Preserve the explicit
`closeOnSubmitted: false` option. Do not close merely because an attempt starts
or because a component unmounts.

For custom actions, keep the submit target limited to the operation. Use the
existing `submitted` notification for subsequent UI work. Handle refresh rejection
there as stale-data feedback through the existing app error/loading path. A
rejected refresh must not rerun the write or reopen the form. Standard resource
actions retain their normal invalidation; do not add duplicate refresh calls.

This plan does not promise draft or operation-state persistence across destruction
of the whole page. It removes the stale external-open-state pattern from normal
use. A remounted unmanaged dialog starts closed. Test that fact without claiming
that unmount is successful submission.

## Scope

Only these implementation files may change:

- `packages/loom/src/components/composites/DialogForm.vue`
- `packages/loom/src/components/composites/__tests__/DialogForm.spec.ts`
- `packages/loom/src/components/composites/__tests__/DialogForm.managed.spec.ts` (new)
- `packages/loom/src/components/composites/__type-tests__/dialog-form.type-test.ts`
- `packages/loom/src/contracts/components.ts` (contract comments only)
- `packages/loom/README.md`
- `docs/ui/forms.md`
- `DESIGN.md`
- `.agents/skills/web-ui-surfaces/references/surfaces.md`
- `.agents/skills/build-resource-form/SKILL.md`
- This plan and its index row.

Out of scope: resource-action state, query runtime changes, base Dialog behavior,
Form validation changes, application route redesign, database work, dependencies,
browser/E2E tests, restoring the forward test, and publishing packages.
TableInput already follows the target usage; prove it instead of rewriting it.

## Commands

Run from the repository root. Commands were resolved from current package scripts;
they were not executed during planning. Node and pnpm requirements are in the root
package file. Loom uses Vitest with jsdom and excludes browser specs.

| Purpose | Command | Expected result |
|---|---|---|
| Focused tests | `pnpm --filter @southneuhof/loom test src/components/composites/__tests__/DialogForm.spec.ts src/components/composites/__tests__/DialogForm.managed.spec.ts src/components/composites/__tests__/TableInput.spec.ts` | Selected tests pass |
| Loom types | `pnpm --filter @southneuhof/loom type-check` | Exit 0 |
| Loom suite | `pnpm --filter @southneuhof/loom test` | Exit 0 |
| Web consumer types | `pnpm --filter @southneuhof/framework-web type-check` | Exit 0; inspect generated route diff |
| Web consumer tests | `pnpm --filter @southneuhof/framework-web test` | Exit 0 |
| Whitespace | `git diff --check` | Exit 0 |

Loom has no lint script. Do not invent one for this change. Serialize type checks
and commands that generate route files. Do not run installs or database setup as
part of this migration. Report missing prerequisites.

## Steps

### 1. Confirm the baseline and add the regression

Run `git diff --stat 5cafda4..HEAD -- packages/loom docs/ui/forms.md DESIGN.md .agents/skills`
and `git status --short`. Compare changed owners with the excerpts above.
Run `rg -n 'DialogForm|v-model:open' apps/web/src packages/loom/src --glob '*.vue'`.
Classify actual DialogForm callers; ordinary Dialog, Popover and menu bindings are
not migration targets.

Add a completion-order assertion to the existing controlled harness: the external
visibility value must already be false inside the submitted listener. Keep an
explicit assertion for `closeOnSubmitted: false`.

Verify with the focused test command, initially omitting the not-yet-created
managed file. The new default-close ordering assertion must fail on current code;
existing cases must pass. Record the actual failure before implementation.

### 2. Make completion order safe and prove managed use

Change `handleSubmitted` to apply close-on-success before the notification.
Keep one close implementation and preserve controlled-mode updates.
In the new managed test file, use the real DialogForm, Form, base Dialog and
trigger. Reuse `mountCore`, `deferred` and `flush` from
`packages/loom/src/components/core/__tests__/harness.ts`; clean up teleported DOM
through the existing harness. Do not mock the visibility or submit boundary.

Cover these distinct outcomes:

- A trigger opens a dialog without an external open prop or listener.
- A valid submit runs once and closes; its submitted observer sees closed state.
- Validation and write rejection preserve entered values and allow correction.
- Two keyed row dialogs retain independent values and target the correct record.
- Removing and recreating a managed dialog does not reopen it from stale state.
- A successful submit followed by a rejected refresh reports stale data through
  the test host's refresh error path; no form write-error event, retry or reopening.
- Existing controlled visibility, close guard, pending input and explicit
  keep-open tests continue to pass.

Verify: focused tests and Loom type check pass. Keep tests about observable state
and results, not exact implementation text. Do not add a general persistence layer
to make the unmount case preserve data outside the approved contract.

### 3. Migrate the guidance to the managed default

Make `docs/ui/forms.md` the application guidance owner for managed versus controlled
use. Show the trigger-owned resource example first, then a custom operation with
separate post-success refresh/error handling. State that one dialog per record is
normal and does not require a shared selected-record ref.

Replace the standard external-open example in the surfaces reference. Link to the
forms guide for the advanced option. Update the form skill so it asks the framework
to own ordinary visibility and completion instead of recommending local close
assignments. Keep the supported loading guidance, without promising survival after
page destruction. Put only the visual/interaction convention in DESIGN.md and the
component contract in the Loom README. Preserve unrelated rules.

Extend the type test to demonstrate the managed prop shape while preserving the
existing controlled shape. Keep Form and DialogForm submit types aligned.

Verify: `rg -n 'DialogForm|v-model:open' docs/ui/forms.md .agents/skills/web-ui-surfaces/references/surfaces.md .agents/skills/build-resource-form/SKILL.md` shows managed examples first; each remaining DialogForm external-open example is explicitly advanced. Run Loom types and `git diff --check`; both pass.

### 4. Review the whole migration

Run the Loom suite, web consumer types, and web consumer tests. Review the diff
against Scope. Re-run the caller search: no normal DialogForm caller should require
external visibility or manual success-close code. Preserve ordinary Dialog callers.
Update the index with checks, source revision and any gaps. Record REWORK for a
required missing check rather than claiming completion from test counts.

## Done criteria

- The completion-order regression failed before the fix and passes afterward.
- All managed behavior cases and existing controlled cases pass.
- Type checks and non-browser suites above pass.
- Examples use the managed path; controlled use is clearly marked advanced.
- No new public state concept, helper requirement or shared dialog state exists.
- No file outside Scope changed; forward-test stash and database are untouched.
- Index status and evidence reflect the actual result.

## STOP conditions

- Current source no longer matches the relevant ownership or completion sequence.
- A required check fails twice after a focused repair.
- Real trigger behavior requires a base Dialog or Form contract change.
- Standard invalidation produces a failed-save result after a committed write.
  Record the exact failing test and request a scoped resource-contract plan;
  do not hide the failure or silently change every action's return semantics.
- The solution requires a global owner, changes to resource memoization, or another
  public abstraction. Revisit the requirement before implementation expands.

## Git and maintenance

Preserve unrelated work. No commit, push or PR is authorized by plan execution
alone. If a commit is requested later, use the existing conventional style, such
as `fix(loom): close managed forms before completion events`.

Future controlled callers must name their coordination need. Future row-dialog
changes must preserve record identity and failure recovery. When the forward test
is restored in a separate authorized task, replace its shared create/edit dialog
and external-open refs with this documented pattern; do not restore it here.

Planning inspected only the relevant Loom form, dialog, resource and query seams,
tests, guidance and package/CI commands. API, security, deployment and whole-repo
performance audits were not performed. Runtime verification remains unrun.
