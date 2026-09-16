# Plan 029: Make one app schema seam support Hono and custom resource contracts

> **Implementation instructions**: Follow this plan step by step. Run each
> verification command and confirm its expected result before the next step.
> If a STOP condition occurs, stop and report it. Do not improvise. After the
> implementation and review pass, update this plan's status row in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 59ba2d1..HEAD -- apps/web/src/framework apps/web/src/router apps/web/src/routes scripts/scaffold-bounded-module.mjs scripts/scaffold-bounded-module.test.mjs .agents/skills/build-resource-form .agents/skills/migrate-web-resource docs/architecture/web-application-architecture.md`
> Then run `git status --short`. At the planned revision, the only source work
> is the untracked proof file
> `apps/web/src/framework/hono/__type-tests__/define-schema.proof.spec.ts`.
> Preserve it until Step 2 moves its proof into permanent tests. If an in-scope
> tracked file changed, compare it with the excerpts in "Current state". On a
> mismatch, use a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED — this changes the schema type seam for all web resources, but
  it does not change API, database, route, field, or UI behavior
- **Depends on**: none; this supersedes the remaining work in
  `plans/027-migrate-web-schemas-to-seam.md`
- **Category**: correctness | migration | tech-debt | dx | docs
- **Planned at**: commit `59ba2d1`, 2026-09-15

## Why this matters

The web app has two schema entry points. Loom exports an identity-only
`defineSchema(schema)` function, while the app exports
`defineEntitySchema(route, schemas)`. A Hono-backed module can use the Loom
function and bypass the app contract checks. The app helper also requires
create and update schemas for every route and has an entity-specific name even
when callers use local schemas.

One app-level `defineSchema` must own schema creation. It must accept either a
Hono route or an explicit custom Loom contract. Loom must stay generic and must
not import or name Hono. Plan 030 removes Loom's old builder only after all web
callers use this app seam.

The submitted write value is the parsed schema output. `Form.vue` calls the
submit action with `validation.data` at
`packages/loom/src/components/core/Form.vue:379-381`. Therefore, write
compatibility must compare the Zod output with the Hono JSON input. Raw form
input can be wider when a local transform changes a selected object into an ID.
Required raw form keys still need the existing phantom-key check.

## Decided contract

The new public app API lives in `apps/web/src/framework/schema.ts`. Hono remains
an app dependency through `apps/web/src/framework/hono/contracts.ts`.

Hono-backed use:

```ts
import { defineSchema } from '@/framework/schema'

export const usersSchema = defineSchema(rpc.users, {
  identity: 'id',
  record: user.schemas.select,
  create: createUserFormSchema,
  update: user.schemas.update,
})
```

Custom contract use with local runtime schemas:

```ts
type AuditLogContract = WebResourceSchema<
  AuditLog,
  AuditLogQuery,
  AuditLogCreate,
  AuditLogUpdate,
  string
>

export const auditLogsSchema = defineSchema<AuditLogContract>({
  identity: 'id',
  record: auditLogRecordSchema,
  query: auditLogQuerySchema,
  create: auditLogCreateSchema,
  update: auditLogUpdateSchema,
})
```

Custom type-only use:

```ts
export const roleAssignmentsSchema =
  defineSchema<RoleAssignmentSchema>({ identity: 'id' })
```

Local runtime schemas can also infer the returned Loom contract when the caller
does not give a type argument:

```ts
const schema = defineSchema({
  identity: 'id',
  record: recordSchema,
  create: createSchema,
  update: updateSchema,
})
```

Use Loom resource terms at this seam. The property is `record`, not `select`.
An API entity's `schemas.select` value is one possible record-schema source.
The full definition shape is:

```ts
{
  identity?: SchemaIdentityDeclaration<...>
  record?: ZodSchemaLike
  query?: ZodSchemaLike
  create?: ZodSchemaLike
  update?: ZodSchemaLike
  validators?: {
    create?: readonly FormValidatorInput<...>[]
    update?: readonly FormValidatorInput<...>[]
  }
}
```

