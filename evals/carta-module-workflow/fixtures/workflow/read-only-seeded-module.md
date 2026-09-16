# Approved module fixture

Create a new scalar `service-levels` resource with List and Detail. It has text
UUID `id`, text `name`, boolean `active`, system permissions and the existing
`settings` group. Seed exactly `{ "id": "standard", "name": "Standard", "active": true }`
and update only `name` and `active` on conflict. API, web, test and browser are
required. No destination exists for this module.
