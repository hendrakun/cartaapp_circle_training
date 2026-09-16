import { defineConfig } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
import { isE2eIteration } from './e2e/state'

const webRoot = __dirname
const repoRoot = resolve(webRoot, '../..')
const apiRoot = resolve(repoRoot, 'apps/api')

const apiEnvPath = resolve(apiRoot, '.env')
const webEnvPath = resolve(webRoot, '.env')

function readAppEnv(path: string): Record<string, string> {
  try {
    return parse(readFileSync(path))
  } catch {
    throw new Error(`Missing app environment file: ${path}. Copy the sibling .env.example to .env.`)
  }
}

function requiredValue(env: Record<string, string>, name: string, filePath: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is missing in ${filePath}. Set ${name} in ${filePath}.`)
  return value
}

function requiredPort(value: string, name: string, filePath: string): string {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} is invalid in ${filePath}. Set ${name} to a port 1-65535.`)
  }
  return String(port)
}

function urlPort(value: string, name: string, filePath: string): string {
  try {
    const port = new URL(value).port
    if (!port) throw new Error('missing port')
    return port
  } catch {
    throw new Error(`${name} is invalid in ${filePath}. Set ${name} to a URL with an explicit port.`)
  }
}

const rejectedPortAliases = ['CARTA_E2E_API_PORT', 'CARTA_E2E_FRONTEND_PORT', 'BACKEND_PORT', 'FRONTEND_PORT'] as const
for (const alias of rejectedPortAliases) {
  if (process.env[alias] !== undefined) {
    throw new Error(`${alias} is not accepted. Set API_PORT in apps/api/.env and WEB_PORT in apps/web/.env.`)
  }
}

const apiEnv = readAppEnv(apiEnvPath)
const webEnv = readAppEnv(webEnvPath)

const apiPort = requiredPort(requiredValue(apiEnv, 'API_PORT', apiEnvPath), 'API_PORT', apiEnvPath)
const webPort = requiredPort(requiredValue(webEnv, 'WEB_PORT', webEnvPath), 'WEB_PORT', webEnvPath)
const betterAuthUrl = requiredValue(apiEnv, 'BETTER_AUTH_URL', apiEnvPath)
const appOrigin = requiredValue(apiEnv, 'APP_ORIGIN', apiEnvPath)
const viteApiUrl = requiredValue(webEnv, 'VITE_API_URL', webEnvPath)

if (urlPort(betterAuthUrl, 'BETTER_AUTH_URL', apiEnvPath) !== apiPort) {
  throw new Error(`BETTER_AUTH_URL port must equal API_PORT in ${apiEnvPath}.`)
}
if (urlPort(viteApiUrl, 'VITE_API_URL', webEnvPath) !== apiPort) {
  throw new Error(`VITE_API_URL port must equal API_PORT in ${apiEnvPath}.`)
}
if (urlPort(appOrigin, 'APP_ORIGIN', apiEnvPath) !== webPort) {
  throw new Error(`APP_ORIGIN port must equal WEB_PORT in ${webEnvPath}.`)
}

const apiUrl = betterAuthUrl
const webUrl = appOrigin
const reuseExistingServer = isE2eIteration()

for (const [name, value, owner] of [
  ['E2E_API_URL', apiUrl, `BETTER_AUTH_URL in ${apiEnvPath}`],
  ['E2E_WEB_URL', webUrl, `APP_ORIGIN in ${apiEnvPath}`],
] as const) {
  const inherited = process.env[name]
  if (inherited !== undefined && inherited !== value) {
    throw new Error(`${name} is derived from ${owner}. Remove the inherited override.`)
  }
  process.env[name] = value
}

export default defineConfig({
  testDir: './e2e',
  testMatch: /\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results',
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
  ],
  use: {
    baseURL: webUrl,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'pnpm exec tsx scripts/ensure-tooling.mjs && pnpm exec tsx scripts/compile-routes.ts .sprindle-e2e/routes.mjs && node --env-file=.env --env-file=.env.e2e --import tsx src/server.ts',
      cwd: apiRoot,
      url: `${apiUrl}/health`,
      timeout: 120_000,
      reuseExistingServer,
      env: {
        API_PORT: apiPort,
        BETTER_AUTH_URL: apiUrl,
        APP_ORIGIN: webUrl,
        SPRINDLE_ROUTE_MANIFEST: '.sprindle-e2e/routes.mjs',
      },
    },
    {
      command: 'pnpm dev --host 127.0.0.1',
      cwd: webRoot,
      url: webUrl,
      timeout: 120_000,
      reuseExistingServer,
      env: { VITE_API_URL: viteApiUrl },
    },
  ],
})
