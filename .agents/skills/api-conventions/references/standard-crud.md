# Resource contracts

## Entity and schema

Define the Drizzle table, write/select schemas, and `createEntity` together.
Group database entities with `defineDomainPart`. Put the entity in `+scope.ts`
and each resource operation in its `+server.ts` file.
Keep route placement and inheritance under the [file-routing contract](file-routing.md).

- Use database constraints for foreign keys, uniqueness, and valid stored values.
  Use Zod for request shape, normalization, and field errors. An enum belongs in
  the schema; it does not need a second function that checks the same strings.
- Omit primary keys, audit fields, ownership derived from identity, and other
  server-owned fields from client write schemas. Infer types from schemas or
  Drizzle. Keep `z.input` and parsed `z.output` distinct when transforms apply.
- Preserve field meaning: omitted patch values mean unchanged; `null` means
  cleared only where allowed. Validate a dependent-field change against the
  resulting record, not only the fields present in the patch.
- For immutable fields, implement the approved reject-or-ignore behavior and
  prove the stored value stays unchanged after a direct update request.
- Validate calendar dates as dates, not only text shape. Apply the declared
  blank/null rule before checking date order against the resulting record.
- Reuse `optionalText` for nullable text. Preserve each entity's audit-column
  nullability and foreign keys; identical names do not make definitions equal.
- Keep scalar relation IDs/codes in ordinary foreign-key writes. Put Drizzle
  relations in `defineRelationsPart` and nested relation select schemas in the
  entity select schema. The response must supply the display data the UI uses.
  Multi-selection and file fields use their distinct public contracts in
  [Public records](public-records.md).

## Canonical routes

Resource constructors are named method exports in `+server.ts`. Use the constructor that
matches the operation; it owns parsing, HTTP status, envelope, and missing-row
behavior. Do not replace it merely to customize persistence.

| Need | First choice |
|---|---|
| Default order, enum filters | `list({ query: { defaultSort, enumFilters } })` |
| Static search/order | Entity `read.searchColumns` / `read.pinnedOrder` |
| Computed filter or related search | Validated `read.virtual` predicate |
| Identity or fixed scope | Route `before` returning `{ where: (table) => predicate }` |
| Extra list data | `list({ enrich })`, with batch reads |
| Extra single-record data | `detail/create/update({ enrich })` |
| Domain validation | Write schema, then route `validate` for database rules |
| Referenced delete | `deleteGuard`, plus database integrity constraints |

Built-in coercion and list parsing need no hook. Keep client-selectable default
order distinct from mandatory `pinnedOrder`. Custom query predicates use the
provided column map so aliases remain correct. Scope applies to both rows and
counts; client filters cannot widen it.

For detail/update/delete, combine scope with the primary key in the source
operation. An inaccessible row returns the same 404 as an absent row. An access
read followed by an unscoped write is not sufficient. Validate newly selected
related records against the same ownership boundary.

When a relation must satisfy a mutable state rule at write time, keep the check
and write in one protected database operation. Choose constraints, locks or
isolation that preserve the rule under concurrent changes; a transaction alone
does not establish that guarantee. Apply the rule to create and relation moves.

`create-app.ts` installs `dataWrite: auditStamp()`. Only canonical create/update invoke
it. Its typed `operation` selects audit values; custom state named `values`
does not trigger it. Keep the returned server values out of client input.

## Custom persistence and HTTP actions

Use the factory's `run` only when its default source cannot perform the required
work. The current contracts are:

| Callback | Return |
|---|---|
| `list.run` | `{ data, total }` |
| `create.run` | One record |
| `update.run` | One record, or `undefined` for 404 |
| `deleteRoute.run` | `void`; throw `notFound()` when no valid row was affected |

There is no detail `run` hook. A `run` callback returns neither a `Response` nor
an HTTP envelope. It owns all custom persistence: apply `state.values` after
client values; apply `state.where` to scoped queries and writes; hydrate the
required relations. Prove these rules in focused tests. Manual list SQL must
keep filter/count agreement, pagination, and a stable primary-key tie order.

Use `defineRoute({ action, ... })` for a different HTTP contract. The file path
and method export own its location. Declare authorization and validate input
at runtime; infer output from the action. For JSON
writes, `openapi.requestBody` documents the schema but does not parse the body.
Use `readJsonBody` and `requirePathParam`. Return plain `{ data }`, or `created`
for 201. Use a `Response` for a real HTTP requirement such as redirect or stream.
Use Sprindle errors and their field issues; keep internal error details private.

Use `after` only to change the complete HTTP response. Record decoration belongs
before the envelope. Add a comment only when a custom contract's reason is not
clear from its implementation.

## Delete and migration

Choose hard delete, soft delete, or deactivation from record retention and
reference rules. Soft delete uses nullable `deletedAt`, with `softDeleteValues`
or `softDeleteRoute` when compatible. Check every read and write for liveness.
The current `softDeleteRoute` has no scope option; do not use it for a scoped
write without an equivalent atomic predicate in a local implementation.

Generate and review SQL with the entity change. Check existing-row backfills,
nullability, defaults, indexes for actual queries, and foreign-key effects.
Preserve applied migrations. Run migration or seed writes only on an authorized
target; tests use the guarded test target. Seeds should use stable business keys
and preserve unrelated records on a repeated run.
