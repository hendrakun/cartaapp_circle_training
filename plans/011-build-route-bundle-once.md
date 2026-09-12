# Plan 011: Build each route bundle once

Follow each step and its verification gate. Update this plan and the index after
implementation and review. The current request is to write plans only.

## Status

- Priority: P2; selected finding 4, after findings 1 and 2.
- Effort: M (about one day, including source-map and output tests).
- Risk: MED; generated hash replacement must not change application literals.
- Depends on: `plans/010-reuse-route-declarations.md`, which follows plan 009.
- Category: perf.
- Planned at: commit `6fa00d4`, 2026-09-12.
- Status: TODO.

## Why this matters

Bundled manifest generation builds the same graph twice. The first bundle
provides dependency metadata; the second embeds the calculated input hash and
writes output. Reuse the first bundle bytes. During the audit an in-memory
analysis of the API graph took 325 ms on its first run and 8–10 ms on repeat runs.
These are stage measurements, not guaranteed savings. This change has lower
priority than declaration scope and reuse.

## Current state

`packages/sprindle/src/tooling/manifest.ts:59–60` builds a provisional manifest:

```ts
const source = (hash: string) => `${imports.join('\n')}\nexport const hash=${JSON.stringify(hash)};export default [${entries.join(',')}];`
const analysis = await build({ stdin: { contents: source('pending'), resolveDir: projectRoot, sourcefile: 'sprindle-routes.ts', loader: 'ts' }, write: false, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22', metafile: true })
```

Lines 61–66 read graph inputs, reject cycles, and compute SHA-256. Line 68 builds
again with `source(hash)`, `outfile: temporary`, and `sourcemap: 'inline'`.
Source mode instead writes `source(hash)` directly. Keep source mode unchanged.

The API production script has a separate application build that includes source
manifest imports and shared application modules. This plan removes only the
second build inside `compileRouteManifest`; it does not remove the application
build or change application module identity.

## Scope

Only modify:

- `packages/sprindle/src/tooling/manifest.ts`
- `packages/sprindle/src/tooling/manifest.spec.ts`
- `packages/sprindle/docs/file-routing-tooling.md`
- `plans/011-build-route-bundle-once.md`
- `plans/README.md`

Do not modify application scripts, watcher scheduling, the language service,
compiler checks, esbuild versions, runtime contracts, other packages, or old
contract directories. No new dependency or public option. Finding 3 (combining
or removing type checks) remains deferred until explicit user permission.

## Drift check

Run `git diff --stat 6fa00d4..HEAD -- packages/sprindle/src/tooling/manifest.ts packages/sprindle/src/tooling/manifest.spec.ts packages/sprindle/docs/file-routing-tooling.md`.
Also inspect `git diff -- packages/sprindle`. Read the completed 009/010 diffs;
their bounded changes are expected. Stop if either prerequisite lacks passing
checks or if unrelated changes alter the contract. Record the actual base SHA
before implementation. Plan/index status changes alone do not block work.

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

### 1. Add work-count and hash characterization tests

Run the tooling suite and capture the before-change timing series described in
step 4 before edits. In `manifest.spec.ts`, add a test named
`builds a bundled manifest once`. Observe the real esbuild function through a
Vitest spy/module mock that forwards to the original implementation. Restore it
after the test; do not add a production hook. A fresh fixture with
`declarations: false` must make exactly one bundle call. Record the expected
failure of this assertion against the current two-call implementation.

Characterize the exported hash: unchanged inputs keep it stable; helper or
extended config changes alter it. Compare source and bundle mode for the same
inputs. Test ordinary application bindings named `hash`, strings equal to the
provisional marker, and text that resembles a hash export. Use a source fixture
that throws on a known line for the source-map check in step 3.

Verify: existing tooling tests pass; the new one-call assertion fails with two
calls, not with a mock or fixture error.

### 2. Reuse the analysis output

