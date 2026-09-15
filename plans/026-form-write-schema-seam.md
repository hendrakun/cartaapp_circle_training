# Plan 026: Check form write schemas against the Hono wire input in defineEntitySchema

> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 783ac5d..HEAD -- apps/web/src/framework/hono/entity.ts apps/web/src/framework/hono/contracts.ts apps/web/src/framework/hono/__type-tests__/contracts.type-test.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Review record (parent review, 2026-09-15)

The subagent's first attempt was REJECTED on four grounds; the revision (same
session) was APPROVED after independent parent verification:

1. Signature break: first attempt accepted ONLY the direct shape, breaking the
   real `roles.schema.ts` bare-entity caller (out-of-scope file). Fixed: both
   overloads exist, both fully checked. Proven with a scratch probe (deleted
   after): real `role` bare entity compiles, real `role.schemas` direct shape
   compiles, phantom keys against the REAL roles wire reject.
2. Dead `IsUnion`: first attempt shipped an `IsUnion` branch that evaluated
   `false` for a real union (proven by probe). Removed with justification:
   `contracts.ts:66-69` `UnionObject<>` normalizes union wire inputs into a
   single object type, so the branch was both broken and unneeded. A too-narrow
   wire union can only widen `keyof` (accept more), never falsely reject —
   consistent with "prefer acceptance".
3. Pre-existing negative cases (`badCreateSchema`, `badAdapterCreateSchema`)
   were silently redefined with `extraRequired` to fit the new check. Accepted
   with updated comments — the old output-direction expectation WAS the defect
   being removed — but recorded here so no one "restores" them.
4. users-caveat: the REAL `createUserFormSchema` (`.passthrough()` on the
   `{id}` union member) does NOT satisfy input-direction for `roleIds` and is
   therefore correctly rejected by the seam. It stays on raw `defineSchema`
   (out of scope, untouched). Plan 027 carries the explicit instruction: drop
   `.passthrough()` or normalize before the seam.

Gates re-run by parent: web `type-check` exit 0, `entity-schema-import.spec`
8/8 pass, `lint:focused` exit 0 (4 oxlint warnings, 0 errors),
`git diff --check` clean. Only the two in-scope files modified.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — changes a shared framework type seam; a wrong constraint direction breaks valid transforming entities
- **Depends on**: none
- **Category**: tech-debt | correctness
- **Planned at**: commit `783ac5d`, 2026-09-15
- **Issue**: omit (no `--issues` flag)

## Why this matters

A web form used `documentTypePublicSchema` (a read/enriched select shape) as
the base for its create/update schemas and hand-omitted server-owned keys. It
guessed `{id, createdAt, updatedAt}` and missed `{createdByUserId,
updatedByUserId}`. Type-check, lint, and the API spec all passed. The form
then failed silently at submit: validation issues named fields with no visible
input, and the framework only displays mapped field errors and toasts root
errors (`packages/loom/src/components/core/Form.vue:177,357`).

The existing `defineEntitySchema` check (`entity.ts:19-21`) compares
`z.output(create)` against `HonoCreateOf`. That direction rejects valid
transforming entities (asset object in, storage id out), so authors bypass the
seam with raw `defineSchema` + `fromZod` and hand-built `.omit()` bases. This
plan fixes the seam to check **wire input vs Hono input** plus a
**phantom-required-keys** check, so the reported defect fails `type-check` —
a gate command (`scripts/verify-module.mjs:123`) — instead of failing silently
in a preview no gate executes.

