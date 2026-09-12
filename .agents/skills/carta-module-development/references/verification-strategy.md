# Verification strategy

Use this reference while planning proof obligations, collecting evidence and
reviewing a Carta module. Carta supplies Vitest, Playwright, lint and type-check
infrastructure. Package scripts/configuration own exact commands and selectors;
those tools are framework defaults, not product choices.

## Select proof by behavior and impact

For each acceptance outcome, name a plausible fault, then choose the smallest
check that detects it. Reuse one check across outcomes it proves. Test names
state behavior; file count and coverage percentage are not completion criteria.

| Risk | Useful proof |
|---|---|
| Input conversion or domain validation | Accepted and rejected values at the owning schema or API boundary; verify the stored value when persistence can change it. |
| Relationship | Valid selection persists; a wrong-parent or inaccessible reference is rejected. Check edit hydration and parent-change clearing through the form when changed. |
| Access | Direct authenticated requests with and without the required permission or record access; rejected writes leave state unchanged. |
| Workflow | Legal and illegal transitions, stored effects, and rollback of coupled writes. Test races or retries when their outcome is part of the contract. |
| UI integration | A focused browser journey through the changed interaction, with visible feedback and a persisted result after reload. |
| Cache or consumer | A successful mutation updates the affected list, detail or summary without a manual browser reload. |
| Migration | Inspect SQL and test the relevant old-to-new data shape on an isolated target. |

Use API integration tests with the real application and test database for
access, query scope, constraints and transactions. Use unit tests for domain
logic with meaningful inputs and outputs. Use browser tests for interaction
and integration; keep exhaustive permission and state combinations at the API.
A layout or copy-only change can use visual inspection and existing checks.
An explicit acceptance requirement still needs its stated evidence.

Select proof for every expected outcome within an acceptance case. One case can
require both API and browser evidence. Put the required surfaces in the worksheet
before implementation; add separate evidence rows where needed. A UI interaction
requires browser evidence even when the same case also specifies stored effects.
Use visual evidence for display/layout outcomes and source review for framework
composition. Reuse a check only for outcomes its actual assertions establish.

For visible actions, prove that the permitted user can find and complete the
action, see updated data and available actions before reload, and retain the
result after reload. For filters, change the visible control and check the
matching records. For file or relation inputs, use the actual control and verify
the saved value and display. Page-render checks establish presence only.

## Browser journeys

Derive journeys from action, transition and conditional-input rules before reading
existing tests or worksheet evidence. An old API-only evidence choice does not
remove a changed UI path. Add its browser proof without changing business approval.

Give each distinct user workflow a browser journey. Split when required controls
or inputs, the submission contract, action sequence, visible result or failure
recovery differs. Count user workflows, not code branches or every combination.
Use one independent starting record per selected journey. A rejected submission
and successful retry can share that record and test.

For example, safe review then close differs from unsafe review then close. If
investigation is optional after unsafe review, select both branches: close without
it, and reject missing required evidence then upload and close. Check retained
evidence when it changes requiredness. Keep other state/permission combinations
at the API boundary.

Reuse coverage for unchanged standard CRUD behavior. Module-specific inputs,
validation, access, uploads and edit hydration still need integration proof.
Use the actual changed controls and assert the submitted value, updated actions
and persistence after reload. Seed prerequisites; perform the selected sequence
through the UI.

The design selects journey IDs and acceptance links. As tests are written, the
worksheet maps each to one distinct `file::exact test title`; parameterized cases need distinct titles.
The executor selects fixtures and assertions from the approved outcomes. Run `check_worksheet.py --browser-report`
on the preserved Playwright JSON report. Every selected case must pass in each
reported project without skipped attempts or retry failures. Review assertions
against the design; a matching title cannot prove coverage or report freshness.

## Tests that earn their cost

- Assert public outcomes and persisted effects. A status code alone cannot
  prove that a write succeeded or that a denied write changed nothing.
- Create the few records that distinguish correct behavior from the fault:
  another parent for scope, a tie for sorting, a conflicting state for a
  transition. Give fixtures unique identities and clean up only owned rows.
- Separate independent rules so one failure does not hide the others. Keep
  one sequential test when the sequence itself is the behavior under test.
- Use installed test helpers and inferred types. Mock an external boundary
  when needed; keep authorization, persistence and transaction behavior real
  when those are the claim. Test-specific wrappers must remove real repeated
  setup or express a domain action.
- For a regression, show that the assertion fails on the prior behavior when
  practical. Otherwise explain which wrong outcome it detects. A test that
  still passes with the changed behavior removed needs stronger assertions.

