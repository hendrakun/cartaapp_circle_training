---
name: carta-module-development
description: Build or resume a Carta application module spanning data, API, resources, routes or permissions, from the strongest usable artifact.
---

# Carta module development

Deliver the requested module without restarting settled work. This router owns
stage selection, continuity and completion; the routed skills own design,
planning, implementation contracts and acceptance review.

## Discovery reuse

Pass established decisions and exact owner pointers between stages. Reuse them
while their inputs remain current. Each stage resolves only its missing facts;
a new stage or worker is not a reason to repeat discovery. Read further only to
resolve a named missing fact, changed input or observed failure. Design resolves
business gaps; planning resolves technical owners and patterns; execution applies
the resulting packet.

Before each discovery search, name the missing fact and the smallest likely
owner. Inspect that owner and the direct callers needed for the question. Batch
independent lookups. Use history only when current source cannot explain a
relevant decision or regression. A general request to understand the architecture
is not a completion condition.

After the initial owner reads, report known owners, unresolved facts and the
next change. If discovery continues for ten additional files or five minutes
without a change, give that report again and name the fact that prevents progress.
Count files, not shell calls; a batch does not reset the checkpoint. This is a
reporting trigger, not permission to skip required investigation or force a write.
Workers report to the parent, which keeps the user informed. Continue useful
authorized work without waiting for approval of the report.

A handoff includes each selected pattern, why it fits, its exact source pointer
and revision, and the manual remainder. A directory or path alone does not pass
the decision. Keep these facts in the existing plan owner rows, not a new log.

## Resume the right stage

Inspect the request, supplied artifacts, existing feature folder and relevant
working tree. Judge an artifact by its content, approval and currentness, not
its filename. Use one feature folder for a coherent journey; separate unrelated
requests. Keep one short plan for a small result; split only for a real dependency
or separate outcome. Record continuity with the
[worksheet contract](references/module-execution-worksheet.md).

| Strongest usable input | Next action |
|---|---|
| Intent or draft with material gaps | Use `$carta-module-design`. |
| Approved behavioral contract | Use `$carta-module-plan`. |
| Usable plan and authority to implement | Execute the unfinished work. |
| Partial implementation | Reconcile the design, plan, code and current evidence, then resume. |
| Implemented result | Use `$verify-carta-module`. |

Design-only and plan-only requests stop at their requested deliverable. Existing
approval is not a reason to repeat an interview. A material conflict goes back
to the owner of that decision; unaffected work remains valid.

## Start from the Carta application

Treat `apps/api` and `apps/web` as the application owners. Reuse their entities, file routes, app adapters, navigation and design tokens. Inspect current public
framework exports before using an example from another app. A completed app
can show a useful interaction; its domain, permission model, helper files and
old framework API are not prerequisites for a new Carta app.

Keep domain logic in its module and use existing framework contracts directly.
A forwarding function or copied type needs a purpose beyond renaming an API.

## Implement and verify

Use [execution.md](references/execution.md) when implementation is authorized.
Assess uncertainty, dependency impact, risk and generator eligibility separately.
A known relation does not require a heavier interview, and a small resource can
still have an unresolved business rule. For selected route files at any supported application route depth, use the
[route-only operation](references/bounded.md#route-only-operation).

Use [bounded generation](references/bounded.md) to assess each resource before
detailed planning, preview compatible standard actions, and apply each manifest
once after implementation authority exists. Generated source then becomes normal
editable source. Generator ineligibility does not change the approved scope.
Environment preparation and the first working result follow execution.md.

Delegate implementation by default under the
[assignment and recovery rules](references/execution.md#assignment).
The parent owns scope, coordination and acceptance. Use direct execution when
the user requests it or delegation is unavailable; state the reason.

Use [verification-strategy.md](references/verification-strategy.md) to select
checks and collect final evidence. Invoke `$verify-carta-module` for final
acceptance. Complete when all required outcomes have current sufficient evidence,
review passes and the worksheet is updated. Preserve incomplete work as such.

## Layer contracts

- Use `$api-conventions` for `apps/api` edits.
- Use `$web-ui-surfaces` for web routes and surfaces; use `$build-resource-form`
  when forms are involved.
- Read [contract-rules.md](references/contract-rules.md) for cross-layer changes.
- Read [frontend-field-contract.md](references/frontend-field-contract.md) for
  web resource and form fields, and [web-query-cache.md](references/web-query-cache.md)
  for custom server reads or cross-resource invalidation.
- Read [ui-automation.md](references/ui-automation.md) for UI acceptance.

Use Carta's standard `pnpm`, Vitest and Playwright infrastructure and current
package scripts. Keep application changes in their owners; framework package
changes and production/external/destructive writes require explicit authority.
Report incomplete checks, blockers and unverified outcomes as such.
