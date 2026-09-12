# Plan 015: Keep asset fields symmetric through read, edit and submit

## Status

- Priority: P1
- Effort: M
- Risk: MED — changes public field typing and form submission timing
- Depends on: None
- Category: migration, dx, correctness
- Planned at: commit `fc5eeae`, 2026-09-12
- Status: TODO — source implementation is not authorized by this planning task

The user selected this migration. Execute it only when implementation is requested.
Keep existing work. No commit, push, package update or external-project write is
included. Update this plan and its index after implementation review.

## Outcome and boundaries

The frontend receives and submits the same asset field name, object shape and
cardinality. The form keeps complete asset objects through editing. A shared
asset has no category, attachment-row ID or ordering property. Applications own
such additions and their business rules.

```ts
// Existing API exports; import them rather than copying their definitions.
type FileFields = {
  document: StoredAsset | null
  attachments: StoredAsset[]
}

// Form/read schemas preserve objects. Server write schemas extract storage IDs.
const readFields = z.object({ attachments: storedAssetSchema.array() })
const patchFields = z.object({ attachments: storedAssetInput.array().optional() })
```

For a patch, omission leaves the collection unchanged; an included array is the
desired complete collection; `[]` requests clearing. Requiredness and access
remain server rules. Use no default empty array on an optional patch field.
Single values use `null` only when the module permits clearing. Preserve array
order through the frontend; an app that persists order must store it explicitly.

Symmetry applies to editable asset fields, not the entire resource record.
Record IDs and audit columns remain server-owned. The server can return fresh
URLs and authoritative metadata. Client URLs and metadata are never storage or
authorization authority. Frontend code must preserve all received asset fields;
this plan does not add a file-metadata database.

Use full collections for ordinary form edits. Existing domain commands with
explicit add/remove semantics need a separately approved API migration. When
an app uses categorized rows, keep that wrapper and its identity in the app;
the nested file remains a canonical asset. Do not copy SWA into this repository.

## Current state

All evidence below was read from this checkout. No runtime baseline was run.

| Owner | Evidence and implication |
| --- | --- |
| `apps/api/src/schema.ts:13` | `storedAssetSchema` owns the canonical HTTP object. `storedAssetInput` at line 25 extracts its ID on the server. Arrays already compose with `.array()`. |
| `apps/api/src/storage/assets.ts:65` | `projectStoredAssets` preserves valid objects and projects stored keys, including arrays. Keep this existing owner. |
| `apps/web/src/framework/adapters/assets.ts:11` | `readOne` validates against the API schema; `readValue` handles arrays. No module adapter is needed. |
| `apps/web/src/framework/inputs/registry.ts:44` | `file` and `image` already receive the shared adapter. |
| `packages/loom/src/fields/defineFields.ts:67` | `ImageFormProjection` has single/multiple typing. `file` falls into a renderer type that permits only `multi?: false`. |
| `packages/loom/src/components/core/Form.vue:187` | `assertInputSchemaCompatibility` checks image shape but omits file; its writer escape can bypass the object contract. |
| `packages/loom/src/renderers/inputProps.ts:69` | `imageValidate` validates asset controls. File has no matching built-in validator. |
| `packages/loom/src/components/inputs/FileInput.vue:114` | `syncPersistedRows` accepts retained string IDs and compares only ID, URL and name. Metadata-only refreshes can leave stale row values. |
| `packages/loom/src/components/inputs/ImageInput.vue:185` | Reordering adds `order_number` to asset objects. That field is outside the strict API schema. |
| `packages/loom/src/components/inputs/useUploadMutation.ts:8` | Pending tracks network work, but each input calls asynchronous `toModel` after `execute` settles. |
| `packages/loom/src/components/core/Form.vue:328` | Submission guards disabled/submitting/validating state, but no child upload state. |

Current type mismatch:

```ts
// packages/loom/src/fields/defineFields.ts
// Only image has the asset-array branch.
renderer: 'image'
props: Record<string, unknown> & { multi: true }
// The fallback used by file rejects it.
renderer: string
props?: Record<string, unknown> & { multi?: false | undefined }
```

