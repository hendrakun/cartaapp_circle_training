#!/usr/bin/env node
// One owner for local setup plus read-only preflight. Setup creates missing
// local environment files; preflight only reads configuration and probes
// selected capabilities. It performs no install, migration, seed, reset,
// upload, list, or delete, and never prints a secret value.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createConnection } from 'node:net'
import { randomBytes } from 'node:crypto'
import { dirname, isAbsolute, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

export const PROBE_TIMEOUT_MS = 2000
export const VALID_NEEDS = ['api', 'web', 'test', 'browser', 'storage']
const SECRET_NAMES = new Set([
  'BETTER_AUTH_SECRET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'CARTA_ADMIN_PASSWORD',
  'DATABASE_URL',
])
const API_SECRET_PLACEHOLDER = 'replace-with-at-least-32-random-characters'

export function scriptRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..')
}

export function setupPairs() {
  return [
    ['apps/api/.env.example', 'apps/api/.env'],
    ['apps/web/.env.example', 'apps/web/.env'],
    ['apps/api/.env.test.example', 'apps/api/.env.test'],
    ['apps/api/.env.e2e.example', 'apps/api/.env.e2e'],
  ]
}

export function stripInlineSecrets(line) {
  const [name, ...rest] = line.split('=')
  if (rest.length && SECRET_NAMES.has(name.trim())) return `${name.trim()}=<redacted>`
  return line
}

export function redactSecrets(text) {
  return String(text)
    .split('\n')
    .map(stripInlineSecrets)
    .join('\n')
}

export { databaseIdentity } from '../apps/api/scripts/test-target.mjs'
import { databaseIdentity } from '../apps/api/scripts/test-target.mjs'

export function identityLine(identity) {
  if (!identity) return 'unknown target'
  return `${identity.hostname}:${identity.port}/${identity.database}`
}

function requiredField(configuration, name, fileLabel) {
  const value = configuration[name]?.trim()
  if (!value) throw new Error(`${fileLabel} must declare ${name}.`)
  return value
}

function fail(purpose, check, correction) {
  return { status: 'FAIL', purpose, check, correction }
}

function pass(purpose, check) {
  return { status: 'PASS', purpose, check, correction: '-' }
}

export function parseNeeds(argv) {
  const values = []
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--needs' || argument.startsWith('--needs=')) {
      const raw = argument === '--needs' ? (argv[index + 1] ?? '') : argument.slice('--needs='.length)
      if (argument === '--needs') index += 1
      if (!raw.trim()) throw new Error('--needs requires a comma-separated list: api,web,test,browser,storage.')
      values.push(...raw.split(',').map((part) => part.trim()))
    } else if (argument === '--help' || argument === '-h') {
      return { help: true }
    } else {
      throw new Error(`Unknown argument: ${argument}. Use --needs api,web,test,browser,storage or --help.`)
    }
  }
  if (!values.length) return { needs: ['api', 'web'] }
  const unknown = values.filter((value) => !VALID_NEEDS.includes(value))
  if (unknown.length) {
    throw new Error(`Unknown --needs value: ${unknown.join(', ')}. Use only: ${VALID_NEEDS.join(',')}.`)
  }
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  if (duplicates.length) {
    throw new Error(`Duplicate --needs value: ${[...new Set(duplicates)].join(', ')}.`)
  }
  return { needs: values }
}

