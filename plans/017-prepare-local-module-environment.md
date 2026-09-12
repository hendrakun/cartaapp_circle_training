# Plan 017: Prepare and check the local module environment

> **Implementation instructions**: Complete plan 016 first. Follow these steps in
> order and run every check. Stop on a condition in `STOP conditions`; do not
> weaken a database or storage guard. Update the plan and index after review.
>
> **Drift check (run first)**:
> `git diff --stat 7eb093d..HEAD -- scripts apps/api/scripts package.json README.md`
> Reconcile plan 016 and any other in-scope change with the current-state
> references. A changed safety contract is a stop condition.

## Status

- Priority: P1
- Effort: M
- Risk: MED — the checks touch local database, browser, and storage setup
- Depends on: 016
- Category: migration, DX, test reliability
- Planned at: commit `7eb093d`, 2026-09-12
- Status: TODO — plan only

The user selected this migration. Execute it after plan 016. Keep unrelated
work. The setup command can create missing local environment files because the
user calls it for that purpose. It must not overwrite a file, install software,
reset data, apply migrations, seed data, clear storage, or print a secret.

## Why this matters

Both measured module runs lost time after implementation because a test service or
environment file was not ready. A small setup command makes required files clear.
A read-only preflight proves each selected capability before dependent work starts.

## Outcome

Two root commands make local module work predictable:

```sh
pnpm setup:local
pnpm module:preflight -- --needs api,web,test,browser,storage
```

`setup:local` creates missing local environment files from tracked templates and
reports the purpose of each target. It is idempotent. `module:preflight` is
read-only. It checks only the capabilities named by `--needs`, reports `PASS`,
`FAIL`, or `SKIP` for each check, and gives an exact correction command for every
failure. The agent runs it before substantial implementation.

The first version uses Node standard library plus dependencies already in the
workspace. It has no service manager, container manager, installer, secret vault,
or general configuration framework.

## Current state

| Owner | Evidence and effect |
| --- | --- |
| `README.md:68-121` | Setup is a manual list. It creates only the two development `.env` files and prepares only the development database. |
| `apps/api/.env.test.example:1-6` | The test target has a clear purpose and database name, but the user must find and copy it. |
| `apps/api/scripts/test-target.mjs:1-49` | A useful read-only guard already validates the test config and keeps it separate from development. Reuse its parsing and target rules. |
| `apps/api/scripts/e2e-target.ts:4-25` | E2E guards have hard-coded database and bucket defaults. There is no tracked `.env.e2e.example`. |
| `apps/api/package.json:28-36` | Existing commands can migrate the test target and reset, migrate, clear, and seed E2E. The preflight must not call these write commands. |
| `apps/web/e2e/state.ts:22-35` | A browser run prepares E2E only after Playwright starts. Setup faults can therefore appear late. |
| `package.json:25-30` | Root module tooling has no local setup or preflight command. `test:module-tooling` already runs Node tests in `scripts/`. |

