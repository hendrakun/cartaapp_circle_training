# Surfaces and actions

Read `docs/ui/surfaces.md` before this implementation reference. Read
`docs/ui/collections.md` when the surface has filters, tabs, tables, or card
collections.

## Surface map

| Need | Use |
|---|---|
| Standard list | `ListView v-bind="resource.list()"` |
| Standard detail | `DetailView v-bind="resource.detail({ id })"` |
| Standard create or update | `FormView` with the matching action prop bag |
| Custom collection | `Table` or `ListView #collection`; `Table` keeps collection states |
| Custom record | `Detail` |
| Custom form | `Form` or `DialogForm` |
| Tree | `TreeTable` |
| List query controls | `ListView #filters` with `Form` or `ChipFilter` |
| Dialog, confirmation, button, card, feedback | Existing framework composite or base component |

## Standard resource path

Follow [action placement](../../../../DESIGN.md#actions-and-forms).

Resource actions are independent. Expose the actions required by the task;
a resource does not need all CRUD actions. Select the form surface from the
design rules for the required navigation and retained context.
Preserve existing route access unless it changes within the user request.

Use the module schema, one field catalog, and the app Hono adapter:

```ts
const api = createHonoResourceActions(rpc.items)
const fields = defineFields(itemsSchema, {
  name: { label: 'Name', form: { renderer: 'text' } },
})

export const items = defineResource(itemsSchema, {
  key: 'items',
  actions: {
    list: { run: api.list, fields: [fields.name], permission: 'view-items', route: { name: 'items' } },
    detail: { run: api.detail, fields: [fields.name], permission: 'view-items', route: { name: 'items-detail', params: (id) => ({ itemId: String(id) }) } },
    create: { run: api.create, fields: [fields.name], permission: 'create-items', route: { name: 'items-create' } },
    update: { run: api.update, fields: [fields.name], permission: 'update-items', route: { name: 'items-edit', params: (id) => ({ itemId: String(id) }) } },
    delete: { run: api.delete, permission: 'delete-items' },
  },
})
```

Use a generated route name that exists in `apps/web/route-map.d.ts`. Do not
pass `dataAdapter` to `createHonoResourceActions`; it already owns response
normalization.

Select field references in the visible order for each action. Omission removes
a field from that surface. Use one terminal `.override(...)` for one local
field difference.

## Action prop bags

Pass standard actions directly:

```vue
<ListView v-bind="items.list()" />
<DetailView v-bind="items.detail({ id })" />
<FormView v-bind="items.create()" />
<DialogForm v-bind="items.update({ id })" v-model:open="open" />
```

`Form` and `DialogForm` accept a structural `{ run }` action bag. Do not add a
wrapper such as `dialogFormOf`, and do not compose raw `Dialog` + `Form` when
`DialogForm` fits.

## Collection variants and action overrides

Use `ListView #collection` to show a card or grid view of the same loaded
collection. It keeps one `Collection` through `Table`, so do not start another
loader or rebuild query/cache state. The slot supplies records and standard
`actions`; use those actions instead of rebuilding route or permission logic.
The framework renders loading, error, and empty states before it invokes the
custom collection slot.

For a custom standard control in `ListView`, use:

- `#create-action` only to replace the standard Create action
- `#resource-action` for Import, Export, Download, and other resource actions
- `#row-actions-view`
- `#row-actions-edit`
- `#row-actions-delete`

The Create and resource-action slots share one right-aligned action row, with
Create first. A resource action does not replace Create. The framework owns
whether a standard-action override can render. The route owns how its control
looks and runs. Do not add a second permission `v-if` around override content.
A server record capability without a declared standard action or override does
not create a control.

Do not feed `ListView` a synthetic `run` that returns a local ref. Declare a
real scoped list action so collection caching, loading, errors, and query state
stay intact.

## Custom surfaces

For a tree or other surface outside standard Views:

- Use `resourceCan(resource)` from `apps/web/src/framework/access.ts` so the
  resource permission remains the single source.
- Use `errorMessage(error, fallback)` from the app normalization adapter.

Keep server-derived record actions or `allowedOperations` as the record-level
authority. API authorization still runs on submit. Each delete action declares its
permission or explicit `null`; each destructive control confirms the action.

## Filters and tabs

`ListView` uses the `filters` prop for its Filter button and popover. The
`#filters` slot renders a separate section; it does not enable that button.
Choose the supported surface before writing the browser interaction.

Follow `docs/ui/collections.md`. Keep query state route-local. Use
`ChipFilter` for a collection query and state its optional or required
selection contract. Use framework `Tabs` for one selected local surface or
presentation. Use the app routing Tabs component for route navigation.

## Collection content

Select collection content from [DESIGN.md](../../../../DESIGN.md#page-structure).

Keep search, filters, sorting, and paging in the collection query. Preserve
unrelated query keys when one filter changes and reset the page to one. A
local presentation switch preserves that query. Use the existing namespaced
URL adapter so sibling lists do not collide and shared links restore state;
query refinements normally replace the current URL. For a nested list, include its
parent in source parameters and cache identity; the server enforces the scope.
