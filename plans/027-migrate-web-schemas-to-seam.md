# Plan 027: Migrate hand-built web schemas onto defineEntitySchema and delete redundant aliases

> **STATUS NOTE (parent, post-execution 2026-09-15): the plan's core premise
> was STALE. `document-types` and `validation-results` modules exist ONLY in
> the working-tree stash (`stash@{0}^3`, untracked), NOT at HEAD (`783ac5d`).
> At HEAD, `apps/api/src/routes/(authenticated)/` holds only
> `files, me, permissions, roles, users`, and `rpc` has no `document-types`
> route. The executor correctly STOPPED on Steps 1-3/validation-results per
> the plan's own STOP rules, restored nothing, and completed ONLY the roles
> migration. The users seam move is BLOCKED on the `.passthrough()` caveat
> (plan 026 review record §4). Do NOT re-dispatch this plan as written; see
> "Remaining work" at the end for the true follow-ups.**
>
> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 783ac5d..HEAD -- apps/web/src/routes apps/web/src/framework/hono/__tests__`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.
>
> **Prerequisite**: plan 026 DONE (the `defineEntitySchema` seam checks
> input-direction and phantom-required keys). Verify by running
> `git log --oneline -3 -- apps/web/src/framework/hono/entity.ts` and
> confirming the seam change is present; if not, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW — deletes indirection; behavior must be identical
- **Depends on**: plans/026-form-write-schema-seam.md
- **Category**: tech-debt | migration
- **Planned at**: commit `783ac5d`, 2026-09-15
- **Issue**: omit (no `--issues` flag)

## Why this matters

Plans write schemas by hand around the seam: `defineSchema` + `fromZod` with
a `.omit()`-guessed base (`document-types.schema.ts` in the stashed module),
or thin `Zod.input` aliases re-exported for actions wrappers
(`DocumentTypeCreate`, `RoleCreate`). Each alias is a second source of truth
that can drift from the wire. After plan 026 the seam itself proves
correctness, so the aliases and wrappers can go: fewer names, fewer drift
points, and the reported defect class fails `type-check` at the schema line.

Intent: this plan changes names and wiring only. No validation rule, field,
permission, route, or submitted value may change. If any runtime behavior
changes, that is a defect in execution, not the plan.

## Current state

Facts inlined; the implementer has not seen prior conversation. NOTE: the
`document-types` module files below live in the stash
(`stash@{0}: "chimaera-5170: stash forward-testing trash + seam proof WIP
before form-schema seam plans (2026-09-15)"`), NOT in the clean tree — the
executor restores ONLY the listed document-types files from the stash (Step 1)
and nothing else.

- Stashed `apps/web/src/routes/(authenticated)/document-types/document-types.schema.ts`
  (the reported defect shape; already fixed in the stash to omit audit keys,
  but still hand-built around the seam):

```ts
import { defineSchema, fromZod } from '@southneuhof/loom'
import { documentTypePublicSchema } from '@southneuhof/api/routes/(authenticated)/document-types/document-types.entity'
import type { AppResourceContract } from '@/framework/hono'
import { rpc } from '@/framework/rpc'
import type { z as Zod } from 'zod/v4'

export type DocumentType = Zod.output<typeof documentTypePublicSchema>

const formFields = documentTypePublicSchema.omit({ id: true, createdByUserId: true, updatedByUserId: true, createdAt: true, updatedAt: true })
export const documentTypeCreateFormSchema = formFields
export const documentTypeUpdateFormSchema = formFields.partial()
export type DocumentTypeCreate = Zod.input<typeof documentTypeCreateFormSchema>
export type DocumentTypeUpdate = Zod.input<typeof documentTypeUpdateFormSchema>

export const documentTypesSchema = defineSchema<AppResourceContract<(typeof rpc)['document-types']>>({
  identity: 'id',
  record: { schema: fromZod(documentTypePublicSchema) },
  create: { schema: fromZod(documentTypeCreateFormSchema) },
  update: { schema: fromZod(documentTypeUpdateFormSchema) },
})
```

- Stashed `document-types.actions.ts` — redundant typed wrappers:

