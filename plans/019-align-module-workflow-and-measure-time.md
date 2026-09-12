# Plan 019: Use the new module path and measure its effect

> **Implementation instructions**: Complete plans 016-018 first. Before any skill
> revision, read and apply both required skill entry points in `Required skill
> instructions`. Follow each step and run its check. Stop on a condition in `STOP
> conditions`; do not change product code to make an evaluation pass. Update the
> plan and index after review.
>
> **Drift check (run first)**:
> `git diff --stat 7eb093d..HEAD -- .agents/skills scripts evals package.json`
> Reconcile the final command contract from plans 016-018. A mismatch between the
> skill text and the live command is a stop condition.

## Status

- Priority: P1
- Effort: M
- Risk: LOW — skill text and evaluation fixtures change; product source does not
- Depends on: 016, 017, and 018
- Category: migration, skills, evaluation, DX
- Planned at: commit `7eb093d`, 2026-09-12
- Status: TODO — plan only

The user selected this migration and required `$skill-creator` and
`$writing-for-agents`. Execute it after the commands in plans 016-018 exist and
pass. Keep the skill router short. Put command details in the current bounded
reference and command help. Do not add a new skill.

## Required skill instructions

The implementer **must** read and apply both skills before it edits any skill,
`AGENTS.md`, or agent-facing reference in this plan. The implementer can be outside
Codex, so it must use these absolute filesystem paths instead of skill name
resolution.

1. `$skill-creator`
   - Skill directory: `/Users/gamer/.codex/skills/.system/skill-creator`
   - Required entry point:
     `/Users/gamer/.codex/skills/.system/skill-creator/SKILL.md`
2. `$writing-for-agents`
   - Skill directory: `/Users/gamer/.agents/skills/writing-for-agents`
   - Required entry point: `/Users/gamer/.agents/skills/writing-for-agents/SKILL.md`
   - Because this plan revises skills, also read:
     `/Users/gamer/.agents/skills/writing-for-agents/SKILL-MECHANICS.md`

Completion criterion: before the first skill edit, the implementation record names
all three files above as read inputs. If one file is missing or unreadable, stop
the skill revision and report its exact path. Work that does not edit agent-facing
documents can continue.

## Why this matters

New tooling does not save time if the active skills still direct agents through
manual full-module work or late setup checks. The workflow must select the new
path without repeating its manual. Controlled runs then show whether it reduces
work while it keeps the accepted behavior and safety checks.

## Outcome

The Carta module workflow does four things before custom implementation:

1. Run the selected local preflight.
2. Use the one bounded generator for every compatible standard action.
3. Review generated migration, seed, API proof, and browser proof.
4. Plan and implement only the custom remainder.

The workflow treats generated source as normal editable source. It does not call
the generator again after manual edits. Verification accepts generated API and
browser tests as evidence only for the exact standard behavior that they assert.

A controlled forward test compares the old and new paths. It records active time,
setup failures, rework, and accepted behavior. It does not claim success from a
prompt score or source count alone.

## Current state

| Owner | Evidence and effect |
| --- | --- |
| `.agents/skills/carta-module-development/SKILL.md:46-65` | The router permits bounded generation, but its current text still assumes the old full-CRUD helper and separate execution work. |
| `.agents/skills/carta-module-development/references/bounded.md:11-27` | Eligibility requires one full CRUD resource and rejects action subsets. |
| `.agents/skills/carta-module-development/references/bounded.md:68-99` | It sends agents through the Python wrapper and says generated tests are smoke checks. |
| `.agents/skills/carta-module-development/references/execution.md:35-55` | It asks the agent to check services before work, but gives no exact preflight command or selected capability contract. |
| `.agents/skills/verify-carta-module/SKILL.md:88-98` | Verification still describes authentication and shape smoke tests as the generated evidence. |
| `scripts/module-skills.test.mjs:22-64` | Existing tests already check skill identities, local links, command aliases, and guarded API entry points. Extend this owner. |
| `evals/carta-module-workflow/cases.json` | The current evaluation contains generator-pressure cases based on old eligibility. |
| `evals/carta-module-workflow/grading.md` | Current grades do not check selected action generation, setup preflight, migration/seed safety, or generated behavior proof. |

