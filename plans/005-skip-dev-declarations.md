# Plan 005: Skip type declarations for development and test manifests

> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 99d77a5..HEAD -- packages/sprindle/src/tooling/manifest.ts packages/sprindle/src/tooling/manifest.spec.ts apps/api/scripts/dev.ts apps/api/scripts/compile-routes.ts apps/api/scripts/build-production.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `99d77a5`, 2026-09-11

## Why this matters

Cold `pnpm dev:api` compiles the route manifest 3 times. Each compile emits
TypeScript declarations through 2 `tsc` subprocesses. A full API compile
takes about 2.4 s. A 1-route fixture compiles in about 150 ms. The fixed
declaration work is most of the 2.4 s. Development and test manifests do not
need declarations. The SDK and the editor use the production artifact. Skip
declarations for dev and test. This removes about 2 s per compile. With plan
006, dev startup drops by about 6 s.

## Current state

The relevant files, each with one line on its role:

- `packages/sprindle/src/tooling/manifest.ts` — owns `compileRouteManifest`
  (line 49) and `watchRouteManifest` (line 232). Line 69 always emits
  declarations, even for dev and test outputs.
- `apps/api/scripts/dev.ts` — dev entry. Line 5 selects
  `.sprindle-dev/routes.mjs`. Line 9 compiles with `bundle=false`. Line 38
  watches with `bundle=false`.
- `apps/api/scripts/compile-routes.ts` — test manifest compiler. Default
  output is `.sprindle-test/routes.mjs` with `bundle=false`.
- `apps/api/scripts/build-production.ts` — line 14 compiles a temporary
  manifest with `bundle=false`. The temp dir is deleted after bundling, so
  its declarations are pure waste.
- `packages/sprindle/tooling/build.mjs` — line 8 builds the production
  artifact `.sprindle/routes.mjs`. It must keep declarations. Do not touch it.
- `apps/api/src/__tests__/auth-manifest.spec.ts` — covers source and bundle
  manifests. The source case only asserts the file starts with `import`
  (line 21). It asserts no declaration. Unaffected.
- `packages/sprindle/src/tooling/manifest.spec.ts` — declaration tests use
  default args. Unaffected.

Excerpts of the code as it exists today:

```ts
// packages/sprindle/src/tooling/manifest.ts:49
export async function compileRouteManifest(projectRoot: string, routesDirectory = 'routes', output = '.sprindle/routes.mjs', bundle = true) {
```

```ts
// packages/sprindle/src/tooling/manifest.ts:66-71
    if (bundle) await build({ ... outfile: temporary, ... })
    else await writeFile(temporary, source(hash))
    const publishDeclaration = await emitRouteDeclarations(projectRoot, routesDirectory, model.routes, target.replace(/\.mjs$/, '.d.ts'))
    await rename(temporary, target)
    await publishDeclaration()
```

```ts
// apps/api/scripts/dev.ts:5,9 and 38
const manifest = '.sprindle-dev/routes.mjs'
await compileRouteManifest(projectRoot, 'src/routes', manifest, false)
const watcher = await watchRouteManifest(projectRoot, 'src/routes', (error) => { ... }, manifest, false)
```

```ts
// apps/api/scripts/compile-routes.ts:1-3
import { compileRouteManifest } from '@southneuhof/sprindle/tooling'
const target = await compileRouteManifest(new URL('..', import.meta.url).pathname, 'src/routes', process.argv[2] ?? '.sprindle-test/routes.mjs', false)
process.stdout.write(`${target}\n`)
```

```ts
// apps/api/scripts/build-production.ts:14
await compileRouteManifest(root, 'src/routes', `${generatedName}/routes.mjs`, false)
```

```ts
// packages/sprindle/src/tooling/manifest.ts:232
export async function watchRouteManifest(projectRoot: string, routesDirectory = 'routes', onResult?: (error?: Error) => void, output = '.sprindle/routes.mjs', bundle = true) {
```

Repo conventions that apply here:

- Failed compiles preserve the old output. The cycle test in
  `packages/sprindle/src/tooling/manifest.spec.ts:89-102` proves it. Keep
  that order: heavy work first, atomic rename last.
