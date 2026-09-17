import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const repoRoot = resolve(__dirname, '../../..')
let prepared = false

function enabled(name: 'E2E_ITERATION' | 'SKIP_E2E_PREPARE') {
  const value = process.env[name]
  if (!value) return false
  if (value !== '1') throw new Error(`${name} must be 1 when set.`)
  return true
}

export function isE2eIteration() {
  const iteration = enabled('E2E_ITERATION')
  const skipPrepare = enabled('SKIP_E2E_PREPARE')
  if (process.env.CI && (iteration || skipPrepare)) throw new Error('E2E iteration flags are not allowed in CI.')
  if (skipPrepare && !iteration) throw new Error('SKIP_E2E_PREPARE requires E2E_ITERATION=1.')
  return iteration
}

export function requiredE2eValue(name: 'E2E_API_URL' | 'E2E_WEB_URL'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is missing. Start tests through Playwright so apps/api/.env and apps/web/.env supply it.`)
  return value
}

function prepareE2eState() {
  execFileSync('pnpm', ['--filter', '@southneuhof/api', 'e2e:prepare'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  })
}

export function prepareForTest() {
  const iteration = isE2eIteration()
  if (process.env.SKIP_E2E_PREPARE === '1') return
  if (iteration && prepared) return
  prepareE2eState()
  if (iteration) prepared = true
}
