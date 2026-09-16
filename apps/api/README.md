# API

## Environment

Run `pnpm setup:local` from the repository root, then configure the database
and auth settings in the created files. `apps/api/.env` holds development,
`apps/api/.env.test` holds the isolated Vitest target, and `apps/api/.env.e2e`
holds E2E database and bucket overrides. Check readiness with
`pnpm module:preflight -- --needs api,test,browser,storage`. The API trusts `APP_ORIGIN` only. Change `API_PORT` and the related API URLs only in `apps/api/.env`; the sample values in `.env.example` are templates. The database is `carta`, admin seed via `CARTA_ADMIN_EMAIL` and `CARTA_ADMIN_PASSWORD`.

Auth is served at `/api/auth/*`. All routes except `/health`, `/openapi.json`, and `/api/auth/*` require a valid Better Auth session cookie.

`src/routes/` is the public API surface. Group related route files in folders.

## Direct S3/MinIO uploads

The API can issue an authenticated, short-lived `PUT` URL. The API does not
receive the file bytes.

Configure these variables in `.env`:

```text
S3_ENDPOINT
S3_BUCKET
S3_ACCESS_KEY
S3_SECRET_KEY
```

Request a URL:

```sh
curl -c cookies.txt -b cookies.txt -X POST "$API_URL/api/auth/sign-in/email" \
  -H 'Content-Type: application/json' \
  --data '{"email":"admin@example.com","password":"demo-password"}'

curl -c cookies.txt -b cookies.txt -X POST "$API_URL/files/presigned-url" \
  -H 'Content-Type: application/json' \
  --data '{"filename":"sample.txt","contentType":"text/plain","size":12}'
```

Copy `data.uploadUrl` from the response, then upload the file directly to
MinIO with the returned `Content-Type` header:

```sh
curl -X PUT '<paste-data.uploadUrl-here>' \
  -H 'Content-Type: text/plain' \
  --upload-file ./sample.txt
```

The response includes `data.downloadUrl`, a stable authenticated API URL for
displaying the object. The API creates a short-lived MinIO `GET` signature when
the browser opens that URL. The API does not store file metadata.

List objects under the application prefix:

```sh
curl -b cookies.txt "$API_URL/files?prefix=uploads/"
```

Delete an object with its server-generated key:

```sh
curl -b cookies.txt -X DELETE "$API_URL/files/object" \
  -H 'Content-Type: application/json' \
  --data '{"key":"uploads/<object-key>"}'
```

`S3_ENDPOINT` must be reachable by the browser that performs the `PUT`. The
MinIO bucket CORS policy must allow `PUT` from the browser origin and allow the
signed request headers, including `Content-Type`.

HTTP routes use files. A `+server.ts` file exports named HTTP methods. The
nearest `+scope.ts` supplies shared context, access, and an entity. Group
directories in parentheses do not add a URL segment.

```ts
// src/routes/health/+server.ts
import { defineRoute } from '@southneuhof/sprindle'

export const GET = defineRoute({
  action: () => ({ ok: true }),
})
```

Normal build, type-check, test, and development commands maintain the private
route artifact. Developers do not register routes or import generated files.
Database domains are registered separately in `src/domains.ts`.

Run `pnpm setup:editor` once after checkout to build and install the matching
Sprindle language extension for VS Code. Route changes then update editor types
without a development server or a route generation command.
