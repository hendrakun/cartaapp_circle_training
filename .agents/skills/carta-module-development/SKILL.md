---
name: carta-module-development
description: Build or resume a Carta application module spanning data, API, resources, routes or permissions, from the strongest usable artifact.
---

# Carta module development

Deliver a usable application result. Preserve requested behavior, meaningful
display values, access and data safety. Use framework defaults for routine
choices; optional refinements must not delay a required result.

## Build on standard behavior

Start with the [standard module base](references/standard-module.md). It owns
the short work record and how to add custom behavior to requested CRUD.
Read it before creating artifacts. A custom action does not switch the whole
module to another process.

Use `$carta-module-design` for unresolved behavior and `$carta-module-plan` for
implementation planning. Use the full design/plan/[worksheet](references/module-execution-worksheet.md)
process only where required traceability or a consequential change needs that
record. State its scope; keep unaffected work in the existing short record.

On resume, keep valid documents, decisions and evidence; do not convert their
format for its own sake. An existing full worksheet can remain the record
without a parallel short document. Explicit user-required processes still apply.

A build request authorizes normal in-scope implementation and repairs, not new
product decisions or unrestricted writes. Design-only and plan-only requests
stop at their requested deliverable. Ask only for a material missing decision
or authority; do not reopen clear requirements because an example differs.

## Discovery reuse

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

## Build and finish

Use [execution](references/execution.md) for implementation, early preview and
review. Keep one executor for connected work. Generation is optional: read
[bounded generation](references/bounded.md) only when a new scaffold will save
work. A generator limitation does not change the requested scope.

Use [verification strategy](references/verification-strategy.md) for checks and
evidence. Use `$verify-carta-module` for final review. Finish when the requested
result works, required checks are sufficient, and the work record reports the
development preview, migration/seed status and any remaining gaps.

## Layer contracts

- Use `$api-conventions` for API edits and `$web-ui-surfaces` for web surfaces.
- Use `$build-resource-form` for forms. For a relation, read the complete
  [display and form pattern](../web-ui-surfaces/references/fields.md), not just
  the lookup configuration.
- Read [cross-layer contracts](references/contract-rules.md) for changed boundaries.
- Read [field contracts](references/frontend-field-contract.md) for unresolved
  value shapes; [query cache](references/web-query-cache.md) for changed custom
  reads or cross-resource invalidation; [UI automation](references/ui-automation.md)
  when running browser tests.

Application owners are `apps/api` and `apps/web`. Framework changes and
production, external or destructive writes need explicit authority. Use current
package commands and preserve unrelated work.
