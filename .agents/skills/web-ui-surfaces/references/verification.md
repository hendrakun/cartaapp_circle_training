# UI verification

Use the shared [verification strategy](../../carta-module-development/references/verification-strategy.md).
Module delivery excludes E2E generation, execution, repair and manual journeys.
Run relevant type checks, lint and existing focused non-browser checks.

Review source for meaningful list/detail values, relation labels, edit loading,
field dependencies, filter wiring, access declarations and standard actions.
Trace changed API values into the actual field configuration. Do not create
tests that copy configuration or repeat standard framework control behavior.
Use API tests for access enforcement, domain rules and stored effects.

Review custom composition against the
[framework-first rule](../SKILL.md#framework-first-composition).
Each custom block must meet a requirement not met by the standard components.
Use the [UI contract check](ui-contract.md) when an existing contract or custom
composition needs it. Standard work needs no new JSON solely for review.
For routing, use [file routing](file-routing.md#verify-changed-behavior).

Report which checks ran and state that actual rendered behavior was not verified.
This limit does not require browser testing or block module completion.
