# Plan 011: Build each route bundle once

## Status and authorization

- Status: TODO — execution remains paused by the user.
- Priority: P2; selected finding 4.
- Effort: M; risk: MED (hash binding and source-map correctness).
- Category: perf.
- Depends on: plans 009 and 010. Both index rows say DONE.
- Original plan: `6fa00d4`, 2026-09-12.
- Refined against: HEAD `a80bfc5` plus the current uncommitted 009/010 changes,
  2026-09-12. The source fingerprints below identify that actual starting point.

The user requested this refinement only. Do not implement until the user resumes
plan 011. Finding 3 (combining or removing type checks) still requires separate
explicit permission. Do not start or monitor other agents for this refinement.

When execution is authorized, follow the steps in order. Do not choose another
architecture. Report a STOP condition instead of adding a resolver, compiler
service, dependency, or source-map library. Work in the current checkout. Do not
commit, push, reset files, change branches, or remove another task's output.

## Result required

For a fresh call to `compileRouteManifest`:

| Mode | Current esbuild calls | Required esbuild calls | Published runtime |
| --- | --- | --- | --- |
| `bundle=true` | 2 | 1 | Bundled ESM with an inline source map |
| `bundle=false` | 1 | 1 | Existing direct source imports |

Keep the existing exported SHA-256 `hash`, default route array, cycle rejection,
watcher inputs, and declaration cache behavior. A smaller call count is the stable
work-reduction result. Measure elapsed time separately; do not promise a speedup.
The first analysis call currently discards its JavaScript. This plan publishes
that JavaScript after replacing only the generated hash literal.

## Scope and protected code

Only modify these five files during future execution:

1. `packages/sprindle/src/tooling/manifest.ts`
2. `packages/sprindle/src/tooling/manifest.spec.ts`
3. `packages/sprindle/docs/file-routing-tooling.md`
4. `plans/011-build-route-bundle-once.md`
5. `plans/README.md` — only the plan 011 row and related execution evidence.

In `manifest.ts`, change only the analysis/output code in
`compileRouteManifest`, plus at most two private helpers placed immediately
before `emitRouteDeclarations`. No new exports. Keep the input hash formula,
input filtering, and `rejectStaticCycles` call unchanged.

Keep the block from `const declaration = target.replace(...)` through the end
of `compileRouteManifest` unchanged. Keep `emitRouteDeclarations` and all its
cache helpers unchanged. They contain the plan 010 behavior. Do not edit
`tooling.spec.ts`; its separate-process emission counter already tests reuse.

Do not change application scripts, source-mode module identity, watchers, package
scripts, compiler checks, dependency versions, old contract directories, or
plans 009/010/012–014. In particular, `apps/api/scripts/build-production.ts`
has a separate application bundle. That build is required and stays unchanged.

## Current code and source fingerprints

Read these files before editing. Locations refer to the current working files,
not the older committed versions.

| File and location | Role |
| --- | --- |
| `packages/sprindle/src/tooling/manifest.ts:50` | `compileRouteManifest` entry point |
| `packages/sprindle/src/tooling/manifest.ts:60` | Generated source and provisional hash |
| `packages/sprindle/src/tooling/manifest.ts:61` | First bundle, `write: false`, with metadata |
| `packages/sprindle/src/tooling/manifest.ts:62` | Input collection and hash computation |
| `packages/sprindle/src/tooling/manifest.ts:69` | Second bundle to remove |
| `packages/sprindle/src/tooling/manifest.ts:71` | Protected publication block |
| `packages/sprindle/src/tooling/manifest.ts:83` | Protected declaration emitter |
| `packages/sprindle/src/tooling/manifest.spec.ts:6` | Existing Vitest imports, including `vi` |
| `packages/sprindle/src/tooling/manifest.spec.ts:10` | Existing `fixture` helper and root cleanup |
| `packages/sprindle/src/tooling/tooling.spec.ts:92` | Separate-process declaration-emission counter |

The relevant current code is:

```ts
const source = (hash: string) => `${imports.join('\n')}\nexport const hash=${JSON.stringify(hash)};export default [${entries.join(',')}];`
const analysis = await build({ stdin: { contents: source('pending'), resolveDir: projectRoot, sourcefile: 'sprindle-routes.ts', loader: 'ts' }, write: false, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22', metafile: true })
```

After unchanged input discovery and hashing, it currently does:

```ts
if (bundle) await build({ stdin: { contents: source(hash), resolveDir: projectRoot, sourcefile: 'sprindle-routes.ts', loader: 'ts' }, outfile: temporary, bundle: true, packages: 'external', platform: 'node', format: 'esm', target: 'node22', sourcemap: 'inline' })
else await writeFile(temporary, source(hash))
```

