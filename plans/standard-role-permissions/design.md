# Standard role permissions

Revision 2. Authority: user request and correction, 2026-09-12.
Administrators use the existing operation permissions. Users keep the existing multiple-role behavior. A role can have many permissions. Use the existing detail routes and show a paginated ListView below role details, with Switch controls. Switches change before the response, block repeat requests for that row, and restore server state on error. Keep other rows usable. Keep existing route names. No framework changes.

id: B-1
Active permissions have stable paging, search and access checks.
id: B-2
Permission switches show immediate state, restore on failure, and refresh after success.

id: A-1
Permission list returns bounded pages and total; protected writes persist.
id: A-3
Optimistic switches handle pending, success and error states.

| Obligation | Rule references | Acceptance IDs |
|---|---|---|
| O-1 | B-1 | A-1 |
| O-3 | B-2 | A-3 |

| Journey | Obligation | Acceptance IDs | Distinct interaction |
|---|---|---|---|
| J-1 | O-1 | A-1 | Page, enable, disable and reload role permissions |
| J-3 | O-3 | A-3 | Delay and reject a permission change |
