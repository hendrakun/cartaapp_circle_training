# File-routing plans

Planned with the improve skill against checkout `00763ed` on 2026-09-08.
Both plans passed parent review on 2026-09-09.

## Status

| Plan | Priority | Depends on | Status |
| --- | --- | --- | --- |
| [001: Hidden tooling and editor support](001-hide-route-language-and-build-work.md) | P1 | None | DONE |
| [002: Framework and app migration](002-migrate-sprindle-and-carta-file-routes.md) | P1 | 001 | DONE |
| [003: Reject route import cycles](003-reject-route-import-cycles.md) | P1 | None | DONE |
| [004: Preserve external declaration paths](004-preserve-external-declaration-paths.md) | P1 | 003 | DONE |

## Delivered contract

HTTP methods and paths come from `+server.ts` files and named method exports.
Parent `+scope.ts` files supply context, identity, access checks, entities, and
record conversion. Parent hooks receive their own context and identity. Child
context can replace fields for descendants without changing parent checks.

Developers can add, move, or delete routes without a registration edit,
generated import, manual context type, or generation command. The normal build,
type-check, test, and development commands maintain private artifacts. The SDK
uses declarations emitted from the same contextual type view as the editor.
Type-only changes update those declarations. Plain consumer TypeScript checks
work after application route source is removed.

All 27 existing API method/path pairs are preserved. Database domain ownership
is separate from route ownership. Production runs in plain Node from a shared
ESM bundle. Development and tests use separate source manifests, so app request
state is shared and simultaneous build/test commands do not replace each
other's artifacts. No production request scans source files or loads a compiler.

## Parent verification

The parent ran these checks against the final implementation:

- `pnpm build --force`: six tasks passed, zero cache hits.
- `pnpm type-check --force`: six tasks passed, zero cache hits.
- `pnpm lint --force`: three tasks passed, zero cache hits.
- `pnpm test --force`: twelve tasks passed, zero cache hits. The unrestricted
  Sprindle suite has 184 tests; API has 72, SDK has 3, and web has 216.
- `pnpm test:module-tooling`: 47 tests passed.
- Sprindle isolated VS Code editor-host and editor-install tests: exit 0.
- [Language proof](proofs/file-routing/LANGUAGE.md): ten checks passed.
- [Runtime proof](proofs/file-routing/README.md): thirteen checks passed,
  including the counterexample for manifest-only source type inference.
- Cold normal development startup: HTTP asset URL projection, route addition,
  invalid-edit recovery, route move, and route deletion passed.
- Cached build and type-check after output removal: six cache hits each;
  required binaries, declarations, and API artifacts were restored. The SDK
  consumer check passed after each restoration.
- Direct plain Node import of the production application returned 200 from
  `/health`. The isolated production test runs a copied bundle without app
  source, the Sprindle package, or a TypeScript loader.
- `git diff --check` and the obsolete production registration search passed.

The API test target guard reported `VALID` for the separate `carta_test`
database before migrations and tests. The existing ignored `.env.test` was
missing its purpose and name markers; those two markers were added. Database
credentials and the target URL were not changed.

Earlier review failures were corrected before approval. The full framework
suite is enabled. Tests cover parent rejection and error unwinding, middleware,
parsed write hooks, type and runtime inheritance, declaration publication from
concurrent processes, failed-build preservation, path aliases, exact literal
outputs, type-only edits, and production/development request state.

## Editor setup and limits

Run `pnpm setup:editor` once to install the project language support. No route
generation command is needed. The parent tested installation in an isolated
profile; the user's editor profile was not changed.

VS Code 1.136.1 on macOS is the tested editor. The extension supports one
TypeScript project at a time. Context rename refuses edits because complete
cross-file references cannot yet be proved. Source add, move, and delete,
context inference, diagnostics, completion, and definitions are supported.
See [tooling documentation](../packages/sprindle/docs/file-routing-tooling.md).

## Boundaries

Work stayed in the current checkout. No other branch, worktree, or historical
implementation was inspected. No commit, push, publication, deployment,
application schema migration, or development database reset was performed.

## Follow-up plan 003

