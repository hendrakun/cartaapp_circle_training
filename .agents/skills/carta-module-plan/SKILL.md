---
name: carta-module-plan
description: Turn an approved Carta module design into implementation plans, or reconcile existing plans with a revised design and repository.
---

# Carta module plan

Translate an approved module contract into repository-grounded implementation
plans. Record intent, affected owners, scope, steps, checks and completion.
This skill plans the selected behavior; it does not run a general audit, choose
new product scope, or implement source changes.

## Confirm authority and current context

Read the design and its approval source. Use the shared
[module contract](../carta-module-design/references/module-contract.md) to assess
readiness without requiring a rewrite into a particular layout. Keep an
existing plan that already meets the same bar.

Inspect the actual affected owners and consumers, relevant layer contracts,
and current package scripts/configuration. Record an existing exemplar for
non-obvious patterns. Separate observed repository facts from proposed technical
changes. Carta supplies Vitest, Playwright, type checking and linting; select
appropriate checks rather than asking the user to choose a testing stack.
Resolve exact commands from this checkout and distinguish script inspection
from a successful execution.

For backend routes, read the
[file-routing contract](../api-conventions/references/file-routing.md). Name the
method exports, URL parameters, inherited scopes, and affected SDK consumers.
Keep database domains separate from HTTP routing.

For web work, apply `$web-ui-surfaces` and, for forms, `$build-resource-form`.
Select supported interaction patterns before choosing custom routes or controls.
Map each required UI action to its entry point, inputs, access/state conditions
and visible result in the plan's existing owner rows. Reference the design's
predicates rather than copying them. Reuse pattern choices across actions; record
only actual framework gaps as exceptions.

For web route changes, read the
[file-routing convention](../web-ui-surfaces/references/file-routing.md). Map
the required visible parent chain to route files and page Back targets. Preserve
existing URLs and names unless the approved change includes them. Treat file
placement within settled behavior as a technical decision.

If planning exposes a missing business rule or a conflict with approved intent,
return that specific issue to `$carta-module-design`. Preserve unaffected work.
Make ordinary technical decisions within the design's delegated scope. A missing
implementation owner is work to plan, not itself a product blocker. Choose local
storage, symbols, permission-code spelling and transaction mechanics when behavior
is settled. Ask the decision owner only for missing business policy or authority;
name the observable outcome that the answer changes. Storage representation is
technical; who may create/read records or receive a grant is business policy.
An absent source of project assignments cannot be replaced by test fixtures and
called a complete application workflow.

## Organize the work

Put test environment preparation first: isolated database, browser, storage and
ports needed by the selected checks. Use existing setup within task authority.
Name any blocked check and its missing prerequisite.

Make the first implementation result a complete path through the most uncertain
integration. Include API, UI and persistence where the approved path uses them.
Prove its result before adding dependent actions. Keep the path and its tests
in one assignment. Split further work only
for a separate result, dependency, independent owner or risk boundary.

Use [plan-template.md](references/plan-template.md) for numbered plans at
`plans/<feature>/001-<result>.md`. Preserve existing numbering on resume. The
complete handoff is the design, worksheet, selected plans and referenced source,
not a transcript or repeated copy of the design in each file.

Use the [worksheet contract](../carta-module-development/references/module-execution-worksheet.md)
for the dependency/status index and acceptance ownership. Map every acceptance
ID to a primary plan and its required evidence surfaces there. Keep acceptance
and journey test mappings only in the worksheet. Exact tests can remain `PENDING`
until the executor returns them for the parent to merge. Use
[verification strategy](../carta-module-development/references/verification-strategy.md)
to select the smallest sufficient tests and broader checks justified by impact.

State affected owners, intended changes, required interfaces, transaction
boundaries and test strategy. Resolve commands and working directories from the
checkout; let the executor add selectors for new tests. Specify critical expected
outcomes; let the executor choose test names, fixtures and routine code details.
Include code excerpts only to explain a fragile interface.

## Review and hand off

Check complete acceptance coverage, dependency order, actual paths and commands,
write boundaries, and design revision. Check the plan as a fresh implementer:
it must resolve what to change and how to prove it without another product
decision. Commands with unknown setup requirements stay visibly blocked.

Record source drift with commit and relevant input fingerprints, including dirty
and untracked work. On resume, reconcile actual changes; routine approved
implementation is not itself a new design conflict. Refresh technical details
when behavior is unchanged. Escalate only material scope, interface or authority
changes.

Return the plan/index paths, design revision, execution order, coverage and
blockers. A planning-only request ends here. For an already authorized module
implementation, return to `$carta-module-development` without inventing another
approval ceremony. New material decisions and additional write authority still
require user approval.
