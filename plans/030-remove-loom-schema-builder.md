# Plan 030: Remove Loom's schema builder and keep generic resource values

> **Implementation instructions**: Follow this plan step by step. Run each
> verification command and confirm its expected result before the next step.
> If a STOP condition occurs, stop and report it. Do not improvise. After the
> implementation and review pass, update this plan's status row in
> `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 59ba2d1..HEAD -- packages/loom README.md plans/README.md`
> Plan 029 must be complete before this plan. Confirm that no app source imports
> Loom `defineSchema` before any deletion.
>
> **Authority note**: this plan changes `packages/loom`, a framework package.
> Planning does not authorize execution. The execution request must explicitly
> authorize Loom changes. If it does not, stop before Step 1.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — removes a public Loom export, but current repository callers
  are fully inventoried and Plan 029 moves app callers first
- **Depends on**: `plans/029-centralize-app-resource-schema-seam.md` must be
  complete and reviewed
- **Category**: migration | tech-debt | docs
- **Planned at**: commit `59ba2d1`, 2026-09-15

## Why this matters

After Plan 029, Carta web has one schema seam with Hono and custom contract
support. Loom's `defineSchema` would remain a second public function that only
returns its input. It adds no runtime behavior, and it gives app code an easy
way to bypass the app contract seam.

Loom must remain transport-independent. It must provide generic
`WebResourceSchema` contracts and `defineResource`, which already accepts any
`WebResourceSchemaBoundary`. Loom's own tests can use plain typed or inferred
schema values. No replacement builder, compatibility alias, or Hono dependency
is needed.

## Current state

- `packages/loom/src/resources/defineSchema.ts:3-7` is an identity function:

```ts
/** Keep the schema value exact; validation and transport behavior stay outside this builder. */
export function defineSchema<const TSchema extends WebResourceSchemaBoundary>(schema: TSchema): TSchema
export function defineSchema(schema: WebResourceSchemaBoundary): WebResourceSchemaBoundary {
  return schema
}
```

- `packages/loom/src/resources/index.ts:2` exports it. `packages/loom/src/index.ts`
  exports the resource barrel.
- `packages/loom/src/resources/defineResource.ts:4-12` already accepts
  `TSchema extends WebResourceSchemaBoundary` directly and does not call
  `defineSchema`.
- `packages/loom/src/contracts/schema.ts:20-40` owns the generic
  `WebResourceSchema` and `WebResourceSchemaBoundary` types. Keep these types.
- `packages/loom/src/resources/__tests__/schema.spec.ts` only proves that the
  identity function returns the same object. Delete this test with the
  function.
- The remaining Loom callers are test fixtures and type-tests:
  - `packages/loom/src/components/inputs/__tests__/option-source.spec.ts`
  - `packages/loom/src/components/views/__tests__/resource-cache.spec.ts`
  - `packages/loom/src/contracts/__type-tests__/contracts.type-test.ts`
  - `packages/loom/src/fields/__tests__/defineFields.spec.ts`
  - `packages/loom/src/resources/__tests__/resources.spec.ts`
  - `packages/loom/src/resources/__type-tests__/field-references.type-test.ts`
  - `packages/loom/src/resources/__type-tests__/resource-actions.type-test.ts`
  - `packages/loom/src/resources/__type-tests__/schema.type-test.ts`
- `packages/loom/src/__tests__/public-api.spec.ts` guards removed exports and
  already proves that Loom has no Hono integration.
- `packages/loom/README.md:45-60` documents Loom `defineSchema` as its resource
  schema constructor.
- Root `README.md:270-283` shows the same builder in the Loom overview.
- Plan 029 must have removed all app and scaffold imports of Loom
  `defineSchema`. If it did not, this plan cannot start.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Precondition inventory | `rg -n "import .*defineSchema.*@southneuhof/loom|import \{[^}]*defineSchema[^}]*\} from '@southneuhof/loom'" apps/web/src scripts .agents docs` | no matches |
| Loom type-check | `pnpm --filter @southneuhof/loom type-check` | exit 0 |
| Web type-check | `pnpm --filter @southneuhof/framework-web type-check` | exit 0 against Loom source |
| Loom tests | `pnpm --filter @southneuhof/loom test` | all Loom tests pass |
| Web tests | `pnpm --filter @southneuhof/framework-web test` | all web tests pass |
| Web build | `pnpm --filter @southneuhof/framework-web build-only` | exit 0 |
| Repository lint | `pnpm lint` | exit 0 |
| Patch check | `git diff --check` | no output |

If a Vitest command fails before collection with `EMFILE: too many open files,
watch`, repeat that same command with `CHOKIDAR_USEPOLLING=true`. Report the
first failure and the passing retry. A failure after collection is a real test
failure.