Plan 003 was written with the improve skill at `83c0cf9` on 2026-09-10.
It is independent of other pending module work. It preserves the completed

The bundle contains the reported undefined auth domain. A focused check also
found that native ESM fails when the same graph is loaded through the scope
first. The plan therefore breaks the application cycle and rejects static
local import cycles before publication. It also gives E2E its own source
manifest so application modules are shared.

Considered and rejected: treating the graph as safe for every ESM entry order;
waiting for route readiness; skipping undefined domains; changing import order
to hide the fault; and adding a new compiled-module system for this fix.

Planning checks: six existing Sprindle manifest tests passed. The minimal
in-memory reproduction confirmed both the native ESM initialization error and
the delayed bundle error. No database reset, live HTTP check, or browser E2E
was run. This was not a full framework or repository audit.

Final review of plan 003 passed on 2026-09-10. The standard Sprindle tooling
suite passed all 37 tests after the timeout and process-cleanup correction.
The API build and all 4 selected API tests passed. Type-check, lint, and patch
checks passed. Browser E2E was not run. See the plan for the full evidence,
earlier failures, and the separate external declaration-emission limit.

## API dev-startup performance — 2026-09-11

Planned with the improve skill against checkout `99d77a5` on 2026-09-11.
Scope: `perf` only. The user reported ~15 s dev startup (2741 ms compile +
6767 ms watcher + 1162 ms manifest load). The user selected the top 2
findings for plans. Read-only analysis only; no source changed during
planning. Working tree was clean (`git status --short` empty).

### Measured evidence (all on this checkout, `bundle=false`)

- Full API compile: 2424 ms cold-ish, warm 1959 ms. Scope: 24 routes,
  5 scopes, 29 route files plus ~44 esbuild metafile inputs.
- 1-route fixture compile: 326 ms cold, 143-161 ms warm. Fixed declaration
  cost dominates the API compile.
- Manifest import under tsx: 936-1372 ms, stable across runs. Plain Node
  import was not measurable (source manifest holds `.ts` specifiers).
- Server phases on port 5199 reproduce the report: manifest 1191 ms,
  app 24 ms, database 2 ms, bind 0 ms.
- Framework imports under tsx: sprindle/hono ~700 ms, create-app ~788 ms,
  db module ~632-674 ms, first `getDb()` ~1 ms, `defineDomainSchema` ~1 ms.

### Findings table

| # | Finding | Category | Impact | Effort | Risk | Evidence |
|---|---|---|---|---|---|---|
| PERF-01 | Dev, test, and temp manifests emit TypeScript declarations | perf | ~2 s of every ~2.4 s dev compile; 3 compiles per startup | S | LOW | `packages/sprindle/src/tooling/manifest.ts:69` always calls `emitRouteDeclarations`; dev uses `.sprindle-dev` (`apps/api/scripts/dev.ts:5`), test uses `.sprindle-test` (`apps/api/scripts/compile-routes.ts:2`), temp dir in `apps/api/scripts/build-production.ts:14` |
| PERF-02 | Dev startup compiles the manifest 3 times | perf | 2 redundant ~2.4 s compiles before the server starts | S | LOW | `apps/api/scripts/dev.ts:9` explicit compile, then `watchRouteManifest` runs `compile(); await queue; compile(); await queue` (`packages/sprindle/src/tooling/manifest.ts:252`) |
| PERF-03 | Watcher scans the whole API project, not routes plus inputs | perf | Every keystroke recompiles on any project file change; dozens of watchers held open | S | LOW | `watch(project, { recursive: true })` at `manifest.ts:235` plus `directories(project)` at line 240; 51 watch-candidate dirs counted; no route/input scoping |
| PERF-04 | Dev manifest is source-only while production is bundled | perf | ~1 s tsx transform per server start plus per-route transform churn on reload | M | MED | `dev.ts:9` and watcher use `bundle=false`; production `tooling/build.mjs:8` bundles; manifest import under tsx measured ~1 s |
| PERF-05 | Versioned `contracts/` dirs accumulate, stale tmp files remain | perf | 8.7 MB across 10 contract versions in `.sprindle-dev`; 4 orphan `.tmp` files; no pruning | S | LOW | `apps/api/.sprindle-dev/contracts/` listing at audit time (ignored output); `manifest.ts:146-150` renames without cleanup; failed-compile tmp files observed |
| PERF-06 | Server imports manifest, app, and db serially | perf | ~150-300 ms of chained tsx transforms | S | LOW | `apps/api/src/server.ts:13-26` awaits hono import, manifest, create-app, db in sequence; each import measured 600-800 ms cold under tsx |

