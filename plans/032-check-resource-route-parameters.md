# Plan 032: Check supplied resource route parameters

## Status and execution rules

- Priority: P2. Effort: M. Risk: MED. Confidence: HIGH for the current gap;
  implementation must prove callback inference.
- Category: correctness / migration.
- Planned at: `c5d8f9b`, 2026-09-16.
- Depends on: Plan 031, completed and verified.
- Status: DONE — 2026-09-16. Parent review approved after two plan
  reconciliations. The final whole-definition constraint preserves inference.

Implementation at `c5d8f9b` changed the route union to bind each name to its
raw parameters and added one `defineResource` boundary check for extra keys in
pre-inferred objects and callback returns. Tests cover direct values, callbacks,
empty, optional and repeatable parameters, inherited runtime parameters,
explicit overrides and missing context. Two Plan 031 synthetic guard routes
now use their generated `userId` and `roleId` keys.

Verification passed: Loom and web type checks; 449 Loom tests; 22 focused web
navigation and generation tests; web lint; focused framework lint; web build;
and `git diff --check`. The plan's filtered `pnpm exec oxlint` command rejected
parent paths before linting, so the same three files were checked with the
installed web oxlint binary from the repository root. Initial Vitest and build
runs hit `EMFILE`; identical checks passed with `CHOKIDAR_USEPOLLING=true`.
Existing lint warnings and the build chunk-size warning remain visible.

Execute only when requested. Follow the steps in order and update this plan
and `plans/README.md` after review. No commit, publication, database work or
browser test is part of this plan.

Start with `git status --short` and
`git diff --stat c5d8f9b..HEAD -- packages/loom apps/web`.
Inspect unstaged, staged and untracked changes too. Plan 031 is expected to
change the route type and generation path described below. Confirm its
completion record and preserve its behavior. Reconcile any other source drift
before editing. Preserve the existing document-check module and skill changes.

## Why this matters

An existing route name can still have incorrect parameters. A callback can
return the wrong parameter key or an invalid value, and the current broad
record type accepts it. Check supplied parameters at the shared resource
boundary while preserving parent parameters inherited from the current route.

## Current state and intended contract

At planning time, `packages/loom/src/resources/actionResource.ts:37` contains:

```ts
type ActionParams = Record<string, string | number>
export type ResourceActionRoute<TIdentity extends RecordIdentity = RecordIdentity> = {
  name: string
  params?: ActionParams | ((id: TIdentity) => ActionParams)
}
```

Plan 031 will restrict `name` to the string keys of Vue Router's public
`RouteMap`, with fresh declarations generated before web compilation. It
deliberately leaves `params` unchanged. This plan replaces that broad parameter
contract. It does not change `toRoute`, URL resolution or runtime navigation.

Existing design example, `apps/web/src/router/tabs.ts:4`:

```ts
type RouteTabTarget = {
  [Name in keyof RouteNamedMap]: Omit<RouteLocationAsRelativeTypedList<RouteNamedMap>[Name], 'name' | 'params'> & {
    name: Name
    params?: Partial<RouteNamedMap[Name]['paramsRaw']>
  }
}[keyof RouteNamedMap]
```

The mapped union binds a route name to its own parameters. Follow this shape
using public `RouteMap` in Loom. Do not import the app's generated file.
Use `paramsRaw`, which describes navigation input, not normalized `params`.

These application declarations intentionally omit parent parameters:

- `apps/web/src/routes/(authenticated)/settings/roles/[roleId]/detail/permissions/role-permissions.resource.ts:19`
  uses `route: { name: 'settings-roles-detail-permissions' }`.
- `apps/web/src/routes/(authenticated)/settings/users/[userId]/detail/role-assignments/role-assignments.resource.ts:18`
  uses `route: { name: 'settings-users-detail-role-assignments' }`.

Keep them valid. Supplied parameters are checked; omitted parameters can still
come from current route context. The type system cannot prove that a parent
value is present at a later navigation. This plan does not claim to reject all
missing-parameter errors. A separate explicit context API would be needed for
that stronger guarantee and is outside this migration.

The intended use stays unchanged:

