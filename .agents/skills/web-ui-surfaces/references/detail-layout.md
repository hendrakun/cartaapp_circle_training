# Workflow detail layout

Read [DESIGN.md](../../../../DESIGN.md#page-structure) for detail composition.
`DetailView` exposes controls and `value:<key>` slots. Check these extension
points before selecting the lower-level `Detail` component. Use the
[field contract](fields.md) to configure attachment display.
Use the [file-routing convention](file-routing.md) when a detail page owns
child routes, tabs, or Back behavior.

## Loading and updates

Start from `resource.detail({ id })`. For a custom loader, pass the returned
namespace, identity, search parameters, and run function to `recordKey` and
`useLoader`. Preserve inferred record types. Keep identity and cache context
reactive if the router reuses the component for another record.

Standard writes invalidate their resource. After a custom write, await the
resource invalidation described in the shared
[cache contract](../../carta-module-development/references/web-query-cache.md).
Check whether the active custom loader needs an explicit refresh. Do not add
both broad and record invalidation without checking what each already covers.
Refresh related resources only when their displayed data changed.

## Actions

Follow [action placement](../../../../DESIGN.md#actions-and-forms).
Show only actions allowed for the current record. Use server
capabilities for record decisions, and repeat authorization on submit.

Each action has its own input
schema and field set. If the clicked action fixes a value, do not ask for that
value again.

Keep load and write failures visible
through the existing error formatter. A custom body must supply loading,
error, unavailable-record, and retry behavior that a standard View would own.