For a Hono provider, require `record`. Require `create` only when the route has
a `create` member. Require `update` only when the route has an `update` member.
Reject a write schema when its route operation is absent. `delete` has no schema
slot. `query` and `validators` remain optional runtime validation. If supplied,
they must match the contract.

Use two overload families and one runtime implementation:

1. `defineSchema(route, definition)` infers `AppResourceContract<TRoute>`.
2. `defineSchema<CustomContract>(definition)` accepts a hand-written contract.
   It supports runtime schemas or a type-only definition.
3. `defineSchema(definition)` infers a Loom contract from supplied runtime
   schemas.

Do not export a `defineEntitySchema` alias. Do not accept an entity wrapper
such as `{ schemas: { ... } }`. Do not accept pre-wrapped `fromZod(...)` values.
The app seam owns `fromZod`.

## Current state

- `apps/web/src/framework/hono/entity.ts:1-95` imports Loom's `defineSchema`,
  accepts both `{ schemas: ... }` and direct `{ select, create, update }`
  values, requires all three schemas, hard-codes identity `id`, and calls
  `fromZod`.
- `apps/web/src/framework/hono/entity.ts:40-56` checks write `_input` against
  `HonoCreateOf` and `HonoUpdateOf`. This rejects a valid object-to-ID form
  transform because the raw UI input is not the submitted wire value.
- `apps/web/src/framework/hono/index.ts:2` exports `defineEntitySchema`.
- `apps/web/src/framework/hono/contracts.ts` owns `HonoRecordOf`,
  `HonoQueryOf`, `HonoCreateOf`, `HonoUpdateOf`, and `AppResourceContract`.
  Reuse these types. Do not move Hono types into Loom.
- `apps/web/src/framework/hono/__type-tests__/contracts.type-test.ts` has the
  current Hono type cases. It tests two call shapes because Plan 026 required a
  temporary migration overload. Replace those duplicate cases with the one
  decided direct shape.
- `apps/web/src/framework/hono/__type-tests__/define-schema.proof.spec.ts` is an
  untracked prototype. It proves one runtime implementation, CRUD and read-only
  route requirements, exact records, custom runtime and type-only contracts,
  and `{ id }` to string-ID parsing. It also proves that raw form input is not
  the Hono write type while parsed output is. Move these cases into permanent
  tests, then delete this proof file.
- `apps/web/src/routes/(authenticated)/settings/users/users.schema.ts:10-32`
  uses `.passthrough()` on the `{ id }` role option, then bypasses the Hono seam
  with Loom `defineSchema` and `fromZod`.
- `apps/web/src/routes/(authenticated)/settings/roles/roles.schema.ts:1-9`
  is the only production caller of `defineEntitySchema`.
- `apps/web/src/routes/(authenticated)/settings/permissions/permissions.schema.ts`
  is a standard read-only Hono resource but uses a hand-written Loom type.
- The nested `role-permissions.schema.ts` and
  `role-assignments.schema.ts` resources use custom actions and custom types.
  Keep them custom. Do not force their nested Hono paths through the standard
  route adapter.
- App fixtures and tests import Loom `defineSchema` in:
  - `apps/web/src/framework/acceptance/QueryOwnershipFixture.vue`
  - `apps/web/src/framework/adapters/assets.form.spec.ts`
  - `apps/web/src/router/__tests__/guards.spec.ts`
  - `apps/web/src/router/__tests__/nested-navigation.spec.ts`
- `scripts/scaffold-bounded-module.mjs:531-546` has two schema templates. The
  non-`id` branch uses Loom `defineSchema`; the `id` branch uses
  `defineEntitySchema`. Current configuration always derives `id`, but dead
  output must not keep an obsolete schema pattern.
- `scripts/scaffold-bounded-module.test.mjs:142-144` requires the old generated
  `defineEntitySchema` call.
- `docs/architecture/web-application-architecture.md:48-91` says there is one
  builder but shows the Loom builder and `fromZod` at app call sites. Replace
  this with the decided app/Loom boundary.
- `.agents/skills/build-resource-form/SKILL.md:18` and
  `.agents/skills/migrate-web-resource/SKILL.md:66` direct agents to the old
  builder pattern.
