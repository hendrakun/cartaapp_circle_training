# Plan 009: Limit declaration entry files to the route contract

The user authorized delegated execution on 2026-09-12. Follow the steps and run
each verification gate. Update this plan and its index row only after
implementation and review.

## Status

- Priority: P1; selected finding 1.
- Effort: M (about one day, including tests).
- Risk: MED; missing global declarations can change inferred types.
- Depends on: none. Plans 005–007 are already complete.
- Category: perf.
- Planned at: commit `6fa00d4`, 2026-09-12.
- Status: DONE. The user authorized delegated execution on 2026-09-12.

## Why this matters

Declaration generation currently promotes every collected TypeScript source to
a compiler entry file. The API overlay has 123 files, including 14 test files
and 12 scripts. These unrelated modules can add type analysis, declaration
output, alias rewriting, and hashing to every generation. Start with the smallest
change: reduce declaration entry files while retaining the existing staged source
set for TypeScript resolution. Do not redesign project discovery.

## Current state

`packages/sprindle/src/tooling/manifest.ts:85` obtains the same contextual overlay
used by the language service. Lines 95–98 copy it to a temporary source tree.
Lines 123–124 then add all non-declaration TypeScript files as roots:

```ts
const contextualSources = [...overlay.keys()].filter((file) => file.endsWith('.ts') && !file.endsWith('.d.ts') && file !== resolve(projectRoot, 'tsconfig.json'))
const rootFiles = [...new Set([...routes.flatMap((route) => [route.sourcePath, ...route.scopes]), ...contextualSources, virtualDefinition])].map((file) => resolve(input, mappedPath(file)))
```

`packages/sprindle/src/tooling/language.ts:209` starts source collection with the
whole project:

```ts
const dependencies = sourceDependencies([...projectFiles(projectRoot), ...configFiles(config), ...open.keys()], open)
```

This broad set is useful for editor diagnostics and must stay unchanged there.
`manifest.ts:133–142` rewrites and hashes all emitted declarations. An unrelated
module therefore adds output work even when no route imports it.

## Scope

Only modify:

- `packages/sprindle/src/tooling/manifest.ts`
- `packages/sprindle/src/tooling/manifest.spec.ts`
- `packages/sprindle/docs/file-routing-tooling.md`
- `plans/009-limit-route-declaration-inputs.md`
- `plans/README.md`

Do not modify the language service, application source, package scripts, compiler
options for diagnostic checking, dependencies, or other framework packages.
Finding 3 (combining or removing type checks) is explicitly deferred until the
user gives permission. Excluding unrelated roots from declaration emission does
not permit removal of whole-project diagnostics.

## Drift check

Run `git diff --stat 6fa00d4..HEAD -- packages/sprindle/src/tooling/manifest.ts packages/sprindle/src/tooling/manifest.spec.ts packages/sprindle/docs/file-routing-tooling.md`.
Read any changes and compare the excerpts above. Also inspect uncommitted changes
with `git diff -- packages/sprindle`. Stop on unrelated changes that conflict
with this plan. Updates to plan status alone are not source drift.

## Commands

Run from the repository root. Node.js 24 and pnpm 12.1.0 are installed.
Use the installed dependencies. Do not install or update packages for this work.

| Purpose | Command | Expected result |
| --- | --- | --- |
| Tooling tests and package preparation | `pnpm --filter @southneuhof/sprindle test:tooling` | Exit 0; all tooling tests pass |
| Focused manifest tests after preparation | `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts` | Exit 0; all selected tests pass |
| Framework type check and tool build | `pnpm --filter @southneuhof/sprindle type-check` | Exit 0 |
| Framework lint | `pnpm --filter @southneuhof/sprindle lint` | Exit 0 |
| API generation and both existing type checks | `pnpm --filter @southneuhof/api type-check` | Exit 0 |
| Production compilation | `pnpm --filter @southneuhof/api build` | Exit 0 |
| SDK consumer check | `pnpm --filter @southneuhof/sdk type-check` | Exit 0 |
| Patch check | `git diff --check` | Exit 0; no output |

These are implementation gates, not results from plan writing. API test scripts
apply database migrations; do not run them for these generator changes. The
selected tooling tests use temporary projects and include installed-package,
portable consumer, source-removal, cycle, and concurrent-publication checks.
No browser test, database operation, or production request is required.
## Contracts and conventions

`packages/sprindle/docs/file-routing-tooling.md` states:
“Source manifests keep one module identity with direct application source imports”.
Keep development and test manifests in source mode with declarations disabled.
Keep production ESM output, static cycle rejection, contextual scope inference,
route ordering, and public `RouteContract` types unchanged. Consumers must still
check with plain TypeScript after route and sibling source files are removed.
Direct sibling imports and their type-only `.ts` and `.d.ts` dependencies are
supported. Do not add alias-only sibling discovery or new module formats.

Use the existing small functions, Node filesystem APIs, esbuild, and Babel parser.
Use unique temporary paths, `try/finally` cleanup, immutable contract directories,
and rename for publication. Do not add a compiler service or a new dependency.
Tests use Vitest and temporary projects. Follow this existing pattern from
`packages/sprindle/src/tooling/manifest.spec.ts:13`:

```ts
test('writes one atomic artifact with file, helper, and extended config inputs', { timeout: 120_000 }, async () => {
  const root = fixture()
```

The file's `afterEach` removes fixture roots. Tests must check behavior and exact
consumer types. Keep performance timing out of pass/fail assertions; use counts
of compiler calls, files, or bundle calls for stable work-reduction checks.

## Git workflow