- The static cycle check (`rejectStaticCycles`, line 63) stays unconditional.
  Syntax errors still fail dev compiles through the esbuild analysis step.
  Only type-level declaration output is skipped.
- After this change the dev watcher no longer gates on type errors.
  `pnpm routes:check` and editor diagnostics stay the type gates. This is
  intended. Do not re-add declaration emit to dev to "catch" type errors.
- Framework change authorization: the user selected this perf scope
  (Top 2 findings) on 2026-09-11. The change stays inside that scope.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Framework typecheck | `pnpm --filter @southneuhof/sprindle type-check` | exit 0 |
| API typecheck | `pnpm --filter @southneuhof/api type-check` | exit 0 (slow; regenerates production declarations) |
| Framework lint | `pnpm --filter @southneuhof/sprindle lint` | exit 0 |
| API script lint | `pnpm --filter @southneuhof/api lint:focused -- scripts/dev.ts scripts/compile-routes.ts scripts/build-production.ts` | exit 0 |
| Framework manifest tests | `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts` | all pass |
| API manifest test | `pnpm --filter @southneuhof/api test:focused -- 'src/__tests__/auth-manifest.spec.ts'` | all pass |
| Dev startup proof | `pnpm --filter @southneuhof/api test:dev-routes` | pass |

## Scope

**In scope** (the only files you should modify):

- `packages/sprindle/src/tooling/manifest.ts`
- `packages/sprindle/src/tooling/manifest.spec.ts` (new regression test)
- `apps/api/scripts/dev.ts`
- `apps/api/scripts/compile-routes.ts`
- `apps/api/scripts/build-production.ts`
- `packages/sprindle/docs/file-routing-tooling.md` (only if it states
  declarations always emit; else leave it)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- `packages/sprindle/tooling/build.mjs` — production path; must keep
  declarations.
- Watcher startup count — plan 006 owns it.
- Watcher directory filters, dev manifest bundling, contracts pruning,
  parallel server imports — deferred findings, not planned.
- SDK, editor, web app — they read the production artifact, unaffected.

## Git workflow

- Branch: `advisor/005-skip-dev-declarations`
- Commit per step or per logical unit. Message style matches `git log`:
  short imperative, e.g. `Add API startup progress logs`,
  `Ensure Sprindle tooling before API route commands`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add an options parameter to `compileRouteManifest`

In `packages/sprindle/src/tooling/manifest.ts`, change the signature to
accept an options object with a `declarations` flag that defaults to emit:

```ts
export async function compileRouteManifest(projectRoot: string, routesDirectory = 'routes', output = '.sprindle/routes.mjs', bundle = true, options: { declarations?: boolean } = {}) {
```

Inside the function, read `const emitDeclarations = options.declarations ?? true`
near the top. Replace lines 69-71 with a conditional publish: when
`emitDeclarations` is true, keep the exact current behavior. When false,
rename the manifest only, then best-effort remove the stale declaration
file:

```ts
const publishDeclaration = emitDeclarations ? await emitRouteDeclarations(projectRoot, routesDirectory, model.routes, target.replace(/\.mjs$/, '.d.ts')) : undefined
await rename(temporary, target)
if (publishDeclaration) await publishDeclaration()
else await rm(target.replace(/\.mjs$/, '.d.ts'), { force: true })
```

`rm` is already imported at the top of the file. Keep `rejectStaticCycles`,
hashing, the try/finally, and the failure-preserves-output order unchanged.

**Verify**: `pnpm --filter @southneuhof/sprindle lint` → exit 0.
`grep -n "emitDeclarations" packages/sprindle/src/tooling/manifest.ts` →
shows the new lines.

### Step 2: Forward the option through `watchRouteManifest`

Add a 6th parameter `options: { declarations?: boolean } = {}` to
`watchRouteManifest` (line 232). Pass it to the `compileRouteManifest`
call inside the `compile` closure (line 250). No other logic changes.

**Verify**: `pnpm --filter @southneuhof/sprindle lint` → exit 0.

### Step 3: Disable declarations at dev, test, and temp-manifest call sites