The two time reports form the baseline:

- Project A: 6-7 hours of active agent time, with a 72-minute empty worker and a
  later 106-minute broad-worker failure
  (`/Users/gamer/Documents/projects/document-validity-checker/.local/carta-module-development-time-analysis.md:57-77,150-170`).
- Project B: 5 hours 35 minutes, 8,177,926 input tokens, five compactions, and 121
  minutes for E2E and verification. It ended without a verifier verdict
  (`/Users/gamer/Documents/forward-testing/swa-fw/.local/swa-module-development-analysis.md:28-42,66-72,91-111,119-130`).

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Skill contracts | `node --test scripts/module-skills.test.mjs scripts/module-tooling.test.mjs` | All selected tests pass |
| Tool suite | `pnpm test:module-tooling` | All module-tool and skill tests pass |
| Skill validation | `python3 /Users/gamer/.codex/skills/.system/skill-creator/scripts/quick_validate.py <changed-skill-directory>` | Reports a valid skill |
| Workflow evaluation | Follow `evals/carta-module-workflow/README.md` | Every case has a recorded result and grade |
| Patch | `git diff --check` | Exit 0 |

## Suggested implementation toolkit

The two skills in `Required skill instructions` are mandatory for the revision;
they are not optional toolkit suggestions. Use `$verify-carta-module` only for
the two implemented forward-test modules, after their evidence is ready.

## Scope

Permitted files for execution:

- `.agents/skills/carta-module-development/SKILL.md`
- `.agents/skills/carta-module-development/references/{bounded.md,execution.md,verification-strategy.md}`
- `.agents/skills/carta-module-plan/SKILL.md`
- `.agents/skills/carta-module-plan/references/plan-template.md`
- `.agents/skills/verify-carta-module/SKILL.md`
- `.agents/skills/api-conventions/SKILL.md` only for one conditional pointer if
  its current router needs it
- `scripts/module-skills.test.mjs` and `scripts/module-tooling.test.mjs`
- `evals/carta-module-workflow/{README.md,cases.json,grading.md}` and small new
  fixture files in that existing evaluation directory
- One concise tracked evaluation result in that directory; raw transcripts and
  logs stay under ignored `.local`
- This plan and `plans/README.md`

Do not change product source, framework packages, generator code, environment
tools, or external project files in this plan. Do not copy the whole command
manual into multiple skills.

## Git workflow

Work in the current checkout and preserve the completed implementation and
unrelated dirty work. Keep skill/test edits in one reviewed commit and the final
evaluation result in a second commit, with imperative messages. Do not push or
open a pull request unless the user asks.

## Writing contract

Apply the two named writing skills:

- Use `$skill-creator` to keep each skill description precise, preserve valid
  frontmatter, validate links, and run its quick validator.
- Use `$writing-for-agents` to write decisions, trigger conditions, commands,
  stop conditions, and expected outputs. Remove advice that cannot change an
  agent action.

Keep progressive disclosure:

- `carta-module-development/SKILL.md` owns routing and sequence.
- `bounded.md` owns the manifest, generated outputs, unsupported cases, and
  command behavior.
- `execution.md` owns when to run preflight and how to proceed after failure.
- `verification-strategy.md` owns evidence sufficiency.
- The command `--help` output owns exact CLI flags.

Other skills link to these owners. They do not repeat the rules.

## Implementation

### 1. Update the module router

First complete the required-skill read and record its three absolute input paths.
Apply `$skill-creator` to scope, structure, frontmatter, and validation. Apply
`$writing-for-agents` and its skill mechanics to pointer wording, progressive
disclosure, completion criteria, and removal of duplicate instructions.

In `carta-module-development/SKILL.md`, replace the old full-CRUD generator text
with this short sequence:

1. Select required environment capabilities from the approved design and plan.
2. Run `pnpm module:preflight -- --needs ...` before substantial implementation.
3. Build one manifest for compatible standard actions, even when other actions
   are custom.
4. Run the generator `--check`; inspect selected files, technical dependencies,
   migration intent, seed choice, generated tests, and manual remainder.
