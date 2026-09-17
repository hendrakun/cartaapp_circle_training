# App design

Use this file when you design, build, or review an `apps/web` page. It owns the
app's visual conventions. An explicit user requirement can change a convention;
record that change in the feature's existing work record. Component APIs still
define the supported implementation.

Keep app design rules here. Skills describe implementation and checks, and link
to the applicable section. Feature records contain required exceptions and
their reasons, not copies of these rules.

## Shell and navigation

Use one authenticated shell, with persistent navigation on wide screens, a
drawer on narrow screens, a global toolbar, and one main content region.
Public and sign-in pages use their own shell. A module supplies the page body.
Keep navigation available on direct entry to a child page and hide empty groups.
Add search, notifications, or a dashboard only when the task requires them.

## Page structure

Use `ListView`, `DetailView`, and `FormView` for their standard tasks. The View
owns the page header and normal actions. Add content through its supported slots
or below the View. Give additional content a short section heading. Choose one
surface treatment: an unframed section with normal page spacing, or a framework
card when the content needs visual containment. Keep unframed sections free of
card-like borders, backgrounds, corner rounding, and container padding. Keep
module titles in the standard header; omit decorative banners, repeated titles,
and slogans.

A record with one additional section shows that section directly below
`DetailView` on entry. Use an adjacent component, or a default child
`detail/index.route.vue` with `AppRouterView` when the section needs a route.
The user does not need an Open button or a single tab to see that section.
For several child sections, place the app routing `Tabs` below `DetailView`,
then `AppRouterView`. Use named `RouteTab` targets. The detail remains visible.
See [file routing](.agents/skills/web-ui-surfaces/references/file-routing.md)
for file placement, replacement pages, and Back targets.

Keep the record summary first. Show each field or attachment once. Use a
sidebar only when short workflow controls need to sit beside longer content.
Several sections alone do not require a custom record shell.

Give the record summary, related collections and distinct workflow areas named
sections. On a custom detail page, use separate framework cards by default for
areas with independent content or controls. Use unframed sections when headings
and spacing make their boundaries clear. Keep each section's heading, content
and controls together. A standard View can already supply this grouping.

For collections, show the primary name or reference first, then useful status
and dates. Put long prose and secondary audit fields in detail. Use cards when
images or summaries help users compare records. Add a Table/Cards switch only
when both views serve the task.

## Actions and forms

Keep standard Create controls and list row View/Edit/Delete actions in their normal
locations. Put requested record workflow actions in the detail controls area.
Group related actions. Keep header actions right-aligned and final form actions
together at the bottom-right. The page header does not repeat form actions.

Use `FormView` for an independent form page, `DialogForm` for a short contextual
form, and `Form` inside an existing surface. Group fields by task and put
prerequisite fields before dependent fields. Use the smallest filter width that
fits the control; use a full row only when needed.

## Controls and values

Use shared buttons, chips, forms, file inputs, and feedback components for
standard interactions, including custom business actions. A custom action does
not require custom controls. Import each component from its public export, or
verify its runtime registration.

Choose display behavior for every visible field. Use the app defaults when
they give the required result. Keep other shared display settings in
`defineFields`, so list and detail show the same meaning. Show attachments as
previews or named file links, states as labelled framework chips, relations as
names, and dates and units with the applicable format. Show structured values
as readable content; use raw JSON only when the task requires JSON.

## Text and spacing

Use labels, values, validation, and short instructions that help the user do
the current task. Add help where a format, dependency, or consequence is unclear.
The standard submit label is `Submit`; collection view labels are `Table` and
`Cards`. Use the existing app language and domain terms.

Use the selected framework surface's spacing and theme tokens. Start peer
sections and action groups with `gap-2`. Let actions wrap on narrow screens.
Use colour with a text label for status. Keep content and controls usable at
narrow widths and with browser zoom.
Keep page actions separate from global actions. Use restrained borders and
surfaces. Reserve strong emphasis for the primary action, selected state, and
urgent feedback. Support the app's light and dark themes.

## Access and feedback

Use links for navigation and buttons for actions. Keep focus visible and
headings in order. Give icon controls accessible names. Support keyboard use;
keep focus inside an open navigation drawer and return it to the trigger when
Escape closes the drawer. Respect reduced motion preferences.

Preserve reading order when columns collapse. Keep labels, errors, and long
values accessible. Keep page scrolling usable; isolate wide table scrolling
and avoid other nested scroll areas unless the task needs them.

Keep loading, empty results, no filter matches, access denial, and failure
distinct. Offer Create or Clear filters when applicable. Preserve input on
failure and prevent duplicate submission. Confirm destructive actions with the
record and consequence. Show success after the write succeeds. If refresh then
fails, report stale data without asking the user to repeat the write.

## Technical references

Read the applicable [UI reference](docs/ui/README.md) for surface slots, form
selection, and collection controls. Use current source for exports and props.
Examples show implementation facts; compare their layout with this file before
you copy them.
