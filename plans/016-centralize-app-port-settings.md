# Plan 016: Read application ports only from each app environment

> **Implementation instructions**: Follow the steps in order. Run each check and
> confirm its expected result. Stop on a condition in `STOP conditions`; do not
> add a fallback or alias. Update this plan and its index row after review.
>
> **Drift check (run first)**:
> `git diff --stat 7eb093d..HEAD -- apps/api apps/web package.json README.md`
> If an in-scope file changed, compare the current-state references with the live
> file before an edit. A contract mismatch is a stop condition.

## Status

- Priority: P1
- Effort: S
- Risk: LOW — local start and browser test configuration change
- Depends on: None
- Category: migration, configuration, DX
- Planned at: commit `7eb093d`, 2026-09-12
- Status: TODO — plan only

The user selected this migration. Execute it only when implementation is
requested. Keep unrelated work. Do not change framework packages, apply a
database migration, run a seed, or write to either forward-test project.

## Why this matters

A port change now requires edits in several configs and tests. This makes a user
setting hard to change and can cause setup failures late in browser work. One
owner per app makes the change local and makes missing values fail before startup.

## Outcome

There is one port setting for each application:

- `apps/api/.env` owns `API_PORT`, `BETTER_AUTH_URL`, and `APP_ORIGIN`.
- `apps/web/.env` owns `WEB_PORT` and `VITE_API_URL`.

All local commands and browser tests read these files. No script, application
config, or test has a fallback port number or a second port variable. The two
`.env.example` files stay as templates. A user changes ports only in the two
app `.env` files.

This plan does not add tests that expect a port number. It tests only that
configuration has one owner and fails clearly when it is absent or invalid.

## Current state

| Owner | Evidence and effect |
| --- | --- |
| `apps/api/src/server.ts:6-10` | The API already requires `API_PORT` and has no runtime fallback. Keep this behavior. |
| `apps/api/scripts/dev.ts:17` | API development already loads `apps/api/.env`. |
| `apps/web/vite.config.ts:10-18` | Vite loads the web environment, but still uses `5181` as a fallback. |
| `apps/web/playwright.config.ts:11-27` | Playwright reads only API `.env.e2e`; it accepts four port aliases and falls back to `5180` and `5181`. |
| `apps/web/playwright.config.ts:60-73` | Playwright replaces API and web URL values instead of using the app-owned values. |
| `apps/web/e2e/auth.spec.ts:8-25` | The tests repeat API and web fallback URLs. `fast-auth.spec.ts:16-39` and `fixtures.ts:20,107-108` do the same. |
| `apps/web/package.json:8` | Web preview has a separate hard-coded port, `3100`. |
| `apps/api/.env.example:1-5` | The API template already keeps its port and related runtime URLs together. |
| `apps/web/.env.example:1-2` | The web template already keeps `VITE_API_URL` and `WEB_PORT` together. |
| `README.md:68-107` | Setup lists the correct variables, but it also presents the sample port numbers as runtime defaults. |

