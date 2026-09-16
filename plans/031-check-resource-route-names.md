# Plan 031: Reject unknown resource route names during type checking

## Status and execution rules

- Priority: P1. Effort: M. Risk: MED. Confidence: HIGH.
- Category: correctness / migration / developer tooling.
- Planned at: `c5d8f9b`, 2026-09-16.
- Depends on: none. Plan 032 follows this plan.
- Status: DONE — 2026-09-16. Parent review approved after one revision to
  make the stale-map test fail at the real `defineResource` declaration.

When execution is requested, follow the steps in order. Update this plan and
the row in `plans/README.md` after checking the result. Do not commit, push,
publish a package, change a database, or run browser tests.

First run `git status --short` and
`git diff --stat c5d8f9b..HEAD -- packages/loom apps/web turbo.json`.
Also inspect `git diff -- packages/loom apps/web turbo.json` and untracked
files. Compare the excerpts below with current source. Preserve existing work.
The planning checkout has modified skills, API files, navigation and route
declarations, plus an untracked document-check module. These are not disposable.

## Why this matters

A resource can name a route that does not exist. Type checking currently
accepts it, then `RouterLink` fails when the page renders. The fix must make
the normal web type-check command reject that declaration. A source review
instruction or optional test command is not sufficient.

## Current state and evidence

`packages/loom/src/resources/actionResource.ts:39` declares:

```ts
export type ResourceActionRoute<TIdentity extends RecordIdentity = RecordIdentity> = {
  name: string
  params?: ActionParams | ((id: TIdentity) => ActionParams)
}
```

`ListResourceAction`, `DetailResourceAction`, `CreateResourceAction` and
`UpdateResourceAction` use this type. `toRoute` in the same file converts it
to a Vue Router target. Keep that conversion and navigation behavior unchanged.
`packages/loom/src/resources/defineResource.ts` infers `TActions` through
`ActionResourceDefinition<TSchema>['actions']`. Test the public function, not
only an isolated assignment to the exported route type.

`apps/web/src/route-map.d.ts:21` augments Vue Router `TypesConfig.RouteNamedMap`.
Vue Router's installed public `RouteMap` type uses that augmentation, and uses
its generic map in an application without generated route declarations.
Loom must import the public type from `vue-router`, not an app file or
`vue-router/auto-routes`.

Existing typed-route example, `apps/web/src/router/tabs.ts:4`:

```ts
type RouteTabTarget = {
  [Name in keyof RouteNamedMap]: Omit<RouteLocationAsRelativeTypedList<RouteNamedMap>[Name], 'name' | 'params'> & {
    name: Name
    params?: Partial<RouteNamedMap[Name]['paramsRaw']>
  }
}[keyof RouteNamedMap]
```

This plan changes names only. Keep the current `ActionParams` contract until
Plan 032. Keep string route names; adding symbol route support is not needed.

`apps/web/package.json` runs `vue-tsc --noEmit --incremental -p
tsconfig.vitest.json` for `type-check`. It does not first generate route types.
`apps/web/vite.config.ts:31` configures the generator with:

```ts
VueRouter({
  routesFolder: 'src/routes',
  extensions: ['.route.vue', '.layout.vue'],
  dts: 'src/route-map.d.ts',
  getRouteName: staticRouteName,
  beforeWriteFiles: applyFileRouteConventions,
})
```

`apps/web/src/router/__tests__/file-routing.spec.ts:25` already uses
`createRoutesContext(resolveOptions(...))`, `await context.scanPages(false)`
and `context.stopWatcher()` to scan isolated route files. Use this supported
API. Installed declarations also expose `writeConfigFiles()`.

The existing regex test in
`apps/web/src/framework/__tests__/route-resource-boundary.spec.ts:117` checks
only one literal declaration format. Replace that one test after compiler
coverage exists. Preserve the other tests in that file.

Both TypeScript and web CI run the existing package type-check commands through
Turbo. `turbo.json` caches type-check tasks. The web build command already runs
type-check before build-only. No new CI job is needed.

## Scope

Only these source owners may change:

- `packages/loom/src/resources/actionResource.ts`.
- `packages/loom/src/resources/defineResource.ts`, only if the existing generic
  constraint bypasses name validation; keep its public call shape.
- `packages/loom/src/resources/__type-tests__/resource-actions.type-test.ts`.
- `packages/loom/README.md`, resource route documentation only.
- `apps/web/src/router/file-routing/options.ts` (new shared generator options).
- `apps/web/scripts/generate-route-types.mjs` (new command).
- `apps/web/vite.config.ts`, only to consume the shared options.
- `apps/web/package.json`, scripts only; `turbo.json`, web type-check task only.
- `apps/web/src/route-map.d.ts`, generator output only.
- `apps/web/src/framework/__type-tests__/resource-routes.type-test.ts` (new).
- `apps/web/src/framework/__tests__/route-resource-boundary.spec.ts`.
- `apps/web/src/router/__tests__/route-type-generation.spec.ts` (new).
- `apps/web/src/router/__tests__/guards.spec.ts` and
  `apps/web/src/router/__tests__/nested-navigation.spec.ts`, only synthetic
  resource route declarations affected by the new contract.
