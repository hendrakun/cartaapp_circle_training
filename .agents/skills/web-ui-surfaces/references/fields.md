# Display fields

Before selecting display settings, read `apps/web/src/configs/defaults.ts` and
`apps/web/src/framework/fields/renderers.ts`. Use `apps/web/src/main.ts` to
confirm registration when needed. These files own the current formats and
renderer keys. A form renderer does not configure table or detail display.

For each visible field, trace the returned value through its app default,
shared `display` settings, and any `table` or `detail` override. Finish when
each selected field produces readable output on both surfaces where it appears.
For assets, check empty, single, and multiple values as applicable. For states,
check each label and colour. Reuse the registered renderer before adding a slot.

A relation is complete when the user can select its label, save its identity,
see its name in list and detail, and load that selection on edit. Treat these as
one implementation result. Verify with a real named record before reusing the
pattern. Lookup configuration alone covers only the input side.

Use `defineFields(schema, definitions)` for shared labels and projections.
Select field references in each action's visible order. Use a schema key string
when the app default supplies all needed configuration. Use one terminal
`.override(...)` for an action-specific difference.

`display.read` projects returned data; without it, the field reads its own key.
Keep the submitted relation identity separate from its display label:

```ts
projectId: {
  label: 'Project',
  display: { read: (record) => record.project?.name },
  form: {
    renderer: 'lookup',
    source: projects,
    props: { pick: 'id', view: 'name', required: true },
  },
}
```

Request the relation in the API read contract. Do not fetch one label per row
or replace a missing relation with an unexplained raw ID. A missing optional
value uses the app's empty-value convention.

Keep status labels and formats with their field definition. Static enums can
use local options. Let the schema infer record types; fix a missing projection
at its contract instead of casting records to `any` or fields to `never`.

Form controls and display fields have separate contracts. Check list and detail
output with representative returned values. Use the app display defaults or a
supported renderer/format for dates, times, files and structured values. Preserve
the date's time basis, show relation labels, and expose file names with the
required preview or download action. Include required workflow results and
history in the visible field selection. Verify these outcomes through the
[UI checks](verification.md), rather than asserting field configuration.

For form values and dependencies, use
[build-resource-form](../../build-resource-form/SKILL.md).
