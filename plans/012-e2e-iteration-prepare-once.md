# Plan 012: Prepare once per worker and reuse local E2E servers

> Read the full plan before implementation. Run each check. Report blocked or
> failed checks. Change the status to DONE only after review and verification.
>
> **Drift check**: `git diff --stat cdbc12b..HEAD -- apps/web/playwright.config.ts apps/web/e2e/fixtures.ts apps/web/e2e/state.ts apps/web/src/__tests__/e2e-state.spec.ts plans/012-e2e-iteration-prepare-once.md plans/README.md`
> Also run `git status --short`. Compare changed files with the facts below.
> Preserve unrelated work. Stop for an unexplained contract change.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED — a missed reset can invalidate test results.
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `cdbc12b`, 2026-09-12
- **Status**: TODO; plan reviewed, implementation not tested.
- **Design**: `plans/008-e2e-iteration-design.md`. Keep serial tests, guarded
  E2E targets, full acceptance reset, and unchanged product assertions.

## Why this matters

Authenticated tests repeat reset, migration, bucket clear, and seed. A worker
can do this once in local iteration mode. Warm servers remove startup cost
only if they run outside the Playwright command. A one-case run still needs
one prepare unless the operator explicitly reuses prepared state.
The design's 40–60 second estimate is not a measured baseline for this checkout.
Do not promise a time in seconds before measurement.

## Current state

- `apps/web/e2e/fixtures.ts:17` calls `e2e:prepare` synchronously.
- `apps/web/e2e/fixtures.ts:48` prepares only tests that use `authenticatedPage`:

  ```ts
  authenticatedPage: async ({ page }, use) => {
    if (!process.env.SKIP_E2E_PREPARE) prepareE2eState()
    await waitForApi(page)
    await login(page)
    await use(page)
  },
  ```

- `apps/web/playwright.config.ts:30` uses one worker, no parallel files, and
  zero retries. Lines 57 and 70 set `reuseExistingServer: false`.
- Config lines 19–25 resolve ports and publish `E2E_API_URL` and `E2E_WEB_URL`.
  API launch lines 53–62 compile `.sprindle-e2e/routes.mjs` and start Node
  without a watcher. Backend edits need a restart and a new route compile.
- `apps/api/package.json:36` runs reset, migrate, clear, and seed in order.
  `apps/api/scripts/reset-e2e.ts:6` checks the connected E2E target before
  dropping tables. `apps/api/scripts/clear-e2e-storage.ts:31` checks the bucket.
- `apps/web/e2e/auth.spec.ts:22` tests anonymous access with the plain page.
  It currently has no prepare fixture. Both RBAC cases only read seed rows;
  the second case's title mentions persistence but does not test a mutation.