export function checkPortAndUrls(apiEnvPath, apiConfiguration, webEnvPath, webConfiguration) {
  const apiPort = requiredField(apiConfiguration, 'API_PORT', 'apps/api/.env')
  const webPort = requiredField(webConfiguration, 'WEB_PORT', 'apps/web/.env')
  for (const [name, value, owner] of [
    ['API_PORT', apiPort, 'apps/api/.env'],
    ['WEB_PORT', webPort, 'apps/web/.env'],
  ]) {
    const port = Number(value)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`${name} is invalid in ${owner}. Set ${name} to a port 1-65535.`)
    }
  }
  const urlPort = (value, name, owner) => {
    try {
      const port = new URL(value).port
      if (!port) throw new Error('missing port')
      return port
    } catch {
      throw new Error(`${name} is invalid in ${owner}. Set ${name} to a URL with an explicit port.`)
    }
  }
  const betterAuthUrl = requiredField(apiConfiguration, 'BETTER_AUTH_URL', 'apps/api/.env')
  const appOrigin = requiredField(apiConfiguration, 'APP_ORIGIN', 'apps/api/.env')
  const viteApiUrl = requiredField(webConfiguration, 'VITE_API_URL', 'apps/web/.env')
  if (urlPort(betterAuthUrl, 'BETTER_AUTH_URL', apiEnvPath) !== String(apiPort)) {
    throw new Error(`BETTER_AUTH_URL port must equal API_PORT in ${apiEnvPath}.`)
  }
  if (urlPort(viteApiUrl, 'VITE_API_URL', webEnvPath) !== String(apiPort)) {
    throw new Error(`VITE_API_URL port must equal API_PORT in ${apiEnvPath}.`)
  }
  if (urlPort(appOrigin, 'APP_ORIGIN', apiEnvPath) !== String(webPort)) {
    throw new Error(`APP_ORIGIN port must equal WEB_PORT in ${webEnvPath}.`)
  }
  return { apiPort: String(apiPort), webPort: String(webPort), betterAuthUrl, appOrigin, viteApiUrl }
}

