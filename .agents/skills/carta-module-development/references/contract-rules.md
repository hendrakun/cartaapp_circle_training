# Cross-layer contracts

The approved design owns business behavior. The layer skills own code and UI
patterns. Use this file to check the boundaries between them.

- **Scope:** Select list, detail, create, update and delete independently.
  Implement the actions the product needs.
- **Names:** Keep persisted fields, API schemas, actions and resource fields
  aligned. Use the same domain labels across pages, validation and workflows.
- **Values:** Read [frontend-field-contract.md](frontend-field-contract.md) for
  display, draft and submit values, relation identities, assets and multi
  selections. Change schema, persistence mapping and consumers together.
- **Relations:** The API returns named relation objects for display and accepts
  the declared write key. Load the display shape on list, detail and returned
  writes. The server checks reference existence, access and parent membership.
  A filtered lookup is user assistance, not authorization.
- **Files:** Shared API storage owns upload, download and deletion. Distinguish
  a retained upload, external URL and owned child row in the data contract.
  Use the current public asset schemas and projection in `apps/api/src/storage`;
  reuse the web asset adapter. Keep module-specific upload routes, URL builders
  and compatibility value mappers out of ordinary resource code.
- **Queries:** The resource owner defines list filters and detail identity.
  Consumers pass parameters through the existing actions. Multi-selection query
  arrays use JSON and the API `selectionQuery(itemSchema)` contract.
- **Access:** Bind one permission policy across API, resource actions, route
  guards, navigation and seed data. Read the
  [API permission rules](../../api-conventions/SKILL.md).
  Server checks remain required even when the UI hides an action.
- **Backend routes:** Use the [file-routing contract](../../api-conventions/references/file-routing.md).
  Plan the inherited scope chain with each HTTP action.
- **Navigation:** Register each intended entry point in the app navigation
  manifest. A filesystem route alone does not add a sidebar entry.
- **State:** Specify deletion, recovery and workflow effects as observable
  behavior. Coupled writes that must succeed together use one transaction.
- **Freshness:** Read [web-query-cache.md](web-query-cache.md) for cached reads
  and invalidation of affected consumers after a mutation.
- **UI:** Use `$web-ui-surfaces` for page and navigation conventions and
  `$build-resource-form` for forms. Their visual defaults permit local choices;
  data contracts and accessible interaction remain requirements.
- **Proof:** Use [verification-strategy.md](verification-strategy.md). Test the
  behavior at its owner, then the integration where layers can disagree.