The protected publication block begins:

```ts
const declaration = target.replace(/\.mjs$/, '.d.ts')
const metadata = declaration.replace(/\.d\.ts$/, '.declarations.json')
const publishDeclaration = emitDeclarations ? await emitRouteDeclarations(projectRoot, routesDirectory, model.routes, declaration, bundle) : undefined
await rename(temporary, target)
if (publishDeclaration) await publishDeclaration()
else { await rm(declaration, { force: true }); await rm(metadata, { force: true }) }
```

Run these read-only checks before future implementation:

```sh
git status --short
git diff --stat a80bfc5..HEAD -- packages/sprindle
shasum -a 256 packages/sprindle/src/tooling/manifest.ts packages/sprindle/src/tooling/manifest.spec.ts packages/sprindle/docs/file-routing-tooling.md
```

Expected fingerprints at refinement time:

```text
49350504877d6ea33ec5d848c11df6c17aa0a74d72510a0561fa7e368d0b547d  packages/sprindle/src/tooling/manifest.ts
de3b47be9b37ca4acf223064332ea5a0e82441efebaf8174ec2da442d4ed6d7a  packages/sprindle/src/tooling/manifest.spec.ts
4b546b0b4c9a5bee70f3f22b9a5f324b573ce748e6a59c95292adb77cc731934  packages/sprindle/docs/file-routing-tooling.md
```

The working tree already contains 009/010 changes. Do not restore files from
HEAD or treat those changes as yours. Save a before-edit diff or copy in your
own temporary directory for final scope comparison. If a fingerprint differs,
compare the changed file with the excerpts and protected blocks. An unrelated
functional change requires reconciliation before execution. A commit that merely
records these same bytes does not require a new implementation design.

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

## Baseline and verification rules

Run commands serially. The tooling tests build package artifacts and start
compilers; concurrent runs caused variable times and watcher test failures in
prior work. Do not run the API database test scripts for this plan.

1. After execution is authorized, run `pnpm --filter @southneuhof/sprindle test:tooling`.
   All tests must pass before adding plan 011 tests. There are 49 tests at this
   starting point. A changed count is acceptable only if the source diff explains it.
2. Record the command, exit code, count, and any failure in this plan.
3. If a baseline check fails, do not mark this plan DONE or modify unrelated code.
   Isolate the failing test and report the result. Do not treat an increased global
   timeout as a fix for a missing event or a wrong assertion.
4. Before a benchmark that uses `@southneuhof/sprindle/tooling`, run
   `node packages/sprindle/tooling/package.mjs`. The API's `tooling:ensure` checks
   existence, not source freshness. Old `dist-tooling` would invalidate the result.

The plan 010 agent reported final completion during this refinement: 49/49
tooling tests passed, as did framework type-check and lint, API type-check and
build, SDK type-check, and the patch check. This refinement did not rerun those
checks. Use the baseline gate above to confirm readiness before implementation.

## Step 1 — Capture a reproducible before measurement

Do this before source edits. Do not write a benchmark system. Use the exact
one-off command below from the repository root. It runs five serial calls on the
real API route graph, uses a private output directory, disables declarations,
and removes only that private directory when done.

```sh
node packages/sprindle/tooling/package.mjs
node --input-type=module <<'JS'
import { performance } from 'node:perf_hooks'
import { mkdtemp, rm } from 'node:fs/promises'
import { resolve, relative, join } from 'node:path'
import { compileRouteManifest } from './packages/sprindle/dist-tooling/index.js'
const project = resolve('apps/api')
const directory = await mkdtemp(join(project, '.sprindle-plan011-'))
const output = relative(project, join(directory, 'routes.mjs'))
const times = []
try {
  for (let run = 0; run < 5; run++) {
    const started = performance.now()
    await compileRouteManifest(project, 'src/routes', output, true, { declarations: false })
    times.push(performance.now() - started)
  }
  const warm = times.slice(1).sort((a, b) => a - b)
  console.log(JSON.stringify({ ms: times, first: times[0], medianNextFour: (warm[1] + warm[2]) / 2 }))
} finally {
  await rm(directory, { recursive: true, force: true })
}
JS
```

Also measure five normal CLI calls in separate processes:

```sh
for run in 1 2 3 4 5; do
  /usr/bin/time -p pnpm --filter @southneuhof/api routes:build
done
```

Record all five `real` values, the first, and the median of the next four. For
four sorted values `a <= b <= c <= d`, the median is `(b + c) / 2`.
Do not delete API cache metadata to improve these numbers. Treat the first normal
CLI call separately because a generator change can invalidate plan 010 metadata.