```ts
import type { DocumentTypeCreate, DocumentTypeUpdate } from './document-types.schema'
const api = createHonoResourceActions(rpc['document-types'])
export const documentTypesActions = {
  list: api.list, detail: api.detail,
  create: (input: DocumentTypeCreate) => api.create(input),
  update: (id: Parameters<typeof api.update>[0], input: DocumentTypeUpdate) => api.update(id, input),
  delete: api.delete,
}
```

- `apps/web/src/routes/(authenticated)/settings/roles/roles.schema.ts`
  (HEAD, tracked) — already entity-direct but bypasses the seam with raw
  `defineSchema` + aliases `Role`, `RoleCreate`, `RoleUpdate`.
- `apps/web/src/routes/(authenticated)/settings/roles/roles.actions.ts`
  (HEAD, tracked) — same redundant wrapper shape with `RoleCreate`/`RoleUpdate`.
- `apps/web/src/routes/(authenticated)/settings/users/users.schema.ts`
  (HEAD, tracked) — genuine UI refinement `createUserFormSchema =
  createUserSchema.extend({ roleIds: <union, uniqueness> })`; keeps its name
  but moves behind the seam. `users.actions.ts` (HEAD) already uses
  `create: api.create, update: api.update` — the target shape.
- `apps/web/src/routes/(authenticated)/validation-results/validation-results.schema.ts`
  (HEAD, tracked) — record-only, no write slots; migrate to seam for uniformity.
- API entities need NO changes: `documentType.schemas.{create,update,select}`
  (stashed entity), `role.schemas.*`, `user.schemas.*`,
  `validationResult.schemas.*`, `createUserSchema` are already correct.
- `DocumentType` record alias: grep shows no `.vue` importer in
  document-types at stash time, but RE-VERIFY before deleting (Step 3).
- Convention (pit-of-success): delete bypasses; do not leave the old
  `defineSchema<AppResourceContract<...>>` + `fromZod` write-slot pattern
  available as a parallel path in migrated files.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Web type-check | `pnpm --filter @southneuhof/framework-web type-check` | exit 0 |
| Focused web tests | `pnpm --filter @southneuhof/framework-web test:focused -- src/routes/\(authenticated\)/settings/roles src/routes/\(authenticated\)/settings/users` | all pass (adjust selectors to existing specs; record substitution) |
| Lint focused | `pnpm --filter @southneuhof/framework-web lint:focused -- <each touched file>` | exit 0 |
| Drift grep | `grep -rn "PublicSchema\|schemas.select" apps/web/src/routes --include="*.schema.ts"` | no create/update-slot matches |

Run from the repo root (or the moved session directory).

## Suggested implementation toolkit

- None. Small, mechanical migration.

## Scope

**In scope** (the only files you may modify or restore):
- Restore from `stash@{0}^3` (untracked commit) ONLY:
  `apps/web/src/routes/(authenticated)/document-types/document-types.schema.ts`,
  `document-types.actions.ts`, `document-types.resource.ts`
  (plus `create.route.vue`, `index.route.vue`, `[documentTypeId]/*.vue` ONLY if
  needed to type-check; prefer not to restore specs or unrelated files).
  Command: `git checkout 'stash@{0}^3' -- <paths>` then immediately
  `git status --short` to confirm nothing else was restored.
- `apps/web/src/routes/(authenticated)/settings/roles/roles.schema.ts`,
  `roles.actions.ts`
- `apps/web/src/routes/(authenticated)/settings/users/users.schema.ts`
  (seam move only; keep `createUserFormSchema` and its refinement)
- `apps/web/src/routes/(authenticated)/validation-results/validation-results.schema.ts`
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch):
- `packages/loom/src/**`, `packages/sprindle/src/**` — separate authority.
- `apps/api/**` — entities already correct. Do NOT "fix" the API.
- The rest of the stash (forward-testing trash, navigation, route-map,
  drizzle migration, document-validation): leave stashed. Restore ONLY the
  listed files. If `git checkout stash -- <path>` pulls anything else, revert it.
- `scripts/scaffold-bounded-module.mjs` — no change needed.
- `apps/web/src/routes/(authenticated)/settings/permissions/*`,
  `role-assignments/*`, `role-permissions/*` — record-only, untouched.
- Any `.vue`, permission, or field change — names/wiring only.

## Git workflow

- Stay on the current session branch/worktree; do NOT create a branch.
- Default: uncommitted changes for parent review. No push, no PR, no stash
  operations beyond the single scoped restore in Step 1.