Direction findings: none. This was a focused perf audit, not a direction pass.

### Status

| Plan | Title | Priority | Depends on | Status |
| --- | --- | --- | --- | --- |
| [005](005-skip-dev-declarations.md) | Skip type declarations for development and test manifests | P1 | None | DONE (manifest.spec 14 pass; auth-manifest 2 pass; test:dev-routes pass ~9.2 s; type-checks + lints exit 0; production build.mjs untouched) |
| [006](006-single-dev-compile.md) | Compile once and wait for watcher readiness on dev startup | P1 | 005 (time saving; logic works alone) | DONE (manifest.spec 15 pass incl. single-compile test; tooling.spec 5 pass; test:dev-routes pass ~10.4 s; type-checks + lints exit 0; pre-existing macOS FSEvents phantom-compile flake documented in 006 deviation note) |
| [007](007-narrow-route-watcher.md) | Narrow the route watcher to routes plus compiled inputs | P2 | None (keep 005/006 signatures if landed) | DONE (manifest.spec 17 pass incl. 2 new scope tests, 10 consecutive full-file passes; tooling.spec 5 pass x2; test:dev-routes pass ~8.4 s; type-checks + lint exit 0) |

Execute 005 → 006, 007 any time after drift check. 005 removes ~2 s per compile; 006 removes 2 compiles.
007 removes spurious recompiles during editing (no startup gain by itself).
Together 005+006 remove ~6-7 s from the ~15 s startup. Either plan alone still helps.

### Findings considered and rejected

- Bundle the dev manifest (PERF-04): deferred; changes reload semantics and
  the auth-manifest source-mode contract. Needs its own design pass.
- Prune contracts and tmp files (PERF-05): housekeeping, not startup time.
  Safe follow-up, unplanned.
- Parallelize server imports (PERF-06): small gain (~150-300 ms), touches
  boot order. Unplanned.
- Database or `defineDomainSchema` as the cause: rejected with evidence;
  first `getDb()` ~1 ms, schema define ~1 ms, pool connect lazy.

## Follow-up plan 004

The user selected the existing temporary-folder approach on 2026-09-10 to get
sibling source imports working quickly. Plan 004 keeps the TypeScript CLI and
maps discovered source and declaration files relative to a common ancestor.
It depends on the completed but uncommitted plan 003 changes.

The virtual-emitter alternative is deferred. The installed TypeScript 7.0.2
public emitter exposes `printNode`; declaration emission through that API was
not proved. The implementation must establish the sibling-import regression
and portable consumer proof before completion. No new compiler architecture,
application configuration, or user generation command is planned.


## Backend generation performance — 2026-09-12

Planned with the improve skill at commit `6fa00d4`. The user selected findings
1, 2, and 4 in that order. This is authorization to write plans, not to execute
them. Finding 3 requires separate explicit permission before further work.
Existing plans 001–007 remain complete; plan 008 is a separate approved E2E
design and is not superseded by these plans.

| Plan | Finding and title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [009](009-limit-route-declaration-inputs.md) | 1: Limit declaration entry files to route dependencies | P1 | M | None | DONE |
| [010](010-reuse-route-declarations.md) | 2: Reuse valid declarations on unchanged builds | P1 | M | 009 | DONE |
| [011](011-build-route-bundle-once.md) | 4: Build each route bundle once | P2 | M | 010 | TODO |

Plan 011 was refined on 2026-09-12 against `a80bfc5` plus the uncommitted
009/010 source. It now gives source fingerprints, two exact helper algorithms,
four named tests, fixed edit points, and repeatable measurement commands. This
refinement does not resume execution; the pause after plan 010 remains active.


