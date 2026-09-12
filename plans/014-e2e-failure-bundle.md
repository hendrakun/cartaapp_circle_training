# Plan 014: Preserve E2E failure evidence in one local bundle

> Read the full plan and run each check. Report failed or missing evidence.
> Update only the 014 status row after implementation and review.
>
> **Drift check**: `git diff --stat cdbc12b..HEAD -- scripts/e2e-failure-bundle.mjs scripts/e2e-failure-bundle.test.mjs apps/web/e2e/fixtures.ts apps/web/e2e/failure-bundle.spec.ts .gitignore plans/014-e2e-failure-bundle.md plans/README.md`
> Also run `git status --short`. Plans 012/013 can change the fixture first;
> retain their behavior and stop only for unexplained contract changes.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED — raw browser evidence can contain private session data.
- **Depends on**: none; retain 012/013 if present
- **Category**: dx
- **Planned at**: commit `cdbc12b`, 2026-09-12
- **Status**: TODO; no failure bundle has been implemented or verified.
- **Design**: `plans/008-e2e-iteration-design.md`; preserve failed assertions,
  logs, screenshots, traces, DOM, console, and network evidence before reruns.

## Why this matters

This plan reduces the time needed to diagnose a failure. It does not make a
passing test run faster. Existing reports contain useful evidence, but not
standalone browser console and network records. Add only those missing records
and a small report collector. Measure its overhead on successful runs.

## Current state

- `apps/web/playwright.config.ts:36` already has:

  ```ts
  outputDir: 'test-results',
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  ```

  Lines 45–47 retain failed screenshots and traces; video is off.
- `apps/web/e2e/fixtures.ts:48` provides the shared test fixture but installs no
  console, page-error, request-failure, or HTTP-error listeners.
- Installed Playwright 1.62.1 `playwright/types/testReporter.d.ts:267–359`
  defines nested suites, per-test results, errors, stdout/stderr, optional steps,
  and attachments with a path or encoded body. It has no network/body field.
  Do not assume browser console equals test stdout, or server logs equal test
  stderr. A fixture/setup failure may have no page, screenshot, or trace.