- This plan and its index row.

Do not change API code, application screens, route URLs, route naming rules,
authentication, storage, database files, input controls, or unrelated skills.
No dependency update, compatibility wrapper, manual route-name list, or
per-resource opt-in helper is needed.

## Commands

Run from the repository root. Existing commands were inspected, not executed
during planning. New commands are marked below.

| Purpose | Command | Expected result |
|---|---|---|
| Loom types | `pnpm --filter @southneuhof/loom type-check` | Exit 0 |
| Web types | `pnpm --filter @southneuhof/framework-web type-check` | Exit 0 after generation |
| Resource behavior | `pnpm --filter @southneuhof/loom test -- src/resources/__tests__/resources.spec.ts` | Selected tests pass |
| Route checks | `pnpm --filter @southneuhof/framework-web test:focused -- router/__tests__/route-type-generation.spec.ts router/__tests__/file-routing.spec.ts router/__tests__/nested-navigation.spec.ts router/__tests__/guards.spec.ts framework/__tests__/route-resource-boundary.spec.ts` | Selected tests pass |
| Web lint | `pnpm --filter @southneuhof/framework-web lint:check` | Exit 0, or identify an unchanged baseline failure |
| Framework lint | `pnpm --filter @southneuhof/framework-web exec oxlint ../../packages/loom/src/resources/actionResource.ts ../../packages/loom/src/resources/defineResource.ts ../../packages/loom/src/resources/__type-tests__/resource-actions.type-test.ts` | Exit 0 |
| Build | `pnpm --filter @southneuhof/framework-web build` | Type-check runs first; exit 0 |
| Patch | `git diff --check` | Exit 0 |

## Steps

### 1. Record the baseline and add compiler regression cases

Run the existing Loom and web type checks before editing. Record any existing
failure. Do not repair unrelated failures.

Create the app type-test file using
`packages/loom/src/resources/__type-tests__/resource-actions.type-test.ts` as
the resource-schema example. Use actual generated names such as
`settings-users`, `settings-users-detail`, `settings-users-create`, and
`settings-users-edit`. Define a minimal local schema and transport functions;
do not import the document-check service or call a server.

For each of list/detail/create/update, add an otherwise-valid `defineResource`
call whose route name is `missing-resource-route`. Put `@ts-expect-error` on
the exact diagnostic line. Add a valid name held in a `const`, a plain string
variable as a negative case, and a resource with no route as a positive case.
Keep positive checks for inferred record identity and action return values.

Verify: run web type-check. Before the fix, the new negative cases must report
unused `@ts-expect-error` directives. This is the expected failing test. A
different error, such as an invalid schema, is not proof of the route defect.

### 2. Generate fresh declarations before compilation

Move the five generator options above into the new shared `options.ts` owner.
Keep imports of `staticRouteName` and `applyFileRouteConventions` there. Vite
and the new command must consume that same owner.

Use a small `.mjs` command with the installed Vite `runnerImport` export to
load the TypeScript options. Pass `configFile: false` and `envFile: false` so
it does not load the whole app config or require a port or credentials. Use
Vue Router's `createRoutesContext` and `resolveOptions`. Disable watching,
await the scan and required declaration write, and stop the watcher in
`finally`. Resolve paths from the script location, not an accidental current
directory. Support an explicit fixture root for the regression test; all
fixture output must remain under that root.

Add `routes:generate` = `node scripts/generate-route-types.mjs` to the web
package. Prefix the existing `type-check` command with `pnpm run routes:generate
&&`. Keep the existing compiler flags. Do not start a dev server, perform a
production build to get declarations, or read application environment files.

Make the web-specific Turbo type-check task uncached, retaining its dependency
on `^type-check`. This small task override guarantees a scan on every requested
web check. Leave other package caches unchanged. Cache optimization is outside
this plan.

Add isolated tests for: absent declaration file; route addition; route rename;
route deletion with a stale declaration left behind; repeated unchanged scan;
and duplicate-name rejection. Spawn the real command against the fixture root.
Assert the resulting declared names, command status and absence of a persistent
process. Use existing temporary-directory cleanup from `file-routing.spec.ts`.

Verify: run the focused route-generation test, then
`pnpm --filter @southneuhof/framework-web routes:generate` (new command).
Both must exit 0. The actual generated map must retain current application
routes, including the untracked document-check module if it still exists.

### 3. Narrow the shared route-name type

Use `Extract<keyof RouteMap, string>` from Vue Router for `name`. Preserve
the `TIdentity` parameter and current `params` type. A plain string must not
be an alternate union member in a typed application. In a generic Vue Router
consumer, its generic map naturally retains string names; no new fallback
configuration is needed.