**Gate:** both commands exit 0, and the before values are written in this plan.
The isolated benchmark excludes declaration cost; the CLI series includes it.
Do not compare one series with the other.

## Step 2 — Add one failing call-count test and three behavior tests

Use `manifest.spec.ts`. Reuse its `fixture`, `roots`, `afterEach` cleanup, and
120,000 ms integration timeout. Add `build` from `esbuild` to test imports.
Add this module mock at file level; Vitest hoists it before the manifest import:

```ts
vi.mock('esbuild', async (importOriginal) => {
  const actual = await importOriginal<typeof import('esbuild')>()
  return { ...actual, build: vi.fn(actual.build) }
})
```

Do not use a post-import spy. It may not intercept the manifest's named import.
Do not reset the forwarding implementation. Use `vi.mocked(build).mockClear()`
before each call whose count is asserted. Do not run these tests concurrently.
A one-call mock override for a failure test must be consumed or cleared in
`finally` without replacing the default forwarding implementation.

Add these four exact test names so the commands below select only this work:

| Name | Setup and assertions |
| --- | --- |
| `plan011 builds each manifest once` | Use a fresh fixture and `declarations:false`. Clear the build mock, compile bundle mode, assert exactly 1 call. Clear again, compile source mode to a different `.mjs` path, assert exactly 1 call. Import both manifests, assert equal 64-character hexadecimal `hash` values and the same route result. Recompile unchanged and assert stable hash. Edit a helper used by the route, then an extended config; assert each edit changes the hash and both modes still agree. |
| `plan011 preserves hash collisions and inline map contents` | Put an application `hash` export in a local helper and use it in the route result so esbuild keeps the name. Its value is `'0'.repeat(64)`. Include ordinary route-returned strings `'pending'` and text resembling `export const hash`. Assert all application results are unchanged. Decode the final inline map. Assert its application `sourcesContent` strings exactly equal the original helper/route strings. Its generated `sprindle-routes.ts` entry must contain the actual exported hash and not its provisional hash initializer. Do not assert that the marker is absent from application strings. |
| `plan011 preserves original stack locations` | Use route source made with `['export const GET = () => {', '  throw new Error("plan011-map")', '}'].join('\n')`. Build with declarations disabled. Use `spawnSync(process.execPath, ['--enable-source-maps', '--input-type=module', '--eval', script])`, where `script` imports the artifact by `pathToFileURL` and calls `manifest.default[0].handlers.GET()`. Assert nonzero exit, stderr contains `plan011-map`, and the stack names the original `+server.ts:2:`. Keep the source file present for this test. Do not assert a hard-coded temporary directory name or generated line number. |
| `plan011 preserves published output when finalization fails` | First create a valid artifact with declarations enabled. Save runtime, `routes.d.ts`, and `routes.declarations.json` bytes. Use a one-call mock that awaits the real esbuild call and then removes the final map comment from its returned output bytes. Keep `metafile` intact. The next compile must reject with a `Sprindle bundle finalization:` error. Assert all three published files retain the saved bytes and the target directory has no remaining `routes.mjs.*.tmp` file. Do not export private helpers to test them. |

In the failure test, get the real build with
`const actual = await vi.importActual<typeof import('esbuild')>('esbuild')`
and call `actual.build(options)` inside the one-call override. Do not call the
mocked `build` recursively.

For the mock's output edit, return an actual `Uint8Array` in `contents` and a
`text` getter that decodes those same bytes, as esbuild does. Do not change only
one representation and let the test depend on which one production reads.

First run the call-count test against the old compiler:

```sh
pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts -t 'plan011 builds each manifest once'
```

**Gate:** it fails with expected 1 call, received 2. Any other failure is a fixture
or mock problem; correct that problem before changing production code. Record
the failure. Then implement steps 3 and 4 before expecting all four tests to pass.

## Step 3 — Add two private finalization helpers

Use the already imported Babel `parseTypeScript`. No new parser or generic AST
visitor. Use explicit node-type checks and simple loops over `program.body`.
Use these private signatures:

```ts
function replaceExportedHash(code: string, placeholder: string, hash: string): string
function finalizeBundle(code: string, provisionalSource: string, placeholder: string, hash: string): string
```

### `replaceExportedHash` algorithm

