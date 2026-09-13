# Carta

Carta is a full-stack TypeScript framework and project template for building information systems.

A Carta project comes with a Hono API, a Vue web application, authentication, users, roles, permissions, database tooling, file storage support, tests, and the conventions used to build new modules. The repository also contains the two frameworks that most of the application is built on:

* [Sprindle](https://github.com/southneuhof/sprindle) for the backend
* [Loom](https://github.com/southneuhof/loom) for the frontend

Carta does not replace Hono, Drizzle, or Vue. It puts a smaller application framework around them so common information-system work follows the same contracts and project structure. Application code can still use the underlying libraries directly when a module needs something outside the standard Carta path.

The repo also ships agent skills for designing, planning, implementing, and verifying application modules.

```text
Carta
├── apps/
│   ├── api/          Hono application
│   └── web/          Vue application
│
├── packages/
│   ├── sprindle/     Backend framework
│   ├── loom/         Frontend framework
│   ├── utilities/    Shared utilities
│   └── sdk/          Client package boundary
│
└── .agents/
    └── skills/       Carta development workflows
```

## Getting started

### Requirements

Use:

* Node.js 24 or newer
* pnpm
* Git
* PostgreSQL

Carta currently pins pnpm through the root `packageManager` field.

An S3-compatible service such as MinIO is needed if the application uses Carta's file-storage flows.

### Create an application

Run this from the directory that should contain the new project:

```sh
npx --yes create-carta-app@latest my-app
```

Then enter the project:

```sh
cd my-app
```

You can also configure the project's Git remote during creation:

```sh
npx --yes create-carta-app@latest my-app \
  --remote <private-repo-url>
```

`create-carta-app` clones the Carta repository with its history and local agent skills, then installs the workspace dependencies.

### Configure the environment

Prepare the four local environment files from tracked templates:

```sh
pnpm setup:local
# edit the four local files and provision the named services
pnpm module:preflight -- --needs api,web,test,browser,storage
```

Each file has one purpose: `apps/api/.env` holds development settings,
`apps/web/.env` holds web settings, `apps/api/.env.test` holds the isolated
Vitest target, and `apps/api/.env.e2e` holds the E2E database and bucket
overrides. `setup:local` creates only missing files and never overwrites an
existing file. `module:preflight` is read-only; every `FAIL` names its purpose
and the exact correction command. Run `node scripts/local-environment.mjs --help`
for the check list.

The API configuration includes:

```text
API_PORT
DATABASE_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
APP_ORIGIN

S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY
S3_SECRET_KEY

CARTA_ADMIN_EMAIL
CARTA_ADMIN_PASSWORD
```

The web application uses:

```text
VITE_API_URL
WEB_PORT
```

The sample addresses in the example files are templates, not defaults:

```text
API: http://localhost:5180
Web: http://localhost:5181
```

Change `API_PORT` and the related API URLs only in `apps/api/.env`. Change
`WEB_PORT` and `VITE_API_URL` only in `apps/web/.env`.

### Prepare the database

Start PostgreSQL, then apply the database migrations:

```sh
pnpm --filter @southneuhof/api db:migrate
```

Seed the initial application data:

```sh
pnpm --filter @southneuhof/api db:seed
```

The administrator account is taken from `CARTA_ADMIN_EMAIL` and `CARTA_ADMIN_PASSWORD`.

### Start development

Start both applications:

```sh
pnpm dev
```

The API runs on the port in `apps/api/.env` and the web application runs on the port in `apps/web/.env`.

### Useful commands

The main workspace commands are:

```sh
pnpm dev
pnpm dev:api
pnpm dev:web

pnpm type-check
pnpm test
pnpm lint
pnpm build
```

Database commands are available through the API package. Run them only after
the matching preflight target passes:

```sh
pnpm --filter @southneuhof/api db:generate
pnpm --filter @southneuhof/api db:migrate
pnpm --filter @southneuhof/api db:seed
pnpm --filter @southneuhof/api db:refresh
pnpm --filter @southneuhof/api db:migrate:test
pnpm --filter @southneuhof/api e2e:migrate
pnpm --filter @southneuhof/api e2e:seed
```

Run web browser tests with:

```sh
pnpm --filter @southneuhof/framework-web test:e2e
```

Sprindle also includes a VS Code language extension for its route system. Install the matching version after checkout with:

```sh
pnpm setup:editor
```

## What you get

A new Carta application starts with working application infrastructure instead of an empty backend and frontend.

The current template includes:

* Better Auth authentication and sessions
* PostgreSQL with Drizzle ORM
* users, roles, and permissions
* authenticated API and web routes
* list, detail, create, and update application patterns
* S3-compatible file storage support
* OpenAPI output
* filesystem routing on the API and web application
* Vitest test infrastructure
* Playwright browser tests
* type checking, linting, and formatting
* local agent instructions and Carta development skills

The included users, roles, and permissions modules are part of the application baseline and also provide examples of how Sprindle and Loom are used together.

## How the pieces fit together

Most Carta modules follow this path:

```text
Vue route
    ↓
Loom resource / view
    ↓
Application transport
    ↓
Hono + Sprindle route
    ↓
Application domain / service
    ↓
Drizzle
    ↓
PostgreSQL
```

The application owns the product behavior.

`apps/api` contains API routes, domains, authorization, persistence, and business operations. `apps/web` contains application routes, resources, navigation, and product-specific UI.

The packages under `packages/` contain reusable framework code. They should not contain business rules that only make sense for one application.

This distinction matters when projects receive Carta updates. Application code stays with the project while framework packages can be updated separately.

## Sprindle

[`@southneuhof/sprindle`](packages/sprindle) is the backend framework used by Carta.

It is a thin layer over Hono, Drizzle, and Zod. Sprindle handles the backend behavior that should stay consistent across applications, including resource contracts, standard operations, route composition, validation, request context, and response shapes.

For standard resources, Sprindle provides list, detail, create, update, and delete operations. Applications can opt into only the operations they need.

Backend routes use a filesystem convention under:

```text
apps/api/src/routes/
```

A route directory can contain a `+server.ts` file that exports HTTP methods:

```ts
import { defineRoute } from '@southneuhof/sprindle'

export const GET = defineRoute({
  action: () => ({ ok: true }),
})
```

A nearby `+scope.ts` can provide shared context or access rules for the routes below it. Parenthesized route groups organize source files without adding a URL segment.

Sprindle is meant to handle the common case without making custom cases difficult. A module with a different HTTP contract can use `defineRoute`, ordinary Hono behavior, application services, or custom Drizzle queries.

Read [packages/sprindle/README.md](packages/sprindle/README.md) for the framework API and [docs/architecture/api-conventions.md](docs/architecture/api-conventions.md) for Carta's backend conventions.

## Loom

[`@southneuhof/loom`](packages/loom) is the Vue application framework used by Carta.

Loom provides the shared contracts and components behind common information-system screens such as tables, detail pages, and forms.

A typical resource starts with a schema:

```ts
const schema = defineSchema({
  identity: 'id',
  record: { schema: recordSchema },
  query: { schema: querySchema },
  create: { schema: createSchema },
  update: { schema: updateSchema },
})
```

Fields describe how values appear and behave on different surfaces. A resource then connects those fields to application actions.

```ts
const resource = defineResource(schema, {
  key: 'records',
  actions: {
    list: { run: list, fields: [fields.name] },
    detail: { run: detail, fields: [fields.name] },
    create: { run: create, fields: [fields.name] },
    update: { run: update, fields: [fields.name] },
  },
})
```

The same resource can be passed to Loom's standard views:

```vue
<ListView v-bind="resource.list()" />
<DetailView v-bind="resource.detail({ id })" />
<FormView v-bind="resource.create()" />
<FormView v-bind="resource.update({ id })" />
```

Routes still own application behavior such as URLs, navigation, dialogs, confirmations, and workflows. Loom owns the reusable UI contracts and components underneath those routes.

The API remains the final authorization boundary. Hiding an action in the browser does not replace server-side permission checks.

Read [packages/loom/README.md](packages/loom/README.md) for the framework API and [docs/architecture/web-application-architecture.md](docs/architecture/web-application-architecture.md) for the application architecture.

## Filesystem routing

Both sides of a Carta application organize routes through the filesystem.

API routes live in:

```text
apps/api/src/routes/
```

Web routes live in:

```text
apps/web/src/routes/
```

On the web side, route files and layouts mirror the application's page hierarchy. An independent list, detail, create, edit, or nested screen normally gets its own route.

For example:

```text
settings/roles/
  index.route.vue
  create.route.vue
  [roleId]/
    detail.route.vue
    edit.route.vue
```

This keeps route ownership visible in the source tree and gives each page a clear place for its loading, query state, navigation, and workflow behavior.

See [docs/architecture/file-routing.md](docs/architecture/file-routing.md) for the routing conventions.

## Agent-assisted development

Carta includes repository-local agent skills under `.agents/skills/`.

The main entry point for cross-layer application work is:

```text
$carta-module-development
```

It looks at the work that already exists and continues from the appropriate stage.

A module can move through:

```text
Requirement
    ↓
Design
    ↓
Plan
    ↓
Implementation
    ↓
Verification
```

The main Carta skills include:

* `$carta-module-design` for resolving module behavior and acceptance requirements
* `$carta-module-plan` for turning an approved design into implementation work
* `$api-conventions` for backend work
* `$web-ui-surfaces` for frontend routes and UI
* `$verify-carta-module` for checking an implementation against its approved behavior
* `$carta-audit` for auditing the Sprindle and Loom framework

Designs and implementation plans normally live under `plans/<feature>/`. This gives later agent sessions a persistent record of what was agreed and what remains to be done.

Generate an approved bounded module with the node CLI: `pnpm scaffold:bounded-module -- --manifest plans/<feature>/module.json --check`, then `--apply`. Read `.agents/skills/carta-module-development/references/bounded.md` for the manifest contract.

Repository-wide instructions are in [AGENTS.md](AGENTS.md).

## Where new application code belongs

Most feature work should change `apps/api` and `apps/web`.

Backend application code belongs in `apps/api` when it defines product data, permissions, business rules, transactions, or HTTP behavior.

Frontend application code belongs in `apps/web` when it defines product routes, resources, navigation, workflows, or screens.

Change `packages/sprindle` or `packages/loom` only when the behavior belongs to the framework itself and should be reusable across Carta applications.

This boundary is also encoded in the Carta agent instructions.

## Framework updates

Projects created from Carta keep their application code while receiving framework updates separately.

The framework update boundary currently covers:

```text
packages/sprindle
packages/loom
packages/utilities
packages/sdk
```

Application-owned paths such as these are not replaced by a framework update:

```text
apps/api
apps/web
plans/
project documents
.env files
```

From a clean working tree, update the framework packages with:

```sh
pnpm carta:update
```

The command pulls the framework packages, installs dependencies, then runs the repository type checks and tests.

Local application changes remain in place.

The full update and contribution model is documented in [docs/framework-sync.md](docs/framework-sync.md).

## Repository map

```text
.
├── .agents/
│   └── skills/             Carta agent workflows
│
├── .github/
│   └── workflows/          Repository validation and sync jobs
│
├── apps/
│   ├── api/                Backend application
│   └── web/                Frontend application
│
├── docs/
│   └── architecture/       Application and framework conventions
│
├── evals/                  Agent workflow evaluation fixtures
│
├── packages/
│   ├── loom/               Vue application framework
│   ├── sdk/                Client package boundary
│   ├── sprindle/           Hono/Drizzle backend framework
│   └── utilities/          Shared frontend utilities
│
├── plans/                  Designs and implementation plans
├── scripts/                Repository and module tooling
├── AGENTS.md               Repository-wide agent instructions
└── package.json            Workspace scripts
```

`packages/sdk` is currently a package boundary for future client and transport work. It does not yet contain a runtime client implementation.

## Where to read next

If you are new to Carta, start with the application code and then read the framework documentation for the layer you are changing:

* [API README](apps/api/README.md)
* [Web README](apps/web/README.md)
* [Sprindle README](packages/sprindle/README.md)
* [Loom README](packages/loom/README.md)
* [Backend conventions](docs/architecture/api-conventions.md)
* [Web application architecture](docs/architecture/web-application-architecture.md)
* [Filesystem routing](docs/architecture/file-routing.md)
* [Framework updates](docs/framework-sync.md)

For agent-driven work, start with [AGENTS.md](AGENTS.md) and `.agents/skills/`.