- [Trace Viewer](https://playwright.dev/docs/trace-viewer) already shows DOM
  snapshots and request details. Keep the trace; do not parse its private ZIP
  format or create another full DOM dump.
- `scripts/module-evidence.mjs:1` uses Node built-ins and an ESM CLI. Its
  `canonicalAbsolute`/`within` helpers show path checks. Its test file uses
  `node:test`, temporary directories, and cleanup:

  ```js
  import { strict as assert } from 'node:assert'
  import { test, afterEach } from 'node:test'
  ```

- `.gitignore:30–32` ignores Playwright reports, results, and auth state, but
  does not ignore `plans/e2e-iteration/reports/`.
- `apps/api/src/routes/(authenticated)/files/presigned-url/+server.ts:17`
  creates `uploads/<uuid>.<extension>` itself. Tests cannot supply a prefix.
  No current browser test uploads a file. An unused prefix helper would not
  control cleanup, so do not add it.

## Scope

Only modify:

- `scripts/e2e-failure-bundle.mjs` (new)
- `scripts/e2e-failure-bundle.test.mjs` (new)
- `apps/web/e2e/fixtures.ts` (failure diagnostics only)
- `.gitignore` (add `/plans/e2e-iteration/reports/` only)
- `apps/web/e2e/failure-bundle.spec.ts` (temporary proof; remove before delivery)
- This plan (evidence) and `plans/README.md` (014 row).

Do not change config, reporters, trace settings, product code, S3, API scripts,
framework packages, existing assertions, prepare policy, or auth policy. No new
dependency. No upload helper until an upload test needs it. Future upload tests
must record the actual returned asset keys and delete only those owned keys.
Full guarded bucket clear remains in prepare, including iteration preparation.
Use the current branch. Do not commit, push, or publish without a user request.

## Steps and commands

All commands run from the repo root unless stated otherwise.

### 1. Add bounded browser diagnostics

Before changing the fixture, record the three baseline timings specified in
step 4. Keep the same server and prepare policy for the later comparison.

Add an automatic test fixture to `fixtures.ts` that attaches listeners to the
built-in `page` before `authenticatedPage` runs. Record console warnings/errors,
page errors, `requestfailed`, and HTTP responses with status >=400. HTTP 4xx/5xx
responses do not emit `requestfailed`, so both listeners are needed.
Keep at most 100 entries per category and 1,000 characters per text entry;
record dropped-entry counts. Do not read request/response bodies or headers.
Strip query strings, fragments, and URL user information. Omit auth-route
network details and replace known secret values in captured text. Do not read
`.env` only to collect diagnostics; use values already available to the fixture.

In teardown, attach one `diagnostics.json` only when actual and expected status
differ. Include explicit empty categories. Remove listeners in `finally`.
The fixture must not mask the original failure if the page closed or attachment
creation fails. Keep failures before fixture setup visible through report errors.
Do not start an extra browser context. Raw trace and screenshot data remain
private evidence; text filtering cannot make them safe for publication.

**Verify**:

```sh
pnpm --filter @southneuhof/framework-web lint:focused -- e2e/fixtures.ts
pnpm --filter @southneuhof/framework-web test:e2e -- --list
```

Both exit 0. Existing tests still load. Passing runs add no diagnostics file.

### 2. Write the collector and one focused test file

CLI contract:

```sh
node scripts/e2e-failure-bundle.mjs --help
node scripts/e2e-failure-bundle.mjs plans/e2e-iteration/reports/run-001
```

Resolve repository input paths from the script location, not the caller's cwd.
Read `apps/web/playwright-report/results.json`. Require a new destination under
`plans/e2e-iteration/reports/`; reject an existing destination, path traversal,
and symlink escape before writing. Ignore that report tree before the real proof.

Walk nested suites and all project results. Include failed, timed-out, and
interrupted attempts, plus top-level setup/server/discovery errors. Preserve
attempt/retry indices and expected status; label expected failures and recovered
attempts correctly. Do not describe a skipped test as a pass. If no failure or
run error exists, exit nonzero with a clear message. Missing/malformed JSON also
exits nonzero. A run error with no test attachments is still a valid bundle.

Write `summary.md` with run timestamp from the report, test file/title/project,
failed step when present, errors, available stdout/stderr, and relative artifact
links. Read the report's attachment list, not the whole results directory.
Resolve relative attachment paths against the web report context verified with
a real report. Allow only regular files inside the real `apps/web/test-results`
or `apps/web/playwright-report` trees; reject symlinks/escapes. Copy allowed
attachments to unique per-test/per-attempt names; support encoded attachment
bodies. State which referenced files are missing instead of inventing links.

Write `network.md` from `diagnostics.json` only. List method, sanitized URL,
status or transport error. If unavailable, say so and link the trace when
present. List DOM as available in the trace, never as an invented standalone
file. List API/web server logs as unavailable unless separately recorded; the
existing reporters do not provide a full server log archive.

Record report timestamp and source paths so the operator can identify a stale
report. Do not silently label an old result as the latest command. State this
limit in `--help`. Copy before the next test run overwrites source artifacts.
All output is local ignored evidence, including raw trace/screenshots and error
text. Do not claim complete redaction. Never copy `.env` or `.auth` files, dump
process environment, or publish the bundle. Validate metadata and filenames
before using them in paths or Markdown links.

Use built-ins and `node:test`, following `scripts/module-evidence.test.mjs`.
Tests can call an exported collector with temporary input roots; keep those
inputs out of the public CLI. Cover nested suites, duplicate titles, attempts,
top-level errors, no failures, invalid JSON, missing attachments, encoded bodies,
valid copied links, traversal/symlinks, existing output, absent diagnostics, and
sentinel private values in URL/header/body fields that must not enter network.md.

**Verify**:

```sh
node --check scripts/e2e-failure-bundle.mjs
node --test scripts/e2e-failure-bundle.test.mjs
node scripts/e2e-failure-bundle.mjs --help
```

All exit 0. Negative CLI cases in the test file must return nonzero. No API or
storage access is needed for these checks.

### 3. Prove one real failure and preserve it before a green rerun

Create the temporary proof file only if it does not already exist. Import the
shared fixture. Add one case using `authenticatedPage` and controlled browser
requests on the web origin. Use `page.route` to produce one 500 response and
one transport abort. Trigger a console warning, then deliberately fail a simple
assertion. Do not edit an existing product assertion. Do not send synthetic
requests to external services.

With ordinary E2E infrastructure available, run:

```sh
pnpm --filter @southneuhof/framework-web test:e2e -- failure-bundle.spec.ts
node scripts/e2e-failure-bundle.mjs plans/e2e-iteration/reports/run-001
```

**Verify**: Playwright exits nonzero for the deliberate assertion. The collector
exits 0. Summary names the exact case and assertion, links a real screenshot and
trace, and includes console output. Network summary contains both the controlled
500 and aborted request. Each copied link resolves. Trace opens with the local
Playwright `show-trace` command and contains DOM data.
Run `git check-ignore plans/e2e-iteration/reports/run-001/summary.md`; it must
print that path. Raw evidence must not appear in `git status --short`.

Change only the deliberate assertion in the temporary file to pass and rerun
that exact case. Expect exit 0 and no failure diagnostics attachment. Confirm
the preserved bundle still exists. Remove only this temporary file. Keep the
failed and green results in the local record; a later pass does not erase a
failure. Do not use a no-match `-g` run as proof of a browser assertion failure.

### 4. Check cost and record evidence

Measure the same RBAC command three times before and after adding diagnostics,
with the same server and prepare policy:

```sh
/usr/bin/time -p pnpm --filter @southneuhof/framework-web test:e2e -- rbac-smoke.spec.ts
```

Record both medians. If overhead is material, reduce capture work inside scope;
do not remove existing traces to improve the measurement. Run focused fixture
lint, the Node checks, and `git diff --check` again. All must exit 0. Update only
the 014 row with the ignored bundle path and check results.

## Done criteria

- [ ] Node tests, syntax check, focused fixture lint, and diff check pass.
- [ ] Real assertion failure has the correct summary and valid copied links.
- [ ] HTTP 500, transport failure, and console warning appear in diagnostics.
- [ ] DOM is available through the preserved trace; missing evidence is explicit.
- [ ] Top-level errors work without browser attachments; stale-input limits are clear.
- [ ] The green proof passes without a failure attachment; temporary spec removed.
- [ ] The bundle is ignored and survives a later run; no secret files are copied.
- [ ] Passing-run timing is recorded; no passing-run speed gain is claimed.
- [ ] The 014 row contains evidence before DONE.

## STOP conditions and maintenance

Stop if report fields differ from the checked contract, infrastructure blocks
the real proof, two in-scope fixes fail the same check, or product changes are
needed. Do not invent absent data or expand to custom trace parsing.
Recheck the JSON shape when Playwright changes. Keep network capture bounded.
Add upload cleanup only with a real upload journey and its returned object keys.

## Implementation record — 2026-09-12

STATUS: STOPPED

The host filesystem reported 100% use and refused new pnpm lock and formatter
writes. The required report artifact, real failure bundle, trace copy, green
rerun, and timing proof could not run. This meets the infrastructure STOP
condition. No plan 014 source file was changed.

### Resumed result after storage recovery

STATUS: COMPLETE WITH INCOMPLETE MEASUREMENT

- Syntax check, 3 Node tests, focused fixture lint, and diff check passed.
- The deliberate assertion failed as expected. The ignored bundle is
  `plans/e2e-iteration/reports/run-002/`.
- Summary links resolve to screenshot, trace, context, and diagnostics files.
  It contains the console warning. Network data contains the 500 and abort.
- The green rerun passed without diagnostics. The bundle remains, and the
  temporary proof spec was removed.

Deviations: equivalent three-sample passing timing was not recorded. The Node
tests cover main copy, run error, clean report, traversal, malformed JSON,
existing output, and encoded bodies, but not each listed test permutation.

### Collector review correction

The merge review corrected output symlink-parent escape, report-relative
attachment resolution, missing allowed roots, regular-file checks, copy
overwrite behavior, duplicate artifact names, all diagnostics summaries, and
network metadata validation. Summary output now includes file, failed step,
stdout, stderr, and recovered-attempt state. Eight focused Node tests and
`git diff --check` pass after these corrections.
