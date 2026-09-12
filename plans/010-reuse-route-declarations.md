# Plan 010: Reuse valid route declarations on unchanged builds

The user authorized implementation on 2026-09-12. Follow the steps and run every
verification gate. Update the plan and index after implementation and review.

## Status

- Priority: P1; selected finding 2.
- Effort: M, with a required input-coverage proof before cache implementation.
- Risk: MED; stale declarations can misstate the API contract.
- Depends on: `plans/009-limit-route-declaration-inputs.md`.
- Category: perf.
- Planned at: commit `6fa00d4`, 2026-09-12.
- Implementation base: commit `2bf90ef`, plus the completed uncommitted plan 009
  changes in the shared checkout.
- Status: DONE, including the dangling-link recovery revision.

## Implementation reconciliation

Plan 009 is DONE and its narrower declaration roots are the base for this work.
The input proof uses a bounded TypeScript `--listFilesOnly` probe on each build.
The probe uses the real project options and declaration roots, plus the framework
definition and public declarations. It hashes the files selected by the current
resolver before reuse. The first real emit also reports its files. Reuse metadata
is written only when the probe covers every external file used by that emit.
After emission, the generator rehashes the initial resolved files and fresh
local inputs. It does not run a second resolver process. A newly selected file
must be in the initial probe set or the build publishes no reusable record.

This is a documented change from the original preference to avoid a second
compiler pass on lookup. It keeps the important boundary: a hit skips source
staging and declaration emission. It is smaller and safer than a second resolver
or a recursive `node_modules` inventory. The timing gate must show that its cost
still gives a useful repeat-build reduction.

| Input class | Reuse validation |
| --- | --- |
| Routes, helpers, ambient inputs, siblings, and overlay additions or deletions | Hash sorted overlay paths and contents, declaration roots, and route method/path data. |
| TypeScript options and extended configuration | Hash effective `--showConfig` output and all supported local configuration files. A non-local `extends` causes a conservative miss. |
| Framework and generator | Hash the route definition, public declaration graph selected by the probe, and the running generator module. |
| External and compiler types | Hash logical paths, resolved real paths, contents, and ancestor package manifests from `--listFilesOnly`; hash the compiler package and entry file. |
| Dependency and workspace state | Hash project and ancestor package manifests, workspace files, and lockfiles when present. |
| Resolution additions, deletions, and symlink changes | Re-run the TypeScript resolver probe; path and real-path changes alter the key. |
| Project, output, and mode | Hash absolute project, route, declaration, and output identities and the declaration mode. Declaration-disabled calls remove reuse metadata. |

## Implementation and review evidence

The implementation keeps runtime route discovery active on each call. A valid
metadata record can skip only declaration staging and declaration emission. The
record contains the input key, the active declaration hash, and the exact active
contract file inventory with content hashes. Invalid metadata, an incomplete
inventory, damaged files, and contract links outside the output cause a normal
miss. A damaged immutable directory is kept, and the rebuilt contract uses a
content version with a unique repair suffix.

The Carta proof found 1,677 external real files in the actual declaration emit.
All were members of the 1,726-file initial probe set after staged paths were
normalized. A coverage mismatch prevents metadata publication. The generator
also rehashes the initial file set and fresh local inputs after emission. This
prevents a record when an input changes during the miss.

| Input class | Evidence |
| --- | --- |
| Unchanged separate process and route source edit | `separate unchanged builds skip declaration staging and emission` records declaration compiler calls as 1 after the miss, 1 after an unchanged hit, and 2 after a route edit. |
| Routes, moves, deletion, helpers, scopes, ambient files, direct siblings, aliases, and type-only inputs | Existing manifest tests cover these outputs and invalidations. `emits a self-contained contextual consumer contract through moves and deletion`, `limits declaration roots without losing route types`, both sibling-source cases, and `versions type-only changes` passed. These tests do not mutate every item in the input table separately. |
| Local and extended compiler configuration | `writes one atomic artifact with file, helper, and extended config inputs` covers a local extended config edit. Package-based `extends` is not tested; the implementation makes it a conservative miss. |
| New higher-priority external resolution | `invalidates reuse when TypeScript selects a new external declaration` adds a `moduleSuffixes` candidate after the first build and observes a new input key. |
| Metadata and output integrity | `rejects invalid reuse metadata and repairs a damaged immutable contract` covers invalid JSON, empty and truncated file arrays, and modified contract content. `does not reuse a contract through a link outside the output directory` covers the output boundary. |
| Declaration mode, failure, and concurrent readers | The disabled-declaration test covers metadata removal. Existing sibling failure and concurrent-publication tests cover last-valid-output retention and active readers. |
| Generator, framework, compiler, package, workspace, lockfile, and real-path identity | The key hashes these files and identities. They were inspected in the Carta coverage proof. They do not each have a mutation test. An unreadable or unsupported input causes a conservative miss. |

