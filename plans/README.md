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
