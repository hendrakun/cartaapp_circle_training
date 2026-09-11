# Plan 007: Narrow the route watcher to routes plus compiled inputs

> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 99d77a5..HEAD -- packages/sprindle/src/tooling/manifest.ts packages/sprindle/src/tooling/manifest.spec.ts apps/api/scripts/dev.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED
- **Depends on**: none (works with or without 005/006; if 005/006 land
  first, rebase onto them and keep their signatures)
- **Category**: perf
- **Planned at**: commit `99d77a5`, 2026-09-11

## Why this matters

The dev watcher holds ~50 directory watchers over the whole API project and
recompiles on any project file change. An edit to `drizzle/`, `scripts/`,
`.env`, or any unrelated source file triggers a full ~2.4 s manifest compile
and a server restart decision. During normal development this causes spurious
reloads and wasted CPU. The compiler already knows the true input set: route
files plus esbuild metafile inputs plus tsconfig chain (`dependencyInputs`).
Watch exactly that set: the routes directory plus compiled input directories.
Spurious recompiles stop. Handle count drops from ~51 project dirs to ~30
route dirs plus ~10 dep dirs (mostly overlapping).

## Current state

The relevant files, each with one line on its role:

- `packages/sprindle/src/tooling/manifest.ts` — owns `watchRouteManifest`
  (lines 232-253). This plan only changes the watcher scope, not compile
  logic, debounce, close, or declaration emit.
- `apps/api/scripts/dev.ts` — dev entry. Calls `watchRouteManifest` at
  line 38. No signature change is planned, so this file likely stays
  untouched. Verify only.
- `packages/sprindle/src/tooling/manifest.spec.ts` — watch tests at lines
  33-53 plus external-cycle test at lines 104-124. These pin the contract
  this plan must preserve.

Excerpts of the code as it exists today:

```ts
// packages/sprindle/src/tooling/manifest.ts:232-240
export async function watchRouteManifest(projectRoot: string, routesDirectory = 'routes', onResult?: (error?: Error) => void, output = '.sprindle/routes.mjs', bundle = true) {
  let queue = Promise.resolve(), timer: ReturnType<typeof setTimeout> | undefined, closed = false
  const project = resolve(projectRoot), watched = new Map<string, ReturnType<typeof watch>>()
  const recursiveWatcher = watch(project, { recursive: true }, (_event, filename) => {
    const path = filename?.toString().replaceAll('\\', '/') ?? ''
    if (path.split('/').some((part) => part.startsWith('.sprindle')) || path.split('/').some((part) => ['.git', 'dist', 'dist-tooling', 'node_modules'].includes(part))) return
    if (!closed) schedule()
  })
  const directories = (directory: string): string[] => [directory, ...readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() && !entry.name.startsWith('.sprindle') && !['.git', 'dist', 'dist-tooling', 'node_modules'].includes(entry.name) ? directories(resolve(directory, entry.name)) : [])]
```

```ts
// packages/sprindle/src/tooling/manifest.ts:241-253
  const refreshWatchers = () => {
    if (closed) return
    const wanted = new Set([...directories(project), ...(dependencyInputs.get(project) ?? []).map(dirname)])
    for (const directory of wanted) if (!watched.has(directory)) watched.set(directory, watch(directory, (_event, filename) => {
      if (filename?.toString().startsWith('.sprindle')) return
      if (!closed) { refreshWatchers(); schedule() }
    }))
    for (const [directory, watcher] of watched) if (!wanted.has(directory)) { watcher.close(); watched.delete(directory) }
  }
  const compile = () => { if (closed) return; queue = queue.then(() => compileRouteManifest(projectRoot, routesDirectory, output, bundle).then(() => { if (!closed) { refreshWatchers(); onResult?.() } }, (error: Error) => { if (!closed) { refreshWatchers(); onResult?.(error) } })) }
  const schedule = () => { if (closed) return; if (timer) clearTimeout(timer); timer = setTimeout(() => { timer = undefined; compile() }, 100) }
  refreshWatchers(); compile(); await queue; compile(); await queue
  return { close: async () => { closed = true; recursiveWatcher.close(); if (timer) { clearTimeout(timer); timer = undefined }; await queue; for (const watcher of watched.values()) watcher.close(); watched.clear() } }
```

```ts
// packages/sprindle/src/tooling/manifest.ts:60-62
  const bundled = Object.keys(analysis.metafile.inputs).filter((file) => !file.endsWith('sprindle-routes.ts') && file !== '<stdin>').map((file) => isAbsolute(file) ? file : existsSync(resolve(file)) ? resolve(file) : resolve(projectRoot, file))
  const inputs = [...new Set([...bundled, ...(await configInputs(resolve(projectRoot, 'tsconfig.json')))])].sort()
  dependencyInputs.set(resolve(projectRoot), inputs)
```

Key facts the implementer must preserve:

- `dependencyInputs` is populated by every successful compile analysis
  (line 62), even before hashing. It holds route files, helper/entity/db
  inputs, tsconfig chain, and external sibling inputs. The watcher reads it
  in `refreshWatchers`. Do not change that map's key or population.