1. Require `placeholder` and `hash` to match `/^[a-f0-9]{64}$/`.
2. Parse with `{ sourceType: 'module', plugins: ['typescript'] }`.
3. Find the one local binding exported under the name `hash`. Support these two
   forms only: `export const hash = "..."` and `const hash2 = "..."; export { hash2 as hash }`.
   For a direct `ExportNamedDeclaration`, inspect its `VariableDeclaration`.
   For specifiers, require `ExportSpecifier`, an exported Identifier named `hash`,
   a local Identifier, and no re-export `source`.
4. Require exactly one such exported binding. Do not assume its local name is
   `hash`; esbuild renames it when application code already uses that name.
5. Find exactly one top-level `VariableDeclarator` for that local binding. Look
   in plain `VariableDeclaration` and the declaration inside a direct export.
   Require an Identifier `id`, a `StringLiteral` initializer with value equal to
   `placeholder`, and numeric `start` and `end` offsets on that initializer.
6. Set replacement to `JSON.stringify(hash)`. Require its byte length and string
   length to equal the old literal slice. Replace that slice only:
   `code.slice(0, start) + replacement + code.slice(end)`.
7. If parsing or any condition fails, throw `Error` with the prefix
   `Sprindle bundle finalization:` and a short cause. Do not return original code
   or continue to publication after a failed check.

A checked in-memory experiment with the installed esbuild produced
`hash2 as hash` when a helper already had `hash`. It produced one output file.
This is evidence for the two-form rule, not a reason to omit the collision test.

### `finalizeBundle` algorithm

1. Locate the final source-map comment with this anchored pattern:
   `/\n\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)\r?\n?$/`.
   Require a match. Do not search/replace all source-map-looking text in the file.
2. Split `code` at the match's start offset. The prefix is executable code; the
   suffix is the final comment and its preceding newline. Record the captured
   base64 payload separately.
3. Decode the payload with `Buffer.from(payload, 'base64').toString('utf8')`,
   then `JSON.parse`. Require a version-3 object with string `mappings`, string
   array `sources`, and string array `sourcesContent` of equal length.
4. Find exactly one `sourcesContent` item equal to the full `provisionalSource`.
   Match the complete string, not the filename: map source paths are relative to
   the temporary outfile. Fail if there are zero or multiple matches.
5. Call `replaceExportedHash` on the executable prefix. Call it again on that
   one generated `sourcesContent` item. Do not change any other source-content
   item or any map field, including `mappings`, `sources`, and `names`.
6. Encode the updated map with `Buffer.from(JSON.stringify(map)).toString('base64')`.
   Replace the captured payload only within the known final comment suffix.
   Return patched executable prefix plus patched suffix. Keep the newline between them.
7. Use the same `Sprindle bundle finalization:` error prefix for invalid map
   shape, missing map, unexpected generated source, or parse errors.

The executable literal replacement keeps positions unchanged. Re-encoding the
map changes only a trailing comment. These properties preserve the mappings;
no mapping recalculation is needed. Do not replace the marker globally, strip
source maps, append another hash export, or accept an unexpected export form.

**Gate:** `pnpm --filter @southneuhof/sprindle exec tsc -p tsconfig.json --noEmit --singleThreaded`
exits 0 after the helpers and wiring in step 4 are present. Helpers stay private;
end-to-end tests exercise them through `compileRouteManifest`.

## Step 4 — Change the two exact call sites

Keep `source` unchanged. Immediately after it, add:

```ts
const placeholder = '0'.repeat(64)
const provisionalSource = source(placeholder)
```

Replace the analysis build with this shape. Keep every option shown:

```ts
const analysis = await build({
  stdin: {
    contents: provisionalSource,
    resolveDir: projectRoot,
    sourcefile: 'sprindle-routes.ts',
    loader: 'ts',
  },
  outfile: temporary,
  write: false,
  bundle: true,
  packages: 'external',
  platform: 'node',
  format: 'esm',
  target: 'node22',
  metafile: true,
  sourcemap: bundle ? 'inline' : false,
})
```

`write:false` prevents publication during analysis. `outfile:temporary` gives
bundle maps the same relative path base as the old second build. Source mode
still performs graph analysis only; it does not publish these bundled bytes.

Leave the following input collection, cycle rejection, and hash computation
unchanged. Inside the existing `try`, replace only the old second build branch:

```ts
if (bundle) {
  if (analysis.outputFiles.length !== 1) {
    throw new Error('Sprindle bundle finalization: expected one output file')
  }
  const output = finalizeBundle(analysis.outputFiles[0].text, provisionalSource, placeholder, hash)
  await writeFile(temporary, output)
} else {
  await writeFile(temporary, source(hash))
}
```

Use the project's TypeScript null checks if indexed access requires a guard.
Keep the declaration preparation, runtime rename, declaration callback, and
`finally` cleanup directly after this branch unchanged.

