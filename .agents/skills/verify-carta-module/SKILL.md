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

Inspect populated list, detail and edit results before auditing evidence tables.
Use current preserved browser artifacts or a safe focused inspection; report
when actual rendered output is unavailable. Check:

- Can the intended user find and complete the requested task?
- Do fields show meaningful values, including relation names rather than IDs?
- Does edit load the existing values, and do changes persist?
- Do requested filters and access rules work?
- Do workflow restrictions apply to standard actions, and do custom actions
  produce their required state changes and effects?
- Are standard actions used without unnecessary custom detail controls?
- Is the development preview prepared, with migration/seed status and URL?

A screenshot can prove display, not access enforcement or stored effects.

## Trace material boundaries

Use the [verification strategy](../carta-module-development/references/verification-strategy.md).
Trace changed access and values through API/schema/persistence to actual output.
Inspect module-specific restrictions, coupled writes and failure effects where
applicable. Use the relevant layer skill for unresolved contracts, not a new
whole-repository discovery pass.

For relation work, inspect the
[complete field pattern](../web-ui-surfaces/references/fields.md).
Use [UI review](../web-ui-surfaces/references/verification.md) for custom composition.
Check scope, unrelated work and unauthorized writes. Existing example code is
not justification for overriding the request or copying an unnecessary control.

## Evaluate evidence

Read assertions, not only titles and counts. Apply
the [saved browser-test requirement](../carta-module-development/references/verification-strategy.md#browser-journeys)
for module UI delivery: inspect the spec and its run result, not only temporary
preview scripts. Then apply
[test ownership](../carta-module-development/references/verification-strategy.md#test-ownership)
before requesting more tests. Reuse framework behavior and sufficient module
proof. Tests that replace a schema/control cannot prove that replaced boundary.

For generated work, apply the
[generated-evidence limits](../carta-module-development/references/verification-strategy.md#commands-and-environment).
Inspect current source, not equality with a template. For selected browser tests,
use [UI automation](../carta-module-development/references/ui-automation.md).
Rerun only affected checks when evidence is stale, failed, missing or insufficient.

Only the full process requires inventory/worksheet consistency and its browser
report check. Run the UI contract checker when a contract exists or custom
composition needs that check; standard work needs no new JSON solely for review.
Static checks cannot establish semantic acceptance or runtime freshness.

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
