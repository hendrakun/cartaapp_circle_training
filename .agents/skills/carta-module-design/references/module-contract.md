# Module contract

This is the full-process contract for a scope that needs explicit traceability.
Start with the [standard module base](../../carta-module-development/references/standard-module.md),
including custom workflows. A relation, filter or custom action alone does not
require this inventory. Record the scope covered here and reference the rest.

`plans/<feature>/design.md` owns intended behavior and approval. Plans own
technical decisions; the worksheet owns progress; reports own observed results.
Use tables for data, standard CRUD actions and their acceptance cases. Use YAML
only for custom workflows. Use Mermaid when it clarifies a branched workflow;
diagrams reference the authoritative rules.
Existing approved artifacts can retain their format when they meet this contract.

## Record rules

Assign stable IDs to workflows (`W-01`), behaviors (`B-01`), transitions (`T-01`),
invariants (`I-01`) and acceptance cases (`A-01`). Define each rule once and link
its consumers. Keep reasons and source notes outside executable conditions.
IDs are unique across the design. Tables can repeat under resource headings;
the checker combines tables with the same header and rejects duplicate IDs.
A blank required property is incomplete. `NONE` is an explicit absence;
`UNRESOLVED` blocks affected work. An unchanged contract reference names its
path and symbol or rule ID. Define technical terms before using them.

## Authority and scope

Record feature, revision, status (`DRAFT`, `APPROVED`, `BLOCKED`), approval source,
date and scope. Separate current behavior from intended changes. A new entity
does not imply additional CRUD actions, collections or administration screens. Record actors,
entry points, outcomes, exclusions, affected owners and consumers using
[context discovery](context-discovery.md).

| Claim ID | Statement | Authority | Source | Affected IDs |
|---|---|---|---|---|

Authority is `OBSERVED` for current evidence, `CONFIRMED` for user requirements,
`PROPOSED` for recommendations, or `UNKNOWN` for missing knowledge. Use one
classification per claim; separate observed facts from proposed decisions. Record conflicts
and their resolution. Approval identifies the exact revision; silence is not approval.

Trace supplied process branches and UI requirements to rule IDs or explicit
exclusions. When sources differ, name which source governs each affected behavior.
Treat an inferred rule as a proposal until confirmed; general approval does not
resolve contradictory rules within the same revision.

## Data tables

For each new or changed entity, name its meaning, owner and identity. Use:

| Field | Meaning | Stored type / values | Initial value | Required by action | Writable by action | Omitted / null input | Uniqueness scope / derivation |
|---|---|---|---|---|---|---|---|

| Relationship | Cardinality | Owner | Valid references | Parent-change effects | Delete / recovery effects |
|---|---|---|---|---|---|

Specify precision, units, time basis and rounding where meaningful. Include
migration of existing data, retained file keys versus URLs, dependent selection
clearing, and mutable versus derived values where applicable. Reference unchanged
schema owners instead of copying them.

## Workflow inventory

List every in-scope branch, invariant and required sequence in this coverage table.
Use one row per obligation; `Obligation` is a unique ID, including workflow path
IDs such as `W-01.normal`. Include alternative entry points, return/resubmit paths,
permitted prerequisite orders and cross-module effects when they exist.

| Obligation | Rule references | Acceptance IDs |
|---|---|---|

Keep this legacy checker table empty in module delivery:

| Journey | Obligation | Acceptance IDs | Distinct interaction |
|---|---|---|---|

Reason: E2E is outside module delivery under the
[verification boundary](../../carta-module-development/references/verification-strategy.md#browser-journeys).
Describe UI behavior in action records, not browser test mappings. On resume,
move old journey obligations to separately scoped work; do not mark them passed.

Present this inventory during design review. The worksheet checker cannot discover
business work omitted here. Explicit exclusions belong in scope, not this table.

Every defined behavior, transition and invariant must appear in the inventory's
Rule references. Use exact IDs, not ID ranges.

## Shared rules

Define a condition used by several actions once, as an invariant:

| Invariant ID | Condition that must remain true |
|---|---|
| I-01 | Each newly selected division is active when the write occurs. |

Use the existing I-ID family. State when the condition applies, including whether
it applies to existing records or only new selections. Action and acceptance rows
reference the ID; field definitions remain the owner of field rules.

## Standard CRUD actions

Use one row per requested List, Detail, Create, Update or Delete action:

| ID | Action | Access and scope | Inputs | Rules or exceptions | Expected result | Acceptance IDs |
|---|---|---|---|---|---|---|

Reference field definitions for requiredness, defaults, writable fields and
omitted/null values. Define shared rules once. Add UI entry, visible inputs and
save/reload outcomes once per distinct interaction. Reference unchanged Carta
behavior by its owner instead of copying it into every action.

An immutable field, relation constraint or custom filter stays in this table.
Choose YAML when an action implements a custom workflow with conditions,
transitions or coupled effects. A feature can contain both formats.

## Custom workflows

For custom conditions, transitions or coupled effects, read
[custom-workflows.md](custom-workflows.md). It defines the workflow state and
YAML action/acceptance records. Load it only for that part of a mixed module.

## Acceptance records

Expected values come from confirmed rules and worked examples, not implementation.
Cover each independent condition, transition branch and invariant. Include boundary
and rejection cases that distinguish plausible wrong results, plus complete sequence
cases where isolated action tests cannot prove the workflow.

For standard CRUD, use one independently checkable outcome per row:

| ID | Rule references | Given | Action and input | Expected result and stored/unchanged values | Required visible result |
|---|---|---|---|---|---|

Several rows can share a test when its assertions prove each outcome. Use
concrete values that distinguish plausible faults. Include allowed and denied
access, omitted and cleared values, and retained values where the rules require
them. Custom workflow acceptance follows the linked workflow reference.

## Boundaries and readiness

Record interfaces to preserve, permitted environments, and technical decisions
reserved for planning. The planner settles architecture; the executor receives
routine coding freedom only. Framework edits and external/destructive writes
require explicit authority; design approval does not authorize deployment.

Ready means all inventory obligations have acceptance cases, each action and
invariant has one unambiguous definition, sources and owners are identifiable,
and no in-scope business decision remains unresolved. Review conflicts and missing
behavior, not headings alone. Record the approved revision and decision sources.
A changed rule reopens its affected approval, plans and evidence; preserve valid work.
Only new or changed business decisions need approval. Technical completion of a
record preserves the existing approval scope.