Existing conventions: Vue composition functions, `defineFields`, `fromZod`, and
Vitest tests beside their owners. Use `deferred` and `mountInput` from
`packages/loom/src/components/inputs/__tests__/harness.ts` for upload timing.
Use `mountCore` from `components/core/__tests__/harness.ts` for form checks.
The existing browser example is `FileInput.browser.spec.ts`; its asset-to-ID
writer is not the new canonical example.

## Scope

Permitted source owners for later execution:

- `packages/loom/src/fields/defineFields.ts`
- `packages/loom/src/renderers/inputProps.ts`
- `packages/loom/src/components/core/Form.vue`
- `packages/loom/src/components/views/{FormView.vue,FormView.types.ts}` and
  `components/views/__tests__/views.spec.ts`
- `packages/loom/src/components/composites/DialogForm.vue` and
  `components/composites/__tests__/DialogForm.spec.ts`
- `packages/loom/src/components/core/useFormInputState.ts` — new private state owner
- `packages/loom/src/components/inputs/{FileInput.vue,ImageInput.vue,assetValue.ts,useUploadMutation.ts}`
- Their existing tests in `fields/__tests__`, `renderers/__tests__`,
  `components/core/__tests__`, `components/inputs/__tests__`, and
  `resources/__type-tests__/field-references.type-test.ts`
- `apps/web/src/framework/adapters/{assets.ts,assets.spec.ts,assets.form.spec.ts}`;
  `assets.form.spec.ts` is the new integration example
- `apps/web/src/framework/inputs/registry.ts`
- `apps/api/src/schema.spec.ts` and `apps/api/src/storage/assets.spec.ts`
- `packages/loom/README.md`, `docs/ui/forms.md`, and existing asset references in
  `.agents/skills/` when needed to remove the migration availability note
- This plan and its `plans/README.md` entry

Keep `apps/api/src/schema.ts` and storage implementation as existing contract
owners. Change them only if a failing contract test proves a necessary defect;
report that scope adjustment first. Keep application modules, migrations, auth,
S3 infrastructure, SDK, utilities, Sprindle and dependencies unchanged.

Loom remains independent of the Carta API schema. Its generic input contract is
an intentional package boundary, not permission for modules to copy asset types.
Reuse one asset type/validator inside Loom and the existing API adapter across
Carta. Do not add a new schema package, attachment service, or collection engine.

Sprindle already writes relation collections in a transaction:
`packages/sprindle/src/source/drizzle-source.ts:252` and `:473`. Native array
columns also accept replacement. Neither fact makes an arbitrary asset array
an entity relation. Select persistence in each app; add shared mechanics only
when an actual consumer proves the existing path insufficient.

## Commands

Run from the repository root. These commands were checked against package
scripts, not executed during planning. Tests must select nonzero cases.

| ID | Command | Expected result |
| --- | --- | --- |
| T | `pnpm --filter @southneuhof/loom type-check` | Exit 0; type regressions checked, including expected rejection cases |
| L | `pnpm --filter @southneuhof/loom test` | All Loom tests pass |
| B | `pnpm --filter @southneuhof/loom test:browser -- src/components/inputs/__tests__/FileInput.browser.spec.ts` | Selected Chromium cases pass |
| W | `pnpm --filter @southneuhof/framework-web test:focused -- framework/adapters/assets.spec.ts framework/adapters/assets.form.spec.ts` | Adapter and form boundary cases pass |
| A | `pnpm --filter @southneuhof/api test:focused -- src/schema.spec.ts src/storage/assets.spec.ts` | Schema/projection cases pass on guarded test target |
| WT | `pnpm --filter @southneuhof/framework-web type-check` | Exit 0 |
| AT | `pnpm --filter @southneuhof/api type-check` | Exit 0 |
| F | `pnpm --filter @southneuhof/framework-web lint:focused -- src/framework/adapters/assets.ts src/framework/adapters/assets.spec.ts src/framework/adapters/assets.form.spec.ts src/framework/inputs/registry.ts` | Exit 0 |
| D | `git diff --check` | Exit 0 |

Command A also compiles routes and applies migrations to the guarded test
configuration. Check its isolation and authority before running it. Do not use
an unguarded database command. B needs an installed Chromium binary; it does not
need the application database or S3. W uses the real adapter and schemas, with
only upload I/O stubbed. It is not proof of a live database or storage service.

## Execution order

