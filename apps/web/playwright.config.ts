import { defineConfig } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
import { isE2eIteration } from './e2e/state'

const webRoot = __dirname
const repoRoot = resolve(webRoot, '../..')
const apiRoot = resolve(repoRoot, 'apps/api')

function readE2eEnv() {
  try {
    return parse(readFileSync(resolve(apiRoot, '.env.e2e')))
  } catch {
    return {}
  }
}

const e2eEnv = readE2eEnv()
const apiPort = process.env.CARTA_E2E_API_PORT ?? process.env.BACKEND_PORT ?? e2eEnv.CARTA_E2E_API_PORT ?? '5180'
const frontendPort = process.env.CARTA_E2E_FRONTEND_PORT ?? process.env.FRONTEND_PORT ?? e2eEnv.CARTA_E2E_FRONTEND_PORT ?? '5181'
const apiUrl = process.env.E2E_API_URL ?? `http://127.0.0.1:${apiPort}`
const webUrl = process.env.E2E_WEB_URL ?? `http://127.0.0.1:${frontendPort}`
const reuseExistingServer = isE2eIteration()

process.env.E2E_API_URL ??= apiUrl
process.env.E2E_WEB_URL ??= webUrl

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
      command: `pnpm dev --host 127.0.0.1 --port ${frontendPort}`,
      cwd: webRoot,
      url: webUrl,
      timeout: 120_000,
      reuseExistingServer,
      env: { VITE_API_URL: apiUrl },
    },
  ],
})