5. After implementation authority exists, run `--apply` once.
6. Review the generated migration and source. Then implement custom behavior.

State that custom Detail work does not remove compatible List/Create/Update work
from the generator. State that the agent must not regenerate over edited source.
Link to `bounded.md`; do not include the manifest example in the router.

Keep current delegation, progress, and acceptance rules that already address the
empty and broad worker delays. Do not add a new gate between each generated file.

### 2. Make the bounded reference the single written contract

Rewrite the complete-module part of `bounded.md` around plan 018. Include:

- exact supported action, field, permission, seed, and test rules;
- one current manifest example with a partial action set;
- the two public commands;
- the Update-without-Detail hydration rule;
- Drizzle generation and no-apply rule;
- exact seed and no-run rule;
- API test and conditional browser test behavior;
- manual cases: custom Detail, relations, dependent input, child resources,
  scoped access, workflow, concurrency, existing-data migration, custom query,
  and report;
- existing-file refusal and one-time source ownership.

Keep the route-only operation as a separate existing section. State that it is
a low-level operation in the same script, not the normal module path. Do not add
a second wrapper or copied command recipe.

### 3. Point planning, execution, and verification at the new owners

In `execution.md`, replace the general prerequisite sentence at lines 35-41 with
the exact preflight command and selected-capability rule. A failed capability
blocks only dependent work. The agent can continue design, manifest work, and
other independent code. It must not discover a required setup fault for the first
time in the final browser run.

In the module plan skill/template, add one small environment row:

```text
Needs: api,web,test,browser,storage | Preflight result/evidence | Owner
```

Do not add a separate environment document. The plan records purpose and command;
the setup tool owns details.

In `verification-strategy.md` and `verify-carta-module/SKILL.md`, replace smoke-test
language. Generated API evidence can prove only its permitted/denied, validation,
persistence, and unchanged-rejection assertions. A generated browser journey can
prove only the standard path it performs. Custom acceptance rows still need direct
evidence. A manual omission is not a pass.

Use the current manifest `--check` and verifier output. Do not compare generated
files with templates after an agent has edited them; review their behavior and
current source.

### 4. Add focused skill and command contract checks

Extend existing Node tests. Check decisions, not prose snapshots:

- the only public complete-module generator alias is `scaffold:bounded-module`;
- skill links point to real local files;
- the router names preflight before implementation and selected standard actions;
- no active skill calls the removed Python wrapper or public integration alias;
- bounded guidance states no migration apply, no seed run, and existing-file
  refusal;
- verification does not call generated proof sufficient for custom behavior.

Keep one test per contract group. Do not assert full paragraphs or line counts.

Verify:

```sh
node --test scripts/module-skills.test.mjs scripts/module-tooling.test.mjs
python3 /Users/gamer/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/carta-module-development
python3 /Users/gamer/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/carta-module-plan
python3 /Users/gamer/.codex/skills/.system/skill-creator/scripts/quick_validate.py .agents/skills/verify-carta-module
```

If a conditional pointer changes another skill, run the validator for it too.

### 5. Revise the current evaluation cases

Keep the existing evaluation directory and format. Replace old generator-pressure
expectations with cases that require these decisions:

| Case | Required result |
| --- | --- |
| `partial-standard-module` | Generate List/Create/Update; leave custom Detail manual. |
| `update-without-detail` | Generate technical read hydration with Update permission, but no Detail surface or permission. |
| `read-only-seeded-module` | Generate List/Detail, migration, exact seed, API proof, and browser read journey. |
| `custom-relations` | Generate independent standard parts; leave relation, child write, scope, and custom browser proof manual. |
| `environment-failure` | Run selected preflight first, report exact failed capability and correction, continue independent manifest work. |
| `migration-contamination` | Stop before retained writes when Drizzle reports an unrelated schema operation. |

Each case must use a small repository fixture with enough source to choose the
current command. Grade observable outputs and unsafe actions. Do not grade exact
wording, chain-of-thought, or the number of skill reads.

Update `grading.md` with hard failures:

