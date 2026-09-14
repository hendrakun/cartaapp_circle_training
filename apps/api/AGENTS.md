# API agent rules

Use `$api-conventions` for API work and `$carta-module-development` for connected
module delivery. These skills own the procedure. Read the framework reference
only for an unresolved API contract; Users and Roles are examples, not product
requirements.

Resolve commands from `package.json`. Use `test:focused -- <spec paths>` for
affected API tests: it compiles routes, checks the test target and migrates it.
Use the full suite after focused checks pass. Preserve complete command output
and the real exit status under the module verification strategy.

Tests use the migrated schema and own their fixture rows. Keep shared database
tests serial. Schema-replacement tests need a separate isolated target.
Use `src/testing/session.ts` for sessions and cleanup.

Before development setup, confirm the target, migration history and authority.
Test setup is not development setup. A table/history mismatch needs a reported
reconciliation decision, not an improvised reset. Applied migrations remain
unchanged. Production, external and destructive writes require authorization.
