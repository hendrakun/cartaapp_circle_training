# Source generator

This optional scaffold writes application source once. Route discovery needs no
scaffold command or manifest; use normal file edits for later route changes.

## Complete module operation

Use `kind: "bounded-module"` only for a new single resource with a supported
subset of the standard actions (list, detail, create, update, delete), a
generated text UUID identity, primitive fields and system-wide permissions. The
current generator supports that shape, not arbitrary module contracts.

Action subsets are supported: omitted actions emit no page, public API action,
resource action, navigation link, or permission. Record-scoped/project
permissions, relations, owned children,
workflows, custom writes/surfaces and risky existing-data migrations use normal
implementation plans. Keep the approved scope; never add actions to fit the
generator. Generator eligibility is independent of business uncertainty or risk.
Unknown manifest extensions are rejected rather than silently ignored.

## Manifest

Write `plans/<feature>/module.json` after the design gate. The generic token is
`kind: "bounded-module"`. Identity and labels derive from `title` and
`singular`; do not send `identity` or `labels` keys. `navigation.group` selects
any existing authenticated route and navigation group; the generator does not
assign a business group. `redirect` is required on create/update only when
neither Detail nor List exists.

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
    "detail": { "fields": ["name", "active"], "permission": "detail-service-levels" },
    "create": { "fields": ["name", "active"], "permission": "create-service-levels" },
    "update": { "fields": ["name", "active"], "permission": "update-service-levels" },
    "delete": { "permission": "delete-service-levels" }
  },
  "permissions": {
    "list-service-levels": { "name": "List service levels", "description": "List service levels." },
    "detail-service-levels": { "name": "View service level", "description": "View a service level." },
    "create-service-levels": { "name": "Create service level", "description": "Create a service level." },
    "update-service-levels": { "name": "Update service level", "description": "Update a service level." },
    "delete-service-levels": { "name": "Delete service level", "description": "Delete a service level." }
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

Use per-action `fields` when list, detail, create, and update have different field
sets. Add `seed` only when the design requires stable initial records.

## Check and generate

Inspect `--help` for the actual helper interface. Validate without writing source:

```sh
pnpm scaffold:bounded-module -- --manifest plans/<feature>/module.json --check --json
```

After implementation is authorized, generate with the transactional apply:

```sh
pnpm scaffold:bounded-module -- --manifest plans/<feature>/module.json --apply --json
```

The node command validates the manifest, gates migration scope, and integrates
owners. `--check` writes nothing. `--apply` writes source and one migration,
integrates owners, and never runs a migration, seed, test, or external write.
It refuses existing generated files. On partial failure, inspect the reported
changed files rather than blindly restarting or overwriting them.

Review the generated schema and SQL migration, add the contract-specific tests,
and use the plan's isolated test environment. The generated API spec proves
permission, validation, persistence, and unchanged rejected writes for the
selected standard actions; the generated browser journey covers only the stable
standard path. Custom behavior needs its own tests.
When optional seed records are present, integration registers the module's seed
in the current `seedDatabase` owner; the plan still decides which environment
may execute it.

The root `scaffold:bounded-module`, `verify:module`, and `module:evidence`
commands expose the public tools. `verify:module --check-only` performs
static checks; `--run` runs its listed non-browser commands and stops at the
first failure. `--reports <unique-directory>` preserves summary and command
outputs. Read [verification-strategy.md](verification-strategy.md) for status
scope, additional business tests, evidence freshness and semantic acceptance.

## Route-only operation

Use `kind: "routes"` to create selected API or web route files in a new or existing
module. The complete module limits above do not apply to this operation.
Call `scripts/scaffold-bounded-module.mjs` directly. Read the command's `--help` for options.

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
