# Plan 018: Generate selected standard module actions and their proof

> **Implementation instructions**: Complete plans 016 and 017 first. Follow each
> step and run its check. Stop on a condition in `STOP conditions`; do not change
> a framework package or hide a migration difference. Update the plan and index
> after review.
>
> **Drift check (run first)**:
> `git diff --stat 7eb093d..HEAD -- scripts package.json apps/api apps/web`
> Reconcile dependency changes and compare all current-state references with live
> code. A changed generator or framework action contract is a stop condition.

## Status

- Priority: P1
- Effort: L
- Risk: MED — generated cross-layer source, migration, and tests change together
- Depends on: 016 and 017
- Category: migration, generation, DX, correctness
- Planned at: commit `7eb093d`, 2026-09-12
- Status: TODO — plan only

The user selected this migration. Extend the current bounded generator. Do not
create another generator or another skill. Generated files are normal editable
source. The command refuses existing destinations and has no regeneration or
protected-region contract.

## Why this matters

Most Carta modules repeat the same entity, routes, resource actions, pages,
permissions, migration, seed, and basic proof. Agents now write those parts by
hand and spend time correcting integration and test setup. Selected generation
removes that repeat work while custom behavior stays explicit and reviewable.

## Outcome

One public generator command owns validation, source creation, owner integration,
migration generation, seed registration, and standard test creation:

```sh
pnpm scaffold:bounded-module -- --manifest <path> --check
pnpm scaffold:bounded-module -- --manifest <path> --apply
```

The manifest selects any supported set of `list`, `detail`, `create`, `update`,
and `delete`. An omitted action creates no page, public API action, resource
action, navigation link, or permission for that action. The generator can create
the standard parts around custom work. For example, a custom Detail page does
not prevent generation of standard List, Create, and Update parts.

The generator also creates a Drizzle migration, an exact optional seed, one
useful API integration spec, and one browser journey when the selected UI is
standard. It does not apply a migration, run a seed, or run generated tests.

## Current state

| Owner | Evidence and effect |
| --- | --- |
| `scripts/scaffold-bounded-module.mjs:12-15` | The generator fixes all permission and resource actions in constants. |
| `scripts/scaffold-bounded-module.mjs:79-97` | Validation requires all five permissions and rejects action subsets. |
| `scripts/scaffold-bounded-module.mjs:192-235` | The manifest needs redundant identity and labels data; it has no selected `actions` or test fixture contract. |
| `scripts/scaffold-bounded-module.mjs:306-345` | It renders every API action and an authentication-only route test. |
| `scripts/scaffold-bounded-module.mjs:412-468` | It renders all resource actions and fixed routes. |
| `scripts/scaffold-bounded-module.mjs:471-505` | The resource spec checks generated shape and route mapping. It does not prove an HTTP or persistence result. |
| `scripts/scaffold-bounded-module.mjs:508-579` | It always renders List, Create, Detail, and Update pages. |
| `scripts/integrate-bounded-module.mjs:1-189` | A separate tool owns domain, permission, seed, and navigation edits. Keep its implementation internal to the public generator. |
| `.agents/skills/carta-module-development/scripts/scaffold_bounded.py:1-60` | A Python wrapper runs generator and integrator commands. It adds a second public interface. |
| `scripts/verify-module.test.mjs:98-105` | Verification currently expects the weak generated resource spec. |
| `apps/api/src/testing/session.ts:40` | `createSystemSession` is the existing system-permission test helper. Reuse it in generated API specs. |
| `apps/api/src/routes/(authenticated)/roles/role-mapping.routes.spec.ts:11-60` | This is the current compact pattern for permitted, denied, persisted, cleanup, and connection close checks. |
| `apps/web/e2e/rbac-smoke.spec.ts:1-14` | Existing E2E fixtures already provide fast authentication and stable role queries. Reuse them. |