Project A found the missing `apps/api/.env.e2e` only during the web journey
(`/Users/gamer/Documents/projects/document-validity-checker/.local/carta-module-development-time-analysis.md:172-188`).
Project B declared isolated targets in its plan, but still spent 121 minutes in
E2E and verification (`/Users/gamer/Documents/forward-testing/swa-fw/.local/swa-module-development-analysis.md:164-184,119-130`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Focused tool test | `node --test scripts/local-environment.test.mjs` | All selected tests pass |
| Tool suite | `pnpm test:module-tooling` | All module-tool tests pass |
| Setup | `pnpm setup:local` | Missing files are created; existing files are unchanged |
| Preflight | `pnpm module:preflight -- --needs api,web,test,browser,storage` | Every required capability reports PASS |
| API target | `pnpm --filter @southneuhof/api test:focused -- scripts/e2e-target.spec.ts` | Guard cases pass on the isolated test DB |
| Patch | `git diff --check` | Exit 0 |

## Scope

Permitted files for execution:

- `scripts/local-environment.mjs` — one new command owner
- `scripts/local-environment.test.mjs` — one focused test owner
- `package.json`
- `apps/api/.env.e2e.example` — one new template
- `apps/api/scripts/test-target.mjs`
- `apps/api/scripts/e2e-target.ts` and its current tests
- `README.md` and app README files
- `.gitignore` only if the new local file is not already ignored
- This plan and `plans/README.md`

Do not change application runtime source, framework packages, CI infrastructure,
database schemas, migrations, or seed contents. Do not add Docker Compose or a
new dependency. Keep plan 016 as the only owner of port resolution.

## Git workflow

Work in the current checkout. Keep plan 016 changes and all unrelated dirty work.
Use one reviewed commit for this plan with an imperative message such as `Add
local module preflight`. Do not push or open a pull request unless the user asks.

## Command contract

### `pnpm setup:local`

Use one Node script with a `setup` operation. It must:

1. Check the repository root and required templates.
2. Copy missing files with exclusive create semantics:
   - `apps/api/.env.example` to `apps/api/.env`;
   - `apps/web/.env.example` to `apps/web/.env`;
   - `apps/api/.env.test.example` to `apps/api/.env.test`;
   - `apps/api/.env.e2e.example` to `apps/api/.env.e2e`.
3. Never change an existing destination.
4. Replace the API secret placeholder only in a newly created `.env`, with
   `node:crypto` random bytes. Never print that value.
5. Run the read-only core preflight and print the next correction commands.
6. Exit 0 when files are ready for configuration. Exit 1 for an unsafe template,
   invalid existing file, or failed core check.

The command prepares files. It does not claim that PostgreSQL, Chromium, or S3
is ready. Its output must say this clearly.

### `pnpm module:preflight`

Use the same script with a `preflight` operation. Accept this bounded option:

```text
--needs api,web,test,browser,storage
```

Reject unknown or duplicate names. With no option, check `api,web`. Always print
the selected scope. JSON output can be added only if the current module tools
need it during implementation; do not add a second command or report format.

Each result has:

```text
STATUS  PURPOSE  CHECK  CORRECTION
```

Do not print URLs with passwords, access keys, secrets, or administrator
credentials. A database result can print host, port, and database name.

## Implementation

### 1. Add the E2E template and remove E2E defaults

Add `apps/api/.env.e2e.example` with only E2E overrides:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carta_e2e
CARTA_DATABASE_PURPOSE=e2e
CARTA_E2E_DATABASE_NAME=carta_e2e
S3_BUCKET=carta-e2e
```

The API `.env` supplies shared local credentials and endpoints. Plan 016 supplies
ports and URLs from app `.env` files. Remove fallback values from
`e2e-target.ts`; require the purpose, database name, and bucket from effective
configuration. Keep the connected database check and storage guard.

Update existing E2E target tests for missing values and exact configured values.
Do not test the sample names as required product constants.

Verify:

```sh
pnpm --filter @southneuhof/api test:focused -- scripts/e2e-target.spec.ts
```

If the actual test file has another name, use the current owner found at execution
time. This command uses the guarded test database and can migrate it.

### 2. Add one setup and preflight script

Create `scripts/local-environment.mjs`. Reuse `node:util.parseEnv` and extract the
database identity parser from `apps/api/scripts/test-target.mjs` only if both
commands need exactly the same rules. Prefer exporting the existing function
over copying it. Keep file copy, validation, probes, and output in this one script.

Checks by capability:

| Need | Read-only checks | Correction examples |
| --- | --- | --- |
| `api` | dependencies present; API `.env` exists; required API values exist; port and URLs pass plan 016 rules; API port is available or its `/health` route responds | `pnpm install`; edit `apps/api/.env`; stop the process that owns the port |
| `web` | web `.env` exists; `WEB_PORT` and `VITE_API_URL` pass plan 016 rules; web port is available or the web server responds | edit `apps/web/.env`; stop the process that owns the port |
| `test` | `.env.test` passes `assertTestTarget`; connect with existing `pg`; run `select current_database()`; confirm the connected name | create the named local database; `pnpm --filter @southneuhof/api db:migrate:test` |
| `browser` | `.env.e2e` passes the E2E config guard; Playwright Chromium executable exists; E2E database accepts `select current_database()` and matches its declared purpose/name | `pnpm exec playwright install chromium`; create the E2E database; `pnpm --filter @southneuhof/api e2e:migrate` |
| `storage` | E2E storage variables exist; use the installed S3 client for one read-only bucket head; require the configured E2E bucket guard | start/configure the S3 service; create the named E2E bucket |

Use a short TCP or HTTP timeout. Close every socket, database pool, and S3 client
before exit. A responding health endpoint is a pass when it matches the selected
app. A process that owns the port but does not give the expected response is a
failure. Do not stop it.

For `browser`, do not invoke Playwright or start a browser. Read the installed
executable path and check that it exists. For `storage`, do not list, upload, or
delete objects. For all database checks, use only `select current_database()`.

### 3. Add one focused test file

In `scripts/local-environment.test.mjs`, use temporary directories and injected
probe functions. Cover these material branches in one test file:

- first setup creates four files and replaces only the new secret placeholder;
- second setup changes no bytes;
- an existing file is never overwritten;
- unknown `--needs` input fails;
- test and E2E database identity cannot equal the development identity;
- missing, unreachable, and mismatched targets give a safe correction and no
  secret value;
- every injected socket/client is closed.

Do not test Node file-copy behavior or every output word. Test decisions and
secret redaction. Keep network and service calls injected so the tooling suite
does not need PostgreSQL, Chromium, or S3.

Verify:

```sh
node --test scripts/local-environment.test.mjs
pnpm test:module-tooling
```

### 4. Add commands and concise setup guidance

Add root aliases:

```json
"setup:local": "node scripts/local-environment.mjs setup",
"module:preflight": "node scripts/local-environment.mjs preflight"
```

Update the root README setup sequence:

```sh
pnpm setup:local
# edit the four local files and provision the named services
pnpm module:preflight -- --needs api,web,test,browser,storage
```

Explain each environment purpose and list the existing write commands that the
user may run after a safe target passes. Do not copy all validation rules into
the README. Link to command `--help` output or keep the short table above in one
code-owned help message.

Verify:

```sh
pnpm setup:local
pnpm setup:local
pnpm module:preflight -- --needs api,web,test,browser,storage
git diff --check
```

Expected: the second setup reports no file change. Preflight gives a complete
result and exact next commands. It does not modify a database, storage, or browser.
A local service can fail during implementation; record it as `FAIL`, correct it,
and rerun before module development.

## Test plan

- Run the focused Node test and full module tooling suite.
- Run setup twice and compare checksums of all existing `.env` files.
- Run each capability alone and in the full list.
- Verify the test and E2E connections use distinct database identities.
- Verify storage with a head request only.
- After all checks pass, run one existing API focused test and one existing E2E
  case. These are service integration proof, not part of the read-only preflight.
- Search captured output for known local secret values before preserving evidence.

## Done criteria

- [ ] One idempotent command creates only missing local environment files.
- [ ] One read-only command checks selected module prerequisites before work starts.
- [ ] Test and E2E database targets are explicit and distinct from development.
- [ ] E2E storage has an explicit guarded target and no hard-coded default.
- [ ] Every failure names its purpose and an exact correction command.
- [ ] No secret is printed and no existing `.env` file is changed.
- [ ] Preflight performs no install, migration, seed, reset, upload, list, or delete.
- [ ] Tool tests and one real API/E2E integration check pass.

## STOP conditions

Before execution, run:

```sh
git diff --stat 7eb093d..HEAD -- scripts apps/api/scripts apps/api/.env.example apps/web/.env.example package.json README.md
git status --short
```

Plan 016 changes are expected. Preserve all unrelated asset work. Stop if the
selected test database is not provably isolated, the E2E bucket is not dedicated,
or a probe would need a write to prove readiness. Report that capability as
blocked. Do not weaken a guard or run the write as a preflight shortcut.

## Maintenance notes

Update this plan and the index after review. Keep raw local output in ignored
`.local` storage. Record failed and unverified capabilities. Add a new capability
only when an approved module repeatedly needs it before implementation; do not
turn this command into a general workstation diagnostic tool.
