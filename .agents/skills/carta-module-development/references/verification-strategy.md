# Verification strategy

Verify the requested result with the smallest useful non-browser checks.
The original request and later decisions govern behavior. Optional refinements
are not completion gates.

## Browser journeys

E2E is outside Carta module delivery. This applies to design, planning,
implementation, review, full-process work and resumed work, for
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
| External integration | Current evidence for the actual provider contract, using a limited live check where needed. |

Source review does not prove rendered behavior. Record that limit without
starting browser work. Prepare the authorized development migration, seed and
preview URL as soon as viable under [execution](execution.md#prepare-and-build).
Do not wait for final test completion to make the preview available.

## External integrations

Before building dependent behavior, identify unverified request and response
contracts. Use current evidence for the specified provider, model or version,
input format and options, or run a limited live check through the application
operation. A compatibility claim or a response invented for a mock does not
verify the external contract.

Resolve live-check authority early from the request and existing permissions.
If authority is missing, ask for the specific check, data and cost or request
limit while continuing independent work. Available credentials alone do not
grant authority. Use authorized test data, bound time and usage, and stop when
the required evidence is obtained or the agreed limit is reached. Report failures
and the next useful check before further paid retries.

Record the target, relevant request options and observed result without secrets
or sensitive payloads. Where useful, preserve a response with sensitive data
removed as a fixture for a stable regression test. Use local tests for malformed
responses, timeouts and error handling; distinguish technical failure from a
valid negative business result. A live connection check proves compatibility,
not model accuracy. Check accuracy with representative cases when required by
the requested outcome.

Keep a required integration with missing evidence visibly unverified. It prevents
completion: use REWORK for missing proof within authority, or BLOCKED when
authority or the environment prevents the check.

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

Inspect current scripts and focused selectors once.

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