The user authorized delegated execution of 009 → 010 → 011 on 2026-09-12. Plan
009 establishes declaration roots before reuse is added. Plan 010 must include
all type inputs, not only runtime dependencies. Plan 011 comes last by user
priority and changes the same publication path; keep the preceding reuse checks
intact. Completed prerequisite diffs are expected changes during later plans'
drift checks.

Plan 010 uses a TypeScript file-resolution probe and content hashes before it
reuses a declaration. A separate-process test records one declaration emit on
the first build, none on an unchanged second build, and a second emit after a
route edit. The final API measurement recorded a 17.80-second miss and a
4.41-second median for the next four hits, with high host wall-time variance.
Invalid metadata, incomplete inventories, damaged files, and output links that
leave the private directory cause safe misses. The generator, compiler, config,
framework, selected external files, and workspace metadata are part of the key.

A plan 010 review revision fixes recovery when the content-version path is a
dangling symbolic link. The old code failed with `ENOTDIR`. The generator now
uses `lstatSync` to detect the link entry and publishes a valid immutable repair
version while it keeps the old link and backup. The next unchanged process
reuses that repair without another declaration emit. The isolated regression
failed before the fix, and the final tooling suite passed all 49 tests.

The user paused this sequence after plan 010. Plan 011 remains TODO and does not
start until the user asks to resume. Finding 3 still requires separate explicit
permission.

### Audit evidence and limits

Scope: route generation in `apps/api`, `packages/sprindle`, and their command
configuration. The API has 24 routes and 5 scopes. Read-only measurements:

- Route scan: 114 ms first run, 6–9 ms on repeat runs.
- In-memory esbuild analysis: 325 ms first run, 8–10 ms on repeat runs.
- Contextual overlay: 123 files, including 14 test files and 12 scripts;
  preparation took 216 ms first run, 29–34 ms on repeat runs.
- Contextual diagnostics: 2229 ms, zero diagnostics.
- Plain API TypeScript check: 1243 ms compiler-reported total, exit 0.

These are separate stage measurements, not a complete generation benchmark.
The initial measurement command could not resolve `tsx` from the repository
root; the corrected command used the installed API loader and passed. Full
builds, tooling test suites, database tests, and browser tests were not run during
this planning pass. Each plan lists implementation verification gates.
Source files were not changed. Existing Loom work remains outside scope.

Evidence: `packages/sprindle/src/tooling/manifest.ts:123` promotes all overlay
TypeScript files to declaration roots; `language.ts:209` collects the project;
`manifest.ts:70` always emits declarations; `manifest.ts:140` checks the version
after emission; `manifest.ts:60` and `:68` build the same graph twice.

### Deferred and rejected work

- Finding 3: repeated type checks in `apps/api/package.json:15–16`. DEFERRED
  until the user gives explicit permission. No plan was written. Plans 009–011
  must preserve declaration validation, contextual diagnostics, and plain `tsc`.
- Old startup findings: declaration skipping, single initial compile, and
  narrower watchers are already implemented by 005–007. Do not plan them again.
- Runtime-hash-only declaration reuse: rejected because type-only edits can
  change the consumer contract without changing runtime inputs.
- Full compiler replacement, persistent compiler service, broad incremental
  staging, and new cache dependencies: outside the selected scope.
- Route-scan micro-optimization: lower value at the measured 6–9 ms repeat cost.
- Database migration generation, request performance, frontend behavior, and a
  full framework audit were not included. No direction findings were requested.

## E2E iteration speed — 2026-09-12

Design: [008](008-e2e-iteration-design.md). Plans reviewed against `cdbc12b`
with the improve skill on 2026-09-12. Only plans changed during this review.
No E2E timing or implementation test was run. Plans 009–011 are unrelated.

