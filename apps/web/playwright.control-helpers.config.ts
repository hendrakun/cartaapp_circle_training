import { defineConfig } from '@playwright/test'

/**
 * Isolated test-only config for the shared control helper regression.
 * No app webServer. No setup dependency. No API or database access.
 * Local page fixture only.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: /form-controls\.spec\.ts$/,
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results/control-helpers',
  reporter: [['list'], ['json', { outputFile: 'test-results/control-helpers/results.json' }]],
  use: {
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
