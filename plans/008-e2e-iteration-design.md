# 008: E2E Iteration Speed — Design

Date: 2026-09-12
Status: Approved
Path: Bounded discussion, short design in chat, written spec on request

## 1. Purpose

Make the agent E2E iteration loop fast.

Keep full reset for final acceptance. Change only test setup for intermediate runs.

Success measure: a focused rerun after a small fix completes in seconds, not 40–60s.

## 2. Context

Current cost per run:

- `apps/web/e2e/fixtures.ts:50` runs full `e2e:prepare` for each test that uses `authenticatedPage`.
- `apps/web/playwright.config.ts:57,70` sets `reuseExistingServer: false` for API and web. Each run cold-boots route compile, API, and Vite.
- `apps/api/package.json:36` defines `e2e:prepare` as reset plus migrate plus clear plus seed, each in a new process.
- Each failure needs trace plus network inspection.

Skill rules already allow reuse:

- `.agents/skills/carta-module-development/references/ui-automation.md:27-32` says establish fixtures once, then rerun focused checks.
- `.agents/skills/carta-module-development/references/verification-strategy.md:160-171` says reuse passing evidence when inputs stay valid.

Result: no skill rule change is necessary. The fixture is stricter than the skill. Fix the fixture and setup.

## 3. Approaches Considered

A. Warm servers plus once-per-run prepare plus ID-scoped cleanup. Recommended.
B. Make the clean reset itself fast. Useful, but smaller gain and more work.
C. Fewer E2E runs plus fast failure triage. Useful, but does not cut single-run time.

Decision: do A first, then add the failure bundle from C. Do B later if needed.

## 4. Architecture

Two modes:

- Iteration mode for agents: boot API plus web once, prepare DB plus S3 once, clean only owned rows by ID.
- Acceptance mode for final proof: keep full reset.

Acceptance criteria do not change.

## 5. Components

- Fixture: change `apps/web/e2e/fixtures.ts` from per-test `e2e:prepare` to once-per-worker setup plus owned-row cleanup by ID. Keep guarded E2E target.
- Server reuse: keep `reuseExistingServer: false` in committed config. Agents reuse warm servers through an env flag or local script, not through a changed default. This avoids cross-run dirty state in CI.
- Auth: replace per-test UI login with one API login plus Playwright storage state.
- S3: prepare once per run. Tests use one prefix or filename per journey. Cleanup deletes only keys the test created.
- Failure bundle: one command collects failed assertion, logs, screenshot, trace, DOM, console plus network summary under `plans/<feature>/reports/<run>/`.

## 6. Data Flow and Error Handling

Clean run:

1. Check E2E guard.
2. Prepare once.
3. Boot servers once.
4. Run focused cases.
5. Clean owned IDs.
6. Save reports.

Dirty state: if a prior run changes required start state, reprepare that run. Record the reprepare in evidence.

Failure triage: read assertion text plus logs first, then screenshot or trace or DOM only as needed. Do not change source or selectors before the cause is known.

Freshness: code, test, fixture, schema, config, or contract change marks a prior pass stale. Same input fingerprint allows reuse.

## 7. Testing

- Measure one focused rerun before and after on the same case.
- Prove the same assertions pass in iteration mode and in full-reset acceptance mode. One case must pass in both modes.
- Guard: E2E target check stays. No use of Vitest, dev database, or dev bucket.
- Scope: change only E2E setup plus fixture plus failure bundle. No change to product behavior or acceptance rules.

## 8. Next Step

Use `$carta-module-plan` to plan the implementation.
