# Standard role permissions worksheet

- State: `READY`
- Feature: standard-role-permissions
- Design and approved revision: design.md revision 2, user request
- Active plan: P-001
- Next action: Verify plan evidence
- Write boundary: Application owners, migration, tests and this plan
- Blocker: NONE
- Latest review: reports/review.md

| Obligation | Acceptance IDs |
|---|---|
| O-1 | A-1 |
| O-3 | A-3 |

| Plan | File | Depends on | Status | Review |
|---|---|---|---|---|
| P-001 | 001-mapping.md | NONE | DONE | reports/review.md |

| Acceptance | Required surfaces |
|---|---|
| A-1 | API, BROWSER |
| A-3 | UNIT, BROWSER |

| Journey | Test case |
|---|---|
| J-1 | apps/web/e2e/role-mapping.spec.ts::A-1 A-3 permission paging and optimistic updates |
| J-3 | apps/web/e2e/role-mapping.spec.ts::A-3 failed permission update |

- Browser report: DONE

| Acceptance | Plan | Surface | Test case | Implementation | Red | Green | Review | Result |
|---|---|---|---|---|---|---|---|---|
| A-1 | P-001 | API | apps/api/src/routes/(authenticated)/roles/role-mapping.routes.spec.ts::paginates active permissions and protects mapping writes | roles API | DONE | DONE | DONE | PASS |
| A-3 | P-001 | UNIT | apps/web/src/routes/(authenticated)/settings/roles/[roleId]/detail/permissions/role-permissions.route.spec.ts::shows the new state and disables the switch while the request is pending | permission table | DONE | DONE | DONE | PASS |
| A-3 | P-001 | UNIT | apps/web/src/routes/(authenticated)/settings/roles/[roleId]/detail/permissions/role-permissions.route.spec.ts::restores the previous state when a pending toggle fails | permission table | DONE | DONE | DONE | PASS |
| A-3 | P-001 | UNIT | apps/web/src/routes/(authenticated)/settings/roles/[roleId]/detail/permissions/role-permissions.route.spec.ts::shows pagination under the role detail | permission table | DONE | DONE | DONE | PASS |
| A-1 | P-001 | BROWSER | apps/web/e2e/role-mapping.spec.ts::A-1 A-3 permission paging and optimistic updates | permission table | DONE | DONE | DONE | PASS |
| A-3 | P-001 | BROWSER | apps/web/e2e/role-mapping.spec.ts::A-3 failed permission update | permission table | DONE | DONE | DONE | PASS |