## Suggested implementation toolkit

- No special implementation tool is needed. This plan removes code and uses
  existing generic contracts.

## Scope

**In scope** (the only files to modify):

- `packages/loom/src/resources/defineSchema.ts` (delete)
- `packages/loom/src/resources/index.ts`
- `packages/loom/src/resources/__tests__/schema.spec.ts` (delete)
- `packages/loom/src/components/inputs/__tests__/option-source.spec.ts`
- `packages/loom/src/components/views/__tests__/resource-cache.spec.ts`
- `packages/loom/src/contracts/__type-tests__/contracts.type-test.ts`
- `packages/loom/src/fields/__tests__/defineFields.spec.ts`
- `packages/loom/src/resources/__tests__/resources.spec.ts`
- `packages/loom/src/resources/__type-tests__/field-references.type-test.ts`
- `packages/loom/src/resources/__type-tests__/resource-actions.type-test.ts`
- `packages/loom/src/resources/__type-tests__/schema.type-test.ts`
- `packages/loom/src/__tests__/public-api.spec.ts`
- `packages/loom/README.md`
- `README.md`
- `plans/README.md` (status only during execution)

**Out of scope**:

- `apps/web/**` except read-only verification. Plan 029 owns app migration.
- `apps/api/**`, `packages/sprindle/**`, `packages/sdk/**`, and database files.
- Any change to `WebResourceSchema`, `WebResourceSchemaBoundary`,
  `defineResource`, fields, actions, views, validation behavior, or runtime
  resource behavior.
- A replacement Loom builder, compatibility alias, deprecation wrapper, or
  re-export from another path.
- Hono types, imports, dependencies, examples, or names inside Loom.

## Git workflow

- Stay in the current worktree. Do not create another branch.
- Preserve unrelated work.
- Do not commit, push, or open a pull request unless the operator asks.
- If a commit is later requested, use the short imperative style, for example:
  `Remove Loom schema identity builder`.

## Steps

### Step 1: Confirm Plan 029 and Loom authority

Confirm all of these facts before a source edit:

1. The execution request explicitly permits `packages/loom` changes.
2. Plan 029 is marked complete after review in `plans/README.md`.
3. The precondition inventory command has no match.
4. `apps/web/src/framework/schema.ts` exists and owns the app builder.
5. `defineEntitySchema` has no match in app source, scripts, skills, or docs.
6. `git status --short` contains no unrelated change in this plan's scope.

**Verify**: all six facts hold. Otherwise stop and report the exact missing
precondition.

### Step 2: Replace Loom test builders with plain schema values

Remove `defineSchema` imports and calls from each inventoried Loom test and
type-test. Use these two boring forms only:

For a named explicit contract:

```ts
type Schema = WebResourceSchema<Row, Query, Create, Update, string>
const schema: Schema = { identity: 'id' }
```

For inference from validation schemas:

```ts
const schema = {
  identity: 'id' as const,
  record: { schema: recordSchema },
  query: { schema: querySchema },
  create: { schema: createSchema },
  update: { schema: updateSchema },
}
```

Apply the forms as follows:

- `option-source.spec.ts`: use a local inferred schema with
  `identity: 'id' as const`.
- `resource-cache.spec.ts`, `contracts.type-test.ts`, and
  `resources.spec.ts`: use their existing named `WebResourceSchema` types as
  annotations.
- `defineFields.spec.ts`: make `schema()` return its current literal directly;
  keep `identity: 'id' as const` so field inference remains exact.
- `field-references.type-test.ts` and `resource-actions.type-test.ts`: keep all
  existing validation-schema values and return-type assertions; remove only the
  helper call and make identity literal.
- `schema.type-test.ts`: keep all `WebResource*Of` and identity assertions. Use
  a direct inferred literal for `schema`, an annotated literal for `explicit`,
  and a direct literal for `schemaWithoutRuntimeValidation`.

Do not add `as WebResourceSchema`, `as unknown`, `as any`, a local identity
helper, or a replacement factory. A named annotation or `as const` on the
identity literal is sufficient. If it is not sufficient, stop and report the
exact inference failure.

**Verify**: Loom and web type-check both exit 0. Existing
`@ts-expect-error` assertions remain active.

### Step 3: Remove the Loom builder and guard its removal

Delete:

- `packages/loom/src/resources/defineSchema.ts`;
- `packages/loom/src/resources/__tests__/schema.spec.ts`.

Remove the export from `packages/loom/src/resources/index.ts`. Do not change
`defineResource`.

In `packages/loom/src/__tests__/public-api.spec.ts`, add the old builder to the
removed-export guard. Construct the name from parts, as this file does for
other removed exports, so the final source inventory can have no
`defineSchema` match:

