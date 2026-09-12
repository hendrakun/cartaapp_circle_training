# Backend form contract

Read when a form changes its source or write API. Use
[api-conventions](../../api-conventions/SKILL.md) for backend implementation;
this reference covers the web/API connection.

## Standard transport

Use `createHonoResourceActions(rpc.<owner>)`. It owns query serialization,
identity, cancellation, and response normalization. Check its current typed
route shape in `apps/web/src/framework/hono` before changing an endpoint.
Do not add another data adapter argument or hand-written CRUD transport.

Expose only the actions the app needs. A read schema includes the labels and
relations required by the screen. Write schemas exclude server-owned values.
Malformed requests remain validation errors; do not replace invalid JSON with
an empty object.

## Sources

A database field uses the owner's standard list/detail pair, not a consumer
options endpoint. Add required owner filters within the authorized behavior.
The consuming form passes values; it does not duplicate the query schema.

List search, parent filters, access scope, sort, paging, and total must describe
the same result set. Detail must resolve an authorized selected record outside
the current page. Agree on how an existing inactive selection is displayed
without making it eligible for a new selection. Keep access checks on both paths.

The lookup uses API `list-*` and `detail-*` access. Resource screen permissions
remain the app's declared navigation policy. A user can need an authorized
lookup without access to the owner's management screen.

## Submit

A filtered list is not write authorization. The server checks every submitted
identity, its parent relationship, current state, and actor access. It extracts
IDs from canonical selected objects and ignores their client display labels.
For uploads, read the shared
[asset contract](../../carta-module-development/references/frontend-field-contract.md#asset-fields).
The server validates ownership and use. Test the real form schema and submit
boundary: capture the request object, pass it to the API write schema, and check
the stored identity. Keep form parsing, field writers and serialization real in
this check; a direct call to a mocked action cannot prove this boundary.

Keep a multi-row operation atomic when partial success would violate the task.
Use a distinct custom action schema when input, permission, or state transition
differs from CRUD. After success, the route refreshes affected data through the
resource cache contract. Preserve the distinction between a failed write and a
successful write whose refresh failed.

Choose backend checks from the shared
[verification strategy](../../carta-module-development/references/verification-strategy.md).
At this boundary, useful cases include a forged parent-child pair, an existing
selection outside page one, and rollback after a child write fails. Do not
repeat the same rule in route, service, source, and browser test suites.