- `apps/api/scripts/dev.ts` line 9: append `{ declarations: false }`.
- `apps/api/scripts/dev.ts` line 38 watcher call: append
  `{ declarations: false }` after the `false` bundle arg.
- `apps/api/scripts/compile-routes.ts` line 2: append
  `{ declarations: false }`. This script only serves the test manifest
  (default `.sprindle-test/routes.mjs`); production uses `routes:build`.
- `apps/api/scripts/build-production.ts` line 14: append
  `{ declarations: false }`. The output is a temp dir deleted after bundling.

**Verify**: `grep -rn "declarations: false" apps/api/scripts/` → 4 matches
(dev.ts twice, compile-routes.ts once, build-production.ts once).
`pnpm --filter @southneuhof/api lint:focused -- scripts/dev.ts scripts/compile-routes.ts scripts/build-production.ts` → exit 0.

### Step 4: Add a regression test for skipped declarations

In `packages/sprindle/src/tooling/manifest.spec.ts`, model after the
`fixture` helper (line 10) and the first test (line 13). Add a test named
`skips declarations when disabled` that:

1. Builds the 1-route fixture.
2. Compiles with `{ declarations: false }`.
3. Asserts the manifest file loads and `default` has 1 route (import via
   `pathToFileURL` with a query suffix, as line 19 does).
4. Asserts the sibling `.d.ts` file does NOT exist (`existsSync` is
   already imported).
5. Compiles the same fixture with defaults and asserts the `.d.ts`
   exists.

**Verify**: `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts` → all pass, including the new test.

### Step 5: Check the tooling doc for stale statements

Run `grep -rn "declaration" packages/sprindle/docs/file-routing-tooling.md`.
If the doc states declarations always emit, update one paragraph: dev and
test manifests skip them; production `routes:build` still emits. If it makes
no such statement, change nothing and record that in the index row.

**Verify**: `git status --short` → only in-scope files modified.

### Step 6: Run the full gates and record timings

Run in order: framework type-check, API type-check, manifest.spec,
auth-manifest focused, dev proof. Record the dev-proof pass and, if easy,
one cold `dev.ts` compile timing for the index row.

**Verify**: all commands in the table exit 0 / pass.

## Test plan

- New test in `packages/sprindle/src/tooling/manifest.spec.ts`:
  skip case (manifest loads, no `.d.ts`) plus default case (`.d.ts` present).
- Existing pattern: the `fixture` helper and first test in the same file.
- Existing suites that must pass unchanged:
  `src/tooling/manifest.spec.ts` (full file),
  `apps/api/src/__tests__/auth-manifest.spec.ts` (both source and bundle modes),
  `pnpm --filter @southneuhof/api test:dev-routes` (cold dev start plus
  add, invalid recovery, move, delete).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "options: { declarations?: boolean }" packages/sprindle/src/tooling/manifest.ts` returns matches (both functions).
- [ ] `grep -rn "declarations: false" apps/api/scripts/` returns 4 matches.
- [ ] `git diff --stat 99d77a5..HEAD -- packages/sprindle/tooling/build.mjs` is empty (production path untouched).
- [ ] New skip-declarations test exists and passes; full manifest.spec passes.
- [ ] `pnpm --filter @southneuhof/api test:focused -- 'src/__tests__/auth-manifest.spec.ts'` passes.
- [ ] `pnpm --filter @southneuhof/api test:dev-routes` passes.
- [ ] Both type-checks exit 0; both lints exit 0.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for 005 updated to DONE with evidence.

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- An existing declaration test fails because it relied on dev or test
  declarations. Report; do not weaken the test without approval.
- The dev proof fails for environment reasons (missing database, busy port)
  rather than the change. Record the exact error; do not fix infrastructure.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The dev watcher no longer gates on type errors. `routes:check` and editor
  diagnostics are the type gates.
- Production declarations come from `routes:build` only. SDK consumers read
  `.sprindle/routes.d.ts`, never `.sprindle-dev`.
- If a new manifest output kind is added (for example E2E), decide
  explicitly whether it needs declarations. The default is emit.
- Reviewer focus: default-true preserves old behavior; stale
  `.sprindle-dev/routes.d.ts` removal cannot race other processes because
  dev and test use separate directories.