```ts
route: {
  name: 'settings-users-detail',
  params: (id) => ({ userId: String(id) }),
}
```

`packages/loom/src/resources/defineResource.ts` uses a generic `TActions`
constraint. Excess-property checks can differ at that boundary and on callback
returns. Verify actual `defineResource` calls; do not assume that a mapped
type alone checks every extra key.

## Scope

- `packages/loom/src/resources/actionResource.ts` and, only if needed for
  inferred callback validation, `packages/loom/src/resources/defineResource.ts`.
- `packages/loom/src/resources/__type-tests__/resource-actions.type-test.ts`.
- `packages/loom/src/resources/__tests__/resources.spec.ts`, only route output
  assertions affected by this contract.
- `packages/loom/README.md`, resource routes section only.
- `apps/web/src/framework/__type-tests__/resource-routes.type-test.ts`, created
  by Plan 031.
- `apps/web/src/router/__tests__/nested-navigation.spec.ts`.
- `apps/web/src/router/__tests__/guards.spec.ts`, only to correct the synthetic
  route parameter keys introduced by Plan 031; preserve each access assertion.
- `apps/web/src/router/__tests__/route-type-generation.spec.ts`, created by
  Plan 031, for isolated optional/repeatable route fixtures if needed.
- This plan and the index row.

Application resource declarations are verification inputs, not planned edits.
If one is invalid, report its exact defect before expanding scope. Do not add
casts, route helpers, a compatibility alias, a parameter registry, a new
navigation mode, runtime validation, or a default parent ID. Do not change API,
UI controls, app URLs, router naming, package dependencies or access rules.

## Commands

Run at the repository root. The commands were inspected during planning;
execution results are not yet available.

| Purpose | Command | Expected result |
|---|---|---|
| Loom types | `pnpm --filter @southneuhof/loom type-check` | Exit 0 |
| Web types | `pnpm --filter @southneuhof/framework-web type-check` | Generates current map, then exit 0 |
| Resource behavior | `pnpm --filter @southneuhof/loom test -- src/resources/__tests__/resources.spec.ts` | Selected tests pass |
| Navigation | `pnpm --filter @southneuhof/framework-web test:focused -- router/__tests__/nested-navigation.spec.ts router/__tests__/tabs.spec.ts router/__tests__/route-type-generation.spec.ts` | Selected tests pass |
| Framework lint | `pnpm --filter @southneuhof/framework-web exec oxlint ../../packages/loom/src/resources/actionResource.ts ../../packages/loom/src/resources/defineResource.ts ../../packages/loom/src/resources/__type-tests__/resource-actions.type-test.ts` | Exit 0 |
| Web lint | `pnpm --filter @southneuhof/framework-web lint:check` | Exit 0, or identify unchanged baseline failures |
| Build | `pnpm --filter @southneuhof/framework-web build` | Exit 0 |
| Patch | `git diff --check` | Exit 0 |

## Steps

### 1. Confirm the name-check baseline

Run both type checks. Confirm Plan 031's unknown-name cases still use their
`@ts-expect-error` directives. Run the navigation command and record existing
results before editing. Stop if Plan 031 is incomplete.

Add parameter cases to its app type-test file. Use the schema and public
resource-call structure from
`packages/loom/src/resources/__type-tests__/resource-actions.type-test.ts`.
Use the existing directive style from
`apps/web/src/framework/hono/__type-tests__/contracts.type-test.ts`.

Test matrix:

| Declaration | Result after this plan |
|---|---|
| Known route, matching scalar parameter object | Accept |
| Known route, correctly inferred identity callback | Accept |
| Child-list route, no `params` member | Accept |
| Known route, empty or partial parameter object | Accept; inherited context remains runtime-owned |
| `settings-users-detail` with only `roleId` | Reject |
| Correct `userId` plus extra `roleId` | Reject for direct literals and callback returns |
| `userId` is a boolean or object | Reject, including callback returns |
| Callback returns wrong key, or correct key plus an extra key | Reject |
| Plain unknown route name | Continue to reject |
| No route declared | Continue to accept |

