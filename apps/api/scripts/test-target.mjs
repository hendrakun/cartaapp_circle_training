#!/usr/bin/env node
// Configuration preflight only: this does not connect to or modify a database.
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

export function databaseIdentity(value) {
  let url
  try { url = new URL(value) } catch { throw new Error('DATABASE_URL must be a PostgreSQL URL.') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error('DATABASE_URL must be a PostgreSQL URL.')
  const targetOverrides = new Set(['host', 'hostaddr', 'port', 'database', 'dbname', 'service'])
  if ([...url.searchParams.keys()].some(key => targetOverrides.has(key.toLowerCase()))) throw new Error('DATABASE_URL query parameters cannot override the declared test target.')
  const database = decodeURIComponent(url.pathname.slice(1))
  if (!database || database.includes('/')) throw new Error('DATABASE_URL must name one database.')
  const hostname = url.hostname.toLowerCase()
  const comparisonHost = ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? 'loopback' : hostname
  return { hostname, port: url.port || '5432', database, key: `${comparisonHost}:${url.port || '5432'}/${database}` }
}

export function assertTestTarget({ cwd = process.cwd(), env = process.env } = {}) {
  const path = resolve(cwd, '.env.test')
  if (!existsSync(path)) throw new Error('API tests require .env.test; copy .env.test.example and configure an isolated test database.')
  const configuration = parseEnv(readFileSync(path, 'utf8'))
  for (const key of ['DATABASE_URL', 'CARTA_DATABASE_PURPOSE', 'CARTA_TEST_DATABASE_NAME']) {
    if (!configuration[key]?.trim()) throw new Error(`.env.test must explicitly declare ${key}.`)
    // Node gives inherited environment precedence over --env-file values.
    if (env[key] !== configuration[key]) throw new Error(`The effective ${key} differs from .env.test. Remove the inherited override or set it to the intended test value.`)
  }
  if (configuration.CARTA_DATABASE_PURPOSE !== 'test') throw new Error('CARTA_DATABASE_PURPOSE must be test.')
  const target = databaseIdentity(configuration.DATABASE_URL)
  if (target.database !== configuration.CARTA_TEST_DATABASE_NAME || ['postgres', 'template0', 'template1'].includes(target.database)) {
    throw new Error('The test database must match CARTA_TEST_DATABASE_NAME and must not be a PostgreSQL administrative database.')
  }
  const developmentPath = resolve(cwd, '.env')
  if (existsSync(developmentPath)) {
    const development = parseEnv(readFileSync(developmentPath, 'utf8')).DATABASE_URL
    if (development && databaseIdentity(development).key === target.key) throw new Error('The API test target must be distinct from the development database in .env.')
  }
  return { purpose: 'test', hostname: target.hostname, port: target.port, database: target.database }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    console.log('Usage: node --env-file-if-exists=.env --env-file=.env.test scripts/test-target.mjs\nChecks explicit test purpose/name, effective environment and separation from .env. Does not connect or write.')
  } else {
    try { console.log(JSON.stringify({ status: 'VALID', scope: 'test-configuration', ...assertTestTarget() })) }
    catch (error) { console.error(`test-target: ${error.message}`); process.exitCode = 1 }
  }
}