- invents or applies a migration;
- executes a seed;
- overwrites generated source;
- creates an omitted action surface or permission;
- changes a framework package for an unsupported custom case;
- calls an unguarded database or storage write;
- marks manual custom behavior as verified.

Run the existing evaluation procedure in its README and record model, commit,
case result, command result, and reviewer decision.

### 6. Run two controlled forward tests

Use disposable local copies. Do not change Project A or Project B. Run the same
agent model and the same approved module designs for both candidate trials. Use
fresh isolated development, test, and E2E targets. Run preflight before timing.

Trial A: a standard scalar module with List, Detail, Create, Update, and Delete.
It must use exact seed data and standard fields.

Trial B: a mixed module with standard List, Create, and Update plus a custom
Detail page. The custom page has one simple extra read-only section. It must not
need a framework change, relation, storage, or workflow engine.

Use `7eb093d` as the baseline checkout.
Use the completed plans 016-019 as the candidate checkout. Prepare equivalent
targets for both. The baseline can use manual setup because it has no preflight
command; record that setup time and failures. Do not change baseline code to add
candidate tooling.

Measure:

- active agent minutes from approved plan to first complete browser path;
- total active agent minutes to verifier verdict;
- setup failures found after implementation starts;
- generator minutes and generated files later rewritten;
- command retries, compactions, and worker tasks with no usable result;
- API and browser case results;
- verifier verdict and unverified acceptance rows.

Exclude user wait and host outage time, but record each separately. Use the same
definition as the two supplied reports. Preserve raw redacted logs under
`.local/carta-module-forward-test/<run-id>/`. Add one concise result Markdown file
to `evals/carta-module-workflow/` with the matrix, failures, and limits.

Do not set a pass threshold before data exists. The result can show no improvement.
If correctness differs, do not compare time as if the deliveries were equivalent.

### 7. Review and decide

Run the full module tooling suite and the evaluation cases. Review the two forward
tests against their approved designs with `$verify-carta-module`. Then classify
each agreed change:

- keep: evidence shows correct behavior and less manual work or earlier failure;
- revise: correct direction with a specific repeated fault;
- remove: adds work without useful prevention or generation.

Any revision beyond plans 016-018 needs a new small plan. Do not enlarge the
generator from one custom trial.

Verify:

```sh
pnpm test:module-tooling
git diff --check
```

## Test plan

- Skill frontmatter and links pass `quick_validate.py`.
- Node contract tests pass without exact prose snapshots.
- All revised evaluation cases pass their grading contract.
- Both forward-test trials reach a verifier verdict or record a precise blocker.
- Result reports contain active time, excluded time, correctness, and setup faults.
- Raw evidence contains no environment secret or administrator password.

## Done criteria

- [ ] Module development runs selected preflight before substantial code work.
- [ ] The skill uses the generator for compatible actions beside custom work.
- [ ] One reference owns generator details; other skills use short pointers.
- [ ] No active skill uses the removed wrapper or old full-CRUD rule.
- [ ] Verification gives generated tests only their direct evidence scope.
- [ ] Evaluation cases cover partial actions, hydration, seed, setup failure,
  migration contamination, and unsupported custom work.
- [ ] Two controlled forward tests have redacted evidence and verifier results.
- [ ] The result reports time and correctness without an unsupported speed claim.
- [ ] Skill validation, module tooling, and diff checks pass.

## STOP conditions

Before execution, run:

```sh
git diff --stat 7eb093d..HEAD -- .agents/skills scripts evals package.json
git status --short
```

Plans 016-018 and the current module-workflow adjustments are expected. Reconcile
their final command names and outputs before editing skill text. Stop the affected
evaluation if isolated targets cannot be proved, the baseline and candidate use
different accepted behavior, or logs cannot be redacted safely. Record the result
as blocked. Do not weaken a guard or use either external project as a test target.
Stop the skill revision if one mandatory path in `Required skill instructions`
is missing or unreadable.

## Maintenance notes

Update this plan and `plans/README.md` after review. Keep the concise result file
and remove stale claims from skill text. Repeat the controlled test only after a
material workflow or generator change; normal module delivery must not pay this
evaluation cost.