## Steps

### Step 1: Scoped restore of document-types web files ONLY

**Do**:
1. `git stash list` → confirm `stash@{0}` message matches
   "chimaera-5170: stash forward-testing trash + seam proof WIP".
2. `git checkout 'stash@{0}^3' -- "apps/web/src/routes/(authenticated)/document-types/document-types.schema.ts" "apps/web/src/routes/(authenticated)/document-types/document-types.actions.ts" "apps/web/src/routes/(authenticated)/document-types/document-types.resource.ts"`
3. `git status --short` → confirm ONLY those three paths appeared (plus plan
   026's already-landed files if applicable). If anything else appeared, revert
   it immediately with `git rm` / `git checkout --` as appropriate and STOP if
   unsure.

**Verify**: `git status --short` lists at most the three restored files (and
expected plan-026 files) → proceed.

### Step 2: Migrate document-types.schema.ts onto the seam

**Do**: Rewrite the restored schema file to:

```ts
import { documentType } from '@southneuhof/api/routes/(authenticated)/document-types/document-types.entity'
import { defineEntitySchema } from '@/framework/hono'
import { rpc } from '@/framework/rpc'

export const documentTypesSchema = defineEntitySchema(rpc['document-types'], {
  select: documentType.schemas.select,
  create: documentType.schemas.create,
  update: documentType.schemas.update,
})
```

Delete: `DocumentType`, `DocumentTypeCreate`, `DocumentTypeUpdate`,
`documentTypeCreateFormSchema`, `documentTypeUpdateFormSchema`, the
`formFields` const, `defineSchema`/`fromZod`/`AppResourceContract`/`Zod`
imports. Keep the `record` slot on the entity select (the seam owns
`fromZod`).

**Verify**: `pnpm --filter @southneuhof/framework-web type-check` → exit 0.

### Step 3: Simplify document-types.actions.ts, verify no alias users remain

**Do**:
1. Rewrite actions to `create: api.create, update: api.update` (match
   `users.actions.ts`), dropping the `DocumentTypeCreate/Update` import.
2. `grep -rn "DocumentTypeCreate\|DocumentTypeUpdate\|documentTypeCreateFormSchema\|documentTypeUpdateFormSchema\|from './document-types.schema'\|from \"./document-types.schema\"" apps/web/src --include="*.ts" --include="*.vue"` → must return NO matches. In particular check the stashed
   `document-types.resource.ts` and any `.vue` for a `DocumentType` import; if
   `DocumentType` (record) is imported anywhere, keep ONLY that single export
   (`export type DocumentType = z.output<typeof
   documentType.schemas.select>`) and record the keeper file in the final report.

**Verify**: grep clean (or single justified keeper) AND type-check exit 0.

### Step 4: Migrate roles, users, validation-results

**Do**:
1. `roles.schema.ts` → `defineEntitySchema(rpc.roles, { select:
   role.schemas.select, create: role.schemas.create, update:
   role.schemas.update })`; delete `Role`, `RoleCreate`, `RoleUpdate`.
2. `roles.actions.ts` → `create: api.create, update: api.update`; drop alias import.
3. `users.schema.ts` → keep `createUserFormSchema` (+ `roleSelection`) exactly;
   change only the `defineSchema<AppResourceContract<...>>` call to
   `defineEntitySchema(rpc.users, { select: user.schemas.select, create:
   createUserFormSchema, update: user.schemas.update })`. Keep `User` ONLY if
   imported elsewhere (grep `from './users.schema'` / `"./users.schema"`);
   else delete it.
4. `validation-results.schema.ts` → seam with `select` only (record-only;
   follow the seam's record-only call shape — if the seam requires create/update,
   STOP and report rather than inventing write schemas).
5. Grep each migrated file for remaining `defineSchema<AppResourceContract` →
   no matches in the four files.

**Verify**: type-check exit 0 after each file (or at minimum after all four).

### Step 5: Focused checks, lint, final grep

**Do**:
1. Focused web tests for touched areas → pass.
2. `lint:focused` on each touched file → exit 0.
3. `grep -rn "PublicSchema" apps/web/src/routes --include="*.schema.ts"` →
   the only allowed matches are `record:`-slot usages or none; NO match in a
   create/update slot.
4. `git status --short` → only in-scope files. `git diff --check` → clean.

**Verify**: all four hold.

## Test plan

- No new runtime specs. The seam type-test from plan 026 is the regression
  guard (phantom keys rejected, refinements accepted).
- Existing specs covering touched areas (roles/users specs if present) must
  still pass — list the exact spec paths run in the final report.
- Pattern reference: `apps/web/src/framework/__tests__/entity-schema-import.spec.ts`
  (entity schemas usable client-side through the bridge).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `document-types.schema.ts` contains no `defineSchema`, no `fromZod`, no
      `.omit(`, no `PublicSchema`, no `DocumentTypeCreate/Update` exports
- [ ] `document-types.actions.ts` and `roles.actions.ts` use `api.create` /
      `api.update` directly (no wrapper lambdas, no schema-type imports)
- [ ] `roles.schema.ts` has no `RoleCreate`/`RoleUpdate` exports
- [ ] `users.schema.ts` still exports `createUserFormSchema` with its
      uniqueness refinement; file uses `defineEntitySchema`
- [ ] `validation-results.schema.ts` uses the seam (or STOP-reported reason)
- [ ] Web `type-check` exits 0
- [ ] Focused tests + focused lint pass
- [ ] `git status --short` shows only in-scope files; `git diff --check` clean

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 026's seam change is absent (prerequisite not met).
- The stash name/message differs or the scoped restore pulls extra files.
- Any migrated file fails type-check because the seam rejects a VALID schema
  (e.g. users refinement) — the bug is in plan 026's seam, not here; do not
  work around it by reverting to `defineSchema`.
- `validation-results` record-only shape does not fit the seam — report, do
  not invent write schemas.
- `DocumentType`/`User`/`Role` record aliases have importers you cannot
  satisfy from `entity.schemas.select` output — keep the single alias and report.
- Any step needs `apps/api/**`, `packages/**`, `.vue`, permission, or field
  changes.
- A verification fails twice after a reasonable fix attempt.

## Execution record (2026-09-15 — PARTIAL, roles only)

- Roles migration DONE and green: `roles.schema.ts` → direct-shape
  `defineEntitySchema`, aliases deleted, `roles.actions.ts` simplified to
  `api.create/api.update`. Type-check exit 0, roles specs 11/11 pass, lint
  exit 0, zero remaining `RoleCreate/RoleUpdate` references (parent verified).
- document-types Steps 1-3 NOT EXECUTED (STOP, correct): API entity + rpc
  route absent at HEAD; restoring web files alone yields TS2307/TS2339.
  Executor restored then reverted; final tree has no document-types web dir.
- users Step 4.3 NOT EXECUTED (STOP, correct): seam rejects
  `createUserFormSchema` (`.passthrough()` caveat); file reverted to HEAD.
- validation-results Step 4.4 NOT EXECUTED (STOP, correct): dir absent at
  HEAD; seam requires create+update so record-only does not fit.

## Remaining work (replaces the Done criteria above for the unexecuted parts)

1. When the document-types module lands on the branch (unstash), its schema
   file must use `defineEntitySchema` from the start — the seam now exists and
   is proven. No `.omit()`-from-select base, no `DocumentTypeCreate/Update`
   aliases, `create: api.create` directly. (No new plan needed; enforce in
   review of the unstash.)
2. users `.passthrough()` decision: drop `.passthrough()` on the `{id}` union
   member (narrowest fix; the member already picks `id`) or normalize before
   the seam — then move `users.schema.ts` behind the seam. Needs a small
   dedicated plan (type-test must prove `{id}`-object input still accepted).
3. validation-results record-only: extend the seam with a create/update-less
   overload, or leave on `defineSchema` as the sanctioned record-only path.
   Decide in the same follow-up as (2).

## Maintenance notes

- New modules: start from `defineEntitySchema(route, entity.schemas)` (or the
  scaffold, which already emits it). Hand `.omit()` bases from select shapes
  are the banned pattern — reviewer: reject them on sight.
- UI refinements (`.extend()`) stay allowed but must pass the seam; required
  keys outside the wire fail type-check by design.
- If `*PublicSchema` aliases (`documentTypePublicSchema`, `userPublicSchema`)
  survive for `+scope.ts` enrich, consider a follow-up rename to
  `*EnrichedSelectSchema` so the name stops suggesting "safe form base".
  Explicitly out of this plan — mention only.
