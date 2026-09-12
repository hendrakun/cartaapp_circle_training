# Playwright UI evidence

Use this reference for approved UI acceptance. The design owns the visible
outcomes; the executor selects cases and data that demonstrate them.

## Scripted acceptance

Saved Playwright Test TypeScript cases are the default. Agents run commands and
review reports; computer-controlled clicks are optional diagnosis, not a delivery
gate. Select actors, fixtures, steps and assertions from the approved outcomes. Put IDs
in test titles and name meaningful `test.step` sections. Keep UI-owned assertions
in browser tests and exhaustive access/state combinations at the API.

## Journey and data

Use focused Playwright cases with named steps that map to acceptance IDs.
Use the [journey selection rule](verification-strategy.md#browser-journeys) and
worksheet mapping. Give each selected journey an independent record and distinct
test title. Include child navigation when it changes. Exercise those actions through the visible authenticated UI, then
verify the persisted outcome by reload or navigation. API setup can create
fixtures and establish authenticated actors; it does not replace the interaction
being tested. For an approval journey, seed the pre-approval state and approve
through the UI. Loading an already-approved fixture proves display/reload only.
Start near the target action; test prerequisite creation separately.
Use full sequences when the sequence itself is an acceptance obligation.

Use the guarded E2E target, its dedicated database/storage and documented fixture
owners. Inspect the current `apps/api` E2E scripts, guard and `.env.e2e` setup;
never use the Vitest or development database/bucket for E2E reset. Serialize
preparation and tests sharing that target. Establish known fixtures once, then
rerun focused checks after a justified fix. Reprepare when a prior run changed
the required starting state. Seeded reference data is not disposable by default.

Confirm target configuration and service health. Use the package's Playwright
configuration and supported setup; it owns ports, projects, report paths and
server lifecycle. A development-only visual inspection does not establish the
required automated journey.

Use role and accessible-name locators, then stable test IDs when needed.
Select named fixture records; avoid the first arbitrary row. Fix the clock or
provide explicit dates for time-sensitive behavior. Wait for an observable
result, not a fixed delay. Keep test data isolated and cleanup tied to returned
record IDs, including after a failed assertion.

## Evidence and diagnosis

Use the existing Playwright runner. Record final evidence under the
[verification strategy](verification-strategy.md#evidence-interface). Before execution, check the target and selected case IDs.
After execution, read JSON results and produce a compact summary: required,
executed, passed, failed and skipped IDs; failed step/assertion; report and attachment
paths. A missing case or an unexplained retry pass leaves its obligation incomplete.
The orchestrator checks assertions and source before granting acceptance.


Use the current focused `test:e2e` command and exact spec/test selector. Confirm
the expected cases actually ran, including denied/empty/failure cases selected
for the approved outcomes. Reuse a passing run when code, tests, relevant dependencies,
fixtures and environment are still applicable. A valid run need not be repeated
merely because it was initially called a debug run.

Preserve the configured JSON/HTML reports and relevant attachments under a
unique `plans/<feature>/reports/<run>/` directory before another run overwrites
working outputs. Preserve relative attachment layout or adjust links when
copying. Record the exact command, working directory, design revision, input
snapshot, environment identity and cases/steps covered.

Inspect the failed assertion and logs first, then screenshots, trace or DOM
snapshots as needed. Use interactive browser diagnosis only when artifacts leave
the cause unclear. Inspect these before changing selectors. A selector repair must still test the required interaction. Keep the
failed result and record its replacement pass. A screenshot alone does not
prove persistence, permission enforcement or successful submission.

When visual quality is required, capture selected Playwright screenshots for
review; functional assertions alone do not prove layout quality. Use image
comparison only against an approved baseline.

Use the [verification strategy](verification-strategy.md) for evidence freshness
and verdicts. A supported UI obligation without executable browser evidence
remains blocked; backend, lint and type checks do not silently replace it.
