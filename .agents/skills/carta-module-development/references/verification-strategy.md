# Verification strategy

Verify the requested user result, not the document shape or test count.
Start with the original request and later decisions. An implementation example
or inferred default cannot override them. Optional refinements are not gates.

## Select proof by behavior and impact

Choose the smallest check that detects a plausible wrong result. Reuse checks
for the outcomes they actually establish. Keep access and data protection real.

| Risk | Useful proof |
|---|---|
| Input/domain validation | Focused schema/API accepted and rejected values. |
| Relation | Correct identity persists, list/detail show the label, edit loads it; invalid references fail at the API. |
| Access | Intended users can read; unauthorized writes fail and leave data unchanged. |
| Filter | Distinguishing records show the correct filter result and count. |
| Workflow | Legal/illegal transitions, coupled stored effects and rollback; races only where required. |
| UI integration | Actual populated list/detail/form output and a representative browser path. |
| Migration | Reviewed SQL and relevant existing-data checks on an isolated target. |

For the standard base and added workflows, record checks in the short work record. No
acceptance IDs or per-surface rows are required. For the full process, map
required outcomes and selected evidence surfaces in the worksheet.
An added workflow needs proof of its changed behavior and its restrictions on
CRUD, not another run of unchanged standard-control tests.

## Test ownership

Use established framework contracts for unchanged standard composition. Reuse
known current coverage; do not audit the framework suite for each new field.
A known coverage gap or changed control requires a focused integration check,
not a repeated framework matrix in each module. A mocked control cannot prove
the real browser interaction.

| Owner | Proof |
|---|---|
| Framework unit/component | Conversion, validation pipeline, dependency clearing and filter/page state. |
| Framework browser | Real controls, calendar/lookup operation, overlays and focus. |
| Module form/API | Actual schema and field configuration, relation source/identity, access, business rules and stored effects. |
| Application browser | Representative assembled path and custom/uncovered interactions. |

Use actual module schemas and fields in form integration checks. Prove the
correct parent/child connection, not the framework clearing algorithm again.
Page readiness is synchronization, not a separate module acceptance case.
Framework gaps outside scope are follow-up work; retain the smallest necessary
local proof and report any material result that remains unverified.

## Browser journeys

Inspect populated list, detail and edit surfaces early. Check meaningful names,
values, required fields and action placement. A form lookup passing does not
establish the relation's list/detail display.

Use one compact browser path per distinct integration risk, not per resource
or validation branch. Equivalent standard forms can share it. Use meaningful
module data, including relations or optional inputs that distinguish the changed
integration; a name-only smoke cannot prove the rest of the form.

For selected paths, operate real controls, observe the visible update and verify
persistence after reload or navigation. Seed prerequisites on the isolated target.
Keep exhaustive validation and permission combinations at the API. Split custom
workflow paths when sequence, required inputs or recovery actually differs.
Explicit user-required checks remain required.

Only the full process uses journey IDs and exact worksheet mappings. Run its
`check_worksheet.py --browser-report` against preserved Playwright JSON.
A matching title proves neither sufficient assertions nor fresh evidence.

## Test justification

Before adding a test, identify the wrong result it detects and the gap in existing
coverage. State this briefly in the work update when it is not evident; no new
ledger is needed. Inspect assertions before the first expensive browser run.
Extend a suitable behavior test before creating another file.

Assertions should survive harmless implementation changes. Exact copy, field
order and configuration literals need an explicit public/product requirement.
Check actual field effects and displayed values, not copied arrays or source text.
Preserve accessible control use. A failing locator is not a reason to change
the product to suit the test.

## Tests that earn their cost

Standard CRUD needs focused module API proof and a representative assembled
browser path, with rendered checks for changed display values. Reuse existing
proof; generated tests are editable starting points, not a required test matrix.

- Assert public results and stored effects, not status codes alone.
- Use the few fixtures that distinguish the fault. Give them unique identities;
  clean up only owned rows in dependency order, including after failure.
- Keep one sequential test when the sequence is the behavior. Separate unrelated
  rules when one failure would hide another.
- Use installed helpers and inferred types. Mock external boundaries where
  appropriate, not the authorization/persistence boundary being claimed.
- For a regression, demonstrate the intended failure when practical. A setup or
  compile failure does not establish that the assertion detects the defect.

