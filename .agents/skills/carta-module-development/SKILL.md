---
name: carta-module-development
description: Build or resume a Carta application module spanning data, API, resources, routes or permissions, from the strongest usable artifact.
---

# Carta module development

Deliver the requested module without restarting settled work. This router owns
stage selection, continuity and completion; the routed skills own design,
planning, implementation contracts and acceptance review.

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

For a first module, establish its actor, data owner, action and visible result,
then build that complete path. Add child resources, reports or workflow services
when the behavior needs them. Keep domain logic in its module and use existing
framework contracts directly. A forwarding function or copied type needs a
purpose beyond renaming an existing API.

## Implement and verify

Use [execution.md](references/execution.md) when implementation is authorized.
Assess uncertainty, dependency impact, risk and generator eligibility separately.
A known relation does not require a heavier interview, and a small resource can
still have an unresolved business rule. For selected route files at any supported application route depth, use the
[route-only operation](references/bounded.md#route-only-operation).
For a new full-CRUD resource with no
special behavior, check [bounded.md](references/bounded.md) for generator limits;
generator ineligibility does not change the approved scope.

Before assigning execution, run the worksheet checker and review the UI contract
and journey coverage against the approved behavior. Missing mappings return to
planning. Delegate plan reconciliation as planning, not execution.

Use delegation when available and useful. Assign workers through the
[execution handoff](references/execution.md#assignment). The orchestrator reviews
every plan before assigning the next; workers return evidence, not acceptance.
When delegation is unavailable, execute directly with the same acceptance
requirements and label the review as a self-review.

Use [verification-strategy.md](references/verification-strategy.md) to select
and record evidence. Invoke `$verify-carta-module` for final acceptance whether
implementation was delegated or direct. A static helper pass or executor summary
is not a module acceptance verdict. Complete only when every required evidence
surface and acceptance row has current sufficient evidence, semantic review passes
and blockers are clear. Apply the verifier's scope-change rule to unfinished work.

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
