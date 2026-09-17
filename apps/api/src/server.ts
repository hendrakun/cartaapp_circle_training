import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";

const bootStarted = Date.now();
const log = (message: string) => console.log(`[api] ${message} (+${Date.now() - bootStarted}ms)`);

const port = Number(process.env.API_PORT);

if (!port) {
  console.error("API_PORT is not set");
  process.exit(1);
}

log("Loading route manifest...");
const { assertRouteEntitiesBound, bindRouteEntities, loadRouteManifest } = await import("@southneuhof/sprindle/hono");
const routeManifest = await loadRouteManifest(
  fileURLToPath(new URL("..", import.meta.url)),
  process.env.SPRINDLE_ROUTE_MANIFEST ?? (process.env.VITEST ? ".sprindle-test/routes.mjs" : ".sprindle/routes.mjs"),
);
log(`Route manifest loaded with ${routeManifest.length} routes.`);

log("Creating app...");
const { createApp } = await import("./create-app");
const app = createApp(routeManifest);
log("App created. Connecting database...");

const { getDb, getDomainSchema } = await import("./db");
getDb();
log("Database ready. Binding route entities...");

bindRouteEntities(routeManifest, getDomainSchema().entities);
assertRouteEntitiesBound(routeManifest);
log("Routes bound. Starting HTTP server...");

serve({
  fetch: app.fetch,
  port,
});

console.log(`Listening on port ${port} (+${Date.now() - bootStarted}ms)`);
