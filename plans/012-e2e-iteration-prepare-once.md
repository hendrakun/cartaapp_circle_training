# Plan 012: E2E iteration mode with prepare-once and warm servers

> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before you move to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When you finish, update the status row for this
> plan in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 6fa00d4..HEAD -- apps/web/e2e/fixtures.ts apps/web/playwright.config.ts apps/api/package.json apps/api/scripts/reset-e2e.ts apps/api/scripts/seed-e2e.ts apps/api/scripts/clear-e2e-storage.ts apps/api/scripts/e2e-target.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before you proceed. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `6fa00d4`, 2026-09-12
- **Design**: `plans/008-e2e-iteration-design.md`, approved 2026-09-12

## Why this matters

Each E2E test runs a full prepare. Each run cold-boots the API and Vite.
A focused rerun costs 40 to 60 seconds. Most of that cost is repeat work.
This plan runs prepare once per run. It reuses warm servers across reruns.
It keeps full reset for final acceptance. The rerun time drops to seconds.

## Current state

The relevant files, each with one line on its role:

- `apps/web/e2e/fixtures.ts` — runs `e2e:prepare` for each test that uses `authenticatedPage`.
- `apps/web/playwright.config.ts` — starts API and web with `reuseExistingServer: false`.
- `apps/api/package.json` — defines `e2e:prepare` as reset plus migrate plus clear plus seed.
- `apps/api/scripts/e2e-target.ts` — guards the E2E database and bucket.
- `apps/api/scripts/reset-e2e.ts` — drops all public tables and the drizzle schema.
- `apps/api/scripts/seed-e2e.ts` — seeds roles, permissions, and the admin user.
- `apps/api/scripts/clear-e2e-storage.ts` — deletes all keys in the E2E bucket.

Excerpts of the code as it exists today:

```ts
// apps/web/e2e/fixtures.ts:17-23
function prepareE2eState() {
  execFileSync('pnpm', ['--filter', '@southneuhof/api', 'e2e:prepare'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })
}
```

```ts
// apps/web/e2e/fixtures.ts:48-55
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    if (!process.env.SKIP_E2E_PREPARE) prepareE2eState()
    await waitForApi(page)
    await login(page)
    await use(page)
  },
})
```

```ts
// apps/web/playwright.config.ts:30-31
fullyParallel: false,
workers: 1,
```

```ts
// apps/web/playwright.config.ts:51-73
webServer: [
  {
    command: 'pnpm exec tsx scripts/ensure-tooling.mjs && pnpm exec tsx scripts/compile-routes.ts .sprindle-e2e/routes.mjs && node --env-file=.env --env-file=.env.e2e --import tsx src/server.ts',
    cwd: apiRoot,
    url: `${apiUrl}/health`,
    timeout: 120_000,
    reuseExistingServer: false,
    ...
  },
  {
    command: `pnpm dev --host 127.0.0.1 --port ${frontendPort}`,
    cwd: webRoot,
    url: webUrl,
    timeout: 120_000,
    reuseExistingServer: false,
    ...
  },
],
```

```json
// apps/api/package.json:31-36
"e2e:reset": "node --env-file=.env --env-file=.env.e2e --import tsx scripts/reset-e2e.ts",
"e2e:migrate": "node --env-file=.env --env-file=.env.e2e ./node_modules/drizzle-kit/bin.cjs migrate",
"e2e:seed": "node --env-file=.env --env-file=.env.e2e --import tsx scripts/seed-e2e.ts",
"e2e:clear": "node --env-file=.env --env-file=.env.e2e --import tsx scripts/clear-e2e-storage.ts",
"e2e:prepare": "pnpm run e2e:reset && pnpm run e2e:migrate && pnpm run e2e:clear && pnpm run e2e:seed",
```

```ts
// apps/api/scripts/e2e-target.ts:18-26
export function assertE2eStorageTarget(bucket: string | undefined = process.env.S3_BUCKET): asserts bucket is string {
  if (bucket !== E2E_BUCKET_NAME) throw new Error('E2E storage guard refused the configured bucket.')
}
```

Repo conventions that apply here:

- The E2E guard stays. No test may use the Vitest database or the dev bucket.
- The default mode stays. CI and final acceptance keep per-test prepare and cold servers.
- Workers stay at 1. Tests share one E2E database. Parallel workers need new isolation. This plan does not add it.
- Tests use unique IDs. Tests clean only rows they own. See `verification-strategy.md:81`.
- Dirty state rule: if a prior run changes the required start state, reprepare that run. Record the reprepare in evidence.

## Commands you will need

| Purpose | Working directory | Command | Expected on success |
|---|---|---|---|
| Baseline timing, default mode | repo root | `pnpm --filter @southneuhof/framework-web test:e2e -- rbac-smoke.spec.ts -g "users list renders"` | pass, record elapsed wall time |
| Guard tests | repo root | `pnpm --filter @southneuhof/api test:focused -- scripts/e2e-target.spec.ts` | all pass |
| Web lint for touched files | repo root | `pnpm --filter @southneuhof/framework-web lint:focused -- playwright.config.ts e2e/fixtures.ts` | exit 0 |
| Iteration run, one case | repo root | `E2E_ITERATION=1 pnpm --filter @southneuhof/framework-web test:e2e -- rbac-smoke.spec.ts -g "users list renders"` | pass, faster than baseline |
| Full E2E file, both modes | repo root | default mode then `E2E_ITERATION=1` mode, `test:e2e -- rbac-smoke.spec.ts` | same assertions pass in both modes |
| Login journey, both modes | repo root | default mode then `E2E_ITERATION=1` mode, `test:e2e -- auth.spec.ts` | same assertions pass in both modes |

