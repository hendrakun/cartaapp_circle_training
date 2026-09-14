# Test session helpers

Use `src/testing/session.ts` for the current fixture API and return types.
`createSystemSession([], label)` creates a signed-in user without permission
grants. Use explicit grants only when the behavior requires them.

Route tests use the migrated schema. Create unique owned rows with `testId`;
delete business rows before session cleanup when they reference session users.
`cleanupSessions()` also runs before the pool closes. Each spec closes its pool.

Do not rebuild shared tables in a route test. Schema-replacement tests need a
separate isolated target. A failed setup is not permission to reset the database.
