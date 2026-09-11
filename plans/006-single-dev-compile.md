# Plan 006: Compile once and wait for watcher readiness on dev startup

> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 99d77a5..HEAD -- packages/sprindle/src/tooling/manifest.ts apps/api/scripts/dev.ts apps/api/scripts/dev-route-reload.proof.mjs packages/sprindle/src/tooling/manifest.spec.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/005-skip-dev-declarations.md (for the full time
  saving; the logic change also works without it)
- **Category**: perf
- **Planned at**: commit `99d77a5`, 2026-09-11

## Why this matters

Cold `pnpm dev:api` logs show 2741 ms for the compile plus 6767 ms of
watcher startup. The code runs `compileRouteManifest`, then
`watchRouteManifest`, which compiles twice more on startup. One compile is
enough. The second pair only re-publishes the same artifact and holds the
server closed. This plan makes startup use one compile (watcher's first) and
then start the server. Watcher readiness still gates the server: the close of
step 5 races old watcher state with the fresh compile. Combined with plan
005, watcher startup drops from about 6.7 s + 2.7 s to about 1 compile.
Without plan 005 the saving is still 2 full compiles.

## Current state

The relevant files, each with one line on its role:

- `apps/api/scripts/dev.ts` — lines 8-47 do:
  explicit compile (line 9), "Starting route watcher" log, watcher (line 38),
  "Route watcher ready", server start.
- `packages/sprindle/src/tooling/manifest.ts` — `watchRouteManifest`
  (lines 232-253). Line 252 is the double compile:
  `refreshWatchers(); compile(); await queue; compile(); await queue`.
  Line 250 queues compile work. Line 251 debounces later edits by 100 ms.
- `apps/api/scripts/dev-route-reload.proof.mjs` — the dev proof. Line 42
  deletes `.sprindle` (stale; dev uses `.sprindle-dev`). Line 43 removes the
  `routeRoot` proof dir. Line 53 waits for `/health` 200. It always passes
  today and must pass after the change.

Excerpts of the code as it exists today:

```ts
// apps/api/scripts/dev.ts:8-10
log('Compiling file routes...')
await compileRouteManifest(projectRoot, 'src/routes', manifest, false)
log('File routes compiled. Starting route watcher...')
```

```ts
// apps/api/scripts/dev.ts:38-47
const watcher = await watchRouteManifest(projectRoot, 'src/routes', (error) => {
  ...
}, manifest, false)
log('Route watcher ready.')
ready = true
startServer()
```

```ts
// packages/sprindle/src/tooling/manifest.ts:250-252
const compile = () => { ... queue = queue.then(() => compileRouteManifest(...).then(...)) }
const schedule = () => { ... timer = setTimeout(() => { timer = undefined; compile() }, 100) }
refreshWatchers(); compile(); await queue; compile(); await queue
```

```js
// apps/api/scripts/dev-route-reload.proof.mjs:42
await rm(join(root, '.sprindle'), { recursive: true, force: true })
```

Repo conventions that apply here:

- The watcher contract from its tests
  (`packages/sprindle/src/tooling/manifest.spec.ts:33-53`): initial compile
  happens inside the watcher; callbacks fire per compile; `close()` cancels
  pending work. This plan keeps that contract.
- The dev proof (`test:dev-routes`) is the startup regression gate. It must
  still pass: cold start, add, invalid recovery, move, delete.
- Normalized logs: startup timing logs were added in `22f2dab`. Keep log
  call sites working; add one for the first compiled revision, not per retry.
- Framework change authorization: the user selected this perf scope
  (Top 2 findings) on 2026-09-11. The change stays inside that scope.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Framework typecheck | `pnpm --filter @southneuhof/sprindle type-check` | exit 0 |
| API typecheck | `pnpm --filter @southneuhof/api type-check` | exit 0 |
| Framework lint | `pnpm --filter @southneuhof/sprindle lint` | exit 0 |
| API script lint | `pnpm --filter @southneuhof/api lint:focused -- scripts/dev.ts` | exit 0 |
| Framework tooling tests | `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts src/tooling/tooling.spec.ts` | all pass |
| Dev startup proof | `pnpm --filter @southneuhof/api test:dev-routes` | pass |

## Scope

**In scope** (the only files you should modify):

- `packages/sprindle/src/tooling/manifest.ts` (watcher startup only)
- `apps/api/scripts/dev.ts`
- `apps/api/scripts/dev-route-reload.proof.mjs` (stale dir cleanup only)
- `packages/sprindle/src/tooling/manifest.spec.ts` (only if a new startup
  assertion is added; keep existing tests green)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- Declaration skip — plan 005 owns it. If 005 is not done, pass no
  declarations option and accept slower compiles. Do not re-implement it.
- Watcher directory filters, dev manifest bundling, contracts pruning,
  parallel server imports — deferred findings, not planned.
- Other watch behavior: debounce, `refreshWatchers`, close semantics. Only
  line 252 changes.

## Git workflow

- Branch: `advisor/006-single-dev-compile`
- If plans 005 and 006 are done by the same pass, one branch
  `advisor/005-006-dev-startup` is acceptable. Record the branch in both
  rows.
- Commit per step. Message style matches `git log`: short imperative.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make watcher startup compile exactly once

In `packages/sprindle/src/tooling/manifest.ts`, change line 252 from:

```ts
refreshWatchers(); compile(); await queue; compile(); await queue
```

to:

```ts
refreshWatchers(); compile(); await queue
```

Keep everything else in `watchRouteManifest` unchanged: debounce, refresh,
close, and the per-edit compile path on line 250.

Rationale to preserve, not re-derive: `queue` serialization means the old
second compile usually ran anyway (startup snapshots in the audit showed the
full cost twice more). There is no settle/retry purpose documented for the
second call. Deleting it is the fix.

**Verify**: `grep -n "compile(); await queue" packages/sprindle/src/tooling/manifest.ts` → exactly 1 match.
`pnpm --filter @southneuhof/sprindle lint` → exit 0.

### Step 2: Remove the explicit compile from `dev.ts`, keep watcher gating

In `apps/api/scripts/dev.ts`:

1. Remove the explicit `await compileRouteManifest(...)` call (line 9) and
   the `compileRouteManifest` import. Keep `watchRouteManifest`.
2. Change the startup logs: replace the two compile logs with one line
   before the watcher, e.g. `log('Compiling file routes and starting route watcher...')`.
   Keep `log('Route watcher ready.')` after the watcher resolves.
3. Keep the order: await watcher, set `ready = true`, then `startServer()`.
   The watcher resolves only after its first compile finishes, so the
   server still starts on a fresh artifact. Do not start the server before
   the watcher resolves.
4. Keep the error callback: write the error to stderr and return without
   restarting (current lines 38-44). On a broken first revision the server
   still starts and serves whatever the last good artifact holds; recovery
   compiles call `restartServer` via `onResult` as today.

Also pass the plan-005 option if that plan has landed
(`{ declarations: false }` on the watcher call). If 005 has not landed,
pass nothing.

**Verify**: `grep -n "compileRouteManifest" apps/api/scripts/dev.ts` →
no matches. `grep -n "watchRouteManifest\|startServer\|Route watcher ready" apps/api/scripts/dev.ts` → present.
`pnpm --filter @southneuhof/api lint:focused -- scripts/dev.ts` → exit 0.

### Step 3: Fix the stale directory in the dev proof

In `apps/api/scripts/dev-route-reload.proof.mjs` line 42, change
`join(root, '.sprindle')` to `join(root, '.sprindle-dev')` so the cold-start
path actually exercises a cold dev manifest. No other proof change. The
proof flow (cold start, add, invalid recovery, move, delete) stays the same.

**Verify**: `grep -n "sprindle-dev" apps/api/scripts/dev-route-reload.proof.mjs` → match on the rm line.

### Step 4: Add a single-compile startup assertion (small, targeted)

In `packages/sprindle/src/tooling/manifest.spec.ts`, add a test
`watcher startup compiles exactly once` modeled on the watch tests at
lines 33-53: create the 1-route fixture, count `onResult` successes during
`watchRouteManifest` startup only (await the watcher open, record count,
then close without editing). Assert exactly 1 success. Do not assert on
later edit behavior; existing tests cover recovery.

**Verify**: `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts` → all pass, including the new test.

### Step 5: Run gates and record the new startup shape

Run framework type-check, manifest.spec plus tooling.spec, API type-check,
and `pnpm --filter @southneuhof/api test:dev-routes`. The dev proof takes
up to 60 s. Record the proof pass and the new startup log shape
(one compile log + watcher ready, no second compile pair) in the index row.

**Verify**: all commands exit 0 / pass. `git diff --check` → clean for the
touched files.

## Test plan

- New test in `packages/sprindle/src/tooling/manifest.spec.ts`: watcher
  startup calls back exactly once. Pattern: existing watch tests (lines
  33-53).
- Existing suites that must pass unchanged: full `manifest.spec.ts`,
  `tooling.spec.ts` (covers packaged `dev.js` startup end to end, ~120 s),
  `pnpm --filter @southneuhof/api test:dev-routes` (cold start, add,
  invalid recovery, move, delete).
- Manual log check: cold `dev` output shows one compile message, then
  `Route watcher ready`, then `Starting API server`. The old
  `File routes compiled. Starting route watcher...` pair is gone.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -c "compile(); await queue" packages/sprindle/src/tooling/manifest.ts` is 1.
- [ ] `grep -c "compileRouteManifest" apps/api/scripts/dev.ts` is 0.
- [ ] `grep -n "sprindle-dev" apps/api/scripts/dev-route-reload.proof.mjs` matches the cleanup line.
- [ ] New single-compile startup test exists and passes; manifest.spec and
  tooling.spec pass.
- [ ] `pnpm --filter @southneuhof/api test:dev-routes` passes.
- [ ] Both type-checks exit 0; both lints exit 0.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for 006 updated to DONE with evidence.

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- The watcher or dev proof behaves differently than described (for example
  the second compile was load-bearing). Report the log; do not add retry
  logic without approval.
- A step's verification fails twice after a reasonable fix attempt.
- Failure is environmental (database, busy port, missing `.env`) rather
  than the change. Record the exact error; do not fix infrastructure.
- The fix appears to require touching an out-of-scope file.
- Key assumption false: `await watchRouteManifest(...)` does not resolve
  after the first compile (server would start on a stale artifact). Stop;
  the plan's ordering depends on it.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- Startup is now: watcher (which compiles once) → server. Any future
  explicit pre-compile reintroduces this finding. Keep compile ownership in
  the watcher.
- A broken first revision still starts the server on the last good
  artifact; edits recover through the normal `onResult` path. Do not add a
  block-startup-on-error gate here; it changes the invalid-recovery proof.
- Reviewer focus: confirm no `dev.ts` path still imports
  `compileRouteManifest`, and that the watcher close/shutdown paths are
  untouched.
- Follow-ups explicitly deferred: watcher scope narrowing (PERF-03),
  bundled dev manifest (PERF-04), contracts retention (PERF-05), parallel
  server imports (PERF-06).
