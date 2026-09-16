---
name: migrate-web-resource
description: Migrate one Carta `apps/web` module per execution from the old `*.operations.ts` API to the approved schema-bound field-reference resource API. Use for a module named by an approved dedicated or cohort Improve plan, after the framework foundation and app adapters exist. Do not use for framework foundation work, requests to migrate multiple modules in one execution, or the removed web PTS module.
---

# Migrate One Web Resource Module

Migrate one selected module to the approved schema and field-reference
resource architecture. The approved plan can cover a cohort of similar
modules, but each execution must select and complete only one module. Keep the
change inside that module and remove its old resource API.

## Required reads

Read these files completely before editing:

- `AGENTS.md`
- `docs/superpowers/specs/2026-08-11-frontend-resource-schema-architecture-design.md`
- the selected Improve plan for the module
- `docs/ui/README.md` and each branch used by the module
- `docs/architecture/web-application-architecture.md`
- `packages/loom/README.md`
- the module's routes, resources, operation files, and focused tests

Use `web-ui-surfaces` when the migration changes route UI composition or a
framework surface. The UI contract owns visual structure; existing routes are
domain evidence.

## Hard gates

Stop and report the exact blocker when any gate fails:

1. The selected module is not named by an approved dedicated or cohort Improve
   plan.
2. The execution request targets more than one application module. A cohort plan
   is valid, but it must be executed once for each named module.
3. The target is the web PTS module. PTS must be removed, not migrated.
4. The required framework schema, action, resource, and View APIs do not exist.
5. The migration needs a framework package change that has no separate approved
   framework plan and user consent.
6. The plan or source leaves a material schema, action, route, or access decision
   unresolved.

Do not add a compatibility wrapper or preserve the old module API.

## Preflight

1. Check `git status --short`. Preserve unrelated work.
2. Select one incomplete module from the plan and resolve its exact module root.
3. Find all imports and callers of its resource and operation files.
4. List its standard actions: `list`, `detail`, `create`, `update`, and `delete`.
5. List its custom actions and UI workflows separately.
6. Identify its contract source:
   - typed Hono client route through the app contract adapter; or
   - manual runtime schemas for services or fetch.
7. Identify current validation in Zod, resource validators, field props, and
   route code.
8. Record the focused tests and the plan's verification commands.
9. Record the selected module's checkpoint in the cohort plan. Do not treat a
   different module's completed checkpoint as evidence for this module.

## Migration workflow

### 1. Create the schema

Create `<module>.schema.ts` with app `defineSchema` from `@/framework/schema`.

- Use the Hono route provider for a standard typed Hono resource. Do not use
  a custom contract to bypass a route mismatch.
- Use an explicit custom contract for a resource without a standard Hono route,
  or let local runtime schemas infer its types.
- Pass raw Zod schemas; the app seam owns `fromZod`.
- Put record, query, create, update, identity, and all standard frontend
  validation here.
- Move synchronous and asynchronous custom validators here.
- Remove duplicated `required`, length, pattern, and cross-field rules from
  resource fields.
- Reuse identical create and update definitions with a plain constant.
- Do not describe custom actions in the schema.

### 2. Bind application run functions

In `<module>.resource.ts`, get standard Hono functions from the app helper or use
the module's services or fetch functions directly.

Run functions must:

- accept and return the types from the schema contract;
- normalize wire data before it reaches the framework;
- throw failed requests;
- stay free of dialogs, confirmations, toasts, and navigation.

Move UI effects to the owning route. Keep a large custom function in a focused
`<module>.actions.ts` file only when the resource file would become hard to read.

### 3. Define one block per action

Call `defineResource(schema, definition)` with one `actions` object.

- Define one adjacent field set with `defineFields(schema, definitions)`.
- Put shared labels, accessors, and write functions at the field root.
- When legacy is the business reference, copy user-facing labels exactly from
  the approved legacy label ledger. Do not translate, shorten, improve, or
  invent a synonym.
- Put surface behavior in `display`, `table`, `detail`, and `form` projections.
- Put `run`, ordered field references, permission, route, and standard View
  options in the same standard action block.
- Use one terminal partial `.override({...})` only for a real local difference.
- Omit a reference to remove a field from a View; preserve the current order.
- Give custom action blocks only `run` unless the approved design changes.
- Do not add custom action schemas, permission metadata, kinds, HTTP methods, or
  automatic invalidation.

### 4. Use the canonical public API

Bind standard Views with the returned action object:

```vue
<ListView v-bind="resource.list()" />
<DetailView v-bind="resource.detail({ id })" />
<FormView v-bind="resource.create()" />
<FormView v-bind="resource.update({ id })" />
```

Execute standard actions only through the same returned object's `run`:

```ts
await resource.list().run(context)
await resource.detail({ id }).run()
await resource.create().run(input)
await resource.update({ id }).run(input)
await resource.delete({ id }).run()
```

Execute custom actions only through their action object:

```ts
await resource.actions.verify.run(input)
```

Do not add another raw standard action namespace, `.props`, `.view`, or a
factory-level `.run`.

### 5. Remove the old module API

- Delete the migrated module's old field-map declarations.
- Delete its `schemas`, `validators`, `capabilities`, `table`, `detail`, and
  `form` resource properties.
- Delete `*.operations.ts` after moving any needed application functions.
- Update all module imports and tests.
- Update architecture boundary fixtures only for this module and the canonical
  global rule. Do not edit another module to make a test pass.

### 6. Verify observable behavior

Run the plan's focused checks first. At minimum, run:

```sh
pnpm --filter @southneuhof/framework-web test
pnpm --filter @southneuhof/framework-web type-check
pnpm --filter @southneuhof/framework-web lint:check
git diff --check
```

Also run a focused framework test when the module exposes a new framework edge.
Validate changed user flows in an authenticated real browser or T3 preview.
If the preview is unavailable after a valid retry, report `UI UNVERIFIED` or
`BLOCKED`; automated checks do not replace the browser check and the migration
must not be reported complete.

Test contract and observable behavior. Do not copy every field list into a test.

## Review checklist

Before completion, verify:

- exactly one selected module changed, apart from approved shared boundary
  fixtures;
- no web PTS source was migrated;
- the schema is transport-neutral;
- all standard frontend validation is in the schema;
- every standard operation is readable from one action block;
- every View owns complete fields;
- every standard action has one execution path through the returned `run`;
- custom actions remain plain application functions;
- user-facing labels match the legacy label ledger exactly, or an approved
  difference is recorded;
- page chrome, actions, forms, collections, copy, and spacing match the
  applicable UI contract;
- UI effects stay in routes;
- no framework code changed without its own approval;
- old module resource patterns are absent;
- all required checks pass.

For a cohort plan, mark only the selected module checkpoint complete. Keep the
plan in progress until every named module checkpoint is complete and reviewed.

Report `Reused`, `Searched`, and `Gap` when `web-ui-surfaces` applies. Name
the migrated module, deleted old files, checks run, and any remaining blocker.