Add negative cases at actual `defineResource` calls for list/detail/create/
update, not only `satisfies ResourceActionRoute`. Include an inferred variable
holding a wrong parameter object and a callback declared before the resource.
Keep identity callback inference and resource result inference positive cases.

Verify: web type-check initially reports unused directives for the parameter
defects accepted by the old contract. Record that expected failure. Do not
count unrelated schema or import errors as a regression demonstration.

### 2. Bind each route name to its raw parameters

Implement a mapped union over the string keys of Vue Router `RouteMap`.
Each member has `name: Name` and optional `params`, whose value is either
`Partial<RouteMap[Name]['paramsRaw']>` or an identity callback that returns
that shape. This is a target shape, not a claim that it alone enforces exact
keys for inferred callback returns.

Use the new negative tests to establish whether the generic resource boundary
admits extra keys. If it does, add a type-level constraint there that compares
the inferred supplied keys, or callback return keys, with the selected route's
raw parameter keys. Retain contextual typing for `id`; do not make callers
annotate every callback. Keep route-free custom actions unaffected. Do not
change global TypeScript strictness to make the tests pass.

Use the generic Vue Router map when a consumer has no typed map. Do not add an
alternate broad string member inside the typed-app union. Do not add fake
routes to the generated application map to satisfy tests.

Verify: both type checks pass, including every negative and positive case.
Run existing resource behavior tests. `toRoute` output must be unchanged.

### 3. Prove inherited values and supported parameter shapes

Extend `nested-navigation.spec.ts` with a memory-router case. Navigate to a
parent with an actual ID, resolve a resource child-list target with omitted
parameters, and assert the inherited ID and URL. Resolve an explicit parent
ID override and assert the new URL. Also resolve the same omitted target from
a route with no parent context and assert the existing missing-parameter
failure. This records the runtime limit instead of hiding it. No browser is
needed.

Use the isolated generated-map compiler fixture from Plan 031 for routes with
optional and repeatable parameters. Generate the fixture declarations from
actual route files; do not extend the real app map. Check that valid raw values
and arrays compile, invalid element values fail, optional values remain
optional, and callbacks receive the original resource identity type. For a
route with no parameters, a supplied nonempty parameter object must fail.

For exact-key cases, include both a direct object and a callback returning a
previously inferred variable. The compiler test must consume the real exported
resource API, never a copied substitute.

Verify: navigation and generation tests pass, then both type checks pass.
Existing child-list resources compile unchanged. The missing-context runtime
case fails only where its assertion expects that failure.

### 4. Finish the migration record

Update the Loom resource documentation: route names and supplied raw values
are checked; omitted context is resolved at runtime; type assertions can
bypass checks. State that consumers without a typed map retain Vue Router's
generic behavior. Do not promise required-parameter completeness.

Run the command table. Compare the final diff with the initial dirty state.
Confirm no parameter casts or caller wrappers were added to production code.
Record source revision, test results and any blocker, then update the index.

## Done criteria

- All matrix cases compile or fail as specified at the public resource call.
- Unused negative directives fail the normal type-check gate.
- Valid callback identity and action-output inference remain intact.
- No-parameter, optional and repeatable generated-route cases pass.
- Existing child-list declarations compile unchanged.
- Memory-router tests prove inheritance, override and missing-context behavior.
- Plan 031 name and stale-map regression tests remain passing.
- Applicable lint, build and patch checks pass; unrelated failures remain visible.
- Only scoped source owners change; index status includes verification evidence.

## Stop conditions

Stop and report if exact-key checks require a caller wrapper or unsafe cast,
if callbacks lose identity inference, if the type-checker reports recursive
type expansion failures, or if the implementation needs to alter runtime
navigation. Do not make every parameter mandatory to simplify the type.
Do not add implicit parent-value defaults. Report two failed repair attempts
at one fault before attempting a different design.

## Maintenance

Keep name and parameter tests at the shared boundary. New modules need no
duplicate type suite. When Vue Router changes its raw parameter contract,
rerun the isolated generated-map cases. Other Carta consumers are outside this
checkout and remain unverified until their own migration. Full static proof
of inherited context is explicitly deferred because current resource objects
do not carry the current route as a type parameter.