- `apps/web/src/framework/__tests__/route-resource-boundary.spec.ts` already
  scans app route files for forbidden patterns. Extend this file for the schema
  import boundary instead of creating another scan framework.
- `packages/loom/src/__tests__/public-api.spec.ts:106-112` already proves that
  Loom has no Hono dependency. Keep that test unchanged in this plan.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Web type-check | `pnpm --filter @southneuhof/framework-web type-check` | exit 0, including all `@ts-expect-error` cases |
| Schema tests | `pnpm --filter @southneuhof/framework-web test:focused -- framework/__tests__/schema.spec.ts framework/__tests__/route-resource-boundary.spec.ts framework/__tests__/entity-schema-import.spec.ts` | all selected tests pass |
| Migrated app tests | `pnpm --filter @southneuhof/framework-web test:focused -- framework/acceptance/QueryOwnershipFixture.spec.ts framework/adapters/assets.form.spec.ts router/__tests__/guards.spec.ts router/__tests__/nested-navigation.spec.ts 'routes/(authenticated)/settings/permissions' 'routes/(authenticated)/settings/roles' 'routes/(authenticated)/settings/users'` | all selected tests pass |
| Generator test | `node --test scripts/scaffold-bounded-module.test.mjs` | all tests pass |
| Module tooling | `pnpm test:module-tooling` | all Node and Python checks pass |
| Focused lint | `pnpm --filter @southneuhof/framework-web lint:focused -- <changed web files>` | exit 0; formatting is correct |
| Final patch check | `git diff --check` | no output |

If Vitest fails before test collection with `EMFILE: too many open files,
watch`, repeat the same focused command with `CHOKIDAR_USEPOLLING=true`. Record
both the first failure and the passing retry. Do not hide a test failure that
occurs after collection.

## Suggested implementation toolkit

- Use `$pit-of-success` if it is available. The app builder is a public seam;
  the natural call must keep all contract checks.
- Use `$writing-for-agents` if it is available for the two skill-file edits.
- Read the proof file before Step 1. It is executable evidence, not production
  code.

## Scope

**In scope** (the only files to modify):

- `apps/web/src/framework/schema.ts` (create)
- `apps/web/src/framework/hono/entity.ts` (delete)
- `apps/web/src/framework/hono/index.ts`
- `apps/web/src/framework/hono/__type-tests__/contracts.type-test.ts`
- `apps/web/src/framework/hono/__type-tests__/define-schema.proof.spec.ts`
  (delete after proof migration)
- `apps/web/src/framework/__tests__/schema.spec.ts` (create)
- `apps/web/src/framework/__tests__/route-resource-boundary.spec.ts`
- `apps/web/src/framework/acceptance/QueryOwnershipFixture.vue`
- `apps/web/src/framework/adapters/assets.form.spec.ts`
- `apps/web/src/router/__tests__/guards.spec.ts`
- `apps/web/src/router/__tests__/nested-navigation.spec.ts`
- `apps/web/src/routes/(authenticated)/settings/permissions/permissions.schema.ts`
- `apps/web/src/routes/(authenticated)/settings/roles/roles.schema.ts`
- `apps/web/src/routes/(authenticated)/settings/roles/[roleId]/detail/permissions/role-permissions.schema.ts`
- `apps/web/src/routes/(authenticated)/settings/users/users.schema.ts`
- `apps/web/src/routes/(authenticated)/settings/users/[userId]/detail/role-assignments/role-assignments.schema.ts`
- `scripts/scaffold-bounded-module.mjs`
- `scripts/scaffold-bounded-module.test.mjs`
- `.agents/skills/build-resource-form/SKILL.md`
- `.agents/skills/migrate-web-resource/SKILL.md`
- `docs/architecture/web-application-architecture.md`
- `plans/README.md` (status only during execution)

**Out of scope**:

- `packages/loom/**` — Plan 030 removes Loom's builder after this plan.
- `apps/api/**`, `packages/sprindle/**`, `packages/sdk/**`, and database files.
- Any resource action, route component, field definition, permission, request,
  response, or product behavior change.
- The absent `document-types` and `validation-results` modules. Do not restore,
  recreate, or invent them.
