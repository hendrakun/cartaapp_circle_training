# Plan 013: Reuse API auth state after E2E preparation

> Read the full plan, run each check, and report failed or blocked checks.
> Update the 013 row to DONE only after implementation and review.
>
> **Drift check**: `git diff --stat cdbc12b..HEAD -- apps/web/e2e/fixtures.ts apps/web/e2e/rbac-smoke.spec.ts apps/web/e2e/auth.spec.ts apps/web/e2e/fast-auth.spec.ts plans/013-e2e-fast-auth.md plans/README.md`
> Also run `git status --short`. Changes from plan 012 are expected. Compare
> them with the dependency contract below; stop only for unexplained drift.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED — resets and logout can invalidate a shared session.
- **Depends on**: 012 DONE with passing evidence
- **Category**: perf
- **Planned at**: commit `cdbc12b`, 2026-09-12
- **Status**: TODO; plan reviewed, speed gain not measured.
- **Design**: `plans/008-e2e-iteration-design.md`; retain the UI login journey
  and the full-reset acceptance mode.

## Why this matters

RBAC tests currently use UI login for every test. In local iteration mode,
create one API session after preparation and reuse its browser state within
the worker. Default mode keeps UI login. A separate setup project and a shared
state file are not needed for the current serial suite.

## Current state and dependency contract

- `apps/web/e2e/fixtures.ts:10` reads administrator credentials from `.env`,
  then `.env.e2e`. Reuse `localEnv`; never print credential values.
- `apps/web/e2e/fixtures.ts:35` fills the visible login form. Keep this function
  and its call for the UI journey and all default-mode authenticated tests.
- `apps/web/e2e/rbac-smoke.spec.ts:1` imports `test` from `./fixtures`.
  Both cases use `authenticatedPage` and only read seeded users and roles.
- `apps/web/e2e/auth.spec.ts:3` tests login, reload, and logout. Lines 16–18
  revoke its session and clear cookies. Its plain-page case expects `/me` 401.
- `apps/api/src/routes/auth/auth.routes.spec.ts:35` confirms the API path:

  ```ts
  app.request('/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    // JSON credentials are supplied here.
  })
  ```

- `apps/api/scripts/reset-e2e.ts:6` drops all public tables after its guard.
  This also deletes sessions. State saved before a reset cannot be reused.
- Plan 012 adds a page-independent `e2eState` test fixture that prepares before
  auth. Local iteration prepares once per worker; default prepares per test.
  It exports the mode check from `apps/web/e2e/state.ts` and rejects local flags
  in CI. It retains a single Chromium project and one worker.