## Commands and environment

Resolve current scripts, config and focused selectors once. Zero selected tests
and skipped required cases are not passes. Generated API evidence proves only
its actual success, persistence, access and payload assertions.
A generated browser journey proves only the path and values it exercises.
An omitted manual check stays unverified.

The root test command does not run application Playwright. Loom browser tests
and application E2E are separate surfaces. Use guarded isolated test/E2E targets,
never the development database for a test reset. Serialize checks sharing mutable
data and memory-heavy type checks. Prepare ordinary prerequisites within authority;
report exact blockers rather than substituting static checks for runtime proof.

Use [UI automation](ui-automation.md) when running browser tests. Development
migration and seed readiness follow [execution](execution.md#prepare-and-build).

## Test order

Use test-first work for regressions and critical access/data-loss rules when
practical. Routine new routes and forms can be implemented before their focused
tests. User-required gates still apply. Preserve approved behavior when repairing
tests; changed requirements need the decision owner's authority.

## Tight loop

Run a focused check after a meaningful boundary change. Preserve complete output,
the exact command and its real exit code. A pipe to `tail` or `grep` can hide a
failed command; capture the status of the check itself. Read saved output rather
than rerunning a test only to show another portion.
Use the harness's saved output, the existing evidence recorder, or redirect a
command to a new log and preserve its status before reading the log. A full
suite is a final integration check, not the loop for one known failure.

Classify a failure as source, test, fixture, environment, tooling or requirement.
Correct the cause, then rerun affected checks. After two failed attempts at the
same fault, report the evidence, proposed cause and next different check before
more repairs. For browser faults, inspect the active page and failure artifacts.
If the cause remains unknown after that check, stop the affected repair and
request a focused diagnosis or missing authority; continue independent work.
Compare a baseline only in an isolated checkout with a matching isolated target.
Stashing tracked files leaves untracked files and database state unchanged.
Keep useful failure artifacts; a later pass does not erase them.

Reuse sufficient passes while owners, dependencies, tests, fixtures and environment
remain applicable. A new reviewer or a final-report label is not a reason to rerun.
Environment drift can invalidate evidence without a source change.
For login-only reads, use a signed-in fixture without module read grants.
For shared API tests, use the migrated schema and clean up owned rows. A test
that must replace schema needs its own isolated target, not the shared suite DB.

## Evidence interface

For the standard base and added workflows, preserve command output, exit status, selected
cases, source state and non-secret environment identity in the existing work
record or linked reports. Keep browser artifacts for visible checks and diagnosis.
Check relevant changes on resume. No recorder JSON is mandatory; do not repeat a
valid run just to change its report format.

A work-document edit requires review of its changed requirements, not an automatic
runtime rerun. Changed behavior still needs sufficient assertions. If a test or
generator consumes a document, that document is a runtime input.

For the full process or explicitly required recorded evidence, use
`node scripts/module-evidence.mjs --help`. Select the recorder before the final
run; it preserves output and checks input changes during execution. Include actual
owners, tests, fixtures, config, lockfile and affected dependencies, including
dirty/untracked files. Fingerprinting a snapshot file alone does not fingerprint
the source paths listed inside it. Preserve the current recorder contract:
include the approved design and keep reports/status output outside the input set.
Do not edit old reports or remove inputs to make stale evidence pass.

Full-process results need exact command, working directory, selected cases,
environment identity, source/design revision, relevant content fingerprints and
artifact paths. Update worksheet links at handoff/review, not after each command.
Static checker PASS, runtime PASS and acceptance are different claims.
Inspect current generated source as normal code; template comparison is not
verification of edited files. Reuse a current generation preview if applicable.

## Verdicts

- `PASS`: requested outcomes work with sufficient current evidence; required
  development preview setup is complete or explicitly outside delivery scope.
- `REWORK`: an in-scope defect or material proof gap needs correction.
- `BLOCKED`: a missing decision, authority, environment or evidence prevents
  a sound verdict. Name the affected user result.

Separate defects, material verification gaps and non-blocking suggestions.
Each blocking finding states its user/access/data consequence or the important
outcome left unproved. Do not block on optional polish or documentation layout.
Do not waive required behavior, security or data protection as a time-saving step.
