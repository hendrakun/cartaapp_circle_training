# Execute a module plan

## Assignment

Delegate implementation unless the user requests direct execution or delegation
is unavailable. The parent owns scope, assignments, worksheet state and final
acceptance. Each worker owns one bounded result, including its tests and fixes.
Keep that worker through review and rework. Workers return results to the parent;
the parent assigns additional workers when needed.

Each assignment names:

- Approved design, plan, acceptance IDs and selected evidence surfaces.
- One observable result, affected files and dependency interfaces.
- Applicable layer skill and reference paths.
- Permitted writes, isolated test target and shared resource owner.
- First integration check and completion condition.

Pass source pointers and unresolved facts, not the discovery transcript. Select
references for the assigned work from the router's layer contracts. A worker
resolves routine coding and test details within the approved behavior.

The first assignment proves one mutation through the most uncertain integration.
Include its API, UI and persisted result where applicable. Include an edit round
trip when retained values are the uncertainty; otherwise assign remaining actions
after this path works. A complete path need not cover the whole lifecycle. Split a large plan at observable results,
not at test failure and test success. Several assignments can share one plan;
set that plan to `IMPLEMENTED` only after all its work and checks are complete.

Run independent assignments concurrently only when their writes and test targets
do not conflict. Name one owner for shared files, migrations and test preparation.
Dependent work can start after the parent checks the required interface and its
focused results; full plan acceptance need not block independent work.

## Prepare and build

Use the selected evidence surfaces; add one only for an uncovered outcome.
Run the worksheet checker once before execution. Check the guarded test target,
required services, browser and storage setup before substantial code work.
Prepare local prerequisites within authority. Report blocked checks by acceptance
ID and continue work that does not depend on them.

Confirm the planned UI components against current exports before using them.
Build the first integration path, including changed value conversion, edit
hydration and cache refresh where applicable. For a changed UI path, exercise
it through the browser before adding the remaining UI actions.

Follow [verification strategy](verification-strategy.md#test-order) for test
order. Run focused checks after a meaningful boundary change. Inspect a failure,
correct its cause, then rerun affected checks. Run broader regression checks after
related changes are complete or when shared changes require them.

Use [UI automation](ui-automation.md) for browser checks and
[bounded generation](bounded.md) for eligible source generation. Keep migrations,
fixtures and storage within the authorized target.

The executor updates exact test references in its handoff as tests are written.
The parent merges them into the worksheet. Changes to business outcomes or write
authority return to the decision owner. Report interface changes to the parent
before dependent work uses them. Routine implementation choices need no new gate.

## Progress and recovery

Workers report a completed boundary, failed check or blocker with the next action.
At dispatch, set a progress checkpoint of at most ten minutes. At that checkpoint,
inspect worker status and available output. A running command with useful output
can continue. If progress is unclear, request status and set the next checkpoint.

On interruption, service error or an empty handoff, inspect saved changes and
results before retrying. Resume the same worker when usable; otherwise assign
only unfinished work to a replacement. If the next checkpoint still shows no
progress, stop the worker before transferring ownership. Reduce the assignment
or correct the identified blocker; repeat only after one of those changes.

A checkpoint starts diagnosis; it does not declare failure from elapsed time
alone. Preserve completed work and prevent concurrent replacements from editing
it. Record the last result, remaining IDs and next action for each handoff.

## Review and finish

The worker returns changed owners, test references, command results, deviations
and unresolved IDs. Collect final evidence as defined by the
[verification strategy](verification-strategy.md#evidence-interface).
The parent checks the diff and assertions before accepting the handoff. Return
specific defects to the same worker. Use a separate plan review only when its
result must be accepted independently; otherwise review the feature once.

At completion, assign `$verify-carta-module` to a reviewer who did not implement
the work. Supply the approved behavior, relevant diff and evidence. If delegation
is unavailable or the user requests direct work, label the review as self-review.
Reuse valid evidence. Correct findings, review affected outcomes, then update
worksheet acceptance and plan states together. Update affected application-map
entries with actual owners.

Report delivered behavior, failed or blocked checks and unverified results.
Record active work time separately from user waits, service failures and framework
blockers. Compare active time with the task target; required work remains
required when the target is exceeded.
