# Execute a module

## Assignment

Keep one executor for connected work through implementation and repair. Delegate
when a worker can keep that ownership; use direct execution if the environment
would require fresh workers for each checkpoint. Split workers only for genuinely
independent work with non-conflicting files and test targets.

An assignment names the requested result, exact owners/patterns, unresolved facts,
permitted writes, environment and completion check. Pass decisions, not the
transcript or an instruction to rediscover them. The active assignment contains
one usable result and its prerequisites; remaining work stays in the work record.

For UI delivery, include API, page, navigation, permissions and development setup
in that first result. An API-only assignment cannot establish a UI checkpoint.
Keep useful generated files within task scope instead of deleting and recreating
them to enforce a layer boundary. Check the first rendered result and test
assertions before repeating the pattern.

Full-process work uses the [worksheet state rules](module-execution-worksheet.md#state-and-completion).
Standard work uses the short record; no worksheet checker is needed. Keep work
with an early interface dependency in one plan when a split would block useful
progress or require a false completion state.

## Prepare and build

Resolve current package commands and reuse a current preflight. Select only
needed capabilities with `pnpm module:preflight -- --needs <capabilities>`.
Establish the intended development target and write authority before setup is
needed. Test/E2E targets and development preview are separate.

Before migration generation, check the affected entity import structure and
existing data. Resolve connected-entity/audit references using the supported
pattern; keep schema declarations and SQL consistent. A module task does not
authorize a framework redesign or removal of required constraints.

As soon as the first viable schema and page are ready:

1. Review migration SQL and identify the target. Apply pending migrations
   within authority using the existing migration command, not reset/refresh.
2. Inspect and run the required permission/system seed within authority. Preserve
   existing data; demo records and account changes are not automatically required.
3. Check that the intended user can reach and use the page. Report its URL,
   migration/seed result and unfinished work before final verification.

Ask early if the target or write authority is unclear. Never substitute test/E2E
reset commands for development setup. A remote target is not disposable merely
because its configuration is available. Once applied to any target, keep migration
history intact; use a new migration for subsequent changes.

Generation is optional under [bounded generation](bounded.md). If a known
restriction blocks it, preserve the worktree and use normal source edits.
After route changes, use the current supported route/type-generation command
before interpreting stale route names as application type errors. Resolve a
missing command once; do not repeatedly clear caches or rewrite declarations.

## Progress and recovery

Use the [tight loop](verification-strategy.md#tight-loop). Report completed
results, material failures and blockers with the next action. Preserve full
output and the real command status so diagnosis does not require a rerun.

On interruption, inspect saved changes/results and resume the same executor.
Transfer only unfinished work when recovery is not possible. Stop the old
executor before transferring ownership. Elapsed time alone does not establish
failure, but an unclear result requires diagnosis before more assignments.

## Review and finish

Return changed owners, observed results, current evidence and remaining work.
Use [verification strategy](verification-strategy.md#evidence-interface) for the
chosen path. Review the feature once unless a separate result needs independent
acceptance. Prefer an independent `$verify-carta-module` reviewer at completion;
label self-review when delegation is unavailable or the user requests direct work.

Review against the original request and later decisions. Fix material in-scope
defects without requesting new implementation approval. Ask only for changed
requirements, scope or write authority. Optional suggestions do not block a
correct result. Report failed checks and missing proof separately from defects.

Update the existing work record, relevant application-map entries and, only for
the full process, worksheet states. Report source readiness, development preview
and verification separately. Record time to usable preview as well as total
elapsed time; keep user waits and external blockers distinct.
