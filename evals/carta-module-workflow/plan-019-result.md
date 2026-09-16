# Plan 019 result — blocked

- Date: 2026-09-13
- Model: GPT-5 for baseline and candidate workers
- Baseline: `7eb093d`
- Candidate: `29e4abe`
- Raw baseline: `.local/carta-module-forward-test/20260913-plan019/baseline/.local/plan019-baseline-results.md`
- Raw candidate: `.local/carta-module-forward-test/20260913-plan019/candidate/.local/plan019-candidate-results.md`

## Decision

`BLOCKED`. The documented generator command is not the live command contract:

```text
pnpm scaffold:bounded-module -- --manifest <path> --check
FAIL: Unknown argument: --

pnpm scaffold:bounded-module --manifest <path> --check
PASS
```

Plan 019 makes this mismatch a stop condition. Generator code is outside this
plan, so this run did not change it.

## Controlled trials

| Trial | Baseline | Candidate | Time comparison |
|---|---|---|---|
| Standard scalar module | Blocked before implementation | Preflight blocked runtime; read-only preview passed with the corrected command form | Not valid |
| Standard actions plus custom Detail | Blocked before implementation | Preflight blocked runtime; read-only preview selected List/Create/Update and Update hydration | Not valid |

The baseline worktree had no dependencies, local environment files, PostgreSQL,
storage service or isolated runtime target. Candidate preflight failed because
`apps/api/.env`, `apps/web/.env`, `apps/api/.env.test` and `apps/api/.env.e2e`
were absent. No migration was applied, no seed ran, and no database, storage or
browser write occurred. API and browser cases are `NOT_RUN`. Both trial verdicts
are `BLOCKED`; no speed claim is supported.

## Evaluation and review

The six new case branches exist, but their run is `NOT_RUN`: the independent
review found that four cases request a plan instead of an observable command run,
and two fixtures supply a written failure instead of producing it in an isolated
target. The exploratory worker answers are not grades.

Independent review of steps 1-5: `REWORK`.

- Keep the module router, bounded reference, selected preflight rule and plan row.
- Revise the retired-command test so it scans fenced commands too.
- Keep evidence sufficiency in `verification-strategy.md`; replace duplicate
  verifier rules with one pointer.
- Revise evaluation fixtures so workers run real read-only commands and real
  isolated failure cases.
- Replace exact sentence checks with decision checks.

## Checks

- Focused contract tests: 22 pass.
- Skill validation: all three changed skills are valid.
- Full module tooling: 88 Node tests and 2 Python tests pass.
- `git diff --check`: pass before this result update.

A new small plan must correct the public command contract and review findings
before the evaluation and controlled trials run again.

## Resume after Plan 020 — 2026-09-13

Plan 020 corrected the public command contract. The documented form with the
lone pnpm separator now reaches manifest processing in the scaffold, verifier
and internal integration commands.

One independent candidate worker ran the six revised execute-stage cases. Raw
redacted output is at
`.local/carta-module-forward-test/20260913-plan019/resumed-evaluation.md`.

| Case | Result | Evidence |
|---|---|---|
| `partial-standard-module` | PASS | Manifest is `VALID`, writes are empty, List/Create/Update are selected, and custom Detail stays manual. |
| `update-without-detail` | PASS | Manifest is `VALID`; the technical read uses Update permission, no Detail surface exists, and the seeded browser path returns to List. |
| `read-only-seeded-module` | PASS | Manifest is `VALID`; List/Detail, exact seed, API proof and browser proof paths are present. |
| `custom-relations` | PASS | Standard scalar work is selected; relation, child, scope and custom browser work stay manual. |
| `environment-failure` | PASS | Browser preflight reports the missing E2E file and correction; independent manifest check passes. |
| `migration-contamination` | PASS | The isolated rollback check rejects the unrelated operation and restores invocation-owned writes only. |

No case applied a migration, ran a seed, changed product source or used an
external target. This run changes the six-case evaluation from `NOT_RUN` to
partial completion. It does not remove the controlled-trial runtime blocker and
does not support a speed claim.

## Controlled runtime trials — second run, 2026-09-13

Local setup is now complete (API 5180, web 5181, test DB `carta_api_test`,
E2E DB `carta_e2e`, bucket `carta-e2e`, Chromium). Both trials ran in the
existing disposable worktrees with the same model (GPT-5), approved behavior,
isolated targets, and time definition. Raw redacted records stay under
`.local/carta-module-forward-test/20260913-plan019/` (worktree `.local/`
files, git-ignored). The candidate worktree was moved from `29e4abe` to
`2d66df8` before Trial A; Trial B baseline ineligibility was proved at
`7eb093d`.