- The existing tests that must keep passing:
  - `watch recovers after an invalid source tree is fixed` (lines 33-43):
    route edit triggers recompile, error then success callbacks.
  - `watch close cancels a pending edit without reopening handles`
    (lines 45-53): close cancels the debounced compile.
  - `watch recovers when an external cycle is fixed by an external edit`
    (lines 104-124): an edit to a symlinked dir OUTSIDE the project root
    (`base/shared/b.ts`, reached via `root/shared` symlink) must trigger a
    recompile. This works today because dep dirnames include the external
    dir. The narrowed watcher must keep watching external dep dirs.
- `dev.ts` passes `routesDirectory='src/routes'`, so
  `routesRoot = resolve(projectRoot, 'src/routes')` =
  `apps/api/src/routes`. Fixture tests pass `'routes'`, so
  `routesRoot = <tmp>/routes`. Compute it from the arguments; do not
  hardcode.
- Repo conventions: failure preserves output; static cycle check stays
  unconditional; debounce stays 100 ms; close semantics stay exact.
- Framework change authorization: the user selected PERF-01 through
  PERF-03 for plans on 2026-09-11. This change stays inside that scope.
- If plans 005/006 already landed, their signatures add a 5th/6th
  `options: { declarations?: boolean }` parameter and a single startup
  compile. Rebase: keep their parameters, forward them unchanged, and only
  narrow the watched directories. Do not revert their changes.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Framework typecheck | `pnpm --filter @southneuhof/sprindle type-check` | exit 0 |
| API typecheck | `pnpm --filter @southneuhof/api type-check` | exit 0 |
| Framework lint | `pnpm --filter @southneuhof/sprindle lint` | exit 0 |
| Watcher tests | `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts` | all pass, including new tests |
| Packaged watcher test | `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/tooling.spec.ts` | all pass (~120 s, covers packaged `dev.js` startup) |
| Dev startup proof | `pnpm --filter @southneuhof/api test:dev-routes` | pass |

## Scope

**In scope** (the only files you should modify):

- `packages/sprindle/src/tooling/manifest.ts` (watcher scope only:
  recursive watcher root, `directories()` seed, `wanted` set)
- `packages/sprindle/src/tooling/manifest.spec.ts` (new regression tests)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- Compile logic, hashing, cycle check, declaration emit (plan 005 owns
  declarations; do not re-implement it here — forward any existing options
  param untouched).
- Watcher startup compile count (plan 006 owns line 252; if 006 landed,
  keep its single-compile form; if not, leave the line as is).
- Debounce delay, close semantics, `refreshWatchers` trigger-then-refresh
  order — keep as is.
- `apps/api/scripts/dev.ts` — no change expected; if the watcher signature
  is unchanged, leave it alone.
- Dev manifest bundling (PERF-04), contracts pruning (PERF-05), parallel
  server imports (PERF-06) — deferred, not planned.
- SDK, editor, web app.

## Git workflow

- Branch: `advisor/007-narrow-route-watcher`
- If 005/006/007 are done in one pass, one branch
  `advisor/005-006-007-dev-startup` is acceptable. Record it in all rows.
- Commit per step. Message style matches `git log`: short imperative,
  e.g. `Add API startup progress logs`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Scope the watcher to the routes root plus compiled inputs

In `packages/sprindle/src/tooling/manifest.ts`, inside
`watchRouteManifest`:

1. Add `const routesRoot = resolve(project, routesDirectory)` next to the
   `project` binding (line 234).
2. Change the recursive watcher (line 235) to watch `routesRoot` instead of
   `project`. Keep the same filename filter. Rationale: route adds, moves,
   deletes, and edits all happen under the routes root. The output file
   (`.sprindle-dev/`, `.sprindle/`) lives outside it, so its events stop
   naturally.
3. Change `refreshWatchers` (line 243): seed directory enumeration from
   `routesRoot`, not `project`:
   `const wanted = new Set([...directories(routesRoot), ...(dependencyInputs.get(project) ?? []).map(dirname)])`.
   Keep the `.sprindle`/`.git`/`dist`/`dist-tooling`/`node_modules`
   exclusions inside `directories()` unchanged.
4. Keep watching external dep dirs as today: `dependencyInputs` holds
   absolute paths, including files outside the project (sibling/symlinked
   trees). Their `dirname`s stay in `wanted`. Do not filter `wanted` to
   inside-project paths — the external-cycle test depends on outside
   watching.
5. Keep everything else identical: per-dir non-recursive watchers, the
   `.sprindle` filename guard, `refreshWatchers()` before `schedule()` on
   per-dir events, close semantics, debounce, queue.

Assumption to preserve: `routesRoot` exists when the watcher opens (true
for dev and all current tests; compile would fail otherwise). If `watch()`
throws ENOENT for a missing routes root, let it propagate as today for a
missing project — do not add fallback watching or directory creation.

**Verify**: `pnpm --filter @southneuhof/sprindle lint` → exit 0.
`grep -n "routesRoot" packages/sprindle/src/tooling/manifest.ts` → matches
for the binding, the recursive watcher, and the wanted set.
`grep -n "directories(project)" packages/sprindle/src/tooling/manifest.ts` →
no matches.

