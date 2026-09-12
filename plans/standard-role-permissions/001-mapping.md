# Plan P-001: Standard role mapping

- Design: design.md revision 2, user request
- Acceptance: A-1, A-3
- Depends on: NONE
- Source: cd72277f758db0f2c225965c2c6cb02cee5f3bdf with unrelated dirty framework/tooling/skill files preserved.
- Scope: apps/api, apps/web, generated migration, focused tests, this plan. Test databases only.

## Owners and interfaces

Keep authenticated scopes and operation guards. GET /roles/:roleId/permissions accepts page, limit, search and supported sort; returns data and total. PUT/DELETE keep existing permission mapping contract.
Web actions forward list query and normalize totals. ListView uses the assigned cell slot and Switch. A local pending value per role and permission provides the optimistic display; successful custom writes invalidate the resource.

## UI contract

See ui-contract.json. Use existing ListView and DetailView; remove the single role permission tab label so the table sits below the detail view. Switch does not expose button attributes, so use a supported local attribute binding if needed for an accessible button. No framework edits.

## TDD cycles

| Cycle | Acceptance IDs | Test case | Fixture / actor | Assertions | Expected red | Implementation owners | Review timing | Consequence |
|---|---|---|---|---|---|---|---|---|
| C-1 | A-1 | apps/api/src/routes/(authenticated)/roles/role-mapping.routes.spec.ts::paginates active permissions and protects mapping writes | Isolated admin and target records | See design A-1 | Current behavior differs | roles API | before-implementation | Access and stored roles |
| C-3 | A-3 | apps/web/src/routes/(authenticated)/settings/roles/[roleId]/detail/permissions/role-permissions.route.spec.ts::shows the new state and disables the switch while the request is pending | Isolated admin and target records | See design A-3 | Current behavior differs | permission table | after-plan | NONE |
| C-4 | A-3 | apps/web/src/routes/(authenticated)/settings/roles/[roleId]/detail/permissions/role-permissions.route.spec.ts::restores the previous state when a pending toggle fails | Isolated admin and target records | See design A-3 | Current behavior differs | permission table | after-plan | NONE |
| C-5 | A-1 | apps/web/e2e/role-mapping.spec.ts::A-1 A-3 permission paging and optimistic updates | Isolated admin and target records | See design A-1 | Current behavior differs | permission table | after-plan | NONE |
| C-6 | A-3 | apps/web/e2e/role-mapping.spec.ts::A-3 failed permission update | Isolated admin and target records | See design A-3 | Current behavior differs | permission table | after-plan | NONE |

## Commands

Use API test:focused with the role mapping and user specs; web test:focused with role/user specs; test:e2e with role-mapping.spec.ts. Run both app type checks and lint. Record runs under reports. API test target guard must pass. Inspect E2E target before migration and seed; do not reset shared records.

## Review

Self-review: source and requested behavior support these components and cases. Write tests first. Review failed API assertions before changes.
