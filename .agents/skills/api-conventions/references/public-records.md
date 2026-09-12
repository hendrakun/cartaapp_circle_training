# Public records and files

## Read shape

Return the data needed to display and edit a record without per-row lookups.
Use declared relations for ordinary related records. Keep output schemas narrow:
internal columns, credentials, and unrestricted related objects are not public
because a database query returned them.

Use scope `enrich: { schema, run }` for conversion shared by list/detail/create/
update. The schema validates the public record. Its callback runs once per list
row: keep it free of database and remote I/O. Use list `enrich` to fetch derived
data for all returned IDs, then join by ID with a `Map` or `Set`. Return early
for an empty list. Query only the extra data, not the base row again.

Route enrichment runs after scope enrichment. Preserve the declared public shape
when adding operation-specific fields. Keep detail/create/update display data
consistent so a saved form can render immediately. A custom route must apply its
own public schema; scope enrichment does not run for `defineRoute`.

Use focused context endpoints only when a form needs a bounded set of dependent
choices or derived defaults that normal resource reads cannot supply. Scope
those choices by the caller and current selection. Large choice sets remain
searchable and paginated; do not return an entire business hierarchy by default.

## Selection values

`selectionValues(exactItemSchema)` in `src/schema.ts` is the multi-selection
contract. Its items are objects with the exact keys the field uses; `id` and
`name` are not universal. Use `selectionQuery` for the corresponding JSON query
value. Coordinate with `$build-resource-form` when changing these fields.

Resolve submitted identity keys on the server, validate membership and allowed
state, and read current labels from storage. A client-supplied display label is
not authoritative. Reject duplicate choices where the relation is a set. Return
the same public object-array shape after a write.

## Stored files

Reuse `storedAssetSchema`, `storedAssetInput`, and `uploadKey` from
`src/schema.ts`, and the current conversion functions in `src/storage/assets.ts`.
External URLs need a separate explicit schema. Do not persist temporary signed
download URLs.

For standard and custom file writes, follow the shared
[asset-object contract](../../carta-module-development/references/frontend-field-contract.md#asset-fields).
Use `z.input` for the HTTP shape and `z.output` for parsed persistence values.

Use `storedAssetModel(publicSchema)` for canonical records and
`publicRecord(publicSchema, value)` for a custom result when these fit. Convert
at the public-record boundary; do not add response-wide JSON parsing or custom
field wrappers to turn keys into URLs.

File access needs the product's permission and ownership rules. A valid key
format or authenticated session alone does not prove access to that object.
Check download, attach, replace, and delete paths against the record's policy.
Validate allowed content type and size at the upload boundary. Client-declared
metadata alone cannot prove the uploaded bytes meet those limits; enforce the
required limit in storage or verify the stored object before accepting it.

Reuse `src/storage/s3.ts` for object operations. Coordinate database references
and object removal so a failed transaction cannot remove a still-used file.
Do not delete a shared object when one record stops referencing it. Add orphan
cleanup only when upload cancellation or retention requirements need it.