The two external time reports show why this must fail early. Project A found
a missing E2E environment and port trouble after web work had started
(`/Users/gamer/Documents/projects/document-validity-checker/.local/carta-module-development-time-analysis.md:172-188`).
Project B spent 121 minutes on E2E and verification
(`/Users/gamer/Documents/forward-testing/swa-fw/.local/swa-module-development-analysis.md:119-130`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Web types | `pnpm --filter @southneuhof/framework-web type-check` | Exit 0 |
| Web build | `pnpm --filter @southneuhof/framework-web build-only` | Exit 0 |
| E2E config | `pnpm --filter @southneuhof/framework-web test:e2e -- --list` | Tests are listed; no server starts |
| Module tools | `pnpm test:module-tooling` | All selected tests pass |
| Patch | `git diff --check` | Exit 0 |

## Scope

Permitted files for execution:

- `apps/web/vite.config.ts`
- `apps/web/playwright.config.ts`
- `apps/web/e2e/{state.ts,fixtures.ts,auth.spec.ts,fast-auth.spec.ts}`
- `apps/web/package.json`
- `apps/api/.env.example`, `apps/web/.env.example`
- `README.md`, `apps/api/README.md`, `apps/web/README.md`
- Existing focused configuration tests, if a current test owner is suitable
- This plan and `plans/README.md`

Keep actual `.env`, `.env.test`, and `.env.e2e` files untracked. Do not add a
configuration package, shared port file, port registry, compatibility alias,
or new dependency. Keep database and storage settings out of this plan.

## Git workflow

Work in the current checkout and preserve its dirty files. Use one reviewed
commit for this plan with an imperative message such as `Centralize app port
settings`. Do not push or open a pull request unless the user asks.

## Implementation

### 1. Make Vite use `WEB_PORT`

In `apps/web/vite.config.ts`, parse `WEB_PORT` as an integer from the web app
environment. Require a value from 1 through 65535 for `serve` and `preview`.
Use that value for `server.port` and `preview.port`. Tests that load the Vite
config can omit it only when they do not start or preview the application.

Remove `process.env.WEB_PORT` precedence and the numeric fallback. Vite already
loads `apps/web/.env`; direct inherited overrides would create a second owner.
Change the preview package command to `vite preview` so Vite config supplies
the port.

Verify:

```sh
pnpm --filter @southneuhof/framework-web type-check
pnpm --filter @southneuhof/framework-web build-only
```

Expected: both commands exit 0 with a valid `apps/web/.env`; no package command
contains a port number.

### 2. Make Playwright read both app environments

In `apps/web/playwright.config.ts`, read these exact files:

- `apps/api/.env` for `API_PORT`, `BETTER_AUTH_URL`, and `APP_ORIGIN`;
- `apps/web/.env` for `WEB_PORT` and `VITE_API_URL`;
- `apps/api/.env.e2e` only for E2E database and storage overrides.

Use the existing `dotenv` dependency. Require valid API and web ports. Require
all three URLs. For a local E2E run, check these relations before a server starts:

- the port in `BETTER_AUTH_URL` equals `API_PORT`;
- the port in `VITE_API_URL` equals `API_PORT`;
- the port in `APP_ORIGIN` equals `WEB_PORT`.

Build the Playwright web base URL from `APP_ORIGIN`. Use `BETTER_AUTH_URL` for
API health and requests. Pass the exact app-owned values to each child process.
Do not accept `CARTA_E2E_API_PORT`, `CARTA_E2E_FRONTEND_PORT`, `BACKEND_PORT`,
`FRONTEND_PORT`, or inherited `E2E_*` URL overrides.

`E2E_API_URL` and `E2E_WEB_URL` can remain process outputs for existing test
helpers. Set them from the app-owned values and reject a different inherited
value. They are derived values, not user settings. Add one small required-value
helper in `e2e/state.ts` and use it in specs and fixtures. Remove every URL
fallback from those files.

Verify:

```sh
pnpm --filter @southneuhof/framework-web test:e2e -- --list
```

Expected: Playwright lists tests without starting services. A missing or
inconsistent app value produces one clear error that names the app `.env` file.
Do not add an assertion for a specific port number.

### 3. Remove duplicate documentation

Keep sample values in `.env.example`. State that they are templates. In the
root and app README files, tell the user to change `API_PORT` and related API
URLs in `apps/api/.env`, and `WEB_PORT` and `VITE_API_URL` in `apps/web/.env`.
Remove text that calls the sample numbers defaults.

Search all tracked application, script, test, and documentation files for the
old aliases and hard-coded local URLs. Remove configuration uses. A fixture can
contain an unrelated number only when it is test data and not a port setting.

Verify:

```sh
rg -n "CARTA_E2E_(API|FRONTEND)_PORT|BACKEND_PORT|FRONTEND_PORT|--port 3100|127\\.0\\.0\\.1:518[01]|localhost:518[01]" apps scripts README.md
git diff --check
```

Expected: the search finds sample values only in the two `.env.example` files
and any text that clearly describes those samples. It finds no runtime fallback,
test fallback, or command-line port.

## Test plan

- Run the web type-check and build.
- Run Playwright `--list` with valid app `.env` files.
- Temporarily remove one required value in a disposable copy and confirm that
  config load fails before server startup. Restore it before other checks.
- Run one existing E2E case after plan 017 has prepared the target. This confirms
  that both child servers use the selected values.
- Run `pnpm test:module-tooling` after plan 019 adds the workflow checks.

No new port-value unit test is required. If no current config test can test the
missing-value branch without copying production logic, use the disposable
Playwright config check above and record the command output.

## Done criteria

- [ ] A port change needs edits only in `apps/api/.env` and `apps/web/.env`.
- [ ] API and web commands use their app-owned port variables.
- [ ] Playwright reads the two app environments and accepts no port alias.
- [ ] E2E specs and fixtures have no hard-coded local URL fallback.
- [ ] Web preview has no separate port setting.
- [ ] Example files remain templates and actual `.env` files remain untracked.
- [ ] Web type-check, build, Playwright list, search, and diff checks pass.

## STOP conditions

Before execution, run:

```sh
git diff --stat 7eb093d..HEAD -- apps/api apps/web package.json README.md
git status --short
```

The existing Loom and asset work is unrelated and must survive. Inspect current
callers before editing a changed file. Stop and report if a deployment system
requires a second port owner, or if an app must use a non-local URL relation that
the checks above reject. Do not add an alias as a quiet fix. A different contract
needs a user decision.

## Maintenance notes

Update this plan and its `plans/README.md` row after review. Record exact commands,
results, and any check that was not run. If a later app needs another process,
give that app its own `.env` value; do not put Carta app ports in a shared file.