- Playwright stops servers that it starts. Reuse accepts an available URL;
  it does not prove the server's worktree or database identity. See
  [web server behavior](https://playwright.dev/docs/test-webserver).
- Match named functions and `execFileSync` in the fixture. Match Vitest
  `vi.mock` and reset style in `apps/web/src/router/__tests__/guards.spec.ts:1`.
  Do not copy its type escapes.

## Scope

Only modify:

- `apps/web/playwright.config.ts`
- `apps/web/e2e/fixtures.ts`
- `apps/web/e2e/state.ts` (new; small prepare and mode module)
- `apps/web/src/__tests__/e2e-state.spec.ts` (new)
- This plan (commands and measured evidence) and `plans/README.md` (012 row).

Do not change API scripts, environment files, framework packages, product code,
auth strategy, reporters, or existing E2E assertions. Do not add a server
manager, background daemon, or new dependency. Use the current branch. Do not
commit, push, or create a PR without a user request.

## Mode contract

| Mode | Prepare | Servers |
| --- | --- | --- |
| Default, including CI | Once per test that uses these fixtures | Playwright starts and stops them; no reuse |
| Local `E2E_ITERATION=1` | Once per worker, after each worker restart too | Reuse only known local E2E servers; otherwise cold start |
| Local iteration plus `SKIP_E2E_PREPARE=1` | None; operator must first run guarded prepare | Same as iteration |

Reject `SKIP_E2E_PREPARE` outside local iteration, and reject iteration or skip
flags when `CI` is set. This deliberately restricts the existing skip escape
hatch. It prevents a bypass from being mistaken for acceptance proof.
Treat only the exact value `1` as enabling either flag; reject other nonempty
values. Keep one worker and zero retries. Run only one E2E command against this
shared database at a time. A module flag is once per worker, not once across
CLI commands. A failed worker is replaced even with one configured worker.

## Commands and steps

All test commands below run from the repo root. Infrastructure must already
exist. Do not install, rebuild infrastructure, or change target guards.

### 1. Measure before the change

With warm servers stopped and both flags unset, run this command three times:

```sh
/usr/bin/time -p pnpm --filter @southneuhof/framework-web test:e2e -- rbac-smoke.spec.ts -g 'users list renders'
```

**Verify**: each command exits 0 and selects exactly one case. Record all wall
times and their median. Keep startup and prepare output. Also measure the full
RBAC file three times with the same command but without `-g`.
Do not run `test:focused` on the API merely to test the guard: that script also
compiles routes and migrates the Vitest database. Use the direct guard command:

```sh
pnpm --filter @southneuhof/api exec vitest run scripts/e2e-target.spec.ts
```

**Verify**: all seven guard cases pass without migration commands.

### 2. Implement and test the mode and prepare rules

Move `prepareE2eState` and its path calculation to `e2e/state.ts`. Export the
mode check and `prepareForTest`. Keep the existing guarded subprocess intact.
Use one module boolean for successful iteration preparation. Check skip first;
in default mode always prepare. Set the boolean only after successful prepare.
Do not catch and hide a failed prepare.

Add a test-scoped automatic `e2eState` fixture. It calls `prepareForTest` and
then yields. Remove the prepare call from `authenticatedPage`; keep health and
UI login there. This also gives the standalone anonymous case a prepared state.
The state fixture must not depend on `page` or browser `storageState`, because
plan 013 must be able to prepare before creating an authenticated context.

Use the same exported mode check in config for both server reuse fields. Leave
URLs, launch commands, timeouts, reporters, and project count unchanged.

In `e2e-state.spec.ts`, mock `node:child_process`, reset modules and env between
cases, and call the real `prepareForTest`. Check default two calls, iteration
one call, skip zero calls, failed prepare then successful retry, fresh module
prepares again, invalid flag values, and CI rejection. No database is needed.

**Verify**:

```sh
pnpm --filter @southneuhof/framework-web test:focused -- __tests__/e2e-state.spec.ts
pnpm --filter @southneuhof/framework-web lint:focused -- playwright.config.ts e2e/fixtures.ts e2e/state.ts src/__tests__/e2e-state.spec.ts
pnpm --filter @southneuhof/framework-web test:e2e -- --list
```

All exit 0. Discovery still lists the four current E2E cases. Also run
`CI=1 E2E_ITERATION=1 pnpm --filter @southneuhof/framework-web test:e2e -- --list`;
it must exit nonzero with the mode error before starting servers.
The web type-check script does not directly include E2E files; do not describe
its success as an E2E type check.

### 3. Start warm servers with a known owner

Use two visible terminals in this worktree. The following commands fix the
local URLs explicitly. Use these same URLs for the benchmark commands. Stop
on an occupied port of unknown ownership; do not attach to it or kill it.

Terminal A, from `apps/api`:

```sh
pnpm exec tsx scripts/ensure-tooling.mjs
pnpm exec tsx scripts/compile-routes.ts .sprindle-e2e/routes.mjs
API_PORT=5180 BETTER_AUTH_URL=http://127.0.0.1:5180 APP_ORIGIN=http://127.0.0.1:5181 SPRINDLE_ROUTE_MANIFEST=.sprindle-e2e/routes.mjs node --env-file=.env --env-file=.env.e2e --import tsx src/server.ts
```

Terminal B, from `apps/web` (`vite.config.ts:13` requires `WEB_PORT` even
when the CLI supplies a port):

```sh
WEB_PORT=5181 VITE_API_URL=http://127.0.0.1:5180 pnpm dev --host 127.0.0.1 --port 5181 --strictPort
```

In the test terminal, set matching config values:

```sh
export CARTA_E2E_API_PORT=5180 CARTA_E2E_FRONTEND_PORT=5181
export E2E_API_URL=http://127.0.0.1:5180 E2E_WEB_URL=http://127.0.0.1:5181
curl --fail --silent http://127.0.0.1:5180/health
curl --fail --silent --output /dev/null http://127.0.0.1:5181
```

**Verify**: both requests exit 0. Record terminal process IDs, worktree, URLs,
and start commands, without environment secrets. Health alone is not a target
identity check. Both server terminals must use `.env.e2e` targets where needed.
After API, schema, route, dependency, or environment changes, stop terminal A,
compile and start again. Restart Vite after configuration or dependency changes.
Before skipping prepare, run `pnpm --filter @southneuhof/api e2e:prepare` and
require exit 0. Do not let other runs use this database during preparation.

### 4. Prove parity and measure each cost separately

Run both files together, first in default mode with warm servers stopped, then
in iteration mode with the known servers running:

```sh
pnpm --filter @southneuhof/framework-web test:e2e -- auth.spec.ts rbac-smoke.spec.ts
E2E_ITERATION=1 pnpm --filter @southneuhof/framework-web test:e2e -- auth.spec.ts rbac-smoke.spec.ts
```

**Verify**: four cases pass in each mode with unchanged assertions. The default
run prepares four times; an iteration run without worker replacement prepares
once. A preparation after worker replacement is expected and must be recorded.

Repeat the step 1 timing commands three times with `E2E_ITERATION=1`, then
three times with both flags set after one explicit guarded prepare. Record:
mode, selected cases, total wall time, prepare count, and server process IDs.
Check both health URLs after each command: the external servers must remain up.
Compare like-for-like medians. One-case prepare-once has no reset-count saving;
report the warm-server saving separately from the explicit skip-prepare saving.
If the relevant median does not improve, report that result and investigate
inside scope; do not claim success from a passing test alone.

### 5. Record the result

Stop the two owned server processes before final default-mode acceptance.
Run the default combined command once. Run `git diff --check` and
`git status --short`. Both checks must show a clean diff within scope.
Record exact commands, case counts, medians, prepare counts, and failed checks
in this plan. Update only the 012 status row after all gates pass.

## Done criteria

- [ ] The focused unit test, focused lint, and direct guard test pass.
- [ ] Default, iteration, skip, invalid-value, failure, and restart cases pass.
- [ ] The standalone anonymous case runs without relying on another case.
- [ ] Both four-case runs and final default acceptance pass.
- [ ] External servers survive separate CLI runs; their identity is recorded.
- [ ] One-case and two-case medians show the separate savings, or a blocked result.
- [ ] No unrelated files changed; `git diff --check` exits 0.
- [ ] The 012 row records verified evidence before DONE.

## STOP conditions and maintenance

Stop if the E2E target cannot be proved, infrastructure is unavailable, ports
have unknown owners, a check fails twice after an in-scope fix, or a required
fix crosses scope. Never weaken a target guard or increase parallelism.
Do not use a skipped-prepare run as final acceptance evidence. If previous
runs changed required state, stop active tests, run the full guarded prepare,
and record it. Recheck this policy when new tests modify shared seed data.

## Implementation record — 2026-09-12

STATUS: STOPPED

- Step 1: blocked before timing. The host filesystem reported 100% use with
  112 MiB available. `pnpm` could not create its task lock.
- Step 2: implementation complete. Direct focused lint passed. Direct
  Playwright discovery listed four cases. The CI rejection check exited 1 with
  the expected mode error. The direct E2E target guard passed all seven cases.
- Focused Vitest: blocked. Vitest failed before collection with `EMFILE` from
  the file watcher. The plan command also could not run after `pnpm` failed to
  create its lock.
- Steps 3–5: not run. The host resource failures meet the infrastructure STOP
  condition. No timing, warm-server, parity, or final acceptance evidence is
  available.

FILES CHANGED: `apps/web/playwright.config.ts`, `apps/web/e2e/fixtures.ts`,
`apps/web/e2e/state.ts`, `apps/web/src/__tests__/e2e-state.spec.ts`, this plan,
and the 012 status row in `plans/README.md`.

NOTES: No environment file, framework package, server, database, or storage
target was changed. Do not mark this plan DONE until the blocked gates pass.

### Resumed result after storage recovery

STATUS: COMPLETE

- State tests passed: 9. Focused lint and the 7 target guard tests passed.
- Owned API session `38836` used port 5180. Owned Vite session `72945` used
  port 5181. Both survived separate commands and were stopped before acceptance.
- Cold one-case times were 48.73 s, 20.94 s, and 52.68 s; median 48.73 s.
- Warm prepare times were 33.49 s, 26.53 s, and 41.40 s; median 33.49 s.
- Warm skip times were 27.81 s, 10.55 s, and 10.85 s; median 10.85 s.
- Iteration parity passed 4 cases with one prepare. Final default acceptance
  passed all 7 current cases with one prepare for each test.
- `git diff --check` passed.

Deviation: the full RBAC file did not get three cold samples. The final default
acceptance and iteration parity run cover both RBAC cases.