## Scope

**In scope** (the only files you should modify):

- `apps/web/e2e/fixtures.ts`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/auth.spec.ts` (only if a test-ID or cleanup change is needed, else leave it)
- `apps/web/e2e/rbac-smoke.spec.ts` (only if a test-ID or cleanup change is needed, else leave it)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- `apps/api/scripts/*` — no API script change in this plan.
- `apps/api/package.json` — no new script in this plan.
- Stored auth state — plan 013 owns it. Keep per-test UI login in this plan.
- Failure bundle — plan 014 owns it.
- Framework packages — this plan is app-local only.
- `packages/loom/*` — dirty work exists in the tree. Do not touch it.
- Production, deployment, or dev database — never touch them.

## Git workflow

- Branch: `advisor/012-e2e-iteration-prepare-once`
- Commit per step or per logical unit. Message style matches `git log`: short imperative.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Measure the baseline

Run the baseline command for one case in default mode. Record the wall time.
Run the guard tests. Record the result. Do not change code in this step.

**Verify**: you have two numbers. One elapsed time. One guard pass.

### Step 2: Add the iteration flag to the Playwright config

In `apps/web/playwright.config.ts`, read the two `reuseExistingServer: false` entries.
Change both to `reuseExistingServer: process.env.E2E_ITERATION === '1'`.
Do not change ports, URLs, timeouts, reporters, or projects.
Default stays `false`. CI behavior does not change.

**Verify**: `grep -n "reuseExistingServer" apps/web/playwright.config.ts` shows two
conditional lines. Web lint for the config passes.

### Step 3: Change the fixture to prepare once per worker

In `apps/web/e2e/fixtures.ts`, add a module-scoped `prepared` flag.
Add a `prepareOnce` function. It calls `prepareE2eState` only once per worker
process, unless `SKIP_E2E_PREPARE` is set. Use it in `authenticatedPage`
instead of direct `prepareE2eState`.
Keep `waitForApi` and `login` unchanged in this plan.
Keep the guard. Do not add a bypass.
Add a comment that states the reprepare rule: if a prior run dirties required
state, the agent reprepares with a full `e2e:prepare` and records it.

**Verify**: `grep -n "prepareOnce\|E2E_ITERATION\|SKIP_E2E_PREPARE" apps/web/e2e/fixtures.ts`
shows the new logic. Web lint for the fixture passes.

### Step 4: Apply the owned-row rule to current specs

Check `auth.spec.ts` and `rbac-smoke.spec.ts`. They read seed data and session state.
They create no module rows. If that still holds, change nothing in the spec files.
If a spec creates rows, give each row a unique ID and delete only those IDs after
the test. Do not add shared cleanup that deletes seed data.

**Verify**: `git status --short` shows changes only in the in-scope list.

### Step 5: Prove both modes pass and record the gain

Run the full `rbac-smoke.spec.ts` in default mode. Then run it with
`E2E_ITERATION=1`. Run `auth.spec.ts` in both modes the same way.
All four runs must pass with the same assertions.
Record all four wall times. The iteration rerun must be clearly faster than
the default rerun. If any run fails from dirty state, do one full reprepare,
record it, then rerun once.

**Verify**: four passes. Timing numbers recorded for the index row.

### Step 6: Update the index row

Update `plans/README.md` for plan 012 with DONE and the evidence:
baseline time, iteration time, guard pass, and the four mode passes.

**Verify**: `git status --short` shows only in-scope files.

## Test plan

- Existing tests that must pass unchanged in both modes:
  `apps/web/e2e/auth.spec.ts::session lifecycle: login, dashboard, reload, logout`,
  `apps/web/e2e/auth.spec.ts::unauthenticated /me is 401`,
  `apps/web/e2e/rbac-smoke.spec.ts::users list renders`,
  `apps/web/e2e/rbac-smoke.spec.ts::roles list renders with assignment persistence`.
- Existing guard tests: `apps/api/scripts/e2e-target.spec.ts` (full file).
- No new test file in this plan. The proof is mode parity plus timing.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `grep -n "reuseExistingServer" apps/web/playwright.config.ts` returns two conditional lines on `E2E_ITERATION`.
- [ ] `grep -n "prepareOnce" apps/web/e2e/fixtures.ts` returns matches, and per-test `prepareE2eState` no longer runs unconditionally.
- [ ] Default mode still prepares. The `SKIP_E2E_PREPARE` escape hatch still exists.
- [ ] `pnpm --filter @southneuhof/api test:focused -- scripts/e2e-target.spec.ts` passes.
- [ ] `rbac-smoke.spec.ts` passes in default mode and in `E2E_ITERATION=1` mode.
- [ ] `auth.spec.ts` passes in default mode and in `E2E_ITERATION=1` mode.
- [ ] Iteration rerun wall time is recorded and lower than the default rerun.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for 012 is DONE with evidence.

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" does not match the excerpts.
- A step verification fails twice after a reasonable fix attempt.
- The guard needs weakening to make iteration work. Report. Do not weaken it.
- Iteration requires `workers > 1` or parallel projects. Report. This plan keeps serial use.
- A failure comes from missing infrastructure (DB down, S3 down, busy port). Record the exact error. Do not fix infrastructure.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

For the human or agent who owns this code after the change lands:

- Iteration mode is for local agent reruns only. CI uses default mode.
- First iteration run still pays one full prepare plus cold boot. Later reruns reuse.
- If state looks dirty, run one full `e2e:prepare` and record it. Do not debug dirty state for long.
- Reviewer focus: default `false` preserves old behavior. The flag only reuses servers that Playwright started for the same config.
