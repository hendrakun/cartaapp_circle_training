# Carta module workflow evaluations

These are behavioral evaluation inputs, not a claim that the skills work reliably.
The six Plan 019 execute-stage cases have one independent candidate run. Other
cases remain `NOT_RUN`. Node tooling tests and metadata/link validation are
reported separately.

## Run a comparison

Use fresh isolated copies of the same application checkout for baseline and
candidate, differing only in the tested skills/tooling. Keep the same model,
harness, user replies, repository state and runtime capabilities for both.
The baseline is the supplied archive identified in the delivery report. Do not
run both variants in the same conversation. Preserve all transcripts, artifacts,
commands and failures. Do not edit a candidate mid-case.

Select an entry from `cases.json`. Give the worker only its `request` and named
`inputs`, plus normal access to the checkout. For ownership cases, the fixture
paths are explicit evidence for a hypothetical existing subsystem; they are not
claims that these fixtures are installed application modules. For implementation
or runtime evaluations, install/register the equivalent test module in the
isolated checkout first and record that fixture preparation for both variants.
Cases here can be used for design/planning/read-only-review without doing that.

The evaluator keeps `grading.md` and follow-up facts private from the worker.
Answer relevant questions from the supplied facts. When a fact is absent, say
it is not established: do not invent a helpful answer that hides a skill gap.
An open-ended question can earn a high score; question count is not a target.
A requested document is useful only when it resolves a consequential gap.

For the handoff case, give a second fresh implementer only the resulting design,
selected plan, worksheet, referenced inputs and checkout. Have it identify any
observable behavior it would still need to decide. Then implement in the isolated
runtime when available. Compare its result with the original approved contract,
not merely the tests it chose to write. Do not give it the discovery transcript.

For stale evidence, record a real passing command with `module-evidence`, then
change the content of the same selected input path before the review. Never use
a hand-written passing report. For runtime-blocker evaluation, enforce the stated
capability restriction in the harness; a sentence saying a tool is missing is
not a substitute for a genuinely unavailable runtime.

Begin with one baseline and one candidate run per case to find failures. Repeat
ambiguous/high-risk cases before making a reliability claim. A single successful
run is exploratory evidence, not a statistical guarantee.

## Record results

One record per case/variant: model and harness version, source/skill revision,
input snapshot, prompt, user replies, transcript and output paths, applicable
obligations covered/missed, invented business rules, source-grounded and irrelevant
questions, reference requests, unnecessary reapprovals, actual commands/retries,
seeded defects found/missed, and final verdict. Record elapsed time/token cost only
when measured. Use PASS / FAIL / BLOCKED / NOT_RUN with an explanatory finding.
For module-workflow cases, also record the preflight command/result, generator
command/result, unsafe writes attempted, and the reviewer decision.

Blind the reviewer to variant labels when practical. Read every graded artifact;
keyword counts and template headings cannot establish semantic completeness.
Use findings to make narrow wording changes and rerun the affected cases plus
relevant neighbors, rather than adding blanket prohibitions to every skill.