| Plan | Title | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [012](012-e2e-iteration-prepare-once.md) | Prepare once per worker and reuse local servers | P1 | M | None | DONE — unit, guard, iteration, and default gates pass; medians 48.73 s cold, 33.49 s warm prepare, 10.85 s warm skip |
| [013](013-e2e-fast-auth.md) | Reuse API auth state after preparation | P2 | S | 012 DONE with evidence | IMPLEMENTED — combined, repeat, and default proofs pass; equivalent timing incomplete |
| [014](014-e2e-failure-bundle.md) | Preserve failure evidence in one local bundle | P2 | M | None | IMPLEMENTED — failed and green proofs pass; timing incomplete; collector review and 8 Node tests pass |

Recommended order: 012 → 013 → 014. Plan 014 can run independently; retain any
fixture changes already made by 012/013. Use DONE with evidence for dependency
checks. Do not require an undefined VERIFIED status.

Plan 012 measures reset-count savings separately from server reuse and explicit
skip-prepare reuse. Warm servers run in owned terminals, and backend changes
require a compile/restart. Plan 013 creates auth after prepare and stores it in
worker memory. The UI journey keeps a separate session. Plan 014 improves failure
diagnosis, not passing-test speed. It adds bounded missing diagnostics and uses
the existing trace for DOM details.

### Review findings

All findings have HIGH confidence from direct source and plan reads. Effort is
for the plan correction; implementation effort is in the status table above.

| Finding | Category | Impact | Effort | Fix risk | Evidence |
| --- | --- | --- | --- | --- | --- |
| Server reuse needs an external process owner | perf | Separate CLI runs otherwise still pay startup | S | LOW | `apps/web/playwright.config.ts:53–70`; installed Playwright `lib/runner/index.js:836–851` stops processes it starts |
| Prepare-once must be restricted to iteration | correctness | An unconditional module flag removes default per-test isolation | S | MED | `apps/web/e2e/fixtures.ts:48–53`; original 012 step 3 omitted the default branch |
| Auth must follow prepare and remain separate from logout | correctness | Reset deletes cached sessions; global state breaks anonymous/logout cases | S | MED | `apps/api/scripts/reset-e2e.ts:6–31`; `apps/web/e2e/auth.spec.ts:16–25` |
| Report data needs explicit capture and private storage | dx/security | JSON has no network field; raw traces can contain session data | S | MED | installed Playwright `types/testReporter.d.ts:329–359`; `.gitignore:30–32`; `apps/web/e2e/fixtures.ts:48` |
| Prefix helper cannot control API object keys | tech-debt | Unused helper gives a false cleanup contract | S | LOW | `apps/api/src/routes/(authenticated)/files/presigned-url/+server.ts:17–19` |
| Dependencies and proof commands were inconsistent | docs/tests | Executor could update the wrong plan or stop on normal dependency changes | S | LOW | Original 013/014 referred to 009–011 and wrong status rows; `apps/api/package.json:19` focused test also migrates Vitest DB |

### Design details corrected in this review

- Keep design 008's local iteration and full acceptance goals. Explicitly start
  warm servers outside Playwright; `reuseExistingServer` alone cannot retain them.
- Use API storage state in memory after prepare. A setup project and shared disk
  file add reset-order problems without a current need.
- Keep raw bundles in ignored local reports. DOM remains in the native trace;
  standalone console/network summaries require fixture capture.
- Keep the owned-object cleanup rule, but defer its implementation until an
  upload journey exists. The server chooses the actual object key.

### Findings considered and rejected

- More E2E workers: rejected; the suite shares one mutable E2E database.
- Faster prepare on a one-case run from a worker flag alone: rejected; one case
  already prepares once. Measure server startup and explicit state reuse instead.
- New auth setup project or persistent session cache: not needed for the current
  serial read-only RBAC cases. Reconsider only with measured need.
- S3 prefix helper now: rejected; no caller and no API prefix input.
- Failure bundle as a passing-test speed improvement: rejected; measure diagnosis
  usefulness and successful-run overhead separately.

### Review scope and limits

Reviewed the three plans, design 008, their index, E2E config and all current
browser specs, reset/seed/storage guards, auth route contract, related scripts,
package commands, web CI, and installed Playwright report/server behavior.
No source, framework, database, storage, or environment file was changed.
Product modules, a full framework audit, dependency security, and infrastructure
performance were not audited. No new product direction was proposed.
