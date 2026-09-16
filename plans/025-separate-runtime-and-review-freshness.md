# Plan 025: Separate runtime freshness from acceptance review

Optional follow-up for full-process recorded evidence. The standard-module path
now permits ordinary current evidence and needs no recorder change. Existing
recorded reports retain their original input/freshness contract.

## Status

- Priority: P2
- Effort: S
- Risk: MED — stale acceptance must not pass
- Category: dx, tests
- Depends on: None
- Planned at: `9720b43`, 2026-09-14
- Status: TODO

## Why this matters

A corrected acceptance link can require another browser run even when code,
tests and environment did not change. Preserve the runtime result, but require
a new coverage review against the revised design. A changed business rule can
still require new tests; a document suffix cannot establish equivalence.

## Current state

`scripts/module-evidence.mjs` already provides `captureInputs`, `recordCommand`
and `checkFreshness`. Freshness compares one selected content fingerprint:
`snapshot.fingerprint === current.fingerprint`. Its CLI help and the module
verification strategy require the approved design in that input set.
`scripts/module-evidence.test.mjs` uses temporary directories and Node tests to
prove edit detection, failed-report retention and changes during a run.

## Scope

Change only recorder help if needed, its existing tests, the evidence section
of `.agents/skills/carta-module-development/references/verification-strategy.md`,
the verifier's evidence instructions, this plan and the index. Reuse separate
existing snapshots: one for runtime inputs, one for the reviewed design. Keep
the acceptance review and its links in the existing worksheet/handoff. No new
report service, parser, schema version or compatibility wrapper is needed.
Do not change application/framework source or old reports. Do not commit/push.

## Steps and verification

1. Run `git diff 9720b43 -- scripts/module-evidence.mjs scripts/module-evidence.test.mjs .agents/skills`.
   Check the stated API against current code. Run
   `node --test scripts/module-evidence.test.mjs`; expected all pass.
2. Add one behavior test using the existing temporary-directory pattern:
   capture runtime and design separately, change an acceptance mapping, verify
   runtime remains fresh and design becomes stale. Then change a runtime input
   and verify runtime becomes stale. Retain the existing failed-command and
   during-run invalidation tests. Run the same command; expected all pass.
3. Update help and skill instructions together. Runtime inputs include owners,
   dependencies, tests, fixtures and config. Include a document in runtime inputs
   if a test or generator actually consumes it. Record the design snapshot and
   review separately. A design change invalidates acceptance review; inspect
   the changed outcomes against existing assertions before reusing runtime
   proof. Reuse for a mapping-only correction needs an explicit review record.
   New or changed behavior needs sufficient tests, not a metadata exemption.
   Old combined reports retain their original freshness rules. Never remove
   inputs from an existing report to make it pass.
4. Run `node scripts/module-evidence.mjs --help`, `pnpm test:module-tooling`
   and `git diff --check`. Expected exit 0 and all tests pass. Review a sample
   handoff with a stale design: runtime can be PASS but acceptance must remain
   unreviewed until the new design has sufficient proof. Update the index.

## Done criteria and limits

The regression proves separate freshness, while failed or changed runtime
evidence still fails. Instructions require current acceptance review and retain
environment checks. All listed commands pass. Stop if a consumer requires a
new report schema or a broader source change; report that dependency first.
Future runtime consumers of design files must include those files as inputs.
