# Plan 020: Accept the pnpm separator and correct the workflow review findings

> **Implementation instructions**: Follow the steps in order. Run each check and
> confirm its expected result. Stop on a condition in `STOP conditions`; do not
> add a fallback or alias. Update this plan and its index row after review.
>
> **Drift check (run first)**:
> `git diff --stat bfb88aa..HEAD -- scripts .agents/skills evals package.json plans/019-align-module-workflow-and-measure-time.md`
> If an in-scope file changed, compare the plan references with the live file
> before an edit. A contract mismatch is a stop condition.

## Status

- Priority: P1
- Effort: S
- Risk: LOW — argument parsing, skill-test, and evaluation-fixture changes only
- Depends on: 019 (blocked result `evals/carta-module-workflow/plan-019-result.md`)
- Category: correctness, DX, evaluation
- Planned at: commit `bfb88aa`, 2026-09-13
- Status: IMPLEMENTED — 2026-09-13, final review `APPROVE`

## Implementation record

Work in the current checkout `sallliisa/execute-centralize-app-ports`.
Drift check clean: `git diff --stat bfb88aa..HEAD -- scripts .agents/skills
evals package.json plans/019-align-module-workflow-and-measure-time.md`
showed only the new plan file and the `plans/README.md` 020 row.

1. Separator: `parseArgs` in `scaffold-bounded-module.mjs`,
   `verify-module.mjs`, `integrate-bounded-module.mjs` skips a lone `--`.
   Probe: `pnpm scaffold:bounded-module -- --manifest
   /tmp/does-not-matter.json --check` reaches manifest read (ENOENT, no
   `Unknown argument: --`). Same missing-file probe for `verify:module`
   (`-- --manifest ... --check-only`) and the integrate entrypoint
   (`-- --manifest ... --check`). `module-evidence.mjs` untouched.
2. Regression tests: one `accepts the pnpm lone separator before flags`
   test per parser file; focused three-file suite 34/34 pass.
3. Retired-command scan: generator-guard test scans raw fenced blocks too
   and still fails on the Python wrapper, public alias, or internal
   integrate name.
4. Decision checks: router command order, parsed manifest actions, removed
   command names, and verifier ownership use structure instead of prose rules.
5. Verifier `SKILL.md` points to
   `verification-strategy.md#commands-and-environment`; repeated
   sufficiency rules removed. `quick_validate.py` valid.
6. Evaluation: six `execute` cases require observable runs; the two written
   failure fixtures are removed. Four checked JSON manifests return `VALID`
   with no writes. The browser-only preflight reports the expected missing
   `apps/api/.env.e2e` correction while independent manifest work passes. The
   isolated migration rollback test passes. One independent worker record is at
   `.local/carta-module-forward-test/20260913-plan019/resumed-evaluation.md`;
   all six cases pass the rubric. No time comparison is claimed. Plan 019 stays
   blocked on its controlled runtime.

Checks: focused 41/41 pass; `pnpm test:module-tooling` 91 Node + 2
Python pass; changed-skill validation valid (`verify-carta-module`,
`carta-module-development` re-validated after no text change there);
`git diff --check` exit 0. No migration applied, no seed ran, no
service started, no guard weakened.

## Review

- First verdict: `REWORK` — runnable manifests and controlled failure commands
  were missing, and skill tests still matched prose.
- Corrections: added four checked manifests, selected only browser for the
  environment case, used the isolated rollback test, and kept skill checks on
  command order, parsed actions and reference ownership.
- Final verdict: `APPROVE`. The reviewer confirmed the six PASS rows against
  the independent worker record. It also confirmed the structural skill tests,
  partial evaluation status, validators, full tooling suite and diff check.

Plan 019 result `bfb88aa` requires this small plan. Plan 019 stays `BLOCKED`
until this plan lands and the evaluation runs again.

## Why this matters

The documented generator command fails. Skills, help text, and fixtures tell
the agent to run `pnpm scaffold:bounded-module -- --manifest <path> --check`.
The script rejects the pnpm separator with `Unknown argument: --`. Plan 019
makes this mismatch a stop condition, so the controlled trials could not run.
The independent review also found five step 1-5 defects that stay open.

## Outcome

After this plan:

- The documented command form with the pnpm separator passes. The script
  ignores a lone `--` argument. The no-separator form keeps its current
  behavior.
- The same separator rule applies to `verify:module` and the internal
  integrate entrypoint for a consistent contract. `module:evidence` keeps its
  `--` command separator; do not change it.
- The retired-command test scans fenced commands too.
- Evidence sufficiency lives in `verification-strategy.md`. The verifier skill
  points to it instead of repeating the rules.
- Evaluation fixtures require observable read-only runs and real isolated
  failure cases, not written plans or written failures.