Do not bump or edit the declaration cache format. Plan 010 hashes the running
generator module's bytes, so this implementation change causes a safe first miss.
An unchanged subsequent process must still reuse declarations.

**Gate:** run the four new tests:

```sh
pnpm --filter @southneuhof/sprindle exec vitest run src/tooling/manifest.spec.ts -t 'plan011 '
```

All four pass. If any fails, correct only the failing behavior and rerun this
focused command. After two unsuccessful correction attempts at the same cause,
stop and report. Do not change expected call counts, source-map line numbers, or
output-preservation assertions to make the test pass.

## Step 5 — Run integration checks once on the final source

Run every command in the Commands table serially. Record exact commands and
results. The full tooling suite includes plan 010's stable separate-process
counter and the existing cycle, watcher, source-removal, alias, sibling type,
failed-declaration, and concurrent-publication tests. Do not duplicate them.
The source fingerprint change is sufficient to invalidate prior reuse metadata;
passing the separate-process test confirms that reuse still works afterward.

Inspect your source diff against the before-edit copy. The code below
`emitRouteDeclarations` must be byte-for-byte unchanged from this plan's starting
point. The publication block must also be unchanged. Any difference is a scope
failure unless it was already present before your work.

**Gate:** all commands exit 0; all new and existing tooling tests pass. Keep a
baseline failure separate from a new failure. Do not mark DONE with failed or
unverified required checks.

## Step 6 — Repeat measurements and record an honest result

Run the exact step 1 measurement commands again after rebuilding tooling. Do not
use a different loader, declaration setting, route graph, or sample count.
Fill this table; do not invent a percentage from single or incompatible runs:

| Measurement | Before first | Before next-four median | After first | After next-four median |
| --- | --- | --- | --- | --- |
| API graph, declarations disabled, same process (ms) | pending | pending | pending | pending |
| Normal `routes:build`, separate processes (seconds) | pending | pending | pending | pending |

Also record the full five samples per series. Do not add a CI timing threshold.
If the final result is slower or too variable to judge, state that no speed gain
is proved. Report the measured tradeoff and leave status `IN PROGRESS — review
required` for the reviewer to decide. Do not add a third optimization or remove
safety checks to improve the number. A reviewer may accept the proved one-call
reduction with a clear timing limit; the executor must not make that decision alone.

After successful review, add one sentence to the tooling document explaining
that bundled manifest analysis and output use one bundle pass. Update only the
plan 011 row and its evidence in the index. Preserve the pause and finding-3
permission record until the user explicitly changes them.

**Gate:** `git diff --check -- packages/sprindle plans/011-build-route-bundle-once.md plans/README.md`
exits 0; source scope matches this plan; measurements and review verdict are recorded.

## Completion checklist

- [ ] Execution was explicitly resumed by the user; prior work was preserved.
- [ ] Baseline tooling gate passed on the actual 009/010 source.
- [ ] One-call test failed with 2 calls before the production change.
- [ ] All four `plan011 ` tests pass, including collision, map, stack, and failure checks.
- [ ] Runtime input hash formula and both source/bundle hash behavior are preserved.
- [ ] Declaration cache code and publication order are unchanged.
- [ ] All Commands-table gates pass on the final source.
- [ ] Before/after series use identical commands and contain all five samples.
- [ ] Reviewer verdict and any timing limit are recorded without overstated claims.
- [ ] Only the five allowed files contain changes from this implementation.
- [ ] Index status is updated after review; finding 3 remains deferred.

## STOP and maintenance notes

Stop for an unhandled bundler export/map shape, incompatible source drift, a
missing prerequisite check, need for an out-of-scope file, or two failed fixes at
the same gate. Report the exact command, failing assertion, and affected step.
No framework rewrite, extra dependency, public helper export, or source-map engine
is an allowed recovery.

Future esbuild updates must pass the collision and stack tests. The provisional
marker must remain 64 ASCII hexadecimal characters because same-length replacement
preserves source positions. The declaration cache key already tracks generator
changes. Never remove that protection as part of this plan.

## Refinement verification

This refinement read the current generator, tests, package commands, plan 010
record, and index. A read-only in-memory esbuild experiment confirmed one output,
`hash2 as hash` under a collision, a version-3 inline map, and exactly one generated
source-content match. No source file, generated bundle, or test was changed or
run by this refinement. The benchmark commands and four future tests are specified
here; their execution results remain unverified.

Document fence checks, benchmark JavaScript syntax checks, and the scoped
`git diff --check` passed. The final test-file fingerprint includes the plan 010
agent's completed test changes.