Skip tests that only copy field arrays, labels, renderer names, route literals,
export names or source text. Check important configuration through its effect:
a hidden action, a selected value, a navigable route or rejected access.
Keep type tests at a changed type contract and framework tests at the framework
owner. Ordinary modules need neither repeated framework CRUD matrices nor
snapshots of component internals. Existing weak tests are not templates.

## Commands and environment

Resolve package scripts, filters, config and test patterns from this checkout.
Confirm that focused selectors select the intended tests; zero tests, skipped
requirements and generated scaffold smoke tests do not establish acceptance.
The root `test` command does not run the separate application Playwright suite.
Loom's browser tests and application E2E are different surfaces. Respect serial
API specifications sharing a database and serialize memory-heavy type checks.

Before DB-backed checks, use the guarded test command and explicit isolated
configuration. The API test preflight requires `.env.test`, a declared test
purpose/name and a target distinct from development. For browser tests, use the
existing guarded E2E setup described in [ui-automation.md](ui-automation.md).
A declared target identifies permitted disposable data; it is not permission
to mutate production or arbitrary remote systems.

Dependencies, browser binaries, ports and fixtures are operational prerequisites.
Prepare ordinary local prerequisites within task authority. If they cannot be
established safely, report the exact blocked checks rather than offering a new
test framework or claiming the runtime result from static checks.

## Test order

Use test-first work for regressions and critical rules: unauthorized access,
financial errors, data loss, irreversible external effects, invalid final
decisions, broken coupled writes, or a consequence the user identifies as serious.
Inspect the assertions against the approved rule before implementation. Keep
this check within the worker's task; final review checks tests and code together.
A user-required review gate still applies.

For routine new routes and forms, implementation can precede focused behavior
tests. Group related changes around an observable result. Existing coverage can
satisfy an outcome when its assertions and inputs remain applicable.

For a regression, observe the expected failure when practical. Setup faults and
empty test selections do not establish it. If failure cannot be reproduced,
state that limit and the wrong outcome the test detects. Keep useful failure
output for diagnosis; a separate red report is not a completion requirement.

Change business assertions only with the decision owner's authority. A technical
test repair can proceed when it preserves the approved outcome; report the change
for final review.

## Tight loop

Run focused checks after a meaningful changed boundary. On failure inspect the
output and classify the cause: source, test expectation, fixture, environment,
tooling, pre-existing failure, or an unresolved requirement. Make an evidence-led
correction inside scope, then rerun the affected checks. Preserve failures in
the record; a later pass supersedes rather than erases them.

Reuse passing evidence when it covers the obligation and its relevant inputs
and environment are still valid. A new reviewer is not a reason to rerun it.
A change to a dependency, fixture, schema, config, contract or test can make it
stale even when the module file is unchanged. Include those inputs. A live
external dependency or contaminated shared environment may need fresh checking
without a source change; fingerprints alone cannot establish runtime isolation.

## Evidence interface

Use ordinary focused test output during development. At a completed assignment
or final verification, record the required commands together with the existing
recorder. One report can support several acceptance rows. Reuse current recorded
passes; ordinary output without the required provenance needs a recorded run.
Preserve relevant failure artifacts and explain their correction in the handoff.
Update the worksheet after handoff and final review, not after each command.

Each result records exact command/argument vector and working directory,
selected cases, environment identity (no credentials), source and approved design
revision, relevant input content fingerprints, result/exit code and artifact
paths. Include untracked files, deletions and changed dependency inputs. Git SHA
and changed filenames alone cannot distinguish two edits to the same file.
Keep final reports out of the tracked source input set to avoid self-invalidating
results. Include the design, but not worksheet status churn, as a contract input.

Use `node scripts/module-evidence.mjs --help` for snapshots, command recording
and freshness checks. The recorder executes a command once, preserves stdout and
stderr, and marks results invalid when relevant inputs change during the run.
The input list is a declared scope, not an automatic dependency analysis. Include
applicable owners, tests, configuration, lockfile and affected shared dependencies.
An empty input set is invalid. Reports are evidence, not proof that their selected
scope was sufficient.

The bounded static checker reports `scope: static`, `runtime: NOT_RUN` and
`acceptance: NOT_REVIEWED`. Its runtime mode covers its listed commands, not
Playwright or semantic acceptance. Use `--reports` for a durable summary and
command logs; its helper snapshot must be supplemented with contract/dependency
inputs when they are not in the generated-module set.

## Verdicts

`PASS` for an acceptance review means all required behavior is implemented and
proved with current sufficient evidence. `REWORK` means a wrong/incomplete result
fixable inside scope. `BLOCKED` means a missing decision, environment, authority
or inaccessible evidence prevents a sound verdict. Record the exact affected
acceptance IDs. Static pass, runtime pass and module acceptance are distinct.