- Skill contract tests check decisions, not exact sentences.

## Current state

| Owner | Evidence and effect |
| --- | --- |
| `scripts/scaffold-bounded-module.mjs:1281-1317` | `parseArgs` throws `Unknown argument: --`. Reproduced: `pnpm scaffold:bounded-module -- --manifest <file> --check` fails; without the first `--` it reaches manifest read. |
| `scripts/scaffold-bounded-module.mjs:1395` | Help text documents the `--` form and shows it in examples. Docs and code disagree. |
| `scripts/verify-module.mjs:256-301` | Same `parseArgs` pattern throws on a lone `--`. `--help` short-circuits first, so `-- --help` passes but `-- --manifest ...` fails. |
| `scripts/integrate-bounded-module.mjs:169-189` | Same `parseArgs` pattern throws on a lone `--`. |
| `scripts/local-environment.mjs:700` | Precedent: entry filters `argument !== '--'`. Use the same idea inside the three parsers above. |
| `scripts/module-evidence.mjs:139-150` | `--` is a real command separator here. Out of scope; do not touch. |
| `scripts/module-skills.test.mjs:13-23, 71-78` | `prose()` strips fenced blocks and the generator-guard test uses it, so fenced commands are never scanned. |
| `scripts/module-skills.test.mjs:62-87` | Contract tests match exact sentences (`all compatible standard actions`, `never applies the migration`, and similar). |
| `.agents/skills/carta-module-development/references/verification-strategy.md:104-107` | Evidence-sufficiency owner. Keep it. |
| `.agents/skills/verify-carta-module/SKILL.md:88-95` | Repeats the same sufficiency rules. Replace with one pointer. |
| `evals/carta-module-workflow/cases.json:37-72` | Four `execute` cases ask for a plan (`Do not apply changes`) instead of an observable read-only run. Two cases (`environment-failure`, `migration-contamination`) supply a written failure file instead of producing the failure in an isolated target. |
| `evals/carta-module-workflow/grading.md:12-17, 39-44` | Rubric is otherwise current, including the Detail-else-List redirect rule. Keep it; add only what the new fixtures need. |

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Documented form | `pnpm scaffold:bounded-module -- --manifest <path> --check` | Reaches manifest read (fails only on missing file, not on `--`) |
| Focused tests | `node --test scripts/scaffold-bounded-module.test.mjs scripts/verify-module.test.mjs scripts/integrate-bounded-module.test.mjs scripts/module-skills.test.mjs` | All pass |
| Tool suite | `pnpm test:module-tooling` | All module-tool and skill tests pass |
| Skill validation | `python3 /Users/gamer/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/verify-carta-module` | Reports a valid skill (run for each changed skill) |
| Patch | `git diff --check` | Exit 0 |

## Scope

Permitted files for execution:

- `scripts/scaffold-bounded-module.mjs` — ignore a lone `--` in `parseArgs`
- `scripts/verify-module.mjs` — same separator rule
- `scripts/integrate-bounded-module.mjs` — same separator rule
- `scripts/scaffold-bounded-module.test.mjs`, `scripts/verify-module.test.mjs`, `scripts/integrate-bounded-module.test.mjs` — separator regression tests
- `scripts/module-skills.test.mjs` — fenced-command scan plus decision checks
- `.agents/skills/verify-carta-module/SKILL.md` — replace repeated sufficiency rules with one pointer only
- `evals/carta-module-workflow/cases.json`, `evals/carta-module-workflow/grading.md`, small fixture files under `evals/carta-module-workflow/fixtures/workflow/` — observable-run cases and real failure cases
- This plan and `plans/README.md`

Do not change `packages/*`, `apps/*`, migration or seed behavior, `module-evidence.mjs`, or the documented `--` command form. Do not apply a migration, run a seed, or start a service. Do not weaken a guard to make a case pass.

## Git workflow

Work in the current checkout. Preserve completed work and unrelated dirty files.
Keep code, skill-test, and evaluation fixes in one reviewed commit with an
imperative message such as `Accept pnpm separator and fix workflow review findings`.
Do not push or open a pull request unless the user asks.

## Implementation

### 1. Accept the lone `--` in the three module parsers

In `parseArgs` of `scaffold-bounded-module.mjs`, `verify-module.mjs`, and
`integrate-bounded-module.mjs`, skip an argument that equals `--`. Put the
skip inside `parseArgs` so both CLI use and direct `execute([...])` calls
pass. Do not change `module-evidence.mjs`.

Verify:

```sh
pnpm scaffold:bounded-module -- --manifest /tmp/does-not-matter.json --check
```

