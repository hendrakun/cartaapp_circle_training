# UI verification

Use the shared [verification strategy](../../carta-module-development/references/verification-strategy.md).
Module delivery excludes E2E generation, execution, repair and manual journeys.
Run relevant type checks, lint and existing focused non-browser checks.

Run the source check on each changed module route directory and any changed
local Vue component outside it. This includes standard Views and custom actions:

```sh
node scripts/module-ui-check.mjs --sources 'apps/web/src/routes/(authenticated)/<module>'
```

This check needs no JSON contract. Resolve each failed binding and review each
native control against the shared component contract. Exit `2` needs source
review; it is not a pass. Use the contract mode below for explicit globals or
declared composition exceptions.

Review source for meaningful list/detail values, relation labels, edit loading,
field dependencies, filter wiring, access declarations and standard actions.
Trace changed API values into the actual field configuration. Do not create
tests that copy configuration or repeat standard framework control behavior.
Use API tests for access enforcement, domain rules and stored effects.

For custom integration, trace the complete boundary: query to collection result,
field definition to control and submitted value, and write completion to dialog
state, feedback and affected data refresh. Check the application composition,
even when each framework component is already tested. Use the focused proof
rules in the shared verification strategy. A source-check pass proves only the
checks that the tool reports.

Review custom composition against the
[framework-first rule](../SKILL.md#framework-first-composition).
Each custom block must meet a requirement not met by the standard components.
Compare the complete page with [DESIGN.md](../../../../DESIGN.md). Check the
applicable page structure, actions, controls, displayed values, text, and access
rules. In the existing review, cite the design sections checked and report
required exceptions with their authority. The source checker does not prove
these design rules. Record a defect when the source breaks them, even if a
standard View is also present.
Use the [UI contract check](ui-contract.md) when an existing contract or custom
composition needs it. Standard work needs no new JSON solely for review.
For routing, use [file routing](file-routing.md#verify-changed-behavior).

Report which checks ran and state that actual rendered behavior was not verified.
This limit does not require browser testing or block module completion.