The final same-path measurement removed only the API declaration metadata before
the first call. The miss took 17.80 seconds. The next four unchanged calls took
13.84, 5.70, 2.70, and 3.12 seconds; their median was 4.41 seconds. Four more
hits took 10.94, 6.91, 3.31, and 2.40 seconds; the eight-hit median was 4.51
seconds. The host had high wall-time variance. The stable process-call test is
the work-reduction proof. The cold miss cost is higher because it runs the probe
and the emitter. An earlier run of the same final logic measured a 3.40-second
median for four hits.

Verification on the final source passed the focused metadata, repair, symlink,
and disabled-mode tests; Sprindle type-check and lint; API type-check and build;
SDK type-check; and `git diff --check`. The final complete tooling run passed all
49 tests. Earlier loaded runs exposed old fixed one-second polling limits in
watcher tests and the five-second default limit on the expanded disabled-mode
test. The integration test now has the same 120-second limit as the other compiler
tests. Positive watcher checks now wait for their asserted callback conditions
with a bounded 30-second limit.

## Dangling-link recovery revision

Review found that `existsSync` did not see a dangling symbolic link at the
content-version contract path. The rebuild then tried to rename the staged
directory onto that link and failed with `ENOTDIR`. The pre-fix temporary
reproduction and the new separate-process regression both produced that exact
failure.

The publication check now uses `lstatSync` to detect the directory entry without
following its target. A dangling link therefore selects the existing unique
repair-version path. The old link and its backup stay unchanged. The outside-link
test now stores its backup in an excluded `.sprindle-` path, and it proves that
the input key stays unchanged while output validation selects a repair version.
The separate-process test covers a dangling link, the valid rebuilt files, the
preserved link and backup, and a next unchanged call that does not add an emit.

The focused pre-fix regression failed with `ENOTDIR`. After the fix, both focused
link recovery tests passed. Final serial gates passed: tooling tests 49 of 49;
Sprindle type-check and lint; API type-check and build; SDK type-check; and
`git diff --check`.

## Why this matters

Every direct generation call starts a new declaration compiler, even if all
inputs and outputs are unchanged. Existing immutable contract versions are
checked only after emission. Reuse a verified declaration result before the
expensive staging/emission work. Keep runtime analysis and all separate diagnostic
commands active. The main target is repeat builds across separate CLI processes.

## Current state

`packages/sprindle/src/tooling/manifest.ts:66–70` computes a runtime hash but
always calls the declaration emitter:

```ts
const hash = createHash('sha256').update(JSON.stringify([portable, inputs, contents])).digest('hex')
// Runtime output is prepared here.
const publishDeclaration = emitDeclarations ? await emitRouteDeclarations(projectRoot, routesDirectory, model.routes, target.replace(/\.mjs$/, '.d.ts')) : undefined
```

Runtime inputs come from esbuild plus configuration files. They do not fully
represent type-only dependencies. `manifest.ts:90` creates a new temporary source
tree; line 110 runs `tsc --showConfig`; line 121 disables incremental compilation;
line 128 runs declaration emission. Lines 140–151 hash emitted files and only
then detect an existing version. Keep the immutable output format.

After plan 009, roots are narrower, but staged dependencies, aliases, ambient
inputs, and sibling declarations must still participate in reuse validation.
`manifest.spec.ts:235` checks sibling type-only edits; line 283 checks alias-only
local type changes. Both must continue to invalidate declarations.

## Scope

Only modify:

- `packages/sprindle/src/tooling/manifest.ts`
- `packages/sprindle/src/tooling/manifest.spec.ts`
- `packages/sprindle/src/tooling/tooling.spec.ts`
- `packages/sprindle/docs/file-routing-tooling.md`
- `plans/010-reuse-route-declarations.md`
- `plans/README.md`

Generated private metadata belongs beside the selected manifest in its ignored
output directory. No shared global cache, daemon, public cache flag, dependency,
new compiler architecture, or incremental staging directory. Do not change API
scripts, watchers, runtime module identity, or the SDK. Do not skip any existing
whole-project check. Finding 3 requires separate explicit user permission.

## Drift check

Run `git diff --stat 6fa00d4..HEAD -- packages/sprindle/src/tooling/manifest.ts packages/sprindle/src/tooling/manifest.spec.ts packages/sprindle/src/tooling/tooling.spec.ts packages/sprindle/docs/file-routing-tooling.md`.
Inspect `git diff -- packages/sprindle` too. Verified changes from plan 009 are
expected; read its final diff and adjust line references before work. Stop on
other contract changes or incomplete prerequisite checks. Record the actual
implementation base SHA in this plan.

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

### 1. Prove the input set and baseline

Run the tooling suite. Trace the declaration compiler's actual file set for a
small alias/sibling/ambient fixture and the API. Use the installed compiler's
file-list diagnostics in a temporary experiment or fixture; do not add a second
compiler pass to every cache lookup. Compare resolved dependencies with the
overlay, framework declarations, compiler files, package metadata, and configs.

Record a table in this plan that maps each input class below to its content
fingerprint or to a conservative cache-miss rule:

- Route paths/methods, source contents, generated helpers, ambient files,
  sibling `.ts`/`.d.ts` files, and the complete current overlay file inventory.