```ts
['define', 'Schema'].join('')
```

Keep the existing no-Hono test. Do not add an app import to a Loom test.

**Verify**:

```sh
rg -n "defineSchema" packages/loom/src
```

Expected: no matches. Run the full Loom test suite; all tests pass, including
the public API guard.

### Step 4: Correct Loom and repository documentation

Update `packages/loom/README.md`:

- state that Loom accepts a generic schema value and does not own an app
  contract provider;
- show a plain inferred schema object with `identity: 'id' as const`,
  `record`, `query`, `create`, and `update` validation parts;
- keep `fromZod` as Loom's Zod-to-validation bridge for direct generic Loom
  use;
- state that a consuming application can provide its own schema seam;
- do not mention Hono in this package README.

Update the Loom section of root `README.md`:

- show Carta app code importing `defineSchema` from `@/framework/schema`;
- show raw `record`, `create`, and `update` Zod sources;
- state that the app seam can use the Hono route contract or an explicit custom
  resource contract;
- state that Loom receives the generic result and remains unaware of Hono;
- keep `defineResource` and View examples unchanged unless an import line must
  change.

Do not copy the full architecture document into either README. Link to
`docs/architecture/web-application-architecture.md` for details.

**Verify**:

```sh
rg -n "defineSchema" packages/loom
```

Expected: no matches. Root README matches must refer only to
`@/framework/schema`, not `@southneuhof/loom`.

### Step 5: Run the full removal gate

Run, in order:

1. Loom type-check.
2. Web type-check.
3. Full Loom tests.
4. Full web tests.
5. Web build-only.
6. Repository lint.
7. `git diff --check`.
8. Final inventories:

```sh
rg -n "defineSchema" packages/loom
rg -n "defineEntitySchema" apps packages scripts .agents docs README.md
rg -n "from ['\"]hono|hono/" packages/loom/src packages/loom/package.json
rg -n "defineSchema" apps/web/src scripts .agents/skills docs README.md
```

Expected:

- first three inventories have no matches;
- the last inventory lists only the one app implementation, its app imports
  and tests, current generator output, and current instructions;
- no deleted file or export remains;
- all commands pass.

## Test plan

- Delete the identity-function runtime test because its subject no longer
  exists.
- Keep all generic schema extraction type-tests with direct values. These prove
  that removal of the helper does not reduce Loom type inference.
- Add the removed public name to the existing public API guard.
- Run the full Loom suite because the removed export was package-wide.
- Run the full web suite and build because the web TypeScript project imports
  Loom source directly.
- No API, database, or E2E test is needed.

## Done criteria

All items must hold:

- [ ] Loom exports no `defineSchema` symbol or subpath.
- [ ] `packages/loom/src/resources/defineSchema.ts` and its runtime test are
  deleted.
- [ ] Loom owns no Hono type, import, dependency, example, or name.
- [ ] All Loom tests use plain typed or inferred schema values.
- [ ] Existing schema extraction and field/action type assertions still pass.
- [ ] Loom README documents generic schema values and no schema builder.
- [ ] Root README directs Carta app code to `@/framework/schema`.
- [ ] Loom and web type-check pass.
- [ ] Full Loom and web tests pass.
- [ ] Web build and repository lint pass.
- [ ] All final inventories have their expected results.
- [ ] `git diff --check` has no output.
- [ ] Only files in this plan's scope changed, apart from plan status.
- [ ] This plan's status is updated in `plans/README.md` after review.

## STOP conditions

Stop and report. Do not improvise if:

- The execution request does not explicitly authorize Loom changes.
- Plan 029 is not complete or any app/scaffold import of Loom `defineSchema`
  remains.
- A new repository caller of Loom `defineSchema` exists outside this inventory.
- Direct schema values cannot preserve current record, query, create, update,
  identity, field, or action inference with only a named annotation or a narrow
  `as const` identity literal.
- Removal requires a change to `WebResourceSchema`, `defineResource`, fields,
  actions, views, or validation behavior.
- Any Hono import, type, dependency, or name is needed in Loom.
- A compatibility alias, wrapper, deprecation period, or replacement Loom
  builder appears necessary.
- A verification command fails twice after one reasonable correction.

## Maintenance notes

- Loom accepts generic schema values. Carta web owns contract-provider
  selection and raw-schema adaptation.
- Future Loom examples must use plain schema values. Future Carta examples must
  use `@/framework/schema`.
- Keep the public API removal guard. Do not re-add a no-op builder for typing;
  named annotations and literal inference are enough.
- If an external Loom consumer later needs a builder, design it from that
  consumer's concrete requirement. Do not restore this identity function as a
  compatibility reflex.

