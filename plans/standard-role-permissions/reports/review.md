Self-review: Plan follows the user request. API, browser and pending-state cases cover the changed behavior. Results pass.

- API: role-mapping.routes.spec.ts passes alone with 60s timeout.
- Web unit: role-permissions.route.spec.ts passes with 7 tests, with a new pagination case. Parent specs pass after importOriginal DetailView mocks.
- Browser: role-mapping.spec.ts passes 2 tests on ports 5280/5281. Pagination shows 1/2 and 2/2 with 11-20 of 20. Optimistic toggle and failed-update restore pass.
- Fix note: role-permissions list meta now returns total, page, pageSize, totalPage so ListView pagination shows under role detail.
- E2E note: keep dev servers off ports 5180/5181, or set CARTA_E2E_API_PORT and CARTA_E2E_FRONTEND_PORT.
