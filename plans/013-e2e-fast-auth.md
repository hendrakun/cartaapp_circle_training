# Plan 013: E2E fast auth with API login and stored session

> **Implementation instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before you move to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. Do not improvise. When you finish, update the status row for this
> plan in `plans/README.md` after the implementation and review pass.
>
> **Drift check (run first)**: `git diff --stat 6fa00d4..HEAD -- apps/web/e2e/fixtures.ts apps/web/e2e/auth.spec.ts apps/web/e2e/rbac-smoke.spec.ts apps/web/playwright.config.ts "apps/web/src/routes/(public)/auth/login/index.route.vue"`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before you proceed. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 012 (needs the iteration flag and prepare-once fixture)
- **Category**: perf
- **Planned at**: commit `6fa00d4`, 2026-09-12
- **Design**: `plans/008-e2e-iteration-design.md`, approved 2026-09-12

## Why this matters

Plan 012 removes repeat prepare and cold boots. UI login still runs for each
test. Login loads the login page, fills credentials, clicks, and waits for
navigation. That costs seconds per test. This plan logs in once through the API
and reuses the stored session for the render specs. It keeps one UI login test
to prove the visible login path.

## Current state

The relevant files, each with one line on its role:

- `apps/web/e2e/fixtures.ts` — owns `authenticatedPage`, `waitForApi`, and `login`.
- `apps/web/e2e/auth.spec.ts` — owns the UI login journey test.
- `apps/web/e2e/rbac-smoke.spec.ts` — owns two render specs that need auth but do not test login.
- `apps/web/playwright.config.ts` — owns the E2E ports and base URL.
- `apps/web/src/routes/(public)/auth/login/index.route.vue` — owns the login form that posts to `sign-in.email`.

Excerpts of the code as it exists today:

```ts
// apps/web/e2e/fixtures.ts:35-46
async function login(page: Page) {
  const env = localEnv()
  const email = env.CARTA_ADMIN_EMAIL
  const password = env.CARTA_ADMIN_PASSWORD
  if (!email || !password) throw new Error('The local administrator credentials are missing.')

  await page.goto('/auth/login')
  await page.getByRole('textbox').first().fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'))
}
```

```ts
// apps/web/e2e/auth.spec.ts:3-10
test('session lifecycle: login, dashboard, reload, logout', async ({ authenticatedPage: page }) => {
  await page.goto('/dashboard')
  await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible()
  await page.reload()
  ...
```

```ts
// apps/web/e2e/rbac-smoke.spec.ts:3-7
test('users list renders', async ({ authenticatedPage: page }) => {
  await page.goto('/settings/users')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'admin@example.com', exact: true })).toBeVisible()
})
```

```ts
// apps/web/e2e/rbac-smoke.spec.ts:9-13
test('roles list renders with assignment persistence', async ({ authenticatedPage: page }) => {
  await page.goto('/settings/roles')
  await expect(page.getByRole('table')).toBeVisible()
  await expect(page.getByRole('cell', { name: 'administrator', exact: true })).toBeVisible()
})
```

Repo conventions that apply here:

- The UI login test stays. It is the only proof that the visible login works.
- Render specs may use stored auth. They must still assert the visible result and reload persistence where the design needs it.
- Credentials stay in `.env` plus `.env.e2e`. Never log them. Never commit them.
- The E2E guard stays. Session setup uses the same E2E API URL and user.
- `apps/web/e2e/.auth/` is already ignored by `.gitignore:32`. Stored state goes there.

## Commands you will need

| Purpose | Working directory | Command | Expected on success |
|---|---|---|---|
| Auth journey, iteration mode | repo root | `E2E_ITERATION=1 pnpm --filter @southneuhof/framework-web test:e2e -- auth.spec.ts` | pass, record wall time |
| Render specs, iteration mode | repo root | `E2E_ITERATION=1 pnpm --filter @southneuhof/framework-web test:e2e -- rbac-smoke.spec.ts` | pass, record wall time |
| Render specs, default mode | repo root | `pnpm --filter @southneuhof/framework-web test:e2e -- rbac-smoke.spec.ts` | pass, proves parity |
| Web lint for touched files | repo root | `pnpm --filter @southneuhof/framework-web lint:focused -- playwright.config.ts e2e/fixtures.ts e2e/auth.setup.ts e2e/rbac-smoke.spec.ts e2e/auth.spec.ts` | exit 0 |

## Scope

**In scope** (the only files you should modify):

- `apps/web/e2e/auth.setup.ts` (new setup file, API login plus stored state)
- `apps/web/playwright.config.ts` (setup project entry only, no server change)
- `apps/web/e2e/fixtures.ts` (use stored state for render specs, keep UI login path)
- `apps/web/e2e/rbac-smoke.spec.ts` (use stored-state fixture, same assertions)
- `apps/web/e2e/auth.spec.ts` (keep UI login test, same assertions unless a session change forces a small fix)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- Login form, auth API, session logic — no product change.
- Iteration flag semantics — plan 012 owns them.
- Failure bundle — plan 011 owns it.
- Framework packages — this plan is app-local only.
- `packages/loom/*` — dirty work exists in the tree. Do not touch it.
- Production, deployment, or dev database — never touch them.

## Git workflow

