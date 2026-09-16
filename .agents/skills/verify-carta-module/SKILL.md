---
name: verify-carta-module
description: Review an implemented Carta module or completed plan against its approved behavior and current verification evidence.
---

# Verify Carta module

Review the named result without implementing fixes or editing decisions/state.
Safe checks and report output are allowed within the declared test boundary.
Use an independent reviewer under the
[execution rules](../carta-module-development/references/execution.md#review-and-finish);
label self-review when applicable.

## Start with the user result

Read the original request and later decisions, then the existing work record and
relevant diff, including dirty/untracked work. Check inferred defaults against
the request; an agent-written design cannot override explicit requirements.

Use the [standard module base](../carta-module-development/references/standard-module.md),
including custom workflows added to it.
Missing worksheet, IDs, UI JSON or recorder JSON is not a defect.
For a scope with a full contract, read the
[module contract](../carta-module-design/references/module-contract.md) and
[worksheet contract](../carta-module-development/references/module-execution-worksheet.md).
Preserve existing useful records without forcing conversion.

Review list, detail and edit source plus current non-browser evidence before
auditing evidence tables. Do not create, run or repair browser tests or require
a manual journey. Report rendered behavior as unverified. Check:

- Can the intended user find and complete the requested task?
- Do fields show meaningful values, including relation names rather than IDs?
- Does edit load the existing values, and do changes persist?
- Do requested filters and access rules work?
- Do workflow restrictions apply to standard actions, and do custom actions
  produce their required state changes and effects?
- Are standard actions used without unnecessary custom detail controls?
- Is the development preview prepared, with migration/seed status and URL?

Source review does not prove actual rendered behavior.
For every new or changed interaction, record the selected framework components,
required input wiring, action owner and route targets in the existing review.
Resolve named route targets against the actual generated routes. Check custom
forms against `$build-resource-form`, including uploads and contextual actions.
Passing type checks or unrelated tests does not replace this review. Unsupported
control substitutions and missing route targets require `REWORK`.

## Trace material boundaries

Use the [verification strategy](../carta-module-development/references/verification-strategy.md).
Trace changed access and values through API/schema/persistence to actual output.
Inspect module-specific restrictions, coupled writes and failure effects where
applicable. Use the relevant layer skill for unresolved contracts, not a new
whole-repository discovery pass.

For every web result, apply [UI review](../web-ui-surfaces/references/verification.md),
including standard Views and custom actions. Compare composition with
[DESIGN.md](../../../DESIGN.md) and inspect the
[complete field pattern](../web-ui-surfaces/references/fields.md) for all visible
fields. A missing component import, raw asset JSON, or an unsupported custom
control requires `REWORK`. An unexplained difference from the app design also
requires `REWORK`; a passing static check does not approve that difference.
Check scope, unrelated work and unauthorized writes. Existing example code is
not justification for overriding the request or copying an unnecessary control.

## Evaluate evidence

Read assertions, not only titles and counts. Apply
the [non-browser boundary](../carta-module-development/references/verification-strategy.md#browser-journeys).
Missing E2E is not a defect. Apply
[test ownership](../carta-module-development/references/verification-strategy.md#test-ownership)
before requesting more tests. Reuse framework behavior and sufficient module
proof. Tests that replace a schema/control cannot prove that replaced boundary.

Rerun only affected checks when evidence is stale, failed, missing or insufficient.

Only the full process requires inventory/worksheet consistency, using API/UNIT
evidence without browser mappings or reports. Run the UI contract checker when a contract exists or custom
composition needs that check; standard work needs no new JSON solely for review.
Static checks cannot establish semantic acceptance or runtime freshness.
For external integrations, apply the shared
[external integration checks](../carta-module-development/references/verification-strategy.md#external-integrations).
Check what the evidence actually reaches; a mocked provider response cannot
support a live-compatibility claim. Required missing proof prevents completion.

## Verdict and handoff

Use the shared [verdict rules](../carta-module-development/references/verification-strategy.md#verdicts).
Return a concise result with:

- Verdict and scope; independent or self-review.
- Requested outcomes, visible result and development preview status.
- Checks used, relevant freshness and unverified outcomes.
- Blocking defects with user/access/data consequences.
- Material proof gaps, separately from non-blocking suggestions.

Use acceptance IDs only when the existing full-process record has them. A
scoped review does not mark the whole feature complete. Return findings to the
executor for in-scope repair; new requirements or write authority need approval.
Preserve failures and material gaps. Optional suggestions do not prevent PASS.
