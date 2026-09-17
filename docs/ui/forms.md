# Forms

Read this file for form fields, defaults, labels, actions, and structured input
selection.

## Standard form path

Select the form surface and action placement from
[DESIGN.md](../../DESIGN.md#actions-and-forms). The View supplies its navigation
header. Framework forms use the app dictionary for default action text.

## Dialog forms

Let `DialogForm` own its visibility for an ordinary contextual form. Supply the
action, title, and trigger. For a row action, render one keyed dialog for each
record:

```vue
<DialogForm :key="record.id" v-bind="items.update({ id: record.id })" title="Edit item">
  <template #trigger>
    <Button>Edit</Button>
  </template>
</DialogForm>
```

One dialog per record is the normal path. It keeps record identity and draft
state local to that action. A shared selected-record ref is not necessary.

Keep a custom submit target limited to the write. Start later cache invalidation
and refetch from the `submitted` event. Report its failure as stale data. Do not
rerun the write:

```vue
<DialogForm
  :fields="fields"
  :schema="schema"
  :submit="saveEvaluation"
  title="Add evaluation"
  @submitted="invalidateAfterSave"
>
  <template #trigger>
    <Button>Add evaluation</Button>
  </template>
</DialogForm>
```

```ts
const staleDataError = ref<string>()

async function invalidateAfterSave() {
  try {
    await evaluations.invalidate()
  } catch (error) {
    staleDataError.value = errorMessage(error, 'Saved, but current data could not be refreshed.')
  }
}
```

A failed validation or write keeps the dialog and its draft available. A
successful write closes the dialog before `submitted` listeners run. Use the
named `v-model:open` only when another page control must coordinate visibility.
This controlled form is the advanced option; it keeps the same validation and
completion behavior.

## Field defaults

Select each schema field needed by the action. When a selected field has no
resource override, the app field default owns its renderer, label, props, and
initial value. This rule applies to recurring fields such as `active`.

A resource defines a recurring field only when that resource needs behavior
that differs from the app default. The presence of the field in the action is
not an override.

Use the registered framework renderer for each value. Calendar dates use the
framework `date` renderer. Arrays of form-owned editable rows use the
framework `table` renderer and `TableInput`.

## Labels and instructions

The outer form field owns the visible label, required state, error, help text,
and grid span. A nested input or custom field renders the control only. This
keeps one visible label for one field.

Use disabled, hidden, and validation states to communicate field dependencies.
Instructional prose follows [DESIGN.md](../../DESIGN.md#text-and-spacing).

## Select a field implementation

Use the first option that expresses the complete value contract:

1. A registered renderer with its source, props, and behavior.
2. A framework composite.
3. The `table` renderer and `TableInput` for editable row arrays.
4. A module-owned custom field composed from framework inputs.
5. A new framework primitive after an approved framework gap.

After selecting a custom field, read the local
[custom field contract](../../.agents/skills/build-resource-form/references/custom-field-contract.md).

## Custom form pages

Apply [DESIGN.md](../../DESIGN.md#actions-and-forms) to custom form pages.
The outer form retains field-label ownership when its body uses custom slots.
