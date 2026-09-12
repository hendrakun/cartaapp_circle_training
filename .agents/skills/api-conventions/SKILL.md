---
name: api-conventions
description: Build or review Carta backend file routes, inherited scopes, entities, permissions, and transactions.
---

# API conventions

Read the approved behavior and affected owners in `apps/api/src`. For route
changes, read [file routing](references/file-routing.md) before choosing files
or hooks. Check current exports in `packages/sprindle/docs/reference.md`.

| Work | Read |
|---|---|
| Resource schemas, CRUD, custom actions, migrations | [Resource contracts](references/standard-crud.md) |
| State transitions, child writes, shared transactions | [Workflow modules](references/workflow-service.md) |
| Public records, derived fields, stored files | [Public records](references/public-records.md) |

## Access

The root scope resolves identity; the `(authenticated)` scope requires a session.
Use `requirePermission` from `src/identity.ts` for each protected operation.
Authentication alone does not grant operation permission. Public placement needs
an explicit product requirement.

Define exact codes in `src/authorization/catalog.ts`. Standard verbs are `view`,
`list`, `detail`, `create`, `update`, and `delete`, followed by the module code.
Custom actions use their action verb. Keep catalog, guard, navigation, and seed
consistent. Select supported targets from the catalog; add ownership rules only
when the behavior requires them.

Use route guards for static permission and route-owned or focused-module checks
for record-dependent access. UI visibility and URL structure do not authorize a
request.

For file inputs in CRUD or custom actions, read the
[asset contract](../carta-module-development/references/frontend-field-contract.md#asset-fields).

## Verification

Select checks with the module
[verification strategy](../carta-module-development/references/verification-strategy.md).
Test rules owned by the change: restricted records, foreign children, invalid
state, server-owned values, rollback, or changed queries. Assert persisted effects
and unchanged rows after rejection. Framework parsing and envelope matrices
belong in framework tests.

Use a real database for SQL, constraints, and transactions; mock external services
at their boundary. Each case owns its fixtures and cleanup. Read
`src/testing/session.ts` for session helpers.

Read `apps/api/package.json` for check commands. API tests migrate their configured
target: inspect the target guard and `.env.test.example` before running them.
Run type-check, lint, and affected tests; check consumers when the wire contract
changes. Report failed or unrun checks.
