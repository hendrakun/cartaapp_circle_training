# Custom workflows

Add custom workflow behavior to the
[standard module base](../../carta-module-development/references/standard-module.md).
Keep rules and YAML records in the existing work record. Use names to reference
shared conditions; IDs and the full inventory are needed only when a scoped
[module contract](module-contract.md) already requires them.
The templates below show available properties, not a required field checklist.
Keep only properties needed to settle the action and its checks.

For stateful behavior, define each state variable, initial value, valid combinations
and terminal states. Give named conditions exact predicates. Use:

| Transition ID | From state | Action | Condition | To state | Effect references |
|---|---|---|---|---|---|

Reference shared rules from the existing record. Apply workflow restrictions to
standard CRUD actions as well as custom actions.

Specify no-match rejection and overlapping-condition precedence, or make conditions
exclusive. For joins, define completion; for returns, define retained and cleared
values. A linear resource needs no artificial state machine.

For each completion condition, define the evidence or authorized confirmation
that establishes it. For return/resubmit paths, state which prior decisions and
reasons remain available after another cycle. Check terminal-state restrictions
against every action, including attachment and metadata writes. Reference these
conditions from action records so transitions and actions use the same rule.

## Custom workflow action records

Use one record per custom workflow action. Include applicable properties; omit
sections for absent retry, concurrency or external behavior. Expand
conditions and effects into referenced records when several actions share them.
Use field/value maps and condition/result rows, not paragraphs inside scalar values.
Separate alternatives into rows. Reference data-table rules instead of copying them.

```yaml
id: B-01
workflow: W-01
name: <business action>
access:
  actor: <permission or role>
  scope: <record ownership predicate>
  assignment: <predicate or NONE>
  denied: <observable result; unchanged data>
input:
  fields: <field names mapped to data-table rules and action-specific overrides>
  unknown_fields: <reject or ignore>
preconditions:
  - condition: <exact predicate or condition ID>
    otherwise: <rejection result; unchanged data>
effects:
  set: <field-to-value map or NONE>
  clear: <field names or NONE>
  create: <record types and field-to-value maps or NONE>
  delete: <record selection or NONE>
  preserved: <other relevant data>
  transaction: <coupled writes and rollback boundary>
  transitions: <transition IDs or NONE>
  external: <delivery, failure and recovery rules or NONE>
repeat:
  result: <duplicate/retry outcome>
  effects: <write changes and effect counts>
concurrent:
  outcomes: <allowed final outcomes>
  preserved: <effects that cannot be lost or duplicated>
result: <returned data and visible outcome>
ui:
  entry: <route or surface>
  parent_visibility: <retained pages or NONE>
  back: <target or NONE>
  control:
    label: <framework default, or confirmed exact text and source>
    visible: <predicate>
    enabled: <predicate>
  fields: <editable/read-only fields; defaults; dependent lookups>
  states: <loading, empty, denied and error behavior>
  success: <confirmation, navigation, refresh and reload behavior>
  failure: <feedback, input preservation and recovery>
acceptance: [<acceptance IDs>]
```

Use `ui: NONE` for headless actions and define the consumer result instead.
Specify required display data and unaffected interfaces. Apply Carta navigation
and visual conventions by reference where they settle the result.

## Workflow acceptance

```yaml
id: A-01
rules: [<behavior, transition or invariant IDs>]
given:
  actors: <named actors mapped to identity, permissions and scope>
  records: <named records mapped to concrete field values>
when:
  - actor: <fixture actor>
    action: <action ID>
    input: <field-to-value map or NONE>
expect:
  result: <exact observable output or rejection>
  stored: <record/field-to-value map and effect counts>
  unchanged: <data that must remain unchanged or NONE>
  visible: <UI result or NONE>
```
