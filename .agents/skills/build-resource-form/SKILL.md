---
name: build-resource-form
description: Build or review Carta form values, validation, relation sources, dependent inputs, custom fields, and child writes.
---

# Build resource forms

Read [DESIGN.md](../../../DESIGN.md) before selecting form layout or controls,
including when this skill is used directly for a custom action.

Apply [discovery reuse](../carta-module-development/SKILL.md#discovery-reuse).
Trace the changed value through its API schema, resource and route; reuse
current pattern decisions from the plan. Read the field contract in
`packages/loom/README.md` when its shape is unresolved, and
`apps/web/src/framework/inputs/registry.ts` when renderer registration or defaults
are unresolved. Use [web-ui-surfaces](../web-ui-surfaces/SKILL.md) for changed
page composition and `docs/ui/forms.md` for an unresolved app form default.

## Define the value contract

Bind standard resources with app `defineSchema` from `@/framework/schema`.
Pass raw Zod schemas; the app seam calls `fromZod` and infers parsed types.
A Hono route or an explicit custom contract supplies the expected types.
For non-asset fields, add a local form transform only when the control and API
shapes differ.
Keep custom action schemas separate from standard CRUD schemas.

For file/image fields in standard or custom actions, read the
[asset-object contract](../carta-module-development/references/frontend-field-contract.md#asset-fields)
before selecting the write schema. Use that contract to resolve an input mismatch.

Use one `defineFields` catalog. Select only each action's fields in its required
order. A schema key string uses the app field default; a field reference adds
module behavior. One terminal `.override(...)` handles one action difference.
Keep `display.read` for display projection and `form.write` for necessary submit
conversion. Omit identity functions and copied input/output type wrappers.

For state-dependent inputs, supply the current record through form context.
Match required state and submit validation to the server predicate, including
previously retained values. Help text alone does not enforce a required input.

Account for every required write value: user input, fixed parent context, or
server-owned data. Show editable required fields. Supply fixed values through
`initialData`; keep server-owned values out of client write schemas. Do not add
hidden controls merely to satisfy a schema.

Use `form.initialValue` for a fresh omitted-key default. Loaded values and
explicit `false`, `null`, or empty values must win. The draft stores control
values; the submit copy passes through the field writer, schema, then business
validators. A failed submit must preserve the draft.

## Select controls

Custom business operations use the same framework forms and controls as CRUD.
Give the operation its own schema and action; let the form own input, validation
and pending state. Use local UI code only for a named requirement that registered
renderers and existing composites cannot meet. Record that gap in the existing
work record before implementing the exception.

Read [field choices](references/form-field-types.md) when selecting a new control
or resolving a value mismatch.
Use the registered renderer, then an existing composite. Use `table`/`TableInput`
for form-owned row arrays. If those cannot express one domain value, use the
[custom field contract](references/custom-field-contract.md).

The outer form owns label, required state, error, help, and grid span.

Define custom-action fields through the supported typed field builder or an
explicit field type at declaration. Check renderer and renderer-prop placement
against that contract; assigning a loose object to a component is not proof
that its configuration keys are used.

Apply the [framework-first composition rule](../web-ui-surfaces/SKILL.md#framework-first-composition)
once per form pattern. Select the form surface from
[DESIGN.md](../../../DESIGN.md#actions-and-forms).
Pass the standard action bag directly. Use a `DialogForm` trigger slot without
`v-model:open` for ordinary contextual forms, and render one keyed form per
record action. Let the form own draft, validation, pending state, visibility,
and completion. Use controlled visibility only when another page control must
coordinate it. Read [the dialog form contract](../../../docs/ui/forms.md#dialog-forms)
for that advanced path.

For a custom submit, trace write success, form completion and data refresh in
order. Start later refresh work from `submitted`; keep it separate from the
write so refresh rejection reports stale data and does not retry the write.
Use the supported loading and invalidation path from
the [query-cache contract](../carta-module-development/references/web-query-cache.md).
Report a failed write separately from a failed refresh after a successful write.

## Configure relation sources

For each new or changed relation, use the
[complete display/form pattern](../web-ui-surfaces/references/fields.md).
Complete its API display data and list/detail projection with the form, rather
than leaving display work for a later assignment.

Use the owner resource as `source`. Its `list` action supplies server search and
paging; `detail` resolves a selected record outside the current page. Static
arrays are for closed choices, not database collections. Pass filters through
`searchParameters`; the owner endpoint owns their contract.

For a parent-dependent field:

```ts
behavior: {
  disabled: ({ draft }) => !draft.divisionId,
  props: ({ draft }) => ({ searchParameters: { divisionId: draft.divisionId } }),
  resetWhen: ({ draft }) => draft.divisionId,
},
```

Use pure synchronous behavior. `visible` controls field presence and submission;
`disabled` controls editing; `derived` calculates a non-editable value. Hidden
fields are omitted, so the schema and server must agree on conditional values.
If several dependencies can invalidate a child, the reset key must reflect
each one; a truthy `a || b` expression can hide changes to `b`.

Use `context` for stable screen information. Standard create/update actions
supply reserved `context.operation` and `context.permission`. Where the source
requires action scope, use that permission rather than a hard-coded create
permission. The server validates it; a query parameter grants no authority.

For multi lookup/select, use `selectionValues(exactItemSchema)`: keep exact
selected record objects and submit them unchanged. Do not add an ID-array
writer.

## Connect writes

Read [backend form contract](references/backend-form-contract.md) when a source
or write contract changes. Use a custom action for a distinct domain operation,
not another options endpoint. Give it only its actual input fields. Keep state
checks and atomic parent/child writes on the server. A child with independent
screens or permissions needs its own resource; a row owned by one form does not.

Continue authorized implementation choices. Ask only for a missing decision
that changes business behavior, access, or transaction semantics. A framework
package change needs explicit scope; a supported local custom field does not.

## Verify

Use [UI verification](../web-ui-surfaces/references/verification.md). Select a
check that can fail on the changed value or interaction: dependency reset,
selected-record hydration, conditional submit, row edit, or failed-save recovery.
Check server rejection of a forged relation when the write boundary changes.
Do not add tests that merely copy field order, labels, renderer names, or action
objects. Reuse existing evidence for unchanged framework behavior.
