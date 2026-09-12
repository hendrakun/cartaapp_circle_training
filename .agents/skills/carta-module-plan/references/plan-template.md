# Module implementation plan

Use `plans/<feature>/NNN-<result>.md`, one plan per complete result.
Preserve valid numbering on resume. Reference design IDs instead of copying rules.
The worksheet alone maps acceptance and journeys to tests and results.

```markdown
# Plan NNN: <observable result>

- Design: <path, approved revision and authority>
- Acceptance: <owned IDs>
- Depends on: <plan IDs and required interfaces, or NONE>
- Source: <commit and relevant dirty/untracked input snapshot>
- Scope: <permitted edits, test target and side effects>

## Owners and interfaces

| File / symbol | Existing or new | Required change | Consumers |
|---|---|---|---|

Specify route methods/paths, public input/output types, errors, authorization,
transaction boundaries and interfaces between plans. Name existing examples and
applicable layer contracts. State migration and consumer update order when needed.
Leave routine code and test details to the executor.

## Work order

Check the required isolated test environment before implementation. Start with
one complete path through the most uncertain integration. Include API, UI and
persistence where the approved path uses them. Prove its result before dependent
actions. Name remaining results and their dependencies.

## UI contract

For changed web surfaces, reference `ui-contract.json` from the
[UI contract](../../web-ui-surfaces/references/ui-contract.md). Record the selected
component, extension and actual gap once. Use the design's journey IDs; the
executor returns exact browser test mappings for the parent to merge.

## Test strategy

Name test boundaries and critical expected outcomes, including unchanged data
on rejected writes. Use the verification strategy for test-first requirements.
Select required evidence surfaces in the worksheet before assignment. Browser
checks use changed controls and prove saved results; API checks prove access,
validation and transaction rules. Reuse valid existing coverage.

## Commands

| Purpose | Working directory | Command | Setup / isolated target |
|---|---|---|---|

Mark commands as inspected or run. Include affected regression checks and final
checks. The executor adds selectors for new tests. Name blocked checks and their
missing setup; prepare ordinary local requirements within task authority.

## Handoff

Return changed owners, test mappings, results, evidence paths, input snapshot
and unresolved conflicts. The parent merges worksheet updates after handoff
and final review. Assignment and review follow the development workflow.
```

## Readiness

Check design coverage, acceptance ownership and required surfaces in the
[worksheet](../../carta-module-development/references/module-execution-worksheet.md).
Check paths, interfaces, write boundaries, commands and dependency order against
the checkout. Use the
[verification strategy](../../carta-module-development/references/verification-strategy.md)
for sufficient checks.

Before `READY`, check the selected UI components and journeys against current
source and approved behavior. The packet is ready when an executor can build the
selected result without another product decision. Exact new test titles and
fixtures are execution details. Record the next assignment and any blocked work.

Return repository conflicts with evidence to the planner and new business choices
to design. Preserve unaffected work. Changed public interfaces, transactions or
dependencies need coordinator review; changed behavior needs design authority.