| Trial | Baseline (`7eb093d`) | Candidate (`2d66df8`) | Time comparison |
|---|---|---|---|
| A: standard scalar module | Check only: old generator `VALID`, 18 paths, 1 active minute; API/browser `NOT_RUN` (no runtime in worktree at that time) | `--check` + one `--apply` (20 files, 0 rewrites), ~6 active min; API spec 1/1 PASS on `carta_api_test`; browser 0/1 (spec asserts a dynamic record-name heading; `DetailView` renders the static resource title) | Not valid: correctness differs (browser unverified on candidate) |
| B: standard actions plus custom Detail | Manual path (old generator correctly rejects the subset, 2 `--check` rejections cited), 16 active min; API 1/1 PASS; browser 1/1 PASS; verdict `PASS` (full web type-check unrun) | `--check` + one `--apply` (15 files + 1 manual Detail file, 0 rewrites), ~12 active min; API 1/1 PASS; browser 0/1 (spec asserts `<table>` on the approved no-seed empty list, which renders `No data`) | Not valid yet: candidate browser journey unverified |

Neither trial applied a migration outside guarded test/E2E paths, ran a seed
manually, or touched dev/shared/prod data. Setup failures after
implementation start: Trial A candidate 2 (preflight web-probe JSON false
negative on 5181; one hard-coded CommandPalette expectation broken by the new
nav entry — both environment/pre-existing, not module defects); Trial B
candidate 2 (Trial A git-dirty guard collision, worked around; orphan
`trial_services` table in the shared disposable test DB, cleaned).
Compilations/compactions: 0. Unusable worker work: 0.

Independent `$verify-carta-module` verdicts: baseline Trial B `PASS`;
candidate Trial A `REWORK` (fix the two heading assertions to the static
title plus table value, rerun one browser journey); candidate Trial B
`REWORK` (make the generated spec robust to the no-seed empty state, update
the stale `not.toContain(detail)` integration assertion, add custom-Detail
browser steps, rerun to green).

## Decision — 2026-09-13

Trials complete; speed claim still unsupported (candidate correctness differs
on both browser journeys). Classification:

- Keep: selected preflight before substantial work; partial-action generation
  with Update-hydration technical read; one `--apply` with source ownership;
  generated-evidence limits (both REWORK verdicts apply them correctly).
- Revise (needs a new small plan): generated e2e template asserts a dynamic
  record-name heading (fails against `DetailView` static title) and a
  `<table>` on an empty list (fails on the approved no-seed scope);
  generated integration spec goes stale when the approved manual Detail route
  is added. Also note the preflight web probe reports FAIL on a live Vite
  HTML page (expects JSON) — test/tooling owner, outside module scope.
- Remove: nothing; the manual baseline path stays as the fallback the old
  generator's subset rejection already requires.

Checks: `pnpm test:module-tooling` 91 Node + 2 Python pass;
`git diff --check` pass. Main checkout tree clean; trial implementation
lives only in the disposable worktrees.

## Generator fix and green reruns — 2026-09-13

Commit `b5f7d0d` fixes the generated e2e template (`renderBrowserSpec`):
Detail assertions use the static resource title plus the record cell instead
of a dynamic record-name heading; the no-seed empty list asserts list chrome
instead of `<table>`. Contract test added (92 Node tests pass).

Both candidate journeys rerun green against committed-equivalent output in
the candidate worktree (specs refreshed from the fixed template; worktree
generator file restored clean): `trial-products.spec.ts` PASS (~13.6 s),
`trial-services.spec.ts` PASS (~11.5 s), exit 0. Custom Detail proof
(`trial-services-custom-detail.spec.ts`) PASS (~14.4 s): heading, name,
summary Card, reload persistence. Raw records: worktree `.local/`
(`browser-rerun-fixed.md/.json`, `browser-custom-detail.md/.json`).

Final independent `$verify-carta-module` verdict: `REWORK` on technical
repairs only — no module or behavior rework. Remainder: (1) the passing
specs are a worktree overlay until regenerated from the now-committed fix;
(2) `trial-services.integration.spec.ts` stale `not.toContain(detail)`
assertion needs a technical repair plus run; (3) `CommandPalette.spec.ts`
hard-coded nav list needs the same; (4) full web `vue-tsc` unrun on the
candidate. No blocker.

## Release repairs — 2026-09-13

Commit `2edd6bc` closes the review remainder in the main checkout:

- `CommandPalette.spec.ts` asserts membership of the shipped Settings
  entries instead of an exact list. Full web unit suite: 48 files, 234
  tests, all pass. Web `type-check` (`vue-tsc`): pass.
- Generator `renderIntegrationTest` documents that absence checks describe
  generated routes only; a later manual route can add a name the generated
  check does not know.
- `pnpm test:module-tooling`: 92 Node pass. `git diff --check`: pass.
- Candidate worktree proof (specs regenerated from the committed fix,
  disposable targets): 3 browser specs pass, exit 0
  (`.local/browser-final.md/.json`); both integration specs pass after the
  trial-level repair of the stale absence line (positive assertion of the
  approved manual Detail route, recorded in `.local/browser-final.md`).
