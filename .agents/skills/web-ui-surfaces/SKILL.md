---
name: web-ui-surfaces
description: Build or review Carta web pages, nested file routes, app navigation, collections, record details, and workflow controls.
---

# Web UI surfaces

Use Carta's page shells and controls as the starting point. Adapt content,
density, and layout to the user's task. Consistency comes from shared controls,
clear hierarchy, and predictable behavior, not identical pages.

## Find the current boundary

Apply [discovery reuse](../carta-module-development/SKILL.md#discovery-reuse).
Start with the changed route/resource or generated source and the applicable
reference below. Reuse the plan's verified adapter and component choices.
Inspect an export or one nearby example only for an unresolved contract.
Before writing each new interaction pattern, identify its View or form, input
renderers, value contract and action owner. Discovery is complete when every
required interaction has a supported path or a named framework gap. Keep these
decisions in the existing work record and reuse them for matching interactions.

Read `docs/architecture/web-application-architecture.md` when ownership or app
integration is unclear; use `docs/ui/README.md` to locate a missing visual rule.
Inspect `apps/web/src/main.ts`, app defaults or the authenticated layout only
when changing their setup or resolving a registration/default problem. Read
the navigation manifest when adding an entry. Keep framework changes within scope.

## Framework-first composition

Use established framework patterns directly. Select the highest-level component
that supports the required interaction, including its states and feedback.
Before adding custom UI behavior, check the relevant component contract and
extension points. Use supported slots, fields, actions and framework controls;
keep custom code limited to the unmet requirement.

Select in order: standard View/action, supported slot or adjacent section,
lower-level framework component, then local code for a named unmet requirement.
Keep standard Create controls unless the requested interaction needs an override.
Keep standard Edit/Delete in list row actions. Use a plain `DetailView` for
standard record details. Its controls slot is for requested workflow actions.
The existing Roles detail customization is not the standard CRUD template.
Import template components or identify their runtime registration; a test stub
or type declaration does not register a component.

Check composition once per interaction pattern. Standard work records only a
real deviation in its work document; it needs no UI JSON. Use the
[UI contract](references/ui-contract.md) for full-process work, an existing
contract or custom composition that needs static checking. Review deviations
against the required result, not merely whether a slot supports them.

## Choose and build

| Work | Read |
| --- | --- |
| New page, app shell, navigation, visual hierarchy, responsive layout | [App conventions](references/app-conventions.md) |
| File routes, nested parents, tabs, Back, route lifecycle | [File routing](references/file-routing.md) |
| Lists, cards, filters, actions, dialogs | [Surfaces](references/surfaces.md) |
| Workflow detail, history, related records | [Detail layout](references/detail-layout.md) |
| Any new or changed relation, display fields or labels | [Fields](references/fields.md) |
| Any user input, including custom actions and inline uploads; read before selecting controls | [Build resource forms](../build-resource-form/SKILL.md) |

Routes own URLs, query state, navigation, dialogs, and workflow feedback.
Schemas own data validation. A resource owns standard actions and one shared
field catalog. Pass the returned action directly to its View:

```vue
<ListView v-bind="records.list()" />
<DetailView v-bind="records.detail({ id })" />
<FormView v-bind="records.create()" />
<FormView v-bind="records.update({ id })" />
```

Use `createHonoResourceActions(rpc.<module>)` for standard transport. It already
normalizes responses. Keep custom transport in app actions, with a typed
`{ run }` resource action when needed. Routes do not call raw RPC endpoints.
A file or wrapper earns its place when it owns behavior; simple standard
resources can call the adapter directly without a separate actions file.

## Check the result

Use [verification](references/verification.md). Report visible behavior checked,
failed checks, and any unverified result. Reuse the parent module's evidence;
do not start a second verification process.
