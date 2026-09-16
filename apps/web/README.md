# Carta Web

Carta template admin: dashboard plus settings users/roles/permissions.
Run `pnpm setup:local` from the repository root, then edit `apps/web/.env`.
Check readiness with `pnpm module:preflight -- --needs web,browser`.
Change `WEB_PORT` and `VITE_API_URL` only in `apps/web/.env`; the sample values
in `.env.example` are templates. The API port and URLs live in `apps/api/.env`.

The accepted direction for the next web architecture is documented in
[`docs/architecture/web-application-architecture.md`](../../docs/architecture/web-application-architecture.md).

## Tech Stack

- Vue 3 (`script setup`, async components)
- Vite 4
- TypeScript
- Vue Router (HTML5 history)
- Pinia
- Tailwind CSS + PostCSS
- Vitest + Vue Test Utils
- Oxlint + ESLint fallback + Oxfmt

## Static hosting

The app is fully static and client-side, but it uses HTML5 history, so the host
must serve `index.html` for any unknown path (SPA fallback). Vite's dev server
and `vite preview` do this by default; on other hosts configure the equivalent
rewrite (for example `try_files $uri /index.html;` on nginx).

Legacy `/#/path` URLs are normalized to their history-mode equivalent on boot,
and legacy roles query-state URLs (`?roles_view=...`) redirect to the matching
route.

## Acceptance fixture

`src/framework/acceptance/QueryOwnershipFixture.vue` is a permanent contract
test, not demo code, and it is deliberately unreachable from navigation. It
proves independent per-table query namespaces, an explicit namespace for a
duplicated resource, synchronous and asynchronous loaders behind one contract,
local query state that never touches the URL, and exceptional `read` and
`behavior` fields next to ordinary ones.

## Requirements

- Node.js 18+ (recommended)
- pnpm at the monorepo root

## Getting Started

From the monorepo root:

```sh
pnpm dev
```

Or run the web app directly from `apps/web` with the package scripts defined in this package.

## Available Scripts

- `dev` - start Vite dev server
- `build` - build for production
- `preview` - preview production build with the port from `apps/web/.env`
- `test` - run unit tests with Vitest (`jsdom`)
- `test:unit` - same as `test`
- `type-check` - run type checking via `vue-tsc`
- `lint` - run Oxlint, the ESLint fallback, and Oxfmt
- `format` - format supported files with Oxfmt
- `format:check` - check formatting with Oxfmt

## Environment Variables

- `GOOGLE_MAP_API_KEY`: used by map components
- `VITE_API_URL`: API base URL for app services
- `VITE_APP_BYPASS_ALL_PERMISSIONS`: set to `true` to bypass permission checks

Vite is configured with:

```ts
envPrefix: ['VITE_', 'GOOGLE_MAP_API_KEY']
```

## Runtime Configuration Notes

- API base URL comes from `VITE_API_URL`
- Permission bypass comes from `VITE_APP_BYPASS_ALL_PERMISSIONS`
- Company code is set in `src/company.ts`

## Current Baseline

- unit tests pass
- type-check passes
- production build currently fails due to a missing asset: `src/assets/corporate/assets/logo-hka.png`
