# Workflow detail layout

Start with `DetailView` for record display. Extend its supported controls and
`value:<key>` slots; place related sections beside it. Several sections alone
do not require a custom record shell. Use `Detail` within custom composition
only for a named requirement that `DetailView` and adjacent sections cannot meet.
Use the registered file renderer or `FileComponent` for attachments. Keep the
record summary first. A main/sidebar grid is useful
when short workflow controls sit beside long content; a single column is also
valid. Do not duplicate the same attachments or fields in several sections.
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

Follow the [standard action placement rule](../SKILL.md#framework-first-composition).
Group workflow actions by purpose and show only actions allowed for the current record. Use server
capabilities for record decisions, and repeat authorization on submit.

Use `DialogForm` for a short contextual action. Each action has its own input
schema and field set. If the clicked action fixes a value, do not ask for that
value again. Use `FormView` for an independent or long form.

Keep load and write failures visible
through the existing error formatter. A custom body must supply loading,
error, unavailable-record, and retry behavior that a standard View would own.