export function readEnvFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} is missing at ${path}. Run pnpm setup:local, then edit the file.`)
  const configuration = parseEnv(readFileSync(path, 'utf8'))
  for (const [name, value] of Object.entries(configuration)) {
    if (value.includes(API_SECRET_PLACEHOLDER)) {
      throw new Error(`${label} still has the template placeholder in ${name}. Replace it before running checks.`)
    }
  }
  return configuration
}

export function checkTestTarget({ apiRoot, env = process.env }) {
  const testPath = resolve(apiRoot, '.env.test')
  if (!existsSync(testPath)) throw new Error('apps/api/.env.test is missing. Run pnpm setup:local, then edit the file.')
  const configuration = parseEnv(readFileSync(testPath, 'utf8'))
  for (const key of ['DATABASE_URL', 'CARTA_DATABASE_PURPOSE', 'CARTA_TEST_DATABASE_NAME']) {
    if (!configuration[key]?.trim()) throw new Error(`apps/api/.env.test must explicitly declare ${key}.`)
    if (env[key] !== undefined && env[key] !== configuration[key]) {
      throw new Error(`The effective ${key} differs from apps/api/.env.test. Remove the inherited override.`)
    }
  }
  if (configuration.CARTA_DATABASE_PURPOSE !== 'test') {
    throw new Error('CARTA_DATABASE_PURPOSE must be test in apps/api/.env.test.')
  }
  const target = databaseIdentity(configuration.DATABASE_URL)
  if (
    target.database !== configuration.CARTA_TEST_DATABASE_NAME ||
    ['postgres', 'template0', 'template1'].includes(target.database)
  ) {
    throw new Error('The test database must match CARTA_TEST_DATABASE_NAME and must not be administrative.')
  }
  const developmentPath = resolve(apiRoot, '.env')
  if (existsSync(developmentPath)) {
    const development = parseEnv(readFileSync(developmentPath, 'utf8')).DATABASE_URL
    if (development && databaseIdentity(development).key === target.key) {
      throw new Error('The test target must be distinct from the development database in apps/api/.env.')
    }
  }
  return { target, configuration }
}

export function checkE2eTarget({ apiRoot, env = process.env }) {
  const e2ePath = resolve(apiRoot, '.env.e2e')
  if (!existsSync(e2ePath)) throw new Error('apps/api/.env.e2e is missing. Run pnpm setup:local, then edit the file.')
  const shared = existsSync(resolve(apiRoot, '.env')) ? parseEnv(readFileSync(resolve(apiRoot, '.env'), 'utf8')) : {}
  const overrides = parseEnv(readFileSync(e2ePath, 'utf8'))
  const effective = { ...shared, ...overrides }
  for (const key of ['CARTA_DATABASE_PURPOSE', 'CARTA_E2E_DATABASE_NAME', 'S3_BUCKET']) {
    if (!overrides[key]?.trim() && !effective[key]?.trim()) {
      throw new Error(`apps/api/.env.e2e must explicitly declare ${key}.`)
    }
    if (env[key] !== undefined && env[key] !== effective[key]) {
      throw new Error(`The effective ${key} differs from apps/api/.env.e2e. Remove the inherited override.`)
    }
  }
  if (effective.CARTA_DATABASE_PURPOSE !== 'e2e') {
    throw new Error('CARTA_DATABASE_PURPOSE must be e2e for the E2E target.')
  }
  if (!effective.DATABASE_URL?.trim()) throw new Error('The E2E target must declare DATABASE_URL in apps/api/.env.e2e.')
  const target = databaseIdentity(effective.DATABASE_URL)
  if (target.database !== effective.CARTA_E2E_DATABASE_NAME) {
    throw new Error('The E2E database must match CARTA_E2E_DATABASE_NAME.')
  }
  return { target, bucket: effective.S3_BUCKET, purpose: effective.CARTA_DATABASE_PURPOSE, configuration: effective }
}

function createProbeTracker(probes) {
  const opened = []
  const closed = []
  const track = (kind, resource) => {
    opened.push(kind)
    return resource
  }
  const noteClosed = (kind) => {
    closed.push(kind)
  }
  return { opened, closed, track, noteClosed, probes }
}

async function probeTcp({ host, port, timeoutMs, openSocket, onClose }) {
  if (openSocket) {
    try {
      const socket = await openSocket({ host, port, timeoutMs })
      await onClose?.(socket)
      return true
    } catch {
      await onClose?.(null).catch(() => {})
      return false
    }
  }
  return new Promise((accept) => {
    const socket = createConnection({ host, port, timeout: timeoutMs })
    const done = (open) => {
      socket.destroy()
      accept(open)
    }
    socket.on('connect', () => done(true))
    socket.on('timeout', () => done(false))
    socket.on('error', () => done(false))
  })
}

async function probeHttpJson({ url, timeoutMs, fetchJson }) {
  if (fetchJson) return fetchJson(url, timeoutMs)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) return null
    return await response.json().catch(() => null)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function parsePortHost(url) {
  const parsed = new URL(url)
  return { host: parsed.hostname, port: Number(parsed.port) }
}

export async function preflight(needs, { root = scriptRoot(), env = process.env, probes = {} } = {}) {
  const tracker = createProbeTracker(probes)
  const results = []
  const apiRoot = resolve(root, 'apps/api')
  const webRoot = resolve(root, 'apps/web')
  let apiPorts = null
  let e2eConfiguration = null

  const coreCheck = async (need) => {
    if (need === 'api') {
      const apiModules = resolve(apiRoot, 'node_modules')
      if (!existsSync(apiModules)) {
        results.push(fail('api', 'dependencies', 'pnpm install'))
        return
      }
      let apiConfiguration
      try {
        apiConfiguration = readEnvFile(resolve(apiRoot, '.env'), 'apps/api/.env')
      } catch (error) {
        results.push(fail('api', 'api configuration', 'pnpm setup:local'))
        results.push(fail('api', 'api configuration detail', redactSecrets(error.message)))
        return
      }
      for (const name of ['API_PORT', 'DATABASE_URL', 'BETTER_AUTH_URL', 'APP_ORIGIN']) {
        if (!apiConfiguration[name]?.trim()) {
          results.push(fail('api', 'required API values', 'edit apps/api/.env'))
          return
        }
      }
      let webConfiguration
      try {
        webConfiguration = readEnvFile(resolve(webRoot, '.env'), 'apps/web/.env')
        apiPorts = checkPortAndUrls(resolve(apiRoot, '.env'), apiConfiguration, resolve(webRoot, '.env'), webConfiguration)
      } catch (error) {
        results.push(fail('api', 'port and URL rules', redactSecrets(error.message)))
        return
      }
      results.push(pass('api', 'dependencies and configuration'))
      const { host, port } = parsePortHost(apiPorts.betterAuthUrl)
      const open = await probeTcp({
        host,
        port,
        timeoutMs: probes.timeoutMs ?? PROBE_TIMEOUT_MS,
        openSocket: probes.openSocket
          ? (target) => probes.openSocket({ ...target, tracker, kind: 'socket-api' })
          : undefined,
        onClose: async (socket) => {
          tracker.noteClosed('socket-api')
          try { socket?.destroy?.() } catch { /* probe socket already closed */ }
        },
      })
      if (!open) {
        results.push(fail('api', `api port ${port}`, `start the API with pnpm dev:api (port ${port} is closed)`))
        return
      }
      const health = await probeHttpJson({
        url: `${apiPorts.betterAuthUrl.replace(/\/$/, '')}/health`,
        timeoutMs: probes.timeoutMs ?? PROBE_TIMEOUT_MS,
        fetchJson: probes.fetchJson
          ? (url, timeoutMs) => probes.fetchJson(url, timeoutMs, { tracker, kind: 'http-api' })
          : undefined,
      }).finally(() => tracker.noteClosed('http-api'))
      if (health && typeof health === 'object' && 'ok' in health) {
        results.push(pass('api', `api /health on port ${port}`))
      } else {
        results.push(fail('api', `api /health on port ${port}`, `stop the process that owns port ${port}; it is not the API`))
      }
    }

    if (need === 'web') {
      let webConfiguration
      try {
        webConfiguration = readEnvFile(resolve(webRoot, '.env'), 'apps/web/.env')
      } catch (error) {
        results.push(fail('web', 'web configuration', 'pnpm setup:local'))
        results.push(fail('web', 'web configuration detail', redactSecrets(error.message)))
        return
      }
      let ports
      try {
        const apiConfiguration = readEnvFile(resolve(apiRoot, '.env'), 'apps/api/.env')
        ports = checkPortAndUrls(resolve(apiRoot, '.env'), apiConfiguration, resolve(webRoot, '.env'), webConfiguration)
        apiPorts ??= ports
      } catch (error) {
        results.push(fail('web', 'port and URL rules', redactSecrets(error.message)))
        return
      }
      results.push(pass('web', 'web configuration'))
      const { host, port } = parsePortHost(ports.appOrigin)
      const open = await probeTcp({
        host,
        port,
        timeoutMs: probes.timeoutMs ?? PROBE_TIMEOUT_MS,
        openSocket: probes.openSocket
          ? (target) => probes.openSocket({ ...target, tracker, kind: 'socket-web' })
          : undefined,
        onClose: async (socket) => {
          tracker.noteClosed('socket-web')
          try { socket?.destroy?.() } catch { /* probe socket already closed */ }
        },
      })
      if (!open) {
        results.push(fail('web', `web port ${port}`, `start the web app with pnpm dev:web (port ${port} is closed)`))
        return
      }
      const page = await probeHttpJson({
        url: ports.appOrigin,
        timeoutMs: probes.timeoutMs ?? PROBE_TIMEOUT_MS,
        fetchJson: probes.fetchJson
          ? (url, timeoutMs) => probes.fetchJson(url, timeoutMs, { tracker, kind: 'http-web' })
          : undefined,
      }).finally(() => tracker.noteClosed('http-web'))
      if (page !== null) {
        results.push(pass('web', `web server on port ${port}`))
      } else {
        results.push(fail('web', `web server on port ${port}`, `stop the process that owns port ${port}; it is not the web app`))
      }
    }

    if (need === 'test') {
      let checked
      try {
        checked = checkTestTarget({ apiRoot, env })
      } catch (error) {
        results.push(fail('test', 'test target', redactSecrets(error.message)))
        return
      }
      const { target, configuration } = checked
      results.push(pass('test', `test target ${identityLine(target)}`))
      let connected
      try {
        const query = probes.queryDatabase
          ? () => probes.queryDatabase({ connectionString: configuration.DATABASE_URL, ...target, tracker, kind: 'pg-test' })
          : () => realDatabaseName({ connectionString: configuration.DATABASE_URL, ...target }, { tracker })
        connected = await query()
      } catch (error) {
        results.push(fail('test', `test database ${identityLine(target)}`, `create the ${target.database} database; pnpm --filter @southneuhof/api db:migrate:test`))
        return
      } finally {
        tracker.noteClosed('pg-test')
      }
      if (connected === target.database) {
        results.push(pass('test', `connected database ${target.database}`))
      } else {
        results.push(fail('test', `connected database ${connected}`, `point apps/api/.env.test at ${target.database}`))
      }
    }

    if (need === 'browser') {
      let e2e
      try {
        e2e = checkE2eTarget({ apiRoot, env })
        e2eConfiguration = e2e
      } catch (error) {
        results.push(fail('browser', 'e2e target', redactSecrets(error.message)))
        return
      }
      results.push(pass('browser', `e2e target ${identityLine(e2e.target)}`))
      let executable
      try {
        executable = probes.chromiumExecutable
          ? await probes.chromiumExecutable({ tracker, kind: 'chromium' })
          : await resolveChromiumExecutable({ tracker })
      } catch (error) {
        results.push(fail('browser', 'chromium executable', 'pnpm exec playwright install chromium'))
        return
      } finally {
        tracker.noteClosed('chromium')
      }
      if (!executable || !existsSync(executable)) {
        results.push(fail('browser', 'chromium executable', 'pnpm exec playwright install chromium'))
        return
      }
      results.push(pass('browser', 'chromium executable present'))
      let connected
      try {
        const query = probes.queryE2eDatabase
          ? () => probes.queryE2eDatabase({ connectionString: e2e.configuration.DATABASE_URL, ...e2e.target, tracker, kind: 'pg-e2e' })
          : () => realDatabaseName({ connectionString: e2e.configuration.DATABASE_URL, ...e2e.target }, { tracker })
        connected = await query()
      } catch (error) {
        results.push(fail('browser', `e2e database ${identityLine(e2e.target)}`, `create the ${e2e.target.database} database; pnpm --filter @southneuhof/api e2e:migrate`))
        return
      } finally {
        tracker.noteClosed('pg-e2e')
      }
      if (connected === e2e.target.database) {
        results.push(pass('browser', `connected e2e database ${e2e.target.database}`))
      } else {
        results.push(fail('browser', `connected e2e database ${connected}`, `point apps/api/.env.e2e at ${e2e.target.database}`))
      }
    }

    if (need === 'storage') {
      const e2e = e2eConfiguration ?? (() => { try { return checkE2eTarget({ apiRoot, env }) } catch { return null } })()
      if (!e2e) {
        results.push(fail('storage', 'e2e storage target', 'declare S3_BUCKET in apps/api/.env.e2e'))
        return
      }
      e2eConfiguration ??= e2e
      const configuration = e2e.configuration
      for (const name of ['S3_ENDPOINT', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']) {
        if (!configuration[name]?.trim()) {
          results.push(fail('storage', 'e2e storage variables', 'configure S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY in apps/api/.env'))
          return
        }
      }
      let endpoint
      try {
        endpoint = new URL(configuration.S3_ENDPOINT)
        if (!['http:', 'https:'].includes(endpoint.protocol)) throw new Error('protocol')
      } catch {
        results.push(fail('storage', 'e2e storage endpoint', 'set S3_ENDPOINT to an http(s) URL in apps/api/.env'))
        return
      }
      results.push(pass('storage', `e2e storage target ${e2e.bucket}`))
      try {
        const head = probes.headBucket
          ? () => probes.headBucket({ bucket: e2e.bucket, endpoint: configuration.S3_ENDPOINT, tracker, kind: 's3' })
          : () => realBucketHead({ bucket: e2e.bucket, configuration, tracker })
        await head()
        results.push(pass('storage', `e2e bucket ${e2e.bucket}`))
      } catch (error) {
        results.push(fail('storage', `e2e bucket ${e2e.bucket}`, `create the ${e2e.bucket} bucket in the S3 service`))
      } finally {
        tracker.noteClosed('s3')
      }
    }
  }

  for (const need of needs) {
    await coreCheck(need)
  }
  return { needs, results, opened: tracker.opened, closed: tracker.closed }
}

async function realDatabaseName(target, { tracker } = {}) {
  const { connectionString } = target
  let Pool = null
  try {
    ;({ Pool } = await import('pg'))
  } catch {
    try {
      const require = createRequire(resolve(scriptRoot(), 'apps/api/package.json'))
      ;({ Pool } = require('pg'))
    } catch {
      Pool = null
    }
  }
  if (!Pool) throw new Error('The pg dependency is missing. Run pnpm install.')
  const pool = new Pool({ connectionString, connectionTimeoutMillis: PROBE_TIMEOUT_MS })
  tracker?.track?.('pg', pool)
  try {
    const client = await pool.connect()
    try {
      const result = await client.query('select current_database()')
      return result.rows[0]?.current_database
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

async function resolveChromiumExecutable({ tracker } = {}) {
  const candidates = []
  for (const specifier of ['@playwright/test', 'playwright-core']) {
    try {
      const module = await import(specifier)
      if (module?.chromium?.executablePath) {
        candidates.push(module.chromium.executablePath())
      }
    } catch { /* try the next installed specifier */ }
  }
  for (const anchor of [resolve(scriptRoot(), 'apps/web/package.json'), resolve(scriptRoot(), 'package.json')]) {
    try {
      const require = createRequire(anchor)
      for (const specifier of ['@playwright/test', 'playwright-core']) {
        try {
          const { chromium } = require(specifier)
          if (chromium?.executablePath) candidates.push(chromium.executablePath())
        } catch { /* try the next installed specifier */ }
      }
    } catch { /* try the next anchor */ }
  }
  if (!candidates.length) throw new Error('Playwright is not installed.')
  const executable = candidates[0]
  tracker?.track?.('chromium', executable)
  statSync(executable)
  return executable
}

async function realBucketHead({ bucket, configuration, tracker }) {
  let S3Client = null
  let HeadBucketCommand = null
  try {
    ;({ S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3'))
  } catch {
    try {
      const require = createRequire(resolve(scriptRoot(), 'apps/api/package.json'))
      ;({ S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3'))
    } catch {
      S3Client = null
    }
  }
  if (!S3Client || !HeadBucketCommand) throw new Error('The S3 client is missing. Run pnpm install.')
  const client = new S3Client({
    endpoint: configuration.S3_ENDPOINT,
    forcePathStyle: true,
    region: 'us-east-1',
    credentials: {
      accessKeyId: configuration.S3_ACCESS_KEY,
      secretAccessKey: configuration.S3_SECRET_KEY,
    },
  })
  tracker?.track?.('s3', client)
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
  } finally {
    client.destroy()
  }
}

export function formatResults({ needs, results }) {
  const lines = [`SCOPE ${needs.join(',')}`]
  for (const result of results) {
    lines.push(`${result.status} ${result.purpose} ${result.check} :: ${result.correction}`)
  }
  const failed = results.filter((result) => result.status === 'FAIL')
  return { text: redactSecrets(lines.join('\n')), failed: failed.length }
}

export function setupLocal({ root = scriptRoot(), createSecret = () => randomBytes(32).toString('hex') } = {}) {
  if (!existsSync(resolve(root, 'package.json')) || !existsSync(resolve(root, 'apps/api')) || !existsSync(resolve(root, 'apps/web'))) {
    throw new Error('Run pnpm setup:local from the repository root.')
  }
  const created = []
  const kept = []
  for (const [template, destination] of setupPairs()) {
    const templatePath = resolve(root, template)
    const destinationPath = resolve(root, destination)
    if (!existsSync(templatePath)) throw new Error(`Template is missing: ${template}.`)
    let templateText
    try {
      templateText = readFileSync(templatePath, 'utf8')
      parseEnv(templateText)
    } catch {
      throw new Error(`Template is unsafe: ${template}.`)
    }
    if (existsSync(destinationPath)) {
      readEnvFile(destinationPath, destination)
      kept.push(destination)
      continue
    }
    mkdirSync(dirname(destinationPath), { recursive: true })
    let text = templateText
    if (destination === 'apps/api/.env' && text.includes(API_SECRET_PLACEHOLDER)) {
      text = text.replaceAll(API_SECRET_PLACEHOLDER, createSecret())
    }
    writeFileSync(destinationPath, text, { flag: 'wx' })
    created.push(destination)
  }
  return { created, kept }
}

export function helpText() {
  return [
    'Usage: node scripts/local-environment.mjs <setup|preflight> [--needs api,web,test,browser,storage]',
    '',
    'setup creates the four missing local files (apps/api/.env, apps/web/.env,',
    'apps/api/.env.test, apps/api/.env.e2e) from tracked templates without',
    'overwriting an existing file. It replaces the API secret placeholder only in',
    'a newly created apps/api/.env. It does not claim PostgreSQL, Chromium, or S3',
    'are ready; run preflight to check them.',
    '',
    'preflight is read-only. Default scope is api,web. Each line has the form',
    'STATUS PURPOSE CHECK CORRECTION. Checks: api (deps, API env, plan-016 port',
    'and URL rules, API /health); web (web env, plan-016 rules, web response);',
    'test (guarded .env.test target plus select current_database()); browser (E2E',
    'guard, Chromium executable exists, E2E select current_database()); storage',
    '(E2E bucket guard plus one read-only bucket head). Database results print',
    'host, port and database name only, never credentials.',
    '',
    `Valid needs: ${VALID_NEEDS.join(',')}.`,
  ].join('\n')
}

async function main(argv) {
  const [operation, ...rest] = argv
  if (!operation || operation === '--help' || operation === '-h') {
    console.log(helpText())
    return
  }
  const options = rest.filter((argument) => argument !== '--')
  if (operation === 'setup') {
    if (options.length) throw new Error('setup takes no options. Use preflight --needs ... for checks.')
    let outcome
    try {
      outcome = setupLocal()
    } catch (error) {
      console.error(`FAIL setup ${redactSecrets(error.message)} :: fix the template or existing file, then rerun pnpm setup:local`)
      process.exitCode = 1
      return
    }
    for (const file of outcome.created) console.log(`CREATED setup ${file}`)
    for (const file of outcome.kept) console.log(`KEPT setup ${file} :: edit it directly, setup never overwrites`)
    console.log('setup does NOT claim PostgreSQL, Chromium, or S3 are ready. Run pnpm module:preflight -- --needs api,web,test,browser,storage.')
    const { needs } = parseNeeds([])
    const { results } = await preflight(needs, {})
    const { text, failed } = formatResults({ needs, results })
    console.log(text)
    if (failed) {
      console.log('Next: fix each FAIL correction above, then rerun pnpm setup:local.')
      process.exitCode = 1
      return
    }
    return
  }
  if (operation === 'preflight') {
    const { needs, help } = parseNeeds(options)
    if (help) {
      console.log(helpText())
      return
    }
    const { results } = await preflight(needs, {})
    const { text, failed } = formatResults({ needs, results })
    console.log(text)
    if (failed) process.exitCode = 1
    return
  }
  throw new Error(`Unknown operation: ${operation}. Use setup, preflight, or --help.`)
}

const invoked = process.argv[1] && isAbsolute(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invoked) {
  main(process.argv.slice(2).filter((argument) => argument !== '--')).catch((error) => {
    console.error(`FAIL local-environment ${redactSecrets(error.message)} :: rerun with --help`)
    process.exitCode = 1
  })
}
