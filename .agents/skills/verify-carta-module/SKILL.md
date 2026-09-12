---
name: verify-carta-module
description: Review an implemented Carta module or completed plan against its approved behavior and current verification evidence.
---

# Verify Carta module

Perform acceptance review of the named feature or plan. Inspect source and
reports without implementing fixes or editing decisions/state. Safe focused
checks and their report outputs are permitted within the declared test boundary.
Use an independent reviewer by default under the
[execution rules](../carta-module-development/references/execution.md#review-and-finish).
Apply the same criteria to self-review. An executor summary is an input, not a verdict.

## Establish the review scope

First derive the required outcomes from the approved design/revision and its
source references. Then compare selected plans, worksheet required surfaces,
acceptance/handoff rows and the complete relevant diff, including dirty and
untracked files. Read the current owners and consumers needed to interpret it.
Consult the shared
[module contract](../carta-module-design/references/module-contract.md),
[worksheet contract](../carta-module-development/references/module-execution-worksheet.md)
and [verification strategy](../carta-module-development/references/verification-strategy.md).

For a scoped plan review, consider that plan's obligations and dependency
interfaces; a final feature review covers all acceptance rows and cross-plan
effects. Selected completed plans can be `IMPLEMENTED` or `VERIFIED`. Missing
workflow metadata is a specific handoff gap, not a reason to invent requirements.
Continue useful safe inspection and report which conclusions remain blocked.

## Compare behavior and scope

Trace each material action and invariant from input and access through its
owning API/service/persistence to the observable result and affected consumers.
Check relevant allowed and denied cases, field/relationship meaning, lifecycle,
atomicity/retries, visible states, reload and invalidation. Compare implementation
to the approved design, not just to tests written by the same implementer.

Apply the design's source and workflow consistency checks to unresolved conflicts.
A missing storage column does not remove a required effect or retained history.
Trace repeated workflow cycles when earlier decisions must remain available.

Map each acceptance ID to direct implementation and sufficient evidence. Compare
changed owners with plan scope and distinguish pre-existing unrelated work.
Check for unapproved product behavior, interface changes, framework edits and
writes. A routine supporting edit inside the approved result is not scope drift.
A material contradiction returns to its decision owner.

Read the applicable layer contracts:

- [cross-layer rules](../carta-module-development/references/contract-rules.md);
- [field contracts](../carta-module-development/references/frontend-field-contract.md)
  for resources/forms;
- [query cache](../carta-module-development/references/web-query-cache.md) for
  changed reads/invalidation;
- [backend routing](../api-conventions/references/file-routing.md) for API
  placement, inherited access, context inference, and consumer contracts;
- [web file routing](../web-ui-surfaces/references/file-routing.md) for changed route
  structure, tabs, Back targets, or page lifetime;
- `$api-conventions`, `$web-ui-surfaces` and `$build-resource-form` for their layers.

Check whether each added layer owns behavior: a service owns a transaction or
business operation; an adapter owns a boundary; a type adds a contract that
inference cannot express. Report forwarding wrappers, duplicate state and
repeated validation where direct use preserves the required behavior.

## Evaluate evidence

Compare the design inventory with worksheet acceptance and plan ownership. Check
required branches, invariants and whole sequences, including browser obligations.
Check every expected outcome against the assertion or visual evidence that proves
it. Compare distinct workflow branches with the design journey inventory; inspect
conditional input paths even when another path passes. Run the worksheet browser
report check and UI contract check. Inspect component exceptions and tests that
stub forms, schemas, serialization or unresolved components; those stubs cannot
prove the replaced boundary. Apply the [UI review](../web-ui-surfaces/references/verification.md) to custom
composition and displayed values. A passed API row leaves a required browser or
visual row open until that evidence is sufficient.
Inspect recorded results, critical-rule tests, changed assertions,
selected cases, commands, input fingerprints,
environment identity and results. Reuse current sufficient evidence; rerun the
smallest affected checks when evidence is missing, stale, failed or insufficient.
Broaden checks when shared changes expose dependent consumers. Fingerprints
prove selected file freshness, not that the selected dependencies or test
assertions were adequate.

For a generated module, validate the manifest with the wrapper's read-only
`--check`, inspect generated/integrated code, and read actual helper reports.
The helper's static/runtime status explicitly excludes semantic acceptance and
browser evidence. Generated authentication/shape smoke tests do not prove full
CRUD behavior, scoped authorization or business invariants.

When UI obligations apply, read [UI automation](../carta-module-development/references/ui-automation.md)
and map the required outcomes to passing Playwright cases/steps. Inspect source
and preserved artifacts, including failures. Backend checks and screenshots do
not replace a required real interaction and persisted result. A feature with no
UI obligation records that applicability reason rather than fabricating a run.

## Verdict and handoff

Return one verdict with its scope:

- `PASS`: every required row in the review scope matches the approved contract
  and has current sufficient evidence.
- `REWORK`: the result is wrong or incomplete and can be corrected within scope.
- `BLOCKED`: missing authority, decision, environment or evidence prevents a sound
  acceptance verdict. Name observed defects too; a blocker does not hide them.

Use this report shape:

```text
VERDICT: PASS | REWORK | BLOCKED
SCOPE: feature or selected plan paths
REVIEW: independent | self-review
DESIGN: path, approved revision and source
IMPLEMENTATION: scope/drift and direct-owner findings
ACCEPTANCE: IDs, implementation pointers and evidence
CHECKS: results, reports, freshness and unverified checks
UI: case/step evidence or applicability reason
REWORK: affected IDs, owning plan and exact correction, or None
BLOCKERS: affected IDs and missing prerequisite, or None
```

Return the report to the workflow owner, who records it and updates the worksheet.
A scoped plan pass does not mark the entire feature done. Preserve failures and
unverified results explicitly; never turn a missing runtime into a pass.
Required work can leave scope only through an authorized scope change. An executor
or reviewer cannot relabel missing acceptance evidence as optional follow-up work.