Delegate one bounded result at a time unless the user requests direct execution.
Keep one worker responsible for the shared Loom files. Review the complete
result independently. Steps below are dependencies, not separate red/green
assignments. Reuse passing checks whose inputs remain current.

### 1. Make file and image field contracts agree

First reproduce `file` plus `multi: true` in the existing type-test file. Replace
image-only projection types with one shared asset projection for `file | image`.
Infer single versus array callback values, including overrides. Built-in asset
fields have no `form.write`: reject it in the field types and in Form's runtime
check, including dynamically resolved fields. Keep writers for other value types.

Use one asset validator for both renderers in `inputProps.ts`. Extend schema
compatibility checks to file; report the field and expected object/array shape.
For assets, direct the author to the public object schema and server-only ID
extraction. Do not suggest a client writer. Preserve existing selection rules.
Unknown/custom schemas still validate through their own runtime contract; do not
claim schema-kind inspection proves the full HTTP shape.

Verify: T and focused Loom tests with
`pnpm --filter @southneuhof/loom test -- src/renderers/__tests__/inputProps.spec.ts src/components/core/__tests__/form.spec.ts`.
Expected: single/multiple file and image fields compile without casts; invalid
writers, scalar schemas and malformed control values fail as intended.

### 2. Preserve values in controls

Keep complete canonical objects when loading, uploading, selecting from the file
manager, reordering and submitting. Correct FileInput's metadata-only refresh.
Remove retained raw-ID recovery from canonical file/image controls. Remove
`ImageAssetValue`'s `order_number` addition and normalization; order is array
position. Emit the reordered array unchanged to the owning form. No compatibility
branch should reintroduce those values.

Update built-in file/image tests that promote client ID writers. Preserve generic
writer coverage using non-asset values. Add cases for optional metadata, same-ID
metadata refresh, reordered arrays, unchanged save and malformed input. Keep the
existing single-file, concurrent-upload and cancellation checks.

Verify:
`pnpm --filter @southneuhof/loom test -- src/components/inputs/__tests__ src/components/core/__tests__/form.spec.ts`
then T. Expected: metadata survives; no framework property is added to assets;
malformed values are rejected; normal controls still work.

### 3. Centralize form upload readiness

Add one private form-scoped pending registry in `useFormInputState.ts`. Form
provides it; file/image inputs register each operation and release it in `finally`
and on disposal. Standalone inputs work without a provider. Nested controls use
the nearest form; state must not be global. Use operation tokens so concurrent
uploads cannot clear each other's state.

The pending interval includes upload, asynchronous `toModel`, and model commit.
Do not use network pending alone. Use the same computed state for Form's submit
guard, default button, exposed state and actions slot. Check it before validation
and again before sending if validation awaited. An attempted submit during
pending work returns without sending; it does not queue an automatic submission.
Keep errors visible and the draft intact; failure or cancellation releases only
its own operation. Preserve existing upload cancellation and ignore late results
from disposed controls. Test hide/unmount and form reset with pending work.

Expose additive `inputPending` state through Form and its actions slot. FormView
and DialogForm replace Form's actions: pass the state through their exposed/slot
contracts and disable their submit buttons too. Update DialogForm's local
`CoreFormExposed` type. Keep cancel/close policy unchanged; upload pending alone
must not prevent cancellation. Avoid module-specific flags.
Existing progress test IDs remain useful. Browser tests wait for completion and
the committed value, rather than filename presence or translated text alone.

Verify: focused input/form tests from step 2, then
`pnpm --filter @southneuhof/loom test -- src/components/views/__tests__/views.spec.ts src/components/composites/__tests__/DialogForm.spec.ts`,
T and B.
Expected: click, Enter and exposed `submit()` cannot send before value commit;
multiple uploads, delayed conversion, failure and disposal cannot leave the form
blocked or permit a partial payload.

### 4. Prove the symmetric boundary with one maintained example

Create `apps/web/src/framework/adapters/assets.form.spec.ts`. Use the actual
Form, `defineSchema`, `defineFields`, `fromZod`, application input registry and
asset adapter. Load canonical objects from a simulated API response. Capture the
actual submit payload and parse it with the API write schema. Stub upload I/O
only; keep field loading, validation, serialization and submission real.

Use an `attachments` array and a nullable single `document` field. Prove:

