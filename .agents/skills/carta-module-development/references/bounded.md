# Source generator

This optional scaffold writes application source once. Route discovery needs no
scaffold command or manifest; use normal file edits for later route changes.

## Complete module operation

Use `kind: "bounded-module"` only for a new single resource whose approved design includes all five
standard actions (list, detail, create, update, delete), a generated text UUID
identity, primitive fields and system-wide permissions. The current generator
supports that shape, not arbitrary module contracts.

Action subsets, record-scoped/project permissions, relations, owned children,
workflows, custom writes/surfaces and risky existing-data migrations use normal
implementation plans. Keep the approved scope; never add actions to fit the
generator. Generator eligibility is independent of business uncertainty or risk.
Unknown manifest extensions are rejected rather than silently ignored.

## Manifest

Write `plans/<feature>/module.json` after the design gate. The generic token is
`kind: "bounded-module"`. `navigation.group` selects any existing authenticated
route and navigation group; the generator does not assign a business group.

```json
{
  "kind": "bounded-module",
  "slug": "service-levels",
  "table": "service_levels",
  "symbol": "ServiceLevel",
  "title": "Service Levels",
  "identity": { "key": "id", "type": "text", "primary": true, "generated": "uuid" },
  "fields": [
    { "key": "name", "type": "text", "label": "Name", "required": true, "renderer": "text" },
    { "key": "active", "type": "boolean", "label": "Active", "required": true, "renderer": "checkbox", "default": true }
  ],
  "labels": {
    "listTitle": "Service Levels",
    "detailTitle": "Service Level",
    "createTitle": "Create Service Level",
    "editTitle": "Edit Service Level",
    "submitLabel": "Save"
  },
  "permissions": {
    "moduleName": "Service Levels",
    "realm": "system",
    "entries": {
      "list": { "name": "List service levels", "description": "List service levels." },
      "detail": { "name": "View service level", "description": "View a service level." },
      "create": { "name": "Create service level", "description": "Create a service level." },
      "update": { "name": "Update service level", "description": "Update a service level." },
      "delete": { "name": "Delete service level", "description": "Delete a service level." }
    }
  },
  "navigation": {
    "group": "settings",
    "after": "settings-roles",
    "title": "Service Levels",
    "icon": "folder",
    "separator": "Configuration"
  }
}
```

Use `actionFields` when list, detail, create, and update have different field
sets. Add `seed` only when the design requires stable initial records.

## Check and generate

Inspect `--help` for the actual helper interface. Validate without writing source:

```sh
python3 .agents/skills/carta-module-development/scripts/scaffold_bounded.py --manifest plans/<feature>/module.json --check --json
```

After implementation is authorized, generate and integrate source explicitly:

```sh
python3 .agents/skills/carta-module-development/scripts/scaffold_bounded.py --manifest plans/<feature>/module.json --apply --json
```

The wrapper checks eligibility and integration anchors before source generation.
It never runs a database migration, seed, application test or external write.
It refuses existing generated files. On partial failure, inspect the reported
changed files rather than blindly restarting or overwriting them.

Review the generated schema and SQL migration, add the contract-specific tests,
and use the plan's isolated test environment. The generated tests are smoke
checks, not proof of accepted/denied CRUD, field validation or consumer behavior.
When optional seed records are present, integration registers the module's seed
in the current `seedDatabase` owner; the plan still decides which environment
may execute it.

The root `scaffold:bounded-module`, `integrate:bounded-module` and `verify:module`
commands expose the individual tools. `verify:module --check-only` performs
static checks; `--run` runs its listed non-browser commands and stops at the
first failure. `--reports <unique-directory>` preserves summary and command
outputs. Read [verification-strategy.md](verification-strategy.md) for status
scope, additional business tests, evidence freshness and semantic acceptance.

## Route-only operation

Use `kind: "routes"` to create selected API or web route files in a new or existing
module. The complete module limits above do not apply to this operation.
Call `scripts/scaffold-bounded-module.mjs` directly; the bounded Python wrapper
owns complete module integration only. Read the command's `--help` for options.

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
