# Module execution worksheet

Use this record only for the full process or to resume an existing worksheet.
Ordinary CRUD uses the [standard module path](standard-module.md). Its short
record does not need this checker or conversion into these tables.

The feature folder contains `design.md`, numbered plans, `worksheet.md` and
`reports/`. The design owns behavior, approval and the obligation inventory.
Plans own technical decisions. The worksheet owns status and test/result links.
Reports contain observed results. Acceptance IDs join these artifacts.

## Ownership and evidence

Use the [template](../assets/worksheet-template.md), or initialize it:

```sh
python3 .agents/skills/carta-module-development/scripts/init_worksheet.py <feature>
```

Assign each acceptance ID to one primary plan. List its IDs under `- Acceptance:`
in that plan. List dependencies by plan ID. Compare coverage with the design
inventory; keep the inventory there.

List each acceptance ID once in Required evidence with its comma-separated
surfaces: `API`, `UNIT`. Browser and visual test surfaces are outside module
delivery. Record UI source review in the review report. Use the
[verification strategy](verification-strategy.md#select-proof-by-behavior-and-impact)
to select proof for all required outcomes.

Each Acceptance row names one surface, test, implementation owner, evidence,
review and result. Repeat an ID for separate tests or surfaces within its primary
plan. The acceptance ID, surface and test identify a unique row.

Use `PENDING` for a test until the executor selects it. This is valid only while
its result is `PENDING` or `BLOCKED` and its plan is `TODO`, `IN_PROGRESS` or
`BLOCKED`. Completed executable checks use `file::exact test title`; visual
checks use a specific name. Plans need acceptance ownership, not a second test map.

Report paths are relative to the feature folder. `Evidence` links recorder JSON
for executable checks or a visual report. The checker requires command evidence
with a zero exit code and unchanged inputs. Run the recorder freshness check too.
`Review` links the orchestrator verdict; completed acceptance requires this link.

Run before execution, after mapping changes and at final review:

```sh
python3 .agents/skills/carta-module-development/scripts/check_worksheet.py plans/<feature>
```

The checker tests design links, surfaces, ownership, dependencies, file links and
state. Reviewers check inventory completeness, assertions, report truth and input
freshness. On resume, preserve approved outcomes and valid evidence. For an older table,
move Green links to Evidence and retain historical Red reports. Remove duplicate
Coverage rows and plan test maps; compare the result with the design inventory.

## Browser journeys

Keep legacy journey tables empty in both design and worksheet. State the reason:
E2E is outside module delivery. Do not create browser mappings or reports or run
the browser-report checker. On resume, move old browser obligations and their
history to separately scoped work, without claiming they passed. Preserve
business requirements and select applicable API/UNIT proof for module delivery.
Record rendered behavior as unverified in the final review.

## State and completion

Feature: `INTAKE` → `DESIGN` → `PLAN` → `READY` → `EXECUTE` → `VERIFY` → `DONE`.
`READY` means plans are ready for execution. `BLOCKED` names the affected stage
and missing prerequisite. Resume from valid artifacts; continue independent work.

Plan: `TODO`, `IN_PROGRESS`, `IMPLEMENTED`, `VERIFIED`, `BLOCKED`, `SUPERSEDED`.
`IMPLEMENTED` requires completed work and checks. The executor stops there.
Dependencies can proceed from `IMPLEMENTED` or `VERIFIED` plans. `VERIFIED`
requires all owned acceptance rows passed and an orchestrator review report.

A plan dependency requires the whole predecessor to be implemented. Keep work
that can start after an early interface check in ordered assignments within the
same plan. The plan remains `IN_PROGRESS` until all assignments and checks are
complete. Separate independent plans have no dependency. On resume, reconcile
plan boundaries and acceptance ownership before dispatch if the old split would
require a false `IMPLEMENTED` state; preserve design approval and valid evidence.

Acceptance: `PENDING`, `PASS`, `FAIL`, `BLOCKED`. Exclusions require approved
scope. The executor records evidence; the orchestrator records acceptance and
state. User-selected direct execution uses the same criteria and labels self-review.

`DONE` requires every selected plan verified, all required acceptance passed with
current non-browser evidence, and review of cross-plan effects. Link
the final report in `Latest review`.

## Handoff and resume

Update at handoff, changed decisions and material failures. Record affected IDs,
evidence paths and the next action. A reviewer receives the approved revision,
plan, acceptance rows, relevant diff including new files, evidence and boundaries.
Reuse current evidence. Changed rules or inputs reopen affected rows and plans;
check dependencies before reopening other work. Preserve failed runs and replaced
reports. Report missing history as unverified.
