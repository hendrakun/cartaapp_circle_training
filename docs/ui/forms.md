# Forms

Read this file for form fields, defaults, labels, actions, and structured input
selection.

## Standard form path

Select the form surface and action placement from
[DESIGN.md](../../DESIGN.md#actions-and-forms). The View supplies its navigation
header. Framework forms use the app dictionary for default action text.

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
