# File routing

Use file placement to set the URL and the rendered parent chain. Apply the
ordinary folder pattern to new child CRUD pages unless the required behavior
calls for replacement of a parent. A completed app is evidence of behavior;
check its route pattern against this convention before copying it.

## Place the page

A folder adds URL segments. Its `index.route.vue` is a replaceable default
page. A route file beside a matching folder retains that page as a parent.
Use `AppRouterView` in retained Carta record pages for the existing identity
and refresh behavior. The route validator also accepts native `RouterView`.

For User Detail with a Roles List, use:

```text
users/[userId]/detail.route.vue
users/[userId]/detail/roles/index.route.vue
users/[userId]/detail/roles/[roleId]/detail.route.vue
```

Opening Role Detail keeps User Detail and replaces Roles List. If Role Detail
has its own children, its matching `detail/` folder retains Role Detail too.
The same rule applies at each depth.

Use native dotted file segments when a destination must leave a matching
rendered parent and keep its URL segments. The containing folder sets which
higher parents remain. These are alternative placements for a destination:

| Visible result | Route file |
| --- | --- |
| Replace User Detail and its children | `users/[userId]/detail.roles.[roleId].detail.route.vue` |
| Keep User Detail; replace Role Detail and its children | `users/[userId]/detail/roles/[roleId]/detail.permissions.[permissionId].detail.route.vue` |

Keep one placement per destination. Use this file structure instead of a
replacement flag, route metadata switch, or a second layout system. Existing
sibling workflow pages can stay flat when they already give the required
result; they do not need dots unless a matching rendered parent must be left.

Preserve existing URLs and explicit route names during migration. Generated
names use static URL segments, including those in dotted files. Equivalent
nested and dotted placements get the same generated name. For a parent and
empty index with the same name, the index keeps the name and the parent becomes
unnamed. Named navigation then opens the default page.

Generation rejects duplicate names, duplicate page paths, layout collisions,
and rendered parents without an outlet. An empty index may share its parent
URL; a conditional outlet is valid. Correct the file structure when generation
fails instead of adding a second name or suppressing validation.

## Navigation and page lifetime

Use the app routing `Tabs` with `RouteTab` named targets. Missing parameters
come from the current route; explicit target parameters take precedence. Tabs
replace bare-parent entry with the first available child. With no available
child, the parent stays visible. A tab stays active on detail, edit, and deeper
pages within its section while its owner remains matched at the same identity.

Use the resource's scoped collection `backTo` for page Back, including after
parent replacement and on direct entry. A workflow without a routed collection
supplies an explicit target and preserves its selection query. Browser Back
uses history. The URL hierarchy alone does not define the page Back target.

Changing a parent ID remounts that parent and its descendants through
`AppRouterView`. Changing a child ID keeps higher parents mounted. Query and
hash changes keep the current pages mounted. Reuse the existing outlet keys
and scoped refresh behavior.

File ancestry does not grant access or prove API scope. Keep route guards,
resource access, and API checks. Router code in `apps/web` is project-owned;
a change in Carta upstream does not migrate another application.

## Verify changed behavior

Check generated URLs, names, parameters, and rendered parents. For changed
nesting, use mounted tests to prove which parents remain or unmount and that
page Back restores the scoped list. Cover direct entry, browser Back, identity
changes, and query/hash changes where affected. For changed tabs, check active
sections, explicit parameters, and bare-parent entry with no available child.
Prove denied entry with the existing guard before the page body mounts.
Route-record assertions alone do not prove the visible result. Reuse existing
checks for unchanged behavior and report any required browser check not run.

For optional file creation, use the shared generator’s
[route-only operation](../../carta-module-development/references/bounded.md#route-only-operation).
