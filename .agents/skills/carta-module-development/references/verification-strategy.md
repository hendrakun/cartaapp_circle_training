# Verification strategy

Verify the requested result with the smallest useful non-browser checks.
The original request and later decisions govern behavior. Optional refinements
are not completion gates.

## Browser journeys

E2E is outside Carta module delivery. This applies to design, planning,
generation, implementation, review, full-process work and resumed work, for
standard CRUD and custom workflows alike. Do not generate, write, run or repair
browser tests. Do not prepare browser test environments, collect browser reports,
assign journey IDs, or require a manual browser walkthrough as a substitute.
Do not run aggregate commands that start browser tests.

Browser testing requires a separate, explicitly requested task. Existing
framework tests remain unchanged. Move old browser obligations to that separate
scope; preserve their history and do not mark them passed. Missing E2E is not a
module defect or a completion blocker. Report actual UI behavior as unverified.

## Select proof by behavior and impact

Use focused type checking and linting for changed owners. Add or run a small
schema/API test only for a module-specific risk not covered by current evidence.

| Risk | Useful proof |
|---|---|
| Validation | Accepted and rejected values through the actual schema. |
| Relation | API identity and returned label; source review of list/detail display and edit loading. |
| Access | Allowed reads and denied writes, with stored data unchanged on rejection. |
| Filter | API results for distinguishing records; source review of field/filter wiring. |
| Workflow | Legal/illegal transitions and coupled stored effects or rollback. |
| UI composition | Source review of fields, dependencies, relation labels, routes and standard actions. |
| Migration | SQL review and relevant existing-data checks on an authorized isolated target. |

Source review does not prove rendered behavior. Record that limit without
starting browser work. Prepare the authorized development migration, seed and
preview URL as soon as viable under [execution](execution.md#prepare-and-build).
Do not wait for final test completion to make the preview available.

## Test ownership

Trust established framework contracts for unchanged controls. Do not rediscover
their coverage for each field or repeat lookup, calendar, reset, readiness,
overlay and focus tests in modules. Framework gaps are separate work.
Module tests own schemas, relation sources, field dependencies, authorization,
business rules and persistence. Use actual module owners, not copied schemas.

## Test justification

Before adding a test, identify the plausible wrong result and the coverage gap.
Extend an existing suitable test first. No test-count target or new ledger.
Avoid snapshots, source-text tests, exact copy, field order and copied config
assertions unless these are explicit product contracts.

## Tests that earn their cost

Assert public results and stored effects, not status alone. Use only fixtures
that distinguish the fault. Give them unique identities and clean up owned rows
after failure too. Keep related steps in one test when their sequence matters.
Do not mock the authorization or persistence boundary being claimed.
For regressions, demonstrate the intended failure when practical.

## Commands and environment

Inspect current scripts and focused selectors once. Generated API evidence
proves only its actual assertions. A generated browser journey is outside this
workflow; do not create or run it. Use normal source edits if a generator would
emit browser files and has no supported way to exclude them.

Use guarded isolated API test targets, never a development database for test
reset. Serialize checks that share mutable data and memory-heavy type checks.
Zero selected tests and skipped cases are not passes. Report exact blockers.

## Test order

Use test-first work for regressions and critical access/data-loss rules when
practical. Routine routes and forms can precede their focused checks.
Do not change approved product behavior to satisfy a test.

## Tight loop

Run a focused check after a meaningful boundary change. Preserve its output,
exact command and real exit status; a pipe can hide failure. Read saved output
instead of rerunning only to see another part. Classify failures as source,
test, fixture, environment, tooling or requirement.

After two failed attempts at the same fault, report the evidence, proposed cause
and next different check. If that check does not establish the cause, stop that
repair and request focused diagnosis; continue independent work.
Reuse current passes when their source, fixtures and environment remain valid.
A new reviewer or report format does not require another run.
Shared API tests use migrated schema and clean up only owned rows. A test that
replaces schema needs its own isolated target.

## Evidence interface

Keep commands, exit status, selected cases, source state and non-secret target
identity in the existing work record. No recorder JSON is needed for ordinary
work. Record source-review findings and unverified UI behavior separately.

For the full process, select only API/UNIT evidence. Use the existing recorder
through `node scripts/module-evidence.mjs --help`. Include actual source, tests,
fixtures, config, lockfile, affected dependencies and approved design as inputs,
including dirty/untracked files. Keep reports outside the input set. Do not edit
old reports or remove inputs to make stale evidence pass. Document-only changes
need requirement review, not automatic runtime reruns, unless consumed at runtime.

## Verdicts

- `PASS`: in-scope non-browser checks and source review are sufficient; required
  development setup is complete. State that browser behavior was not verified.
- `REWORK`: an in-scope defect or missing non-browser proof needs correction.
- `BLOCKED`: a decision, authority or environment prevents in-scope completion.

Separate defects and material proof gaps from optional suggestions. Do not waive
security, data protection or requested behavior to save time. Do not expand
verification into browser work to close a stated UI verification limit.