Project A shows that simple API generation was fast, while later web and E2E
work caused large delays. Its API cycles took 18 minutes; a web worker had 72
minutes with no output; three broad workers later used 106 minutes without a
usable result (`/Users/gamer/Documents/projects/document-validity-checker/.local/carta-module-development-time-analysis.md:64-77,138-170`).
Project B used 24 minutes for scaffold, 47 minutes for API test work, 27 minutes
for canonical rework, 53 minutes for web, and 121 minutes for E2E and verification
(`/Users/gamer/Documents/forward-testing/swa-fw/.local/swa-module-development-analysis.md:119-130`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Generator tests | `node --test scripts/scaffold-bounded-module.test.mjs scripts/integrate-bounded-module.test.mjs scripts/verify-module.test.mjs` | All selected tests pass |
| Tool suite | `pnpm test:module-tooling` | All module-tool tests pass |
| API types | `pnpm --filter @southneuhof/api type-check` | Exit 0 |
| Web types | `pnpm --filter @southneuhof/framework-web type-check` | Exit 0 |
| Generator check | `pnpm scaffold:bounded-module -- --manifest <path> --check` | Reports exact paths, owners, migration intent, and manual work; writes nothing |
| Generator apply | `pnpm scaffold:bounded-module -- --manifest <path> --apply` | Creates new source and one migration; applies no migration or seed |
| Patch | `git diff --check` | Exit 0 |

## Suggested implementation toolkit

Use `$api-conventions` to check generated entity, scope, route, permission, and
transaction patterns. Use `$web-ui-surfaces` to check generated route placement,
navigation, standard views, redirects, and browser proof. Use
`$build-resource-form` for generated Create and Update fields. These skills check
the templates; they do not authorize a framework package change.

## Supported contract

Keep the first version bounded:

- one UUID text identity named `id`;
- one table;
- system permissions;
- scalar `text`, `boolean`, and `number` fields;
- existing standard Loom renderers for those types;
- standard Sprindle list/detail/create/update/delete routes;
- no relation, child resource, computed write, scoped access, workflow, custom
  query, report, concurrency rule, or existing-data migration.

Those unsupported parts stay in the normal module plan. The generator still
creates independent supported actions when their contracts do not depend on
custom parts.

Use this manifest as the exact v1 shape:

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
    "group": "settings", "after": "settings-roles", "title": "Service Levels", "icon": "folder"
  },
  "seed": {
    "records": [{ "id": "service-level-standard", "name": "Standard", "active": true }],
    "updateFields": ["name", "active"]
  },
  "test": {
    "record": { "name": "Generated test level", "active": true },
    "update": { "name": "Updated test level" }
  }
}
```

Rules:

- `actions` must have at least one key. Unknown actions fail.
- Each action lists only fields that it uses. Delete has no fields.
- A permission code can be shared by actions. Each used code must exist once in
  `permissions`; unused permission definitions fail.
- `navigation` is allowed only when List exists. It is optional.
- `seed` is optional. Its records and update fields are emitted exactly. The
  generator does not invent a record.
- `test.record` is required for a selected mutation. `test.update` is required
  for Update and must change at least one Update field.
- For a read-only List or Detail module, the browser test requires a seed record.
  Without it, generation succeeds and reports the browser case as manual.
- Field renderer is optional. Derive the current standard renderer from type.
  An explicit unsupported renderer makes that UI action manual.
- Derive identity, route names, imports, titles, default submit label, redirects,
  and normal field defaults. Do not keep the old redundant identity and labels
  form as a compatibility input.

## Scope

Permitted files for execution:

- `scripts/scaffold-bounded-module.mjs`
- `scripts/integrate-bounded-module.mjs` as an internal module
- `scripts/verify-module.mjs`
- Their existing tests and `scripts/test-support/bounded-fixture.mjs`
- `.agents/skills/carta-module-development/scripts/scaffold_bounded.py` — remove
- `package.json` — remove the public integration alias; keep the scaffold alias
- Generated file templates inside the existing generator only
- Root README and `apps/api/AGENTS.md` for a short command pointer
- This plan and `plans/README.md`

Do not change Sprindle, Loom, shared application behavior, database migration
format, or E2E fixtures. Use existing framework APIs and Drizzle CLI. Keep the
route-only operation in the same script if current consumers still use it; do
not expand it in this plan.

## Git workflow

Work in the current checkout. Keep completed dependency changes and all unrelated
dirty files. Commit the generator, its tests, and direct docs as one reviewed
logical unit with an imperative message such as `Expand bounded module generation`.
Do not push or open a pull request unless the user asks.

## Implementation

### 1. Replace the manifest validator

Replace the full-CRUD assumptions with the exact supported contract above.
Validate all fields, actions, permission references, seed records, and test data
before any write. Return normalized data with derived identity, renderer, labels,
route names, redirects, and the technical actions required for hydration.

Update without a Detail page still needs the API record-read route for edit
hydration. In that case:

- create `detail/[id]/+server.ts` as a technical API dependency;
- authorize it with the Update permission;
- in the generated Update page, pass a `load` function to `FormView` that calls
  the technical API read through `createHonoResourceActions`;
- do not create a Detail resource action, Detail page, Detail route name, Detail
  link, or Detail permission.

This technical dependency must be visible in `--check` output. Do not infer any
other omitted business action.

`--check` must report:

- normalized selected actions;
- derived technical dependencies;
- every new source and owner edit;
- migration intent;
- seed registration or omission;
- API and browser test generation or manual reason;
- unsupported custom work that remains for the module plan.

Verify with a table-driven Node test for representative sets: List only,
List+Detail, Create+List, Update without Detail, full actions, shared permission,
and a standard action beside a custom Detail omission. Check that omitted action
files and metadata are absent.

### 2. Render only selected source

Change `filesFor` and render functions to use selected actions. Always create the
entity, domain part, scope, web schema, and resource only when a selected action
needs that layer. Create API route files, resource action entries, and Vue route
files only for selected actions and the Update hydration dependency.

Redirect rules:

- Create and Update redirect to Detail when Detail exists.
- Otherwise, they redirect to List when List exists.
- If neither target exists, the manifest must give a valid existing route name;
  add one bounded `redirect` string to that action rather than infer a target.
- Delete returns through the standard resource behavior; it has no page.

List links and buttons include only actions that exist. Navigation uses the List
permission and exists only for List. Integrate only used permissions. Register a
seed only when `seed` exists.

Delete the generated resource shape spec and authentication-only route spec.
They test renderer output, not the module contract. Keep generator-owned tests
for renderer decisions in `scripts/scaffold-bounded-module.test.mjs`.

Verify:

```sh
node --test scripts/scaffold-bounded-module.test.mjs scripts/integrate-bounded-module.test.mjs scripts/verify-module.test.mjs
```

Expected: selected combinations create exact files and owner edits; a rerun
refuses existing generated files; invalid owners cause no write.

### 3. Generate and inspect one Drizzle migration

Use Drizzle Kit. Do not render SQL in generator code.

Before `--apply` writes source, fail if there are pre-existing changes under
`apps/api/src/routes/**/*.entity.ts` or `apps/api/drizzle/`. This makes the
migration attribution exact. Validate all destination and owner anchors first.

Treat apply as one transaction owned by the command:

1. Save the exact bytes of owner files that the command can edit.
2. Write new source files, but do not integrate owners yet.
3. Run the installed Drizzle CLI with `generate --explain --output json` and the
   current API config.
4. Require the explanation to contain only creation of the manifest table and
   its columns, primary key, and indexes that the entity declares.
5. If it contains an unrelated operation, restore owner bytes and remove only
   files created by this invocation. Report the full explanation and stop.
6. Run normal `drizzle-kit generate --name <slug>`.
7. Identify the one new migration directory. Read its SQL and journal metadata.
   Apply the same expected-table check. On a mismatch, restore this invocation.
8. Integrate domains, permissions, optional seed, and navigation.
9. Report the migration path and SQL text. Never run `db:migrate`.

Rollback is allowed only for new files from this invocation and exact owner bytes
captured before the command. Never remove or replace a pre-existing path. If
rollback itself fails, report every remaining path and stop.

Mock the Drizzle child process in generator tests. Prove accepted output,
unrelated-operation rejection, command failure, and rollback. One separate
integration check can run Drizzle in a disposable copy of the repository. It
must not use the development checkout or connect to a database.

### 4. Generate the seed and API integration spec

Keep the current idempotent seed renderer, but emit only exact manifest records
and exact `updateFields`. Register it in the current `seedDatabase` owner. Never
execute it.

Generate one API route spec beside the module. Use `createSystemSession`, `getDb`,
the generated entity, and current cleanup patterns. Use unique IDs for test state.
For selected actions, the one spec must prove applicable parts of this contract:

- a session with the action permission gets the expected status and response;
- a session without it gets 403;
- create/update/delete persistence matches the request;
- invalid create or update input gets 400;
- a denied or invalid write leaves stored values unchanged;
- List and Detail return the created or seeded record;
- cleanup runs in `finally`, sessions are cleaned, and the DB is closed.

Use `test.record` and `test.update` exactly. Derive invalid input by removing the
first required field or giving the first selected field a wrong JSON type. If no
selected write field can make a stable invalid case, reject the manifest and
report that the action needs a manual test. Do not invent business validation.

The API spec is generated only for selected standard API actions. Custom actions
remain in a separate manual spec.

### 5. Generate one browser journey when it can be stable

Generate one `apps/web/e2e/<slug>.spec.ts` when all selected web actions use
standard generated views and renderers. Use the current `./fixtures` import and
`fastAuth`. Exercise one connected journey, with only applicable steps:

- open List and find an exact record;
- create from the List or direct Create route and see the saved value;
- open Detail and see fields;
- update a value, return to Detail or List, reload, and see the saved value;
- delete and confirm the record is absent.

Use role and label selectors. Do not use CSS classes or fixed waits. Use a seed
record for a read-only journey. If there is no Create action and no seed record,
omit the browser file and report the manual fixture need. Omit it and report a
manual journey when Detail is custom, a field renderer is custom, or a required
interaction is outside the standard views.

The generator must not run Playwright. Plan 017 preflight must pass before the
executor runs this generated case.

### 6. Make the Node script the only public generator

Move orchestration into `scripts/scaffold-bounded-module.mjs`. `--check` performs
read-only validation and previews. `--apply` performs the transactional sequence.
Keep `integrate-bounded-module.mjs` importable for focused tests, but remove the
root `integrate:bounded-module` alias. Remove the Python wrapper and its tests.
Update `verify-module.mjs` for selected paths, exact migration presence, seed
choice, and generated proof choice.

Keep `verify:module` as a verifier. It is not a second generator. Update the root
README and API AGENTS file with a short pointer to the one command. Put detailed
manifest rules in the existing bounded skill reference under plan 019.

Verify:

```sh
pnpm test:module-tooling
pnpm --filter @southneuhof/api type-check
pnpm --filter @southneuhof/framework-web type-check
git diff --check
```

### 7. Prove one generated module in a disposable copy

Copy the current repository to a disposable directory without `.git`, ignored
build output, actual `.env` files, or `node_modules`; link the existing dependency
store only if the package manager supports it safely. Configure the four local
environment files for isolated targets and run plan 017 preflight.

Use a manifest with List, Create, Update, and Delete, with no Detail page. Run
`--check`, then `--apply`. Inspect the SQL before any migration. Apply the migration
only to the disposable test and E2E databases, register exact seed data, then run:

```sh
pnpm --filter @southneuhof/api test:focused -- src/routes/'(authenticated)'/<slug>/<slug>.routes.spec.ts
pnpm --filter @southneuhof/framework-web test:e2e -- <slug>.spec.ts
```

Expected: Update hydration works through its technical read route; there is no
Detail page, Detail link, or Detail permission; denied and invalid writes keep
data unchanged; the browser journey persists across reload.

Do not copy the generated module back to this checkout. Preserve a redacted
command summary under ignored `.local` evidence.

## Test plan

- One table-driven generator suite covers selected action decisions and refusal.
- One integration suite covers exact owner edits and idempotent integration.
- One migration-child test covers expected SQL, unrelated SQL, failure, rollback.
- Existing verifier tests cover selected files, migration, seed, and manual E2E.
- API and web type-checks prove generated imports and action types in a disposable
  module.
- One generated API spec and one generated browser journey pass in isolation.
- No test applies a migration or seed to the development database.

## Done criteria

- [ ] One public command supports `--check` and `--apply`.
- [ ] The manifest selects exact standard actions; omitted actions emit no product
  surface or permission.
- [ ] Update without Detail has only the technical read support that it needs.
- [ ] Generated source is ordinary editable source and existing paths are refused.
- [ ] Drizzle creates one reviewed migration and the command never applies it.
- [ ] Seed data is exact, optional, registered, and never run by the generator.
- [ ] One generated API spec proves permission, validation, persistence, and
  unchanged rejected writes for applicable actions.
- [ ] One generated browser journey exists only for a stable standard path.
- [ ] Custom detail, relations, children, scope, workflow, concurrency, existing
  data changes, custom queries, and reports are clearly manual.
- [ ] Tooling, type, diff, disposable API, and disposable browser checks pass.

## STOP conditions

Before execution, run:

```sh
git diff --stat 7eb093d..HEAD -- scripts package.json apps/api apps/web .agents/skills/carta-module-development
git status --short
```

Plans 016 and 017 are expected dependencies. Preserve the unrelated asset work.
Stop before source writes if an owner anchor is missing, a destination exists, an
entity or migration path is dirty, or Drizzle reports an unrelated schema change.
Stop the affected generated action if current Sprindle or Loom standard APIs
cannot express it. Report the manual work; do not change framework packages or
add a compatibility wrapper.

## Maintenance notes

Update this plan and the index after review. Record generated paths, migration
path, Drizzle explanation, exact test commands, and manual items. Add a supported
case only after two real modules need the same standard behavior and the existing
framework already supports it.