- Load A and save unchanged: submit A with all metadata and no category/order key.
- Add B: submit `[A, B]` once each, not an add/remove command.
- Remove A: submit `[B]`; clear: submit `[]` where allowed.
- Omit attachments in a patch: parsing preserves omission, not `[]`.
- Reject raw keys, partial objects and a client asset-to-ID transform.
- A denied or invalid write remains a server responsibility; the fixture must
  not claim that schema shape validation proves file ownership.

Extend API schema/projection tests for the matching array and omission cases.
Parse object arrays to storage IDs and project stored IDs back to object arrays.
Check required keys and authoritative values, not equality with client metadata
that the server does not persist. This example establishes the value contract,
not database rollback, S3 integrity or conflict resolution.

For a real module migration, server writes apply the desired collection atomically
inside the existing persistence owner. Preserve that module's concurrent-edit
policy; do not invent generic last-write-wins for protected workflows. Required
files and permissions must be validated before mutation. Removing an association
must not delete shared storage. These are app checks, not new framework columns.

Verify: W, A and WT. Expected: real form payloads pass the server input schema;
read values load and resubmit without a module writer, mapper, or field rename.

### 5. Align examples and complete review

Document the built-in asset object/array path and upload readiness in Loom's
README. Link the executable example from the existing asset skill reference.
Keep all asset convention definitions in that reference; other skills use a
conditional pointer. Mark framework gaps resolved only after their checks pass.
Keep category, relation identity, requiredness and authorization at app level.

Verify: L, B, W, A, T, WT, AT, F and D, reusing current passes from earlier steps.
Run `python3 /Users/gamer/.codex/skills/.system/skill-creator/scripts/quick_validate.py`
with each changed skill directory; if that tool is unavailable, report this check
as unverified and inspect frontmatter and links directly.

## Done criteria

- [ ] All commands in step 5 pass with nonzero selected test cases.
- [ ] Type tests accept single/multi file and image fields without casts and
  reject built-in asset writers.
- [ ] Form integration tests cover unchanged, add, remove, clear, omission and
  metadata preservation using real schemas and controls.
- [ ] Browser tests prove pending upload and delayed conversion prevent submit;
  wrapper tests cover FormView and DialogForm buttons and cancellation.
- [ ] Image reordering adds no property to an asset; refreshed metadata is used.
- [ ] The example uses the same field names and shapes for reads and writes.
- [ ] No new shared category schema, collection engine, dependency or DB migration.
- [ ] Independent review passes; plan/index status reflects observed results.

## Drift and stop conditions

Before execution run `git diff --stat fc5eeae..HEAD -- packages/loom apps/web/src/framework apps/api/src/schema.ts apps/api/src/storage`
and inspect `git diff` plus `git status --short` for uncommitted changes. The
existing uncommitted module-workflow skill edits are expected and must survive.
Compare current excerpts and callers before editing a changed owner.

Stop the affected step and report if the public asset contract has changed, a
required test target cannot be established safely, or a consumer needs a different
business contract. Preserve independent progress. Diagnose repeated failures
before retrying. Scope expansion to another package, a schema database, applied
migration or either external forward-test project requires a separate decision.

## Review scope and maintenance

This is a selected migration plan, not a full framework audit. Inspected: asset
schemas/adapters, field types, input controls, Form, related tests, package/CI
commands and existing relation writes. No dependency, production infrastructure,
performance, or unrelated module audit was performed. Runtime results remain
unverified until execution.

Rejected: a shared `category` wrapper, client attachment diffs, another asset
adapter, a new storage engine, and moving the API schema into a frontend package.
The observed SWA upload failure was a browser timing error. The pending-form gap
is a separate source finding and must receive its own regression test.

Future asset keys must be supported at the existing API and generic Loom
boundaries, with the adapter integration test checking agreement. App metadata
stays app-owned. Keep the executable example useful for agents; do not replace
its behavior checks with source-text or field-name assertions.

## Planning review — 2026-09-12

Independent source review found that FormView and DialogForm replace the default
actions; step 3 and scope now include both wrappers. Skill validators and local
Markdown link checks passed. GPT-5.6 Sol at low reasoning effort passed a bounded
decision test for collection payloads, application-owned photo details, and
current type/upload limits. This was not a module build or runtime test.