- Compatibility exports, aliases, wrappers, or support for the old
  `defineEntitySchema` and `{ schemas: ... }` forms.
- Support for a new validation library. The current app seam accepts the Zod
  shapes that `fromZod` already accepts.

## Git workflow

- Stay in the current worktree. Do not create another branch.
- Preserve all unrelated changes. The proof file is related and must be folded
  into permanent tests.
- Do not commit, push, or open a pull request unless the operator asks.
- If a commit is later requested, use the repository's short imperative style,
  for example: `Centralize web resource schema construction`.

## Steps

### Step 1: Turn the proof into the production app seam

Create `apps/web/src/framework/schema.ts`. Start from the type and runtime model
in `define-schema.proof.spec.ts`, but use production names and exported types.

Required type behavior:

1. Use `WebResourceSchemaBoundary` as the generic constraint. Do not use bare
   `WebResourceSchema` as the constraint. The proof showed that its identity
   type is invariant and rejects valid concrete identity keys.
2. Keep Hono extraction in imports from `./hono/contracts`.
3. Use `SchemaOutput<TSchema>` for Hono create and update compatibility:
   `[SchemaOutput<TSchema>] extends [HonoCreateOf<TRoute>]` and the matching
   update form.
4. Keep the `RequiredKeys<TSchema>` check from the existing seam. Every raw
   required form key must exist in the matching Hono wire object. If a schema
   shape cannot be inspected, keep the existing "no opinion" behavior.
5. Require an exact record output in both directions.
6. If a query schema is supplied, require its parsed output to match
   `HonoQueryOf<TRoute>` in both directions. Do not require runtime query
   validation.
7. Build route members conditionally. A route with `create` requires `create`;
   a route without it has `create?: never`. Apply the same rule to `update`.
8. Accept Loom identity keys, key arrays, and identity functions. Do not
   hard-code `id` inside the builder. Omitted identity must keep Loom's existing
   default-to-`record.id` behavior.
9. Type `validators.create` and `validators.update` against the create and
   update values of the resolved contract. Map them to Loom's existing write
   schema parts. Do not add another validator system.
10. Support explicit custom contracts with runtime schemas, explicit custom
    type-only contracts, and type inference from runtime schemas. Use overloads
    only for type entry. Use one implementation for all calls.

Required runtime behavior:

- Ignore the route value after it supplies type inference. Do not store it in
  the Loom schema.
- Convert each supplied raw schema once with `fromZod`.
- Map `record`, `query`, `create`, and `update` to the matching Loom schema
  parts. Omit each absent part. Do not create `{ schema: undefined }`.
- Attach supplied create/update validators to their matching write part.
- Return the generic `WebResourceSchemaBoundary` value that `defineResource`
  already accepts.
- Keep the implementation small. Do not add a class, factory, provider
  registry, or runtime Hono adapter.

**Verify**: run the web type-check. It can fail until Step 2 replaces the old
test imports, but errors must be limited to the known old symbol and call
shape. Any error inside the new implementation that is not an expected caller
migration is a STOP condition.

### Step 2: Move all prototype and existing type proof to permanent tests

In `apps/web/src/framework/hono/__type-tests__/contracts.type-test.ts`:

1. Import `defineSchema` from `../../schema`.
2. Replace `select` with `record` in every seam call.
3. Remove all `{ schemas: ... }` wrapper cases. Keep one direct case for each
   invariant; do not keep duplicate tests for a deleted overload.
4. Keep the existing query adapter assertions.
5. Keep and adapt the existing bad record, bad create, bad update,
   phantom-required-key, Zod v3/v4, refinement, and partial-update cases.
6. Add a read-only route. Prove `{ record }` compiles, and prove create and
   update members fail with `@ts-expect-error`.
7. Prove a CRUD route fails when create or update is missing.
8. Move the proof's custom contract cases here. Prove custom runtime schemas,
   custom type-only schemas, and one wrong custom runtime schema.
9. Add an inferred custom runtime-schema case with no explicit type argument.
   Assert `WebResourceRecordOf`, `WebResourceQueryOf`,
   `WebResourceCreateOf`, and `WebResourceUpdateOf` values from its result.
