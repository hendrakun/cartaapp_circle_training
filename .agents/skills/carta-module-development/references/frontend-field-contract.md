# Frontend field and input contract

Read this reference before a Carta web resource or form edit. The framework
owns the normal input behavior. A module declares only its domain difference.

## Public field shape

```ts
{
  label,
  display: { read?, renderer?, props?, format? },
  table: { ... },
  detail: { ... },
  form: { renderer?, props?, source?, validate?, write?, behavior? },
}
```

- If `display.read` is absent, display reads `record[field.key]`.
- If `form.write` is absent, submit keeps the control value unchanged.
- Do not add `(value) => value` or an identity display reader.
- There is no public top-level field `read` or `write`.
- Field `form.validate` replaces the renderer's default non-empty control-shape
  validation.

## Value and validation flow

```text
loaded API value
  -> framework prepares the control value
  -> live control draft
  -> input default or form.validate
  -> form.write, when present, on a shallow submit copy
  -> resource schema
  -> action business validators
```

Field authors do not configure another load or write path. The framework owns
the loaded-value preparation, and `form.write` remains the only field writer.

The framework runs field writers before the submit callback or resource
action. Submit callbacks and actions send their input unchanged. They do not
run a full-payload writer. Readiness checks inspect control values and do not
write them.

For a nested custom form block that has a non-asset submit conversion, put one
writer on the owning top-level field. Do not also write its child fields or
write the block again during submit. For assets, use the
[asset field contract](#asset-fields).

The live draft always keeps the control value. A writer is pure, changes only
its field on the submit copy, and never replaces a preview or selected record
in the live draft.

The input contract owns basic non-empty control shape:

- `number`: a finite JavaScript number;
- `file` and `image`: the [asset field contract](#asset-fields);
- `lookup` or `select` with `multi: true`: an array of exact selection record
  objects from the field schema. The schema must use
  `selectionValues(itemSchema)`; the framework rejects a missing or different
  schema and rejects `form.write`.

Empty values go to the resource schema. The resource schema owns requiredness
and the final submitted shape. Use action validators only for extra business
rules. For example, a number renderer already rejects text; use
`form.validate` only to replace that rule with a domain rule such as 1–15.

Built-in override parameters follow the renderer value type. An arbitrary custom
renderer receives `unknown` until its own contract narrows it. Check current
exports before relying on a planned type change.

## Objects and identifiers

Do not apply one identifier rule to all inputs:

- A database-backed single relation keeps its scalar ID or code as the write
  field. The API also returns the named relation object for display, and
  `display.read` reads its label. Do not fetch only to label it.
- A lookup field keeps the source resource identity separate from its `pick` and
  `view` keys. Use the source identity for detail, CRUD, and cache operations.
  When a pre-filled value uses a different picked key, load it through a loader
  that accepts that key or through returned list records. Never pass `pick` as a
  detail ID. Check a pre-filled lookup in the focused Playwright journey.
- A multi lookup or select keeps the exact selected records in the live draft
  and sends them unchanged. The backend extracts identity fields only at the
  persistence boundary, then sends current labels in the same record array.
  Do not map these values to IDs and do not add a field writer.

## Asset fields

Use the same field name and asset shape in API reads, the live form draft and
submitted writes. A single field contains `StoredAsset` (or `null` when allowed);
a multi field contains `StoredAsset[]`. Preserve every asset property, including
optional metadata. Array position carries UI order. Framework controls add no
category, row identity or ordering property to an asset.

The API owns `storedAssetSchema` and its inferred `StoredAsset` type in
`apps/api/src/schema.ts`. Use that schema for client parsing, including `fromZod`.
Use `storedAssetInput` only on the server to extract storage IDs. Its HTTP input
is still the complete object. Project stored IDs with the existing
`apps/api/src/storage/assets.ts` owner before returning records.

Reuse `apps/web/src/framework/adapters/assets.ts` and the input registry for
load, upload and preview. Keep asset objects through submission: no asset field
writer, client ID transform, copied asset type or per-action object reconstruction.
The contract applies to custom workflow actions as well as create/update.
Raw keys, URLs, partial objects and compatibility aliases are not asset values.

For ordinary collection edits, submit the desired complete array. On PATCH,
omission means unchanged; an included array replaces the collection; `[]` requests
clearing. Keep optional patch arrays free of empty-array defaults. The server
validates requiredness, access and allowed files before applying the collection
atomically through the existing persistence owner. Keep client add/remove diffs
out of this path. An existing domain command with different semantics needs an
authorized contract change before migration.

Business data belongs in the app. An app can declare separate asset fields or
wrap an asset in an app-owned record when its behavior requires extra fields.
Keep that record symmetric across its read/form/write path. A category is never
a framework asset requirement. Use the app's existing field extension for such
values; preserve the nested asset object.

The frontend preserves metadata; the server decides authoritative metadata and
can issue fresh URLs. Do not persist client URLs as authority. A stored key alone
does not preserve all metadata after reload. Removing a record association does
not authorize deletion of the shared file. Apply the module's concurrent-edit
policy and file-access rules on the server.

### Availability and proof

The object schema and app adapter exist. Multi-file field typing, uniform asset
validation, metadata refresh and form upload readiness are pending in
[plan 015](../../../../plans/015-symmetric-asset-fields.md). Inspect current source
before using those capabilities. Report a type/runtime mismatch at its owner;
use an authorized supported local extension only if it preserves this contract.
A cast or client conversion must not hide the mismatch. Remove this availability
note only after the implementation checks pass.

Use shared form readiness when available. Browser checks wait for upload and
model commit; filename presence does not prove completion. Existing upload
progress test IDs avoid dependence on translated copy. Keep module-specific
pending flags out of the normal form path.

For changed asset fields, prove unchanged save, addition, permitted removal or
clear, retained metadata and reload. Cover omitted PATCH separately from empty
arrays at the API boundary. Capture a real form submission and parse it through
the server input schema; a mocked action alone cannot prove symmetry. Reuse a
shared integration example when it exists, and keep business-rule tests local.

## Check the boundary

Trace one loaded value through the control, submit and stored result. For a
changed conversion, check a value that differs across those stages. For a
lookup, check a pre-filled selection and an invalid parent reference. For an
asset, use the checks in [Asset fields](#asset-fields). Use the [verification strategy](verification-strategy.md) to select
checks; repeated assertions of field configuration do not prove this flow.