Run the negative cases through `defineResource`. If its generic inference
accepts an invalid name, fix the constraint at that boundary rather than
requiring callers to add `satisfies`, a cast, or a wrapper.

App tests define synthetic runtime routes not present in the generated map.
First try to use existing generated names for these private test routers,
changing only fixture names and their assertions. Keep the tested paths and
access conditions. If a generated temporary-tree fixture cannot use those
names, use a narrowly scoped `@ts-expect-error` on that synthetic declaration
with a comment naming the isolated fixture. Never augment the real app map
with fake test routes or add a general unsafe route factory.

Verify: both package type checks now exit 0. All negative directives are used.
Run the resource behavior and focused route checks from the command table.
Valid routes, permissions and navigation results must remain unchanged.

### 4. Prove the normal gate detects stale names

Extend the isolated generation test to compile a minimal consumer that calls
the real `defineResource` with the fixture's generated route map. Use the
installed TypeScript compiler, a temporary `tsconfig`, and no API imports.
Do not hand-copy `ResourceActionRoute` into the test.

Start with a real fixture route: generation plus compilation succeeds. Remove
the route file but keep the old map and consumer. Run the same generation-first
sequence: compilation must fail on the route name. Restore the route: the
sequence must succeed. This test joins the generator and type boundary.

Verify that the normal web command uses the same generator entry point before
the compiler. Run the web type-check task through Turbo twice:
`pnpm exec turbo run type-check --filter=@southneuhof/framework-web
--output-logs=full`. The web task must execute on both runs; dependency tasks
may use their caches. Record prerequisites or failures without changing API
source or starting services.

Verify: the new regression test and both normal type checks pass. Remove only
the superseded regex route-name test and its now-unused helper. Run the rest
of the boundary test to prove it remains active.

### 5. Document and review

Document that resource names use the consumer's Vue Router map, that Carta
refreshes the map during type-check, and that parameter typing remains as before.
Run the command table. Inspect `git diff` against the initial dirty state.
Record failed or blocked checks separately from passes. Mark DONE only when
the required compiler and regression checks have passed.

## Done criteria

- Normal web type-check rejects unknown resource names for all four actions.
- It accepts existing application resource declarations without opt-in helpers.
- Loom's standalone type-check passes without importing an app route map.
- Route add/rename/delete tests and stale-map compilation test pass.
- Shared options preserve route naming, layout validation and generated URLs.
- Resource runtime and focused app route tests pass.
- Normal web build and applicable lint checks pass; no hidden baseline failures.
- No source changes outside the scope list; no change to existing unrelated work.
- Index row records commands, results and source revision before DONE.

## Stop conditions

Stop the affected step and report if the public generator cannot produce a
complete declaration file without a server; if narrowing the route name loses
record identity inference; if application routes need casts to pass; or if a
fix needs an out-of-scope owner. Do not replace the type check with regex.
After two failed attempts at one fault, report the fault and evidence instead
of weakening a negative test. Missing local prerequisites are blockers, not
passing checks.

## Maintenance

Changes to file naming, layout handling or router versions must use the shared
options and keep the stale-map test. Other Carta apps can acquire new compile
errors when they update Loom; this plan verifies only this checkout. Package
publication and other application migrations require separate scope. Type
assertions and `any` can bypass TypeScript; this plan makes normal declarations
safe, not arbitrary unsafe code impossible.

## Implementation record — 2026-09-16

Implemented against `c5d8f9b`. Loom now constrains resource route names to the
consumer's public Vue Router `RouteMap`. The web package owns one shared route
generator configuration and regenerates `src/route-map.d.ts` before each normal
type check. Turbo bypasses the web type-check cache, while dependency caches
remain available.

The compiler type test covers list, detail, create and update names, a literal
constant, a broad string and a resource without route metadata. The isolated
generator test covers a missing declaration, addition, rename, deletion,
repeat generation, duplicate names and stale-map compilation through the real
`defineResource` function. Synthetic router tests now use generated application
names. The obsolete regex-only resource route-name test was removed.

Verification results:

- Loom and web package type checks passed.
- Both Turbo web type-check runs passed; the web task executed with `cache bypass`
  on both runs.
- The focused route suite passed 40 tests in five files. The host reached its
  file-watch limit with the plain command; the same command passed with
  `CHOKIDAR_USEPOLLING=true`.
- The Loom test command passed 56 files and 449 tests.
- Web build passed with `CHOKIDAR_USEPOLLING=true` after the plain build reached
  the same host file-watch limit.
- Web lint passed with two unchanged warnings in `RailItem.vue` and the user's
  untracked document-type detail page. Focused framework lint exited zero with
  existing warnings in `actionResource.ts`.
- `git diff --check` passed.

No API source, database, browser test, package publication, commit or push was
part of this execution. Final status remains subject to parent review.