- Use Playwright's built-in `storageState` fixture and fresh context per test.
  See [authentication guidance](https://playwright.dev/docs/auth). No global
  authenticated state is allowed for anonymous or logout tests.

## Scope

Only modify:

- `apps/web/e2e/fixtures.ts`
- `apps/web/e2e/rbac-smoke.spec.ts` (add opt-in only; retain titles/assertions)
- `apps/web/e2e/fast-auth.spec.ts` (new regression proof)
- This plan (evidence) and `plans/README.md` (013 row).

Read but do not change `auth.spec.ts`, the login form, API, reset scripts, config,
framework packages, or plan 012 mode rules. Add no setup project, auth endpoint,
new account, persistent state file, custom browser context, or dependency.
Use the current branch; do not commit, push, or create a PR without a request.

## Steps and commands

All commands run from the repo root, with existing E2E infrastructure.

### 1. Check the dependency and record a baseline

Run `rg -n '012|013' plans/README.md`. The 012 row must be DONE with evidence.
Confirm that `e2eState` does not depend on page or storage state.
Using the known warm servers from 012, run three times:

```sh
E2E_ITERATION=1 /usr/bin/time -p pnpm --filter @southneuhof/framework-web test:e2e -- rbac-smoke.spec.ts
```

**Verify**: two cases pass each time. Record the median and prepare count.
Do not compare a cold default run with a warm fast-auth run to claim auth gains.
If warm servers are unavailable, use cold runs before and after and label them.

### 2. Add auth as a test option, after preparation

Add a `fastAuth` boolean test option, default false. In the RBAC file add
`test.use({ fastAuth: true })`. It has an effect only in local iteration mode.

Override the built-in `storageState` fixture. Its dependencies must include
`e2eState`, `fastAuth`, and `playwright`, so preparation finishes before any
session is created and before Playwright creates the test context. It must
not depend on `page`, `context`, or `authenticatedPage` (that creates a cycle).
For default mode or no opt-in, yield empty cookies and origins.

For fast iteration auth, keep a typed module-local storage-state value. On
first use, create an isolated `playwright.request.newContext` with the resolved
`E2E_API_URL`. Read credentials with `localEnv`, require both fields, and POST
`/api/auth/sign-in/email` with JSON credentials and the resolved web `Origin`.
Require success and an authenticated `/me` response with the seeded admin
identity. Save `request.storageState()` in memory only after all checks pass.
Dispose the request context in `finally`. Do not navigate a setup browser to
Dashboard; the real render cases already prove browser access.

Yield the cached state to each fresh browser context. Keep it only for this
worker. New commands and replacement workers create a new session after their
prepare step. Do not keep or retry invalid state across resets. A 401 during a
test remains a failure; do not hide it with automatic login retries.

In `authenticatedPage`, retain health polling. Skip UI login only when both
local iteration and `fastAuth` are enabled. Otherwise use the existing login.
This preserves the existing page fixture, trace, screenshot, and teardown.

**Verify**:

```sh
pnpm --filter @southneuhof/framework-web lint:focused -- e2e/fixtures.ts e2e/rbac-smoke.spec.ts
pnpm --filter @southneuhof/framework-web test:e2e -- --list
```

Both exit 0; the four existing cases still appear. No setup project appears.

### 3. Prove isolation with one small regression file

Add `fast-auth.spec.ts` using the fixture import and assertions from
`auth.spec.ts`. Keep three ordered cases in one file with no serial retry mode:
first, an opted-in authenticated page loads Dashboard and `/me`; second, a
non-opted-in UI session logs out; third, an opted-in page still loads Dashboard
and `/me`. Check that the two fast cases have different browser contexts but
reuse the same session cookie in iteration mode. Compare values in memory;
never print cookies. Default mode must not require cookie equality.
Use nested `test.describe` groups or scoped `test.use` to set the option for
only the two fast cases. Preserve the anonymous 401 case in `auth.spec.ts`.

**Verify**, with warm servers running:

```sh
E2E_ITERATION=1 pnpm --filter @southneuhof/framework-web test:e2e -- auth.spec.ts rbac-smoke.spec.ts fast-auth.spec.ts
E2E_ITERATION=1 pnpm --filter @southneuhof/framework-web test:e2e -- fast-auth.spec.ts --repeat-each=2
pnpm --filter @southneuhof/framework-web lint:focused -- e2e/fixtures.ts e2e/rbac-smoke.spec.ts e2e/fast-auth.spec.ts
```

Expect seven passing cases, then six passing cases, and lint exit 0. Run the
first command again in a new process: it must pass after a new prepare, without
any stored file. Stop the owned warm servers; run the combined command with
`E2E_ITERATION` unset. All seven cases must pass with per-test prepare/UI login.
Test discovery is a load check, not a type check. The web type-check script's
configured include list does not directly cover E2E files.

### 4. Measure and record the result

Repeat the step 1 benchmark with the same servers, case selection, prepare
policy, and three samples. Record the median, auth request count, and whether
UI login occurred. The two RBAC cases must use one API login per iteration
worker and no UI login. Default mode must still use UI login for each case.
Use local traces for request counts; do not copy auth bodies or cookies into
this plan. If the median does not improve, record that result; do not mark the
performance objective complete. Keep failures visible.

**Verify**: `git diff --check` exits 0; `git status --short` shows only the
in-scope changes from this pass. Update the 013 row, never 009, 010, or 012.

## Done criteria

- [ ] Preparation finishes before cached auth is created.
- [ ] RBAC iteration uses one API session per worker and fresh browser contexts.
- [ ] UI logout cannot revoke the fast-auth session; anonymous `/me` stays 401.
- [ ] Combined, repeated, fresh-process, and default-mode checks pass.
- [ ] Existing test titles/assertions and the UI login path remain unchanged.
- [ ] Focused lint and `git diff --check` pass.
- [ ] Equivalent before/after timing and auth counts are recorded in this plan.
- [ ] No state file, credential output, config change, or unrelated change.
- [ ] The 013 row is DONE only with this evidence.

## STOP conditions and maintenance

Stop if 012 is not DONE, reset can occur after cached auth, the cookie contract
requires product changes, a check fails twice after an in-scope fix, or a
required change is outside scope. Do not turn a failed UI login into API login.

Shared auth is only for read-only tests. Tests that revoke sessions, change
credentials, or modify shared permissions need their own session and owned data.
A new CLI run intentionally repeats one API login. Add disk persistence only
if measured login cost justifies a separate invalidation design.

## Implementation record — 2026-09-12

STATUS: STOPPED

Plan 012 is not DONE because its required E2E and timing gates are blocked by
host disk and file-watcher limits. This meets the dependency STOP condition.
No plan 013 source file was changed.

### Resumed result after plan 012 verification

STATUS: COMPLETE WITH INCOMPLETE MEASUREMENT

- Focused lint passed. Discovery listed one project and 7 cases.
- The iteration combined proof passed 7 cases with one prepare and one cached
  API session for opted-in tests.
- The repeat proof passed 6 cases. Its replacement worker prepared again and
  created a new in-memory session.
- Final default acceptance passed 7 cases with per-test prepare and UI login.
- UI logout did not revoke fast auth. Fast cases used fresh browser contexts
  with the same worker-local session cookie. No cookie or credential was logged.

Deviation: equivalent three-sample before and after RBAC timing was not
recorded. Do not claim the performance measurement as verified.