### Step 2: Add regression tests for scoped watching

In `packages/sprindle/src/tooling/manifest.spec.ts`, model after the
`fixture` helper (line 10) and the watch tests (lines 33-53). Add two tests:

1. `watch ignores edits outside routes and inputs`:
   - Build the 1-route fixture.
   - Open `watchRouteManifest`, await startup, record callback count.
   - Write an unrelated file at project root (e.g. `notes.txt`) and a file
     in a new unrelated dir (e.g. `scripts/tool.ts`). Wait ~300 ms.
   - Assert callback count is unchanged (no recompile triggered).
   - Then edit the route file, wait for the success callback, assert count
     increased by exactly 1. Close the watcher.
   - This proves unrelated edits no longer recompile while route edits
     still do.
2. `watch follows new dependency directories after import`:
   - Build the 1-route fixture.
   - Open the watcher, await startup.
   - Add `helper.ts` at project root importing nothing; edit the route to
     `import { value } from '../../helper'` (same import shape as the first
     test at line 22). Wait for success callback.
   - Edit `helper.ts` again (change the exported value). Wait.
   - Assert a further success callback fired (dep dir joined `wanted`
     after the import compile). Close the watcher.

Do not change existing tests. The external-symlink test (lines 104-124)
already covers outside-project deps and must pass unchanged.

Timing guidance (copied from existing tests): poll up to ~40 attempts at
25 ms for expected callbacks; for the must-NOT-fire assertion, sleep a
fixed ~300 ms then assert unchanged. Keep each new test timeout at
120_000 like the existing watch tests.

**Verify**: `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts` → all pass, including the 2 new tests.

### Step 3: Run the full gates and record evidence

Run in order: framework type-check, full manifest.spec, tooling.spec
(packaged `dev.js` startup path, ~120 s), API type-check,
`pnpm --filter @southneuhof/api test:dev-routes` (cold start, add, invalid
recovery, move, delete). Record passes plus the new-test names in the
index row. `git diff --check` must be clean for touched files.

**Verify**: all commands exit 0 / pass.

## Test plan

- New tests in `packages/sprindle/src/tooling/manifest.spec.ts`:
  unrelated-edit silence plus new-dependency follow, as specified in
  Step 2. Pattern: existing watch tests at lines 33-53.
- Existing suites that must pass unchanged: full `manifest.spec.ts`,
  `tooling.spec.ts` (packaged commands plus `dev.js` startup), and
  `pnpm --filter @southneuhof/api test:dev-routes`.
- The external-cycle watch test (lines 104-124) is the critical
  outside-project regression: it must pass without modification.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "routesRoot" packages/sprindle/src/tooling/manifest.ts`
  returns matches (binding, recursive watcher, wanted set).
- [ ] `grep -n "directories(project)" packages/sprindle/src/tooling/manifest.ts`
  returns no matches.
- [ ] `grep -n "dependencyInputs.get(project)" packages/sprindle/src/tooling/manifest.ts`
  still matches (dep dirs still watched, including external).
- [ ] Two new watch-scope tests exist and pass; full manifest.spec passes.
- [ ] `tooling.spec.ts` passes.
- [ ] `pnpm --filter @southneuhof/api test:dev-routes` passes.
- [ ] Both type-checks exit 0; framework lint exits 0.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for 007 updated to DONE with evidence.

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written — especially if
  005/006 changed the watcher signature; rebase the plan instead of
  guessing).
- An existing watch test fails, especially the external-cycle test
  (lines 104-124). That means the narrowing dropped a load-bearing watch.
  Report which test and which edit stopped triggering; do not widen back
  to project-wide watching without approval.
- The unrelated-edit test flakes (spurious callback) twice. Report the
  callback sequence; do not lengthen sleeps beyond ~500 ms without approval.
- A step's verification fails twice after a reasonable fix attempt.
- Failure is environmental (busy port, missing `.env`, sandbox file-watch
  limits) rather than the change. Record the exact error; do not fix
  infrastructure.
- The fix appears to require touching an out-of-scope file (e.g. `dev.ts`
  signature change). Stop; the plan assumes no signature change.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The watcher's input set is `routesRoot` dirs plus `dependencyInputs`
  dirs. Any new compile input kind (new config chain, new dep discovery)
  must also enter `dependencyInputs`, or edits to it will not trigger.
- A helper file that is not yet imported by any route is intentionally not
  watched. The importing route's own edit triggers the compile that
  enrolls the helper. Do not "fix" this by re-adding project-wide watching.
- If route edits ever stop triggering after a move/rename, suspect
  `refreshWatchers` pruning vs. the recursive routes watcher, not the dep
  set. The recursive routes watcher is the backstop.
- Reviewer focus: confirm no `project`-rooted enumeration remains, external
  dep dirs are still watched, and close/dispose paths are untouched.
- Follow-ups explicitly deferred: PERF-04 (bundle dev manifest), PERF-05
  (contracts pruning), PERF-06 (parallel server imports).
