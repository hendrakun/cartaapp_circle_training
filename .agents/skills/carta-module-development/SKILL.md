---
name: carta-module-development
description: Build or resume a Carta application module spanning data, API, resources, routes or permissions, from the strongest usable artifact.
---

# Carta module development

Deliver a usable application result. Preserve requested behavior, meaningful
display values, access and data safety. Use framework defaults for routine
choices; optional refinements must not delay a required result.

E2E is excluded from this entire workflow, including custom work and full-process
review. Do not generate, write, run or repair browser tests or substitute a manual
journey. Follow the [non-browser boundary](references/verification-strategy.md#browser-journeys).

## Build on standard behavior

Start with the [standard module base](references/standard-module.md). It owns
the single design record and how to add custom behavior to requested CRUD.
Read it before creating artifacts. A custom action does not switch the whole
module to another process.

Use `$carta-module-design` for unresolved behavior and `$carta-module-plan` for
implementation planning. Use the full design/plan/[worksheet](references/module-execution-worksheet.md)
process only where required traceability or a consequential change needs that
record. State its scope; keep unaffected work in the existing record.

On resume, reuse current decisions, approval and evidence in the selected process.
Explicit user-required processes still apply.

A build request authorizes design work. Implementation authority begins only
after the [design approval gate](references/standard-module.md#design-approval-gate).
Design-only and plan-only requests stop at their requested deliverable. Ask only
for a material missing decision or authority; do not reopen clear requirements
because an example differs.

## Discovery reuse

Before broad technical discovery, separate explicit requirements, delegated
defaults and material questions. Inspect only the owner needed to resolve a
question, then ask it. Exclude options that contradict the request. Report the
intended result and next action before starting a repository survey.

Start with the requested change, current owners and one applicable pattern.
Read further for a named missing fact, changed input or observed failure.
Inspect the smallest owner and necessary direct callers; batch independent
lookups. Use history only when current source cannot resolve the question.
An example supplies implementation facts, not authority to change the request.

After initial owner reads, report the known path, unresolved facts and next
change. If discovery continues for ten further files or five minutes without
a change, name what prevents progress. This is a communication checkpoint,
not a file budget or permission to skip necessary inspection.

Pass decisions, reasons and exact source pointers on handoff. Reuse them while
current. A new stage or worker is not a reason to repeat discovery. Keep these
facts in the existing work record, not a separate discovery log.
Delegate discovery only for a named gap, with an answer and stopping condition.
Reuse the answer; read its source again only for an unresolved detail or change.

## Build and finish

Use [execution](references/execution.md) for implementation, early preview and
review. Keep one executor for connected work. Implement the module with normal
source edits and the repository's existing framework patterns.

Use [verification strategy](references/verification-strategy.md) for checks and
evidence. Use `$verify-carta-module` for final review. Finish when the requested
result works, required checks are sufficient, and the work record reports the
development preview, migration/seed status and any remaining gaps.
Record the review verdict before reporting completion. A pending required
review leaves the work in `verifying`, including after a repair.

## Layer contracts

- Use `$api-conventions` for API edits. Before planning or writing any web
  surface, use `$web-ui-surfaces` and read [DESIGN.md](../../../DESIGN.md).
  Apply this path to custom actions and playgrounds as well as CRUD.
- Before selecting controls for any user input, use `$build-resource-form`.
  This includes custom actions, playgrounds and inline uploads. For a relation, read the complete
  [display and form pattern](../web-ui-surfaces/references/fields.md), not just
  the lookup configuration.
- Read [cross-layer contracts](references/contract-rules.md) for changed boundaries.
- Read [field contracts](references/frontend-field-contract.md) for unresolved
  value shapes; [query cache](references/web-query-cache.md) for changed custom
  reads or cross-resource invalidation.

Application owners are `apps/api` and `apps/web`. Framework changes and
production, external or destructive writes need explicit authority. Use current
package commands and preserve unrelated work.
