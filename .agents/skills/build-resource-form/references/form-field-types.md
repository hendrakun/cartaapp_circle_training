# Form field type manifest

Read `docs/ui/forms.md` first. It owns the field implementation decision. Use
this manifest to identify the registered renderer or composite selected by that
decision.
The live renderer keys and app adapters are in:

- `packages/loom/src/renderers/form.ts`
- `apps/web/src/framework/inputs/registry.ts`

Use an input catalog if the app has one. The source files are authoritative when this manifest and the runtime differ.
Do not create a second renderer list in application code.

## Text and numeric values

| Renderer | Use it for | Value and configuration |
| --- | --- | --- |
| `text` | One-line text, email, telephone, URL, or native input type | string; `type`, `required` |
| `textarea` | Multi-line plain text | string; `required`, native textarea props |
| `password` | Secret text entry | string; `required` |
| `number` | Counts, measures, percentages, or other numbers | number; `min`, `max`, `step`, `required` |
| `currency` | Money entry with a visible currency format | number; `currency`, `locale`, numeric props |
| `tag` | A short string list entered as tags | string array; `placeholder` |
| `color` | A color value | color string; native color props |
| `rich-text` | Formatted text that the API stores in the approved rich-text shape | string; current catalog props |

Use `number` for numeric schemas. Do not use a text field and parse it by hand.
Use `text` with a native `type` only when the form contract still owns a string.

## Choice and relation values

| Renderer | Use it for | Value and common props |
| --- | --- | --- |
| `select` | A compact closed choice set | scalar or array; `source`, `pick`, `view`, `multi`, `searchable`, `clearable` |
| `radio` | A small exclusive set that must stay visible | scalar; `source`, `pick`, `view`, `variant`, `direction` |
| `checkbox` | One boolean agreement or flag | boolean; `required` |
| `switch` | One on/off value | boolean; `required` |
| `checkbox-group` | A small visible multi-choice set | array; `source`, `pick`, `view`, `searchParameters` |
| `lookup` | A searchable database-backed relation | scalar ID or code; owner resource `source`, `pick`, `view`, `searchParameters` |

Use a static source only for a small closed set owned by the form contract. Use
`lookup` for database rows and parent-filtered relations. The owner resource
must expose `list` and `detail`, and both actions must return the selected
identity and label. A multi lookup or select uses `selectionValues(exactItemSchema)` and keeps the
selected record array. A switch inside a form edits the draft; it does not
write immediately unless that interaction is explicitly implemented.

## Date and time values

| Renderer | Use it for | Value and common props |
| --- | --- | --- |
| `date` | One calendar date | date string; `required`, native date props |
| `daterange` | Start and end dates selected together | two date strings; `locale`, `required` |
| `month` | One year and month | `YYYY-MM` string; `required` |
| `year` | One year | number or year string; `required` |
| `time` | One time of day | time string; native time props |

Match the API schema to the value emitted by the input. Add `form.write` only
when the API contract uses another representation.

## Assets, location, and drawing values

| Renderer | Use it for | Value and required configuration |
| --- | --- | --- |
| `file` | One or more non-image uploads | asset object or array; app upload defaults, `multi`, `accept`, `maxSize` |
| `image` | One or more image uploads with previews | image asset object or array; app upload defaults, `limit`, `multi`, `maxSize` |
| `location` | One address and coordinate value | coordinate object; app `operations` |
| `multi-location` | Several address and coordinate values | coordinate object array; app `operations` |
| `icon-select` | One icon name from the current icon catalog | icon name string; current icon options |
| `canvas` | A drawing or signature saved as an image value | saved image string; `width`, `height`, `onSave` |

For file/image values, read the shared
[asset contract](../../carta-module-development/references/frontend-field-contract.md#asset-fields),
including current framework limits.
Location inputs use the app location operations. Use one `form.write` on the
owning field only when the API location shape differs from the control shape.

## Structured and layout values

| Renderer | Use it for | Value and required configuration |
| --- | --- | --- |
| `table` | An array of form-owned rows | row object array; `fields`, `form`, `table`, optional `rowKey` and reorder props |
| `separator` | A labelled section break in a form | no submitted value; label and layout props |

Use `table` and its row field catalog before you build manual repeatable rows.
Use a separate child resource when rows need their own permissions, paging, or
actions.
