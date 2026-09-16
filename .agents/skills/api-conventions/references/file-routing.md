# Backend file routing

## Ownership

`apps/api/src/routes` owns HTTP locations. Each `+server.ts` exports named HTTP
methods. Directories supply URL segments; `(group)` adds no segment; `[id]`
supplies a parameter. A default `defineScope(...)` export in `+scope.ts` applies
to that directory and its descendants.

```text
routes/
  +scope.ts                         identity resolver
  health/+server.ts                 GET /health
  (authenticated)/
    +scope.ts                       session guard
    roles/
      +scope.ts                     entity and shared record conversion
      list/+server.ts               GET /roles/list
      detail/[id]/+server.ts         GET /roles/detail/:id
```

Keep request context, identity, entity, shared authorization, and hooks in the
scope that owns their descendants. Keep operation permission and persistence
choices in the route. Ordinary helper and service files do not create routes.

Database domains remain explicit in `apps/api/src/domains.ts`. Permissions and
web navigation have separate owners. Adding a route requires no route registry.

## Authoring

Developers must be able to add, move, or delete a route without knowing generation
exists. Use normal project commands and public package imports. Context, identity,
entity, and parameters must infer from the file tree: no generated imports,
manual generation, per-route type plumbing, or registry edits.

A move can change both URL and inherited access. Check the old and new parent
chains and affected consumers. Preserve existing URLs unless the requested
behavior changes them. A public SDK import owns consumer types; clients do not
import backend source files or private artifacts.

These complete files use the existing role entity:

```ts
// routes/(authenticated)/roles/+scope.ts
import { defineScope } from '@southneuhof/sprindle'
import { role } from '../../roles/roles.entity'

export default defineScope({ entity: role })
```

```ts
// routes/(authenticated)/roles/list/+server.ts
import { list } from '@southneuhof/sprindle'
import { requirePermission } from '../../../../identity'

export const GET = list({ authorize: requirePermission('list-roles') })
```

```ts
// routes/(authenticated)/roles/detail/[id]/+server.ts
import { detail } from '@southneuhof/sprindle'
import { requirePermission } from '../../../../../identity'

export const GET = detail({ authorize: requirePermission('detail-roles') })
```

`list({})` and `detail({})` use the inherited entity and hooks. The empty object
adds no operation permission. Detail, update, and delete use `id`; set `param`
when the directory parameter has another name.

A custom HTTP action uses `defineRoute({ action, ... })`. It has no `method` or
`path` option:

```ts
// routes/health/+server.ts
import { defineRoute } from '@southneuhof/sprindle'

export const GET = defineRoute({ action: () => ({ ok: true }) })
```

Keep callbacks inline when they need inferred scope types. Extract business
operations with explicit business inputs, not copied route-context types.

## Inheritance and hooks

Context is created per request. Child fields replace equal parent keys. Each
scope's hooks retain that scope's context and identity view; a child replacement
does not change the parent view. Each identity resolver is memoized per request.
Parent authorization rejection stops child
context work. Error hooks unwind only through entered scopes.

Order: scope context and authorization, route authorization, canonical state
parsing, server write values, `before`, `validate`, action, operation `after`.
`before` and `validate` run from parent to child; `after` runs in reverse.
Use Hono middleware for headers, cleanup, and behavior required on all responses.

A new entity clears inherited record enrichment. An enrich-only scope replaces
the inherited converter. Canonical results pass through scope conversion, then
route enrichment, then the envelope. See [public records](public-records.md).

Keep `entity`, `enrich`, `identity`, `pipeline`, and `source` out of returned
business context; these keys are reserved. Use supported `state.where`
and `state.values` for canonical read/write constraints; arbitrary context keys
do not change source behavior.