- Branch: `advisor/013-e2e-fast-auth`
- Commit per step or per logical unit. Message style matches `git log`: short imperative.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Run 009 first

Plan 013 needs plan 012 VERIFIED. Check `plans/README.md`. If 012 is not
VERIFIED, stop. This is not a failure. Return to 009.

**Verify**: 009 row says DONE or VERIFIED with evidence.

### Step 2: Add a setup file that logs in once through the API

Create `apps/web/e2e/auth.setup.ts`. It uses `test as setup` from Playwright.
It reads the E2E API URL and web URL from the same env names the config uses.
It reads admin credentials from `apps/api/.env` plus `apps/api/.env.e2e` the
same way `fixtures.ts:localEnv` does. Do not duplicate secrets handling. Reuse
the same parse order.
It uses `page.request.post` to the sign-in endpoint with JSON email and password
and the `Origin` header set to the web URL. Then it goes to `/dashboard` and
waits for the visible Dashboard text. Then it saves storage state to
`e2e/.auth/admin.json`. That directory is ignored. Create it if missing.
Name the test exactly `authenticate as seeded admin`.
If the sign-in endpoint path differs from the login form path, use the form
path. Check `index.route.vue:46` for the exact call.

**Verify**: `ls apps/web/e2e/auth.setup.ts` exists. Lint passes for the new file.

### Step 3: Register the setup project in the config

In `apps/web/playwright.config.ts`, add a `setup` project that runs
`auth.setup.ts`. Make the `chromium` project depend on it only when storage
state is used. Keep `workers: 1`, `fullyParallel: false`, `retries: 0`, and all
server settings unchanged. Do not change ports or URLs.

**Verify**: config loads. `grep -n "auth.setup\|storageState\|dependencies" apps/web/playwright.config.ts`
shows the new entries. Lint passes for the config.

### Step 4: Point render specs at stored state

Change `rbac-smoke.spec.ts` to use stored state instead of per-test UI login.
Keep both test titles and all assertions exactly the same.
Keep `auth.spec.ts` on the UI login path. Its title and assertions stay the
same unless the session change forces a small fix. If a fix is needed, record
the exact diff and reason in the handoff.

**Verify**: `grep -n "storageState\|authenticatedPage" apps/web/e2e/rbac-smoke.spec.ts apps/web/e2e/fixtures.ts`
shows render specs no longer run UI login. Lint passes.

### Step 5: Prove parity and record the gain

Run `rbac-smoke.spec.ts` with `E2E_ITERATION=1`. Then run it in default mode.
Run `auth.spec.ts` with `E2E_ITERATION=1`.
All three runs must pass with the same assertions as before plan 010.
Record all three wall times. Compare the render-spec time against the plan 009
evidence. The gain must be visible. If stored state is stale or dirty, delete
`apps/web/e2e/.auth/admin.json`, rerun once, and record it.

**Verify**: three passes. Timing numbers recorded for the index row.

### Step 6: Update the index row

Update `plans/README.md` for plan 012 with DONE and the evidence:
setup file path, config change, three passes, and timing numbers.

**Verify**: `git status --short` shows only in-scope files.

## Test plan

- Existing tests that must pass unchanged:
  `apps/web/e2e/auth.spec.ts::session lifecycle: login, dashboard, reload, logout`,
  `apps/web/e2e/auth.spec.ts::unauthenticated /me is 401`,
  `apps/web/e2e/rbac-smoke.spec.ts::users list renders`,
  `apps/web/e2e/rbac-smoke.spec.ts::roles list renders with assignment persistence`.
- New setup case: `apps/web/e2e/auth.setup.ts::authenticate as seeded admin`.
  It is setup, not acceptance proof. The UI login test stays the proof.
- Regression check: default-mode `rbac-smoke.spec.ts` still passes without stored state.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `ls apps/web/e2e/auth.setup.ts` exists and saves state to `e2e/.auth/admin.json`.
- [ ] Playwright config has a setup project for `auth.setup.ts`.
- [ ] `rbac-smoke.spec.ts` keeps both exact test titles and all assertions.
- [ ] `auth.spec.ts` keeps the UI login test and its assertions.
- [ ] `rbac-smoke.spec.ts` passes with `E2E_ITERATION=1` and in default mode.
- [ ] `auth.spec.ts` passes with `E2E_ITERATION=1`.
- [ ] Timing numbers are recorded and render specs are faster than plan 012 evidence.
- [ ] No credentials in logs or new files. `e2e/.auth/` stays ignored.
- [ ] No files outside the in-scope list are modified (`git status`).
- [ ] `plans/README.md` status row for 013 is DONE with evidence.

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 012 is not VERIFIED.
- The code at the locations in "Current state" does not match the excerpts.
- A step verification fails twice after a reasonable fix attempt.
- Stored state hides a real login fault. If the render spec passes but the UI login fails, keep the failure. Do not delete the UI login test.
- Session cookies do not persist across the setup and chromium projects. Record the exact behavior. Do not invent a custom auth bypass.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

For the human or agent who owns this code after the change lands:

- Stored state is a speed tool for render specs only. The login journey still uses the UI.
- Delete `apps/web/e2e/.auth/admin.json` when auth behavior changes. It regenerates on the next run.
- Reviewer focus: setup uses the same E2E user and guard. No new user. No new permission.