Intent for judgment calls: prefer accepting valid code (fallback to "no
opinion") over catching every exotic schema. A false rejection on a valid
entity is worse than a missed exotic case.

## Current state

The facts the implementer needs, inlined. The implementer has not seen any
prior conversation.

- `apps/web/src/framework/hono/entity.ts` — the only Hono schema seam; owns
  `defineEntitySchema`. Current content (HEAD, tracked, clean tree):

```ts
import { defineSchema, fromZod } from '@southneuhof/loom'
import type { RecordIdentity, SchemaIdentityDeclaration } from '@southneuhof/loom'
import type { AppResourceContract, HonoCreateOf, HonoRecordOf, HonoUpdateOf } from './contracts'

type SchemaWithOutput<TOutput> = { _output: TOutput }

type EntitySchemasOf<TRoute> = {
  schemas: {
    select: Parameters<typeof fromZod>[0] & SchemaWithOutput<HonoRecordOf<TRoute>>
    create: Parameters<typeof fromZod>[0] & SchemaWithOutput<HonoCreateOf<TRoute>>
    update: Parameters<typeof fromZod>[0] & SchemaWithOutput<HonoUpdateOf<TRoute>>
  }
}

type SchemaOutput<TSchema> = TSchema extends SchemaWithOutput<infer TOutput> ? TOutput : never
type Exact<TActual, TExpected> = [TActual] extends [TExpected] ? ([TExpected] extends [TActual] ? true : false) : false
type EntitySchemaContract<TRoute, TEntity extends EntitySchemasOf<TRoute>> = {
  schemas: {
    select: Exact<SchemaOutput<TEntity['schemas']['select']>, HonoRecordOf<TRoute>> extends true ? TEntity['schemas']['select'] : never
    create: SchemaOutput<TEntity['schemas']['create']> extends HonoCreateOf<TRoute> ? TEntity['schemas']['create'] : never
    update: SchemaOutput<TEntity['schemas']['update']> extends HonoUpdateOf<TRoute> ? TEntity['schemas']['update'] : never
  }
}

export function defineEntitySchema<const TRoute, const TEntity extends EntitySchemasOf<TRoute>>(route: TRoute, entity: TEntity & EntitySchemaContract<TRoute, TEntity>) {
  return defineSchema<AppResourceContract<TRoute>>({
    identity: 'id' as SchemaIdentityDeclaration<HonoRecordOf<TRoute>, RecordIdentity>,
    record: { schema: fromZod(entity.schemas.select) },
    create: { schema: fromZod(entity.schemas.create) },
    update: { schema: fromZod(entity.schemas.update) },
  })
}
```

- `apps/web/src/framework/hono/contracts.ts:92-93` — `HonoCreateOf<TRoute>`
  and `HonoUpdateOf<TRoute>` derive the **wire input** (`json` of the POST /
  PATCH endpoint) with unknown-key adaptation (`AdaptedObject`,
  `UnionObject`). Proven fact: for document-types the wire create input keeps
  raw asset objects (`referenceImages: StoredAsset[]`), NOT transformed ids.
  Evidence: generated contract
  `apps/api/.sprindle/contracts/<hash>/.../document-types/create/+server.d.ts`
  (ignored build artifact; regenerate with `pnpm --filter @southneuhof/api routes:build`)
  shows `referenceImages: { kind: "file"; id: string; url: string; name:
  string; ... }[]`.
- `apps/web/src/framework/hono/__type-tests__/contracts.type-test.ts` (100
  lines) — the existing type-test. It asserts the current output-direction
  checks with `@ts-expect-error` cases. Extend it; do not replace its existing
  passing cases unless this plan says so.
- Convention: Zod v4 entity schemas (`zod/v4`), `fromZod` infers output from
  the schema and accepts no caller output type (see the last case in the
  type-test, line 99-100).
- The `users` module has a genuine UI refinement that MUST keep passing:
  `createUserSchema.extend({ roleIds: <union normalizing to ids> })`
  (`apps/web/src/routes/(authenticated)/settings/users/users.schema.ts:10-25`).
  Its output is `string[]`, no new required keys. Any constraint that rejects
  this is wrong.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Web type-check | `pnpm --filter @southneuhof/framework-web type-check` | exit 0, no errors |
| Focused web test | `pnpm --filter @southneuhof/framework-web test:focused -- src/framework/hono/__tests__/entity-schema-import.spec.ts` | all pass (note: this spec exists at HEAD; if the path differs, list `src/framework/__tests__/` and `src/framework/hono/__tests__/` and use what exists) |
| Lint focused | `pnpm --filter @southneuhof/framework-web lint:focused -- src/framework/hono/entity.ts src/framework/hono/__type-tests__/contracts.type-test.ts` | exit 0 |
| API routes build (only if wire contract is stale) | `pnpm --filter @southneuhof/api routes:build` | exit 0 |

Run from the repo root `/Users/gamer/orca/workspaces/carta/chimaera-5170`
(or the session working directory if it was moved with `session_move`).

## Suggested implementation toolkit

- No extra skills needed. Read `apps/web/src/framework/hono/contracts.ts`
  fully before starting (the `HonoCreateOf`/`HonoUpdateOf` derivation and the
  `AdapterPayload` normalization decide what "wire input" means).

## Scope

**In scope** (the only files you should modify):
- `apps/web/src/framework/hono/entity.ts`
- `apps/web/src/framework/hono/__type-tests__/contracts.type-test.ts`

**Out of scope** (do NOT touch, even though they look related):
- `packages/loom/src/**` — framework changes need separate explicit authority
  (per `AGENTS.md`). The Form silent-failure backstop is plan 028, not this plan.
- `apps/web/src/routes/**` — app migration is plan 027, not this plan.
- `scripts/scaffold-bounded-module.mjs` — already emits `defineEntitySchema`;
  no template change needed.
- `apps/api/**` — entity schemas are already correct; no API change.

## Git workflow

- Branch: stay on the current session branch/worktree; do NOT create a new
  branch unless the operator instructs it. (Repo convention from `git log`:
  short imperative subjects, e.g. `Exclude E2E from Carta module delivery`.)
- Commit per logical unit only if the operator asks; default is uncommitted
  working-tree changes for parent review.
- Do NOT push, open a PR, stash, or run `git checkout -- .` unless instructed.

## Steps

### Step 1: Confirm the wire-input fact against the live contract

Regenerate if stale, then read the generated create input for one
transforming route and one plain route.

**Do**:
1. `pnpm --filter @southneuhof/api routes:build`
2. Find the create `+server.d.ts` under `apps/api/.sprindle/contracts/<hash>/`
   for `roles` (plain) and `users` (custom contract route).
3. Confirm: wire create input `json` contains the keys the form must supply
   (for roles: `roleCode, name, ...` without `id/createdByUserId/...`; for
   users: `name, email, password, roleIds`).

**Verify**: the `json` input object in each file lists only client-supplied
keys (no `id`, no `createdByUserId`/`updatedByUserId`, no timestamps) → fact
confirmed. If the wire input instead contains server-owned keys, STOP (the
seam premise is wrong; see STOP conditions).

### Step 2: Add input-direction + phantom-required checks to entity.ts

**Do**: In `apps/web/src/framework/hono/entity.ts`, keeping the existing
select exact-check unchanged:

1. Add a `SchemaWithInput<TInput>` type reading `_input` (mirror the existing
   `SchemaWithOutput` reading `_output`).
2. Add a `RequiredKeys<TSchema>` type computed from the Zod shape:
   - Read `shape` whether it is a plain object or a getter function
     (`typeof shape === 'function' ? shape() : shape`).
   - A key is required when its field type's `_input` does NOT include
     `undefined` (i.e. `undefined extends Field['_input'] ? never : Key`).
   - If the shape is unresolvable (not an object), resolve to `never`
     (fallback to "no opinion" — never reject valid code you cannot inspect).
3. Change the create/update contract to require BOTH:
   - `SchemaInput<TForm> extends HonoCreateOf<TRoute>` (input-direction;
     replaces the output-direction check for create/update only), AND
   - `RequiredKeys<TForm> extends keyof HonoCreateOf<TRoute>` — every required
     key of the form schema must exist on the wire. For unions (`roleIds`-style
     refinements aside, true union wire inputs), distribute: required keys must
     be a subset of the union of keys only when the wire side is a plain
     object; if `HonoCreateOf` is a union, require the form's required keys to
     be a subset of the *common* required keys is WRONG — instead fall back to
     "no opinion" (`unknown`) for union wire inputs. Simple rule: if
     `HonoCreateOf<TRoute>` is not a single object type (is a union or has no
     `keyof`), the required-keys check passes vacuously.
   - Keep accepting `Parameters<typeof fromZod>[0]` (raw Zod schemas, not
     pre-wrapped) so callers pass entity schemas directly.
4. Keep the function signature shape `defineEntitySchema(route, { select,
   create, update })` so the scaffold template and existing callers
   (`roles.schema.ts`, `validation-results.schema.ts`) keep compiling.
   Pre-wrapped `fromZod(...)` results must NOT be required as inputs; the seam
   owns `fromZod`.
   ADDITIONAL REQUIREMENT (from parent review 2026-09-15 — the subagent's
   first attempt exposed this gap): the OLD call shape
   `defineEntitySchema(route, entity)` with `entity = { schemas: { select,
   create, update } }` MUST KEEP WORKING for the migration window. Rationale:
   `apps/web/src/routes/(authenticated)/settings/roles/roles.schema.ts`
   (HEAD, tracked) calls `defineEntitySchema(rpc.roles, role)` with the bare
   entity TODAY, and `apps/web/src/routes/**` is OUT OF SCOPE for this plan
   (migration is plan 027). Breaking it here would force an out-of-scope edit
   or a broken tree between plans. Implement BOTH overloads:
   - `defineEntitySchema(route, { schemas: { select, create, update } })`
     → FULL check (input-direction + phantom-required) on the three schemas.
   - `defineEntitySchema(route, { select, create, update })` → same FULL check
     on the three schemas (new direct shape).
   Both overloads return the same `defineSchema<AppResourceContract<TRoute>>`
   value. The type-test must cover BOTH call shapes (one phantom case per
   shape). Plan 027 migrates remaining bare-entity callers to whichever shape
   the implementer of 027 prefers; either is fully checked so the choice is
   cosmetic.

Target shape (adapt names to repo style; the behavior, not the identifiers,
is load-bearing):

```ts
type SchemaWithInput<TInput> = { _input: TInput }
type SchemaInput<TSchema> = TSchema extends SchemaWithInput<infer TInput> ? TInput : never
// RequiredKeys: keys whose _input excludes undefined; never when unresolvable
```

**Verify**: `pnpm --filter @southneuhof/framework-web type-check` → exit 0
(existing callers `roles.schema.ts`, `validation-results.schema.ts`,
`users.schema.ts` still compile at this point because you have not tightened
call sites yet — the seam must stay backward compatible until plan 027).

### Step 3: Extend the type-test with the defect and the valid refinements

**Do**: Append to
`apps/web/src/framework/hono/__type-tests__/contracts.type-test.ts` (do not
delete existing cases). NOTE: the existing cases in this file call
`defineEntitySchema(route, { schemas: {...} })` — the BARE-ENTITY shape
(select/create/update nested under `schemas`). Both shapes must be covered:

1. A phantom-required case in the BARE-ENTITY shape (matches the file's
   existing harness):
   ```ts
   const formWithAuditKeys = z4.object({
     name: z4.string(),
     createdByUserId: z4.string(),
     updatedByUserId: z4.string(),
   })
   // @ts-expect-error form requires keys the wire does not accept
   defineEntitySchema({} as Route, { schemas: { select: selectSchema, create: formWithAuditKeys, update: updateSchema } })
   ```
   (Adjust `Route` create json / names to match the file's existing harness;
   the point is a form schema with required keys outside `keyof HonoCreate`.)
1b. The SAME phantom case in the DIRECT shape:
   ```ts
   // @ts-expect-error form requires keys the wire does not accept (direct shape)
   defineEntitySchema({} as Route, { select: selectSchema, create: formWithAuditKeys, update: updateSchema })
   ```
2. A valid-refinement case mirroring users:
   ```ts
   const uiRefined = createSchema.extend({ note: optionalText() })
   defineEntitySchema({} as AdapterRoute, { select: selectSchema, create: uiRefined, update: adapterUpdateSchema })
   ```
   (must compile WITHOUT `@ts-expect-error`).
3. A partial-update case: `createSchema.partial()`-style all-optional schema
   as `update` must compile.

**Verify**: `pnpm --filter @southneuhof/framework-web type-check` → exit 0.
All `@ts-expect-error` lines must each suppress exactly one error (an unused
`@ts-expect-error` or an error on a non-annotated line fails the check — that
is the desired gate behavior). Additionally verify NO existing caller broke:
`grep -rn "defineEntitySchema" apps/web/src scripts --include="*.ts" --include="*.vue" --include="*.mjs"`
must show every call site still type-checks (the check itself proves this;
the grep is just the inventory).

### Step 4: Run focused checks and lint

**Do**:
1. `pnpm --filter @southneuhof/framework-web test:focused -- src/framework/hono/__tests__/entity-schema-import.spec.ts`
   (if the path does not exist, run the closest hono/framework spec and record
   the substitution).
2. `pnpm --filter @southneuhof/framework-web lint:focused -- src/framework/hono/entity.ts src/framework/hono/__type-tests__/contracts.type-test.ts`
3. `git status --short` — confirm only the two in-scope files are modified.
4. `git diff --check` → no output.

**Verify**: tests pass, lint exits 0, `git diff --check` clean, only in-scope
files modified.

## Test plan

- Type-test additions in `__type-tests__/contracts.type-test.ts` ARE the tests
  for this plan (type direction: phantom-required rejected, UI refinement and
  partial update accepted). No new runtime spec is required.
- Structural pattern: the existing `@ts-expect-error` cases in the same file
  (lines 45-51, 95-97).
- Verification: web `type-check` exit 0 (unused `@ts-expect-error` fails the
  build, so a passing check proves each negative case errors exactly once).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm --filter @southneuhof/framework-web type-check` exits 0
- [ ] New `@ts-expect-error` phantom-required cases exist for BOTH call
      shapes (bare entity AND direct `{ select, create, update }`) and the
      check passes (proves rejection); valid-refinement and partial-update
      cases compile without annotation (proves no false rejection)
- [ ] `select` exact-check behavior unchanged (existing cases still pass)
- [ ] Focused hono/framework tests pass
- [ ] Focused lint on both touched files exits 0
- [ ] No files outside the in-scope list are modified (`git status --short`)
- [ ] `git diff --check` is clean

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `entity.ts` doesn't match the "Current state" excerpt (drift).
- Step 1 shows wire inputs containing server-owned keys (`id`,
  `createdByUserId`, timestamps) — the seam premise is false.
- The `_input`-based `RequiredKeys` rejects the existing valid `users`
  `createUserFormSchema` shape (union normalization) or any existing caller in
  `apps/web/src/routes/**` — loosen to "no opinion" for that shape, do not
  touch the route file (routes are plan 027).
- `vue-tsc` cannot express the constraint without `// @ts-ignore` or
  `any`-casts in product code — report the exact error instead of weakening
  with a cast.
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- Future entities with transforms (asset object in, id out) must keep passing:
  the input-direction check is what allows them. If someone "simplifies" back
  to output-direction, transforming entities break — the type-test's
  `AdapterRoute` cases guard this.
- If Zod changes its `_input`/`shape` internals (v3 vs v4 differ already;
  `shape` may be a getter), the `RequiredKeys` fallback (`never` = no opinion)
  keeps valid code compiling, but phantom-key detection silently weakens.
  Reviewer: any change to the fallback branch deserves a second look.
- Deferred to plan 027: migrating the four hand-built app schemas onto this
  seam and deleting redundant aliases. Deferred to plan 028: the Loom Form
  orphan-issue backstop (needs framework authority).