10. Keep these explicit direction assertions:

```ts
const rawFormInputIsWireInput:
  [z.input<typeof createSchema>] extends [HonoCreateOf<CrudRoute>]
    ? true
    : false = false
const parsedFormOutputIsWireInput:
  [z.output<typeof createSchema>] extends [HonoCreateOf<CrudRoute>]
    ? true
    : false = true
```

Create `apps/web/src/framework/__tests__/schema.spec.ts`. Move only runtime
proof into it:

- One Hono CRUD definition returns identity, record, create, and update parts.
- One Hono read-only definition returns identity and record only.
- One custom runtime definition returns each supplied part.
- One custom type-only definition returns identity only.
- A role value `{ id: ' admin ', label: 'Admin' }` is accepted without
  `.passthrough()` and validates to `'admin'` in the create output.
- Create and update validators appear on the correct Loom parts and run with
  the normal Loom validator contract.

Delete
`apps/web/src/framework/hono/__type-tests__/define-schema.proof.spec.ts` only
after all its positive and negative cases have a permanent owner. Do not keep
the `PROOF ONLY` implementation.

**Verify**:

- `pnpm --filter @southneuhof/framework-web type-check` exits 0. Every
  `@ts-expect-error` must suppress one error; an unused directive fails the
  check.
- Run the focused `schema.spec.ts`; all tests pass.

### Step 3: Remove the old app helper with no compatibility path

Delete `apps/web/src/framework/hono/entity.ts`. Remove its export from
`apps/web/src/framework/hono/index.ts`.

Do not re-export `defineSchema` from the Hono barrel. Its one app import is
`@/framework/schema`, because the same function also supports custom
contracts. Do not add `defineEntitySchema` as an alias.

Extend `apps/web/src/framework/__tests__/route-resource-boundary.spec.ts` with
one source scan that fails when application files, excluding test fixtures that
must read package source, do either of these:

- import `defineSchema` from `@southneuhof/loom`;
- refer to `defineEntitySchema`.

The scan must include `apps/web/src`, not only route files. Exclude the boundary
test itself. Keep the scan narrow enough that prose comments do not create a
false failure.

**Verify**:

```sh
rg -n "defineEntitySchema|@southneuhof/loom.*defineSchema|defineSchema.*@southneuhof/loom" apps/web/src
```

Expected: no old API match. Matches inside a deliberate negative source-scan
pattern are allowed only when the string is split or constructed so this grep
still has no false positive. Run the focused boundary test; it passes.

### Step 4: Migrate all production web schemas

Change each schema file to import `defineSchema` from `@/framework/schema`.
Pass raw Zod schemas. Do not call `fromZod` at the call site.

1. `settings/roles/roles.schema.ts`:

```ts
export const rolesSchema = defineSchema(rpc.roles, {
  identity: 'id',
  record: role.schemas.select,
  create: role.schemas.create,
  update: role.schemas.update,
})
```

2. `settings/users/users.schema.ts`:
   - remove `.passthrough()` from the `{ id }` role member;
   - preserve string input, `{ id }` input, trimming, `min(1)`, and the unique
     role-ID refinement;
   - use `record: user.schemas.select`, `create: createUserFormSchema`, and
     `update: user.schemas.update`;
   - remove Loom `defineSchema`, `fromZod`, and `AppResourceContract` imports;
   - delete `User` and `userPublicSchema` only if a fresh importer search shows
     no use. At the planned revision, there is no importer.

3. `settings/permissions/permissions.schema.ts`:
   - use the Hono provider `rpc.permissions`;
   - use `record: permission.schemas.select`;
   - remove `Permission` and `PermissionSchema` if the fresh importer search is
     still empty;
   - do not invent create or update schemas. The route is read-only.

4. Keep the nested role-permissions and role-assignments resources custom:
   - import the same app `defineSchema`;
   - keep their exported record/query types because actions and route files use
     them;
   - keep their explicit `WebResourceSchema` contract type;
   - use `defineSchema<TheirContract>({ identity: 'id' })`;
   - do not change their actions or nested RPC calls.

After each file, run the web type-check. A failure that shows a real record or
write mismatch is a seam finding. Stop and report it. Do not use Loom's old
builder to bypass the error.