Keep a single `build` call with `write: false`, `metafile: true`, and the current
runtime options. For bundle mode, request inline source maps in this call and
use a known output location so relative map paths resolve as before. Continue
to run graph input collection, watcher input recording, and cycle rejection
before publication.

The input hash is available only after analysis. Use a fixed-width 64-character
provisional string for the generated exported hash. After analysis, locate the
bundle's exported `hash` binding through the existing Babel parser and replace
only that binding's string initializer with the 64-character final SHA-256.
Follow the export binding if esbuild renames it. Require exactly one matching
export and initializer; fail before publication if the expected form is absent.
Do not use a global string replacement or modify application literals. The
replacement must keep byte length and line count unchanged so mappings remain
valid. Update the generated entry's map `sourcesContent` if needed so the map
also reports the final generated hash; preserve original application sources.

Write these prepared bytes to the existing unique temporary path. Retain the
declaration preparation/reuse from plan 010, rename publication, and `finally`
cleanup. Source mode still writes the unbundled `source(hash)` and retains its
one analysis call. Do not apply marker rewriting to source mode.

If a shorter safe method preserves all tests, use it and record the reason;
it must still use one esbuild call and cannot require a new package, source-map
engine, or changed hash contract.

Verify: `pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts`
passes, with exactly one build call in both modes and unchanged public hash rules.

### 3. Verify output, maps, and failure preservation

Run the throwing fixture with plain Node and `--enable-source-maps`. Require the
stack to name the original source file and its known throwing line. Check that
inline map JSON is valid and that application `sourcesContent` is unchanged.
The generated entry's source must not contain a stale provisional hash.

Use existing fixtures to check that bundled routes execute after source removal,
source mode retains direct imports, static cycles fail before publication, and
declaration failure preserves the last valid output. Repeat the plan 010
separate-process reuse test: this generator change must not make old metadata
look valid. Keep immutable contract publication and active readers safe.

Verify: `pnpm --filter @southneuhof/sprindle test:tooling` exits 0, including
source-map, consumer, concurrency, and reuse tests.

### 4. Measure and close

After tool preparation, measure five serial fresh-output bundled generations
before and after the change. Use temporary fixture outputs to force a miss;
do not delete shared developer outputs or immutable contract directories.
Measure with declarations disabled to isolate bundle work, and record one normal
API `routes:build` series separately to show the user-visible limit. Record first
run and median of the next four. Do not add timing thresholds to tests.

Run all Commands-table gates. Update the tooling document and this plan with the
one-call evidence and measured result. Review each hunk against scope. If the
extra parsing/map handling eliminates the timing benefit, report that result
instead of declaring a performance win.

Verify: all Commands-table gates exit 0 and the one-call regression passes.

## Test plan and done criteria

- [ ] Fresh bundled generation invokes esbuild once; source mode also invokes it once.
- [ ] Exported hash matches source mode and changes for source/config edits.
- [ ] Application literals and bindings that resemble generated hash text are unchanged.
- [ ] Source-map stack locations and original application source contents are correct.
- [ ] Bundled source-removal, cycle rejection, failure preservation, and concurrency pass.
- [ ] Plan 010 reuse remains valid across separate processes and implementation changes.
- [ ] All Commands-table gates pass; no diagnostic command was changed.
- [ ] Timing results and one-call evidence are recorded without unsupported speed claims.
- [ ] Only in-scope files changed; the index row is updated after review.

## STOP conditions

Stop if the installed bundler cannot expose a stable exported hash binding or
source maps need a new mapping engine. Do not replace arbitrary matching strings.
Stop if one-pass generation needs changes to the production application build,
source-mode identity, or public manifest shape. Stop if prerequisites conflict,
input drift is unexplained, or a verification gate still fails after two
reasonable correction attempts. Report a negative timing result explicitly.

## Maintenance notes

An esbuild output-format change must exercise the exported-binding and map tests.
Keep the one-call assertion scoped to manifest generation; the application build
is separate required work. Finding 3 is not part of this plan and must not start
without the user's explicit permission.
