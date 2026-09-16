# Source generator

This optional scaffold writes application source once. Route discovery needs no
scaffold command or manifest; use normal file edits for later route changes.
Use it only when it saves work. A dirty-worktree restriction or unsupported
contract is a reason to use normal edits, not to stash user work or investigate
generator internals during module delivery. Preserve useful generated files.

## Complete module operation

Module delivery must not emit browser files. Inspect the read-only preview
before application. If it includes E2E and no supported exclusion exists, use
normal source edits or the route-only operation. Do not modify the generator,
invent a flag, or generate E2E and then delete it to satisfy this boundary.

Use `kind: "bounded-module"` for a new one-table resource with a generated text
UUID `id`, system permissions and any supported subset of List, Detail, Create,
Update and Delete. It generates compatible standard actions beside custom work.
An omitted action creates no surface, public action or permission. Update without
Detail creates only the technical API read needed to hydrate the edit form. It
uses the Update permission and creates no Detail surface or permission.

Fields support `text`, `boolean` and `number` with the current standard Loom
renderers. They can set `required`, a scalar `default`, or a supported explicit
`renderer`. List, Detail, Create and Update list only their fields. Delete has no
fields. Actions can share a permission code. Every used code must exist once in
`permissions`; unused definitions fail. Navigation is optional and needs List.

Relations, dependent input, child resources, scoped access, workflow,
concurrency, existing-data migration, custom query, report and custom surfaces
stay manual. Include independent standard actions when generation is useful. An unsupported
explicit renderer makes its UI implementation manual. Unknown actions,
extensions and manifest keys fail.

## Manifest

If generation is selected, prepare the manifest after data and actions are settled.
Use `plans/<feature>/module.json` for one resource
or `plans/<feature>/<resource>.module.json` for several resources. Each manifest
describes one table. Identity, route names,
labels, standard renderers and normal redirects are derived. This partial example
generates List, Create and Update while Detail stays custom. `navigation.group`
selects an existing authenticated route and navigation group. A Create or Update
action needs `redirect` only when neither Detail nor List exists.

```json
{
  "kind": "bounded-module",
  "slug": "service-levels",
  "table": "service_levels",
  "symbol": "ServiceLevel",
  "title": "Service Levels",
  "singular": "Service Level",
  "fields": [
    { "key": "name", "type": "text", "label": "Name", "required": true },
    { "key": "active", "type": "boolean", "label": "Active", "required": true, "default": true }
  ],
  "actions": {
    "list": { "fields": ["name", "active"], "permission": "list-service-levels" },
    "create": { "fields": ["name", "active"], "permission": "create-service-levels" },
    "update": { "fields": ["name", "active"], "permission": "update-service-levels" }
  },
  "permissions": {
    "list-service-levels": { "name": "List service levels", "description": "List service levels." },
    "create-service-levels": { "name": "Create service level", "description": "Create a service level." },
    "update-service-levels": { "name": "Update service level", "description": "Update a service level." }
  },
  "navigation": {
    "group": "settings",
    "after": "settings-roles",
    "title": "Service Levels",
    "icon": "folder"
  },
  "test": {
    "record": { "name": "Standard", "active": true },
    "update": { "name": "Priority" }
  }
}
```

`test.record` is required for a selected mutation. `test.update` is required for
Update and must change one Update field. The API test uses these values exactly.
For a read-only List or Detail module, add an exact seed when the design requires
stable initial records:

```json
"seed": {
  "records": [{ "id": "service-level-standard", "name": "Standard", "active": true }],
  "updateFields": ["name", "active"]
}
```

The generator does not invent or run seed records. Without a read-only seed,
generation succeeds and reports the browser fixture as manual.

## Check and apply once

The two public complete-module commands are:

```sh
pnpm scaffold:bounded-module -- --manifest plans/<feature>/module.json --check
pnpm scaffold:bounded-module -- --manifest plans/<feature>/module.json --apply
```

Read `--help` for optional flags. `--check` writes nothing and reports selected
actions, Update hydration, paths, owner edits, migration intent, seed choice,
generated tests and manual work. Inspect each result.

This output completes discovery of generated owners. Record manual owners and
unresolved interfaces in the plan. Reuse the preview while the manifest,
generator and relevant destination inputs remain current.

After implementation authority exists, run `--apply` once. It refuses existing
generated destinations. It writes new source and uses installed Drizzle Kit to
generate one migration. It rejects unrelated schema operations, reports the SQL,
and never applies the migration. It registers an exact seed when present and
never runs it. It never runs generated tests or external writes. Review the SQL
and source, then edit generated source normally. Do not regenerate over edited
source. On partial failure, inspect the reported paths before any retry.
The generator's no-migration/no-seed execution rule is not a delivery restriction.
The executor performs authorized development setup under
[execution](execution.md#prepare-and-build).

The generated API spec covers only selected standard actions. Each action
proves success plus persistence. Create and update also prove denied access
and invalid payload rejection. No copy, layout, or dialog assertions exist.
The generator can emit a browser journey for list/create/update. That output is
outside module delivery; follow the exclusion above. Custom behavior needs
focused non-browser proof, not a manually written browser replacement.

Read [verification-strategy.md](verification-strategy.md) for evidence scope and
acceptance. The root `verify:module` and `module:evidence` commands are
verification tools, not generators.

## Route-only operation

Use `kind: "routes"` to create selected API or web route files in a new or existing
module. The complete module limits above do not apply to this operation.
This is a low-level operation in `scripts/scaffold-bounded-module.mjs`, not the
normal module path. Call the script directly and read its `--help` for options.

Select paths after checking inherited API scopes or rendered web parents. Supply
the route code, imports, and required access checks. The generator creates source;
it does not infer business behavior or register permissions and navigation.
Use `imports[].path` for a repository-relative source target so the generator can
calculate the import from the destination. Use `imports[].from` for package or
alias imports. Import bindings use TypeScript syntax.

```json
{
  "kind": "routes",
  "routes": [
    {
      "path": "apps/api/src/routes/(authenticated)/projects/[projectId]/tasks/detail/[taskId]/+server.ts",
      "imports": [
        { "binding": "{ detail }", "from": "@southneuhof/sprindle" },
        { "binding": "{ requirePermission }", "path": "apps/api/src/identity.ts" }
      ],
      "script": "export const GET = detail({ param: 'taskId', authorize: requirePermission('detail-tasks') })"
    }
  ]
}
```

This example requires a parent scope with the task entity, project ownership
checks, and an existing permission. Keep callbacks inline for scope inference.
For web files, supply `template` and optional `script`; the generator adds the Vue
file sections. Supply an outlet when the page must retain child pages.

Run with `--check --json` to review all paths and source without writes. Then run
without `--check` under the task's implementation authority. All destinations are
checked before writing. Existing files, duplicate destinations, and symbolic
links are rejected. If an I/O error interrupts writing, inspect the files before
retrying. Complete when the requested files exist and the affected application
checks prove the route behavior; a source preview is not a behavior check.
