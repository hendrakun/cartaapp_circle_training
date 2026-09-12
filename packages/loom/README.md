# @southneuhof/loom

Loom is the Vue application framework used by Carta. It provides schema-bound fields, resource actions, and reusable list, detail, and form surfaces for information systems.

The application still owns its routes, transport, workflows, and backend authorization.

```text
schema
  ↓
fields
  ↓
resource actions
  ↓
ListView / DetailView / FormView
  ↓
Table / Detail / Form
```

## Getting started

Loom is normally used inside a [Carta](https://github.com/southneuhof/carta) application, where it is already installed and configured.

A Vue application installs `FrameworkPlugin` once:

```ts
import { FrameworkPlugin } from '@southneuhof/loom'

app.use(FrameworkPlugin, {
  adapters,
  renderers,
  inputProps,
  fieldDefaults,
  uiDefaults,
})
```

All options are optional. Applications provide them when they need custom transport, access, query behavior, renderers, input props, or shared UI defaults.

## Define a resource

A Loom resource starts with a schema, a field set, and the application functions that perform its actions.

### Schema

`defineSchema()` describes the data used by standard resource operations.

```ts
import { defineSchema, fromZod } from '@southneuhof/loom'

export const rolesSchema = defineSchema({
  identity: 'id',
  record: { schema: fromZod(roleRecordSchema) },
  create: { schema: fromZod(createRoleSchema) },
  update: { schema: fromZod(updateRoleSchema) },
})
```

A schema can define record, query, create, and update contracts as needed.

`fromZod()` adapts a Zod schema to Loom's validation contract while preserving its inferred output type.

### Fields

`defineFields()` describes how schema fields appear on Loom surfaces.

```ts
import { defineFields } from '@southneuhof/loom'

const fields = defineFields(rolesSchema, {
  roleCode: {
    label: 'Role Code',
    form: { renderer: 'text' },
  },
  name: {
    label: 'Role Name',
    form: { renderer: 'text' },
  },
  description: {
    label: 'Description',
    form: { renderer: 'textarea' },
  },
})
```

A field can define behavior for display, table, detail, and form surfaces.

Fields are bound to their schema. Each resource action selects only the fields it needs.

### Actions

`defineResource()` connects the schema and fields to application actions.

```ts
import { defineResource } from '@southneuhof/loom'

export const roles = defineResource(rolesSchema, {
  key: 'roles',
  actions: {
    list: {
      run: rolesActions.list,
      fields: [fields.roleCode, fields.name],
    },
    detail: {
      run: rolesActions.detail,
      fields: [fields.roleCode, fields.name, fields.description],
    },
    create: {
      run: rolesActions.create,
      fields: [fields.roleCode, fields.name, fields.description],
    },
    update: {
      run: rolesActions.update,
      fields: [fields.roleCode, fields.name, fields.description],
    },
    delete: {
      run: rolesActions.delete,
    },
  },
})
```

The standard actions are:

```text
list
detail
create
update
delete
```

The application supplies each `run` function. Loom does not require a specific HTTP client or backend.

Additional actions can be added as ordinary application functions.

## Use the resource in a view

Standard resource actions return the props expected by Loom's views:

```vue
<ListView v-bind="roles.list()" />

<DetailView v-bind="roles.detail({ id })" />

<FormView v-bind="roles.create()" />

<FormView v-bind="roles.update({ id })" />
```

Delete is executed directly:

```ts
await roles.delete({ id }).run()
```

Action definitions can also carry route and permission metadata when the application uses those features.

Permission metadata controls presentation. The backend remains responsible for authorization.

## Views and core components

### Resource cache ownership

Resource factories pass a stable resource owner to list, detail, and form views. A successful standard create, update, or delete action invalidates the related resource data. Active reads then run again, and inactive reads become stale until the view uses them again.

The `namespace` prop separates URL query state and duplicate views of one resource. It does not replace the resource owner. Standalone core components can use a namespace as their local cache owner. Detail display reads and edit form reads stay separate because their field conversions can differ.

Loom provides two levels of UI components.

`ListView`, `DetailView`, and `FormView` provide the standard application surfaces used by resources.

`Table`, `Detail`, and `Form` are lower-level components. They can be used directly when a screen does not need a standard resource.

```text
ListView     → Table
DetailView   → Detail
FormView     → Form
```

Routes remain responsible for navigation, dialogs, confirmations, notifications, and workflow state.

## Renderers

Fields refer to renderers by key:

```ts
name: {
  label: 'Name',
  form: { renderer: 'text' },
}
```

`FrameworkPlugin` owns the renderer registries. Loom includes standard form renderers, and applications can register their own renderers for table, detail, or form surfaces.

This keeps field definitions independent from specific Vue component implementations.

## Asset fields

Built-in `file` and `image` fields keep the same asset object shape through
read, edit, and submit. A single field holds one asset object (or `null` when
allowed); a multi field holds an asset array with `props: { multi: true }`.
Controls preserve every received asset property, keep array position as UI
order, and add no category, row identity, or ordering property.

Asset fields allow no `form.write`. The server extracts storage IDs from the
submitted objects. Form blocks submit while an upload, model conversion, or
model commit is pending, exposes that state as `inputPending` through Form,
its actions slot, FormView, and DialogForm, and never queues a partial submit.
Cancellation still closes DialogForm. The executable boundary example is
`apps/web/src/framework/adapters/assets.form.spec.ts`.

## Application boundary

Loom does not own application transport.

A resource action can call a Hono client, `fetch`, a service function, or another data source:

```ts
export const rolesActions = {
  list: api.list,
  detail: api.detail,
  create: api.create,
  update: api.update,
  delete: api.delete,
}
```

Loom receives those functions and handles the standard UI contract around them.

The application owns:

* transport and response normalization
* URLs and navigation
* business workflows
* application permissions
* custom actions

The backend remains the authority for validation and access control.

## Package exports

| Import                           | Purpose                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `@southneuhof/loom`              | schemas, fields, resources, views, core components, query APIs, and framework configuration |
| `@southneuhof/loom/components/*` | component subpaths                                                                          |
| `@southneuhof/loom/renderers/*`  | renderer APIs                                                                               |
| `@southneuhof/loom/adapters/*`   | application adapters                                                                        |
| `@southneuhof/loom/router/*`     | router utilities                                                                            |
| `@southneuhof/loom/services`     | shared service helpers                                                                      |
| `@southneuhof/loom/utilities/*`  | framework utilities                                                                         |
| `@southneuhof/loom/styles/*`     | framework styles                                                                            |
| `@southneuhof/loom/file-manager` | optional file manager                                                                       |

## Documentation

The current Loom application architecture is documented in the Carta monorepo:

* [Web application architecture](https://github.com/southneuhof/carta/blob/main/docs/architecture/web-application-architecture.md)
* [Carta](https://github.com/southneuhof/carta)

Loom is developed in the Carta monorepo.
