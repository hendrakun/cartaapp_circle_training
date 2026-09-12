# Agent rules

- Use ASD-STE100 Simplified Technical English.
- Keep changes within the user request and preserve unrelated work.
- Use destructive, production, or external writes only when the user authorizes them.
- Prefer existing code and the smallest change that meets the requirement.
- Test changed behavior with stable tests.
- Implement the current contract. Add no compatibility alias or wrapper unless the user request requires it.
- Change framework packages only when the user request explicitly includes them. Keep unsupported behavior local.
- For an update from upstream, read [the update procedure](docs/framework-sync.md#update-carta-packages-in-a-project). It defines authorization, local work protection, conflict resolution, and required checks.
- Use `$carta-audit` for a Sprindle plus Loom framework audit.
- Use `$carta-module-development` for cross-layer module delivery; `$carta-module-design` for module behavior and `$carta-module-plan` for planning an approved design.
- Use `$api-conventions` for `apps/api` changes and `$web-ui-surfaces` for `apps/web` UI changes.
- Use `$verify-carta-module` to verify a completed module.
- Report failed checks, blocked work, and unverified results.