**Verify**: web type-check exits 0. Focused settings tests pass.

### Step 5: Migrate custom app fixtures and tests

Use the app seam in each current non-production caller:

- `QueryOwnershipFixture.vue`: keep `FixtureSchema`; import the app
  `defineSchema`; keep its type-only `{ identity: 'id' }` call.
- `assets.form.spec.ts`: pass `readSchema` directly as `record`, `create`, and
  `update`; remove `fromZod` and Loom `defineSchema` imports. Preserve the
  separate `writeSchema` and `patchSchema` assertions; they test asset
  conversion and are not schema-builder inputs.
- `guards.spec.ts`: define one small explicit custom contract/schema fixture at
  file scope and reuse it in the four resource declarations. Do not duplicate
  a schema call in each test.
- `nested-navigation.spec.ts`: keep its explicit custom `WebResourceSchema`
  type and import the app builder.

Do not change test behavior or expected values.

**Verify**: run the migrated app-test command from "Commands you will need".
All selected tests pass.

### Step 6: Make the scaffold generate only the new pattern

In `scripts/scaffold-bounded-module.mjs`, replace both branches in
`renderSchema(config)` with one template:

```ts
import { defineSchema } from '@/framework/schema'

export const ${plural}Schema = defineSchema(rpc['${config.slug}'], {
  identity: ${literal(config.identity.key)},
  record: ${entity}.schemas.select,
  create: ${entity}.schemas.create,
  update: ${entity}.schemas.update,
})
```

The current generator derives `id`, but keep `config.identity.key` in the
template because the normalized configuration owns that value. Remove the dead
non-`id` Loom/fromZod branch. Keep existing exported type aliases unless a
separate current generator rule removes them; this plan does not redesign the
generated module contract.

In `scripts/scaffold-bounded-module.test.mjs`, replace the two old assertions
with exact assertions for:

- the `@/framework/schema` import;
- the one direct call;
- `identity`, `record`, `create`, and `update` members;
- no `defineEntitySchema`, `fromZod`, or Loom `defineSchema` text.

**Verify**: the generator test passes. Then run `pnpm test:module-tooling`; all
checks pass.

### Step 7: Update agent and architecture instructions

Update `.agents/skills/build-resource-form/SKILL.md`:

- say that standard resources use app `defineSchema`;
- pass raw Zod schemas and let the seam own `fromZod`;
- say that a Hono route or an explicit custom contract supplies expected
  types;
- keep the existing rules for local transforms and server-owned fields.

Update `.agents/skills/migrate-web-resource/SKILL.md`:

- replace "core `defineSchema`" with the app seam;
- name Hono route and explicit custom contract as the two supported providers;
- state that Hono-backed modules must not use the custom overload to bypass a
  route mismatch;
- keep the one-module-per-execution rule unchanged.

Update `docs/architecture/web-application-architecture.md`:

- state that Loom owns generic resource contracts and `defineResource`;
- state that Carta web owns the only app schema builder at
  `@/framework/schema`;
- state that Hono is known only at the app layer;
- show one Hono example and one custom contract example with raw schemas;
- describe conditional read/write members and parsed-output write checking;
- keep validators in the documented input shape;
- remove app call-site `fromZod` instructions. Loom still owns the bridge used
  inside the app seam.

Do not edit `packages/loom/README.md` or root `README.md` here. Plan 030 updates
them when it removes the Loom export.

**Verify**:

```sh
rg -n "defineEntitySchema|core `defineSchema`|defineSchema.*fromZod|fromZod.*defineSchema" .agents/skills/build-resource-form .agents/skills/migrate-web-resource docs/architecture/web-application-architecture.md
```

Expected: no obsolete instruction. Literal API names in the new architecture
text are allowed only when they describe the new app seam.

### Step 8: Run the full migration gate and inventory

Run, in order:

1. Web type-check.
2. Both focused web-test commands.
3. Generator test and module tooling.
4. Focused lint for every changed web TypeScript/Vue file.
5. `git diff --check`.
6. The final inventories below.

