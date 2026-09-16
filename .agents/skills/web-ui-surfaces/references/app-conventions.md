# App conventions

Read for app shell or visual composition work. Read
[DESIGN.md](../../../../DESIGN.md) for visual rules and section placement.

## Shell and navigation

Read [shell and navigation](../../../../DESIGN.md#shell-and-navigation) before
changing the app shell.

Use the typed navigation manifest for menu labels, groups, order, routes, and
permission visibility. Use generated route names for links. Derive breadcrumbs
and active navigation from routing data; do not maintain parallel URL maps.
Use the [file-routing convention](file-routing.md) for retained parents and
replacement pages.
The API still checks access when a hidden page is requested directly.

## Content and overlays

Apply [access and feedback](../../../../DESIGN.md#access-and-feedback).
Use the component portal and layer
contract for overlay placement. Check display values through the
[field contract](fields.md).

## Interaction and feedback

Trace action state through the owning View or form. Confirm that pending,
failure, retry, and refresh behavior meets
[DESIGN.md](../../../../DESIGN.md#access-and-feedback). Reuse the app error
formatter and resource invalidation contracts.
