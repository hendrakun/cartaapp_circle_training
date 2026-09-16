# Application context and affected owners

Use this reference for a new module or a change whose surrounding application
knowledge is incomplete. Discover the actual application, not a generic
industry model and not merely a similarly named folder.

## Sources and authority

Read the user's artifacts and feature history first. Locate applicable product
briefs, domain vocabulary, decisions and existing application maps. Check their
scope: examples, starter content and another application's documents do not
silently become requirements for this application.

Code and tests establish current behavior. User-confirmed intent establishes
desired behavior. A source document establishes only what its author and scope
support. When these disagree, record both and ask about the affected behavior.
Mark unverified assumptions as unknown or proposed rather than fact. Cite paths
and symbols, reference sections, or dated user decisions so the next agent can
reopen the evidence.

## Affected-system map

For the requested journeys, trace the data and effects across the relevant
owners: entities and identifiers, relation cardinality, lifecycle, authorization
scope, operations, consuming forms/lookups, and downstream reads or effects.
Include reporting, background work, files or external systems only when this
change touches them. Follow ownership and consumer references, not just the
feature name. Read a sibling to learn a pattern, not to infer business policy.

Stop when each requested journey
has a known data origin, actor, observable effect and affected consumer, or a
specific unresolved business decision. Leave code pattern selection to planning.

Use this compact map in the design's Context section:

| Owner / consumer | Role in this change | Current contract and source | Intended difference / unresolved gap |
|---|---|---|---|

The map is sufficient when it explains where the data originates, who can
change it, how the selected journeys use it, and which consumers can observe
the change. A whole-repository inventory is unnecessary.

## Reusable application knowledge

Reuse the application's existing map when present. If no map exists and this
work establishes cross-module knowledge worth retaining, create
`docs/application-map.md` with:

- application identity, scope and last verified source revision;
- important domain boundaries, data owners and cross-module relationships;
- non-obvious invariants and decisions, each with a source and authority;
- pointers to source owners and approved feature designs;
- known gaps and application-specific examples explicitly marked as such.

Keep field catalogs, command lists and code details in their existing owners.
Revalidate the entries this change depends on, including relevant dirty or
untracked source. A stale entry is a lead to investigate, not a settled fact.
Update changed map entries after implementation is verified; desired behavior
under development must stay distinct from implemented behavior.

Use `$domain-modeling` when durable terminology or a consequential domain
boundary needs work. `CONTEXT.md` owns shared vocabulary, and an ADR owns a
cross-cutting decision and its rationale. Ordinary module behavior stays in
`design.md`; the map and glossary point to it rather than competing with it.