Expected: no `Unknown argument: --`. The command fails only on the missing
manifest file. Repeat the same probe for `verify:module` with `-- --help`
and a `-- --manifest` missing-file probe.

### 2. Add separator regression tests

Add one test per parser that passes `['--', ...]` with the documented flags
and proves the `--` itself causes no error (missing-file or usage error is
sufficient proof; do not write outside temp dirs). Keep one test per file.
Do not assert full help paragraphs.

Verify:

```sh
node --test scripts/scaffold-bounded-module.test.mjs scripts/verify-module.test.mjs scripts/integrate-bounded-module.test.mjs
```

Expected: all pass, including the new separator cases.

### 3. Scan fenced commands in the retired-command test

Revise the generator-guard test in `scripts/module-skills.test.mjs` so it
scans fenced command blocks too. The test must still fail if an active skill
calls the removed Python wrapper, the removed public integration alias, or
the internal integrate script by name. Keep the check name-based, not a full
paragraph snapshot.

Verify with the step-5 focused command below.

### 4. Replace exact sentence checks with decision checks

In `scripts/module-skills.test.mjs`, replace exact-sentence `match` checks
with decision checks. Check behavior or structure, for example: the router
names preflight before the generator command; the bounded reference states
the no-apply, no-seed-run, and existing-file-refusal decisions; verification
limits generated proof to direct assertions. Keep one test per contract
group. Do not assert full paragraphs or line counts.

Verify:

```sh
node --test scripts/module-skills.test.mjs scripts/module-tooling.test.mjs
python3 /Users/gamer/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/verify-carta-module
```

Expected: tests pass and each changed skill validates. Run the validator for
every changed skill, not only the verifier.

### 5. Point the verifier at the strategy owner

In `.agents/skills/verify-carta-module/SKILL.md`, replace the repeated
generated-evidence rules with one pointer to
`../carta-module-development/references/verification-strategy.md`. Keep the
read-only `--check` instruction and the no-template-comparison rule. Do not
edit `verification-strategy.md` in this plan.

### 6. Make evaluation cases observable

Revise the six `execute` cases in `evals/carta-module-workflow/cases.json`
so each worker runs a real read-only command in the checkout (for example a
manifest `--check` or a selected preflight) and reports the observed result.
Do not ask for a plan document. Change the two written-failure fixtures so
the worker produces the failure in an isolated target instead of reading a
supplied verdict:

- `environment-failure`: the worker runs the selected preflight where one
  named capability fails, reports the exact failed capability and correction,
  and continues independent manifest work.
- `migration-contamination`: the worker runs the read-only gate that reports
  the unrelated Drizzle operation and stops before retained writes.

Update `grading.md` only for what the new fixtures need. Keep the existing
Detail-else-List redirect rule and hard failures. Do not put the rubric or
expected findings in the worker context.

Then run the evaluation procedure in `evals/carta-module-workflow/README.md`
for the six cases as far as this host allows. This host has no PostgreSQL or
S3, so API and browser cases stay `NOT_RUN`/`BLOCKED` with the exact missing
capability. Record that limit. Do not claim a time comparison.

## Test plan

- New separator tests fail before the fix and pass after it.
- Focused suites pass: scaffold, verify, integrate, module-skills, module-tooling.
- Each changed skill passes `quick_validate.py`.
- `pnpm test:module-tooling` passes.
- `git diff --check` passes.
- No migration applied, no seed ran, no service started.

## Done criteria

- [x] `pnpm scaffold:bounded-module -- --manifest <path> --check` no longer reports `Unknown argument: --`.
- [x] `verify:module` and the internal integrate entrypoint accept the same separator form.
- [x] Retired-command test scans fenced commands.
- [x] Verifier points to the strategy owner; no repeated sufficiency rules remain.
- [x] Six evaluation cases require observable runs; the two failure cases produce their failure in an isolated target.
- [x] Skill contract tests check decisions, not exact sentences.
- [x] Tooling, skill validation, and diff checks pass.
- [x] Plan 019 stays `BLOCKED` with the runtime limit recorded; no speed claim is made.

## STOP conditions

Before execution, run:

```sh
git diff --stat bfb88aa..HEAD -- scripts .agents/skills evals package.json
git status --short
```

Plan 019 `BLOCKED` state and the Detail-else-List redirect rule are expected.
Reconcile their final command names before editing skill text. Stop if a fix
needs a framework change, a migration apply, a seed run, or a weakened guard.
Stop the skill revision if one mandatory validator path is missing or
unreadable. Record a blocked runtime capability with its exact correction;
do not work around it.

## Maintenance notes

Update this plan and `plans/README.md` after review. Keep raw local output in
ignored `.local` storage with secrets redacted. Repeat the controlled trials
only after this plan lands; normal module delivery must not pay the
evaluation cost.
