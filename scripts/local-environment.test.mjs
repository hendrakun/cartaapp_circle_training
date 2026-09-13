import { strict as assert } from 'node:assert'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, afterEach } from 'node:test'
import {
  checkE2eTarget,
  checkTestTarget,
  formatResults,
  parseNeeds,
  preflight,
  redactSecrets,
  setupLocal,
  setupPairs,
} from './local-environment.mjs'

const roots = []
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'carta-local-env-'))
  roots.push(root)
  writeFileSync(join(root, 'package.json'), '{"name":"fixture"}')
  for (const dir of ['apps/api', 'apps/web']) {
    mkdirSync(join(root, dir), { recursive: true })
  }
  writeFileSync(join(root, 'apps/api/.env.example'), 'API_PORT=5180\nDATABASE_URL=postgresql://postgres:postgres@localhost:5432/carta\nBETTER_AUTH_SECRET=replace-with-at-least-32-random-characters\nBETTER_AUTH_URL=http://localhost:5180\nAPP_ORIGIN=http://localhost:5181\n')
  writeFileSync(join(root, 'apps/web/.env.example'), 'VITE_API_URL=http://localhost:5180\nWEB_PORT=5181\n')
  writeFileSync(join(root, 'apps/api/.env.test.example'), 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carta_api_test\nCARTA_DATABASE_PURPOSE=test\nCARTA_TEST_DATABASE_NAME=carta_api_test\n')
  writeFileSync(join(root, 'apps/api/.env.e2e.example'), 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carta_e2e\nCARTA_DATABASE_PURPOSE=e2e\nCARTA_E2E_DATABASE_NAME=carta_e2e\nS3_BUCKET=carta-e2e\n')
  return root
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test('first setup creates four files and replaces only the new secret placeholder', () => {
  const root = fixtureRoot()
  const outcome = setupLocal({ root, createSecret: () => 'created-secret-value' })
  assert.deepEqual(outcome.created.sort(), ['apps/api/.env', 'apps/api/.env.e2e', 'apps/api/.env.test', 'apps/web/.env'])
  const apiEnv = readFileSync(join(root, 'apps/api/.env'), 'utf8')
  assert.ok(apiEnv.includes('created-secret-value'))
  assert.ok(!apiEnv.includes('replace-with-at-least-32-random-characters'))
  for (const [, destination] of setupPairs().filter(([, destination]) => destination !== 'apps/api/.env')) {
    assert.ok(!readFileSync(join(root, destination), 'utf8').includes('created-secret-value'))
  }
})

test('second setup changes zero bytes and existing files are never overwritten', () => {
  const root = fixtureRoot()
  setupLocal({ root, createSecret: () => 'first-secret' })
  const before = setupPairs().map(([, destination]) => sha256(join(root, destination)))
  writeFileSync(join(root, 'apps/api/.env'), 'API_PORT=5180\nDATABASE_URL=postgresql://custom@localhost:5432/custom\n')
  const sentinel = sha256(join(root, 'apps/api/.env'))
  const outcome = setupLocal({ root, createSecret: () => 'second-secret' })
  assert.deepEqual(outcome.created, [])
  assert.equal(readFileSync(join(root, 'apps/api/.env'), 'utf8').includes('second-secret'), false)
  assert.equal(sha256(join(root, 'apps/api/.env')), sentinel)
  assert.ok(!readFileSync(join(root, 'apps/api/.env'), 'utf8').includes(before[0]))
})

test('unknown and duplicate --needs values fail', () => {
  assert.throws(() => parseNeeds(['--needs', 'api,unknown']), /Unknown --needs/)
  assert.throws(() => parseNeeds(['--needs=api,api']), /Duplicate/)
  assert.throws(() => parseNeeds(['--bogus']), /Unknown argument/)
})

test('test and E2E identity cannot equal the development identity', () => {
  const root = fixtureRoot()
  setupLocal({ root, createSecret: () => 'x'.repeat(64) })
  writeFileSync(join(root, 'apps/api/.env.test'), 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carta\nCARTA_DATABASE_PURPOSE=test\nCARTA_TEST_DATABASE_NAME=carta\n')
  assert.throws(() => checkTestTarget({ apiRoot: join(root, 'apps/api'), env: {} }), /distinct/)
  writeFileSync(join(root, 'apps/api/.env.e2e'), 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/carta\nCARTA_DATABASE_PURPOSE=e2e\nCARTA_E2E_DATABASE_NAME=carta\nS3_BUCKET=carta-e2e\n')
  const e2e = checkE2eTarget({ apiRoot: join(root, 'apps/api'), env: {} })
  assert.equal(e2e.target.database, 'carta')
  assert.equal(e2e.bucket, 'carta-e2e')
})

test('missing, unreachable and mismatched targets give safe corrections without secrets', async () => {
  const root = fixtureRoot()
  setupLocal({ root, createSecret: () => 'x'.repeat(64) })
  const secretUrl = 'postgresql://admin:s3cret-value@localhost:5432/carta_api_test'
  writeFileSync(join(root, 'apps/api/.env.test'), `DATABASE_URL=${secretUrl}\nCARTA_DATABASE_PURPOSE=test\nCARTA_TEST_DATABASE_NAME=carta_api_test\n`)
  const closedSocket = async ({ tracker, kind }) => {
    tracker.track(kind, { destroy() {} })
    return null
  }
  const { results } = await preflight(['api', 'test'], {
    root,
    env: {},
    probes: {
      openSocket: closedSocket,
      queryDatabase: async () => {
        throw new Error(secretUrl)
      },
    },
  })
  const { text, failed } = formatResults({ needs: ['api', 'test'], results })
  assert.ok(failed > 0)
  assert.ok(!text.includes('s3cret-value'))
  assert.equal(redactSecrets(`DATABASE_URL=${secretUrl}`).includes('s3cret-value'), false)
  const correction = results.find((result) => result.purpose === 'test' && result.status === 'FAIL')
  assert.match(correction.correction, /db:migrate:test/)

  const mismatched = await preflight(['test'], {
    root,
    env: {},
    probes: { queryDatabase: async () => 'other-database' },
  })
  assert.equal(mismatched.results.at(-1).status, 'FAIL')
  assert.match(mismatched.results.at(-1).correction, /point apps\/api\/.env\.test/)
})

test('matching test database probe passes and receives the configured connection', async () => {
  const root = fixtureRoot()
  setupLocal({ root, createSecret: () => 'x'.repeat(64) })
  const expectedUrl = 'postgresql://postgres:postgres@localhost:5432/carta_api_test'
  let received = null
  const { results } = await preflight(['test'], {
    root,
    env: {},
    probes: {
      queryDatabase: async (probe) => {
        received = probe
        return 'carta_api_test'
      },
    },
  })
  assert.equal(results.at(-1).status, 'PASS')
  assert.equal(results.at(-1).check, 'connected database carta_api_test')
  assert.equal(received?.connectionString, expectedUrl)
  assert.equal(received?.database, 'carta_api_test')
})

test('every injected socket and client is closed', async () => {
  const root = fixtureRoot()
  setupLocal({ root, createSecret: () => 'x'.repeat(64) })
  writeFileSync(join(root, 'apps/api/.env'), `${readFileSync(join(root, 'apps/api/.env'), 'utf8')}S3_ENDPOINT=http://localhost:9000\nS3_ACCESS_KEY=key\nS3_SECRET_KEY=secret\n`)
  const seen = []
  const fakeSocket = { destroy() { seen.push('socket') } }
  const { opened, closed } = await preflight(['api', 'web', 'test', 'browser', 'storage'], {
    root,
    env: {},
    probes: {
      openSocket: async ({ tracker, kind }) => {
        tracker.track(kind, fakeSocket)
        return fakeSocket
      },
      fetchJson: async (url, _timeout, { tracker, kind }) => {
        tracker.track(kind, {})
        return url.includes('/health') ? { ok: true } : {}
      },
      queryDatabase: async ({ tracker, kind }) => {
        tracker.track(kind, {})
        return 'carta_api_test'
      },
      queryE2eDatabase: async ({ tracker, kind }) => {
        tracker.track(kind, {})
        return 'carta_e2e'
      },
      chromiumExecutable: async ({ tracker, kind }) => {
        const executable = join(root, 'chromium-stub')
        writeFileSync(executable, 'stub')
        tracker.track(kind, executable)
        return executable
      },
      headBucket: async ({ tracker, kind }) => {
        tracker.track(kind, {})
      },
    },
  })
  for (const kind of opened) assert.ok(closed.includes(kind), `unclosed probe: ${kind}`)
  assert.ok(opened.length > 0)
  assert.ok(seen.length > 0)
})