Work in the current checkout and preserve unrelated changes. At planning time,
Loom files had uncommitted changes. Record `git status --short` before work and
compare only this implementation's changes at completion. Do not commit, push,
open a PR, or change branches unless requested. If a branch is requested without
a name, use the `codex/` prefix.
## Steps

### 1. Establish the output and timing baseline

Run the tooling suite before edits. In `manifest.spec.ts`, extend the portable
consumer fixture with an unrelated exported test module and an unrelated exported
script module. Count their declarations in the active contract directory. Add
an ambient `.d.ts` type that a route needs without an import. Include a configured
non-module `.ts` global and a module with `declare global` to establish which
ambient roots the current emitter supports. Record current behavior before
changing it; do not claim support that the baseline lacks.

Add a regression named `limits declaration roots without losing route types`.
It must require the unrelated exported modules to be absent from contract output,
while preserving the supported ambient cases and exact route output types.
Run the regression against the old implementation and record its expected failure
on the unwanted declarations. Do not delete unrelated files to make it pass.

For before/after timing, prepare tools once, then run five serial invocations of
`pnpm --filter @southneuhof/api routes:build` with an external wall clock. Record
the first run and median of the next four in this plan. Use the same checkout,
machine, and command. Do not use old startup timing as an emission measurement.

Verify: `pnpm --filter @southneuhof/sprindle test:tooling` passes before the new
regression; the focused regression then fails for the stated reason.

### 2. Reduce compiler roots, preserve resolution

In `emitRouteDeclarations`, replace the all-source `contextualSources` root list
with route files, scope files, the virtual definition, and required ambient roots.
Keep staged source files available so TypeScript follows ordinary imports,
re-exports, path aliases, and type-only imports itself. Do not use the esbuild
runtime input list to select declaration dependencies.

Preserve standalone declarations and ambient contributions that the baseline
supports. Use the existing parser when module/global classification is needed;
do not classify by filename or a text search for `export`. Imported tests or
scripts remain dependencies and must not be removed merely by their name.
Do not change `routeLanguageOverlay` or its whole-project diagnostics. Keep
alias rewriting and the common-ancestor mapping for sibling files unchanged.

Verify: `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts`
passes, including the new output-scope regression and existing sibling/alias tests.

### 3. Verify consumers and record the result

Run all commands in the Commands table. Repeat the timing sequence from step 1.
Record active contract file count and byte size before and after. Read only the
contract version referenced by `routes.d.ts`; older immutable directories are
not evidence of current output size. Update the tooling document to state that
declaration emission follows route dependencies while checks retain project scope.

Verify: all Commands-table gates exit 0; unrelated fixture module declarations
are absent and exact consumer checks pass. Report measured time, including a
small or negative change. Do not claim a speed improvement without evidence.

## Test plan and done criteria

- [x] New root-scope regression fails before and passes after the change.
- [x] Required ambient types, aliases, helper re-exports, nested scopes, and
      type-only sibling edits pass consumer compilation.
- [x] An explicitly imported module with a test/script name remains usable.
- [x] Existing source-removal, cycle, failed-publication, and concurrent tests pass.
- [x] All Commands-table gates pass; no type-check command is removed.
- [x] Timing and active output counts are recorded in this plan.
- [x] Only listed files contain changes from this work; index status is updated.

## Execution evidence

The drift check from `6fa00d4` to `2bf90ef` found no changes in the three
Sprindle source and document files. The worktree was clean before execution.
The old implementation failed `limits declaration roots without losing route
types` because it emitted `scripts/unrelated.d.ts` and
`tests/unrelated.test.d.ts`. A direct unreferenced ambient `.d.ts` was not a
supported root. The regression therefore uses the supported triple-slash
reference form. Configured script globals, `declare global`, and external module
augmentation were supported and remain roots.

The active API contract changed from 119 declaration files and 441,851 bytes to
83 files and 435,629 bytes. These counts use only the version referenced by
`.sprindle/routes.d.ts`. The first baseline build took 2.77 seconds; the median
of the next four was 2.84 seconds. After the change, the first prepared build
took 8.16 seconds; the median of the next four was 8.565 seconds. The second
sequence was slower and variable. This timing does not prove a speed gain. The
stable file-count result proves that the compiler emitted fewer files.

All command-table gates passed. The tooling suite passed 45 tests, and the
focused manifest file passed 18 tests. Sprindle type-check and lint, API
type-check and production build, SDK type-check, and `git diff --check` exited
with status 0. The first sandbox runs reported macOS watcher `EMFILE` errors
and denied the `tsx` IPC socket. The same exact tooling and production build
commands passed outside the sandbox. No API database test ran.

Parent review also passed on 2026-09-12. The parent read the full source and
test diff, checked the five-file scope, and independently reran the 45-test
tooling suite, Sprindle type-check and lint, API type-check and build, and SDK
type-check. All exited 0. No further source correction was required after the
module-augmentation case was added during review.

## STOP conditions

Stop and report if required global declarations cannot be preserved with a
bounded root-selection change, or if TypeScript still emits all unrelated modules
because the real route graph imports them. Do not hide that result by removing
imports or tests. Stop if the change needs a new resolver, compiler API, language
service change, or a file outside scope. Stop after two failed correction attempts
at the same verification gate. Report unrelated baseline failures separately.

## Maintenance notes

New ambient declaration forms can affect root selection. Review exact consumer
types when that selection changes. Keep broad staging for now; reducing source
copying is a separate, unproved opportunity. Plan 010 may conservatively hash the
broad overlay even though this plan narrows emitted output. That is safe extra
invalidation, not a reason to broaden emission again.
