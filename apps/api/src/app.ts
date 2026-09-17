import { fileURLToPath } from 'node:url'
import { loadRouteManifest } from '@southneuhof/sprindle/hono'
import { createApp } from './create-app'

export const routeManifest = await loadRouteManifest(
  fileURLToPath(new URL('..', import.meta.url)),
  process.env.SPRINDLE_ROUTE_MANIFEST ?? (process.env.VITEST ? '.sprindle-test/routes.mjs' : '.sprindle/routes.mjs'),
)
export const app = createApp(routeManifest)
export type AppType = typeof app
