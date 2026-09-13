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