- Effective TypeScript options and all extended configuration inputs.
- Framework route definitions, public declaration contents, and generator
  implementation identity. A package version alone is insufficient in a workspace.
- Resolved external declaration contents and package metadata that controls
  resolution; compiler identity; relevant project/workspace dependency manifests
  and lockfile contents, when present.
- Resolution-affecting additions, deletions, and symlink target changes. A list
  of previously read files alone cannot detect a new higher-priority resolution.
- Absolute project/output identity and emission mode. Never reuse a result from
  another output or a declaration-disabled invocation.

Prefer conservative content checks to a new dependency resolver. The broad
existing overlay can be hashed even after plan 009. Do not recursively hash all
of `node_modules`. If external input/resolution coverage cannot be established
with bounded metadata and actual dependency files, record that case as a miss.
The normal Carta unchanged CLI case must still qualify for reuse.

Measure five serial `pnpm --filter @southneuhof/api routes:build` calls after tool
preparation. Record the first and median of the next four.

Verify: `pnpm --filter @southneuhof/sprindle test:tooling` exits 0. Do not proceed
until the input table has no unexplained reuse case. An unsupported case must
explicitly miss, not silently reuse.

### 2. Add private content-validated reuse

In `manifest.ts`, calculate the declaration input key before temporary source
copying and emission. Reuse existing discovery and hashing. If a compiler config
probe remains necessary for correctness, retain it; the required saving is the
emission process and staging, not removal of all subprocesses.

Store a small versioned JSON record next to the output. Include the input key,
active declaration content hash, and relative paths/content hashes of required
contract files. Parse and validate its shape. Treat absent, stale, malformed,
missing-file, or content-mismatch records as misses. Metadata must never cause
reads outside the expected output/input boundaries. Do not import the generated
runtime file to inspect it; that would execute application code.

On a hit, retain the existing valid declarations without invoking the declaration
compiler or rewriting contract files. On a miss, use the existing emitter and
publication path. Publish metadata with a unique temporary file and rename only
after successful output publication. Concurrent records must remain bound to
the exact active output; mismatches on the next lookup must cause a miss.
Recheck input identity before recording a successful build. If inputs changed
during generation, do not publish a reusable record for that run.

Keep runtime route discovery, dependency tracking, and cycle rejection on every
invocation. With `declarations: false`, preserve declaration cleanup and prevent
any later false hit. No cache failure may discard the last valid artifact.

Verify: focused manifest tests pass, including unchanged-input reuse, recovery
from invalid metadata, and type-only invalidation.

### 3. Verify separate processes and all invalidation cases

Add a separate-process test to `tooling.spec.ts`, following its existing `run`
helper and concurrent-publication test. Prove that the second unchanged CLI
invocation does not invoke declaration emission. Use test-side process observation
or a fixture compiler wrapper that forwards the real compiler and records calls;
do not add production test flags. Output modification time alone is insufficient
because it cannot prove the expensive compiler was skipped.

Use table-driven fixture cases for source/config/ambient/sibling changes, a new
route, move/delete, local type-only alias changes, dependency type changes,
generator identity changes, damaged output, and declaration mode changes.
Check an error introduced after a warm success still fails and preserves the
last valid output. Keep the concurrent active-reader test passing.

Verify: `pnpm --filter @southneuhof/sprindle test:tooling` exits 0. The process
check records zero declaration-emission calls on an unchanged qualifying hit and
at least one on required misses. Check exact consumer types after invalidation.

### 4. Measure and close

Run all Commands-table gates. Repeat the five API generation calls. Record the
median, cache-validation cost, and emission-call count. Add a short description
of automatic reuse and safe miss behavior to the tooling document. No new user
command is needed. Mark DONE only after the review confirms input coverage and
lower repeat-generation median; otherwise report the measured limit.

Verify: all gates exit 0 and the new cross-process work-reduction test passes.

## Test plan and done criteria

- [x] An unchanged second process skips declaration emission and retains valid output.
- [x] All input classes in step 1 have invalidation evidence or an explicit conservative miss rule.
- [x] Missing/corrupt metadata and missing/modified contract files rebuild safely.
- [x] Type-only edits update exact consumer types even if runtime hash is unchanged.
- [x] Failure, concurrent publication, source removal, and mode isolation tests pass.
- [x] All Commands-table gates pass; diagnostic commands remain unchanged.
- [x] API repeat-run timing and compiler-call counts are recorded without a fixed CI timer.
- [x] Only in-scope files changed; index status and this plan contain review evidence.

## STOP conditions

Stop if safe reuse needs a general resolver, persistent compiler service, new
package, or global cache. Stop if qualifying Carta CLI runs cannot safely reuse
output, or validation costs remove the measured benefit. Do not weaken input
coverage to reach a timing target. Stop for unexplained prerequisite drift,
conflicting user changes, scope expansion, or two failed correction attempts
at the same gate. Keep finding 3 deferred.

## Maintenance notes

Increment metadata format/implementation identity when emission behavior changes.
New resolver options and dependency layouts require coverage or conservative
misses. Plan 011 must preserve this behavior and invalidate earlier metadata when
its generator implementation changes. Full incremental compilation is deferred.