```sh
rg -n "defineEntitySchema" apps/web/src scripts .agents/skills docs/architecture
rg -n "import .*defineSchema.*@southneuhof/loom|import \{[^}]*defineSchema[^}]*\} from '@southneuhof/loom'" apps/web/src
rg -n "\.passthrough\(\)" apps/web/src/routes/'(authenticated)'/settings/users/users.schema.ts
rg -n "defineSchema" apps/web/src scripts/scaffold-bounded-module.mjs .agents/skills/build-resource-form .agents/skills/migrate-web-resource docs/architecture/web-application-architecture.md
```

Expected:

- first three commands return no match;
- the final command lists only the app `defineSchema` implementation, imports,
  calls, tests, generator output, and current instructions;
- no app source imports Loom `defineSchema`;
- no proof-only file remains.

## Test plan

- Extend the existing Hono type-test instead of adding a second type-test
  harness.
- Add one runtime app-schema spec based on the validated prototype.
- Extend the existing route-resource boundary scan so future app code cannot
  import the raw Loom builder.
- Keep each existing module and fixture test. They prove that migration does
  not change behavior.
- Keep generator tests as source-output tests because generated imports and
  call shapes are the behavior under test.
- No E2E test is needed. This migration changes compile-time ownership and
  schema construction, not a user flow.

## Done criteria

All items must hold:

- [ ] `apps/web/src/framework/schema.ts` is the one app schema builder.
- [ ] Hono and custom explicit/inferred contracts use one runtime
  implementation.
- [ ] Hono remains absent from `packages/loom`.
- [ ] Write compatibility checks parsed output; phantom required keys remain
  rejected.
- [ ] CRUD, read-only, custom runtime, custom type-only, inferred custom,
  identity, query, validator, transform, and negative type cases exist.
- [ ] `.passthrough()` is absent from the users role-selection member, and the
  `{ id }` plus extra-label runtime case passes.
- [ ] `defineEntitySchema` has no match in app source, scripts, skills, or app
  architecture docs.
- [ ] No app source imports `defineSchema` from Loom.
- [ ] All current web schema callers use `@/framework/schema`.
- [ ] The scaffold emits only the new app schema call.
- [ ] Web type-check, selected web tests, generator tests, module tooling, and
  focused lint pass.
- [ ] `git diff --check` has no output.
- [ ] Only files in this plan's scope changed, apart from plan status.
- [ ] Plan 027 is marked superseded for its remaining work, and this plan's
  status is updated in `plans/README.md` after review.

## STOP conditions

Stop and report. Do not improvise if:

- Any current `defineSchema` or `defineEntitySchema` caller exists outside the
  inventoried files and Plans 029/030 do not name it.
- `document-types` or `validation-results` appears before execution. The base
  inventory has changed and the full migration scope must be revised.
- The new custom overload cannot support both explicit type-only contracts and
  inference from runtime schemas without a caller cast or a second runtime
  implementation.
- The Hono overload can silently select the custom overload after a route
  contract mismatch.
- A valid users `{ id }` input or its string-ID parsed output fails.
- A read-only route can accept create or update, or a CRUD route can omit one.
- Record exactness, write output compatibility, required-key rejection, query
  compatibility, identity typing, or validator typing is weaker than the
  permanent tests state.
- The implementation needs a Hono import or Hono-named type in
  `packages/loom/**`.
- A migrated module needs an API, action, field, route, permission, or UI
  behavior change.
- A verification command fails twice after one reasonable correction.

## Maintenance notes

- New Hono-backed modules must call `defineSchema(route, definition)`. An
  explicit custom contract is for resources that do not use the standard Hono
  route shape.
- Reviewers must reject a custom-contract call that copies types from a
  standard Hono route. That call bypasses the provider that already exists.
- Use `record` at the Loom seam. Use `entity.schemas.select` only as the value
  supplied to it.
- A form transform may accept a wider raw UI value. Its parsed output must fit
  the transport write type.
- If another runtime validation library is needed, design one schema-source
  adapter. Do not add a second app schema builder.
- Plan 030 must follow before the migration is complete. Until then, Loom's old
  builder still exists for Loom's own source and tests, but app code cannot use
  it.
