#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { captureInputs, recordCommand, runCommand } from './module-evidence.mjs'
import { integrate } from './integrate-bounded-module.mjs'
export { runCommand } from './module-evidence.mjs'
import { fileURLToPath } from 'node:url'
import { expectedGeneratedPaths, moduleMetadata, validateConfig } from './scaffold-bounded-module.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultCommandTimeoutMs = 180_000

function quoted(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n').replaceAll('\r', '\\r')}'`
}

function html(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function read(path, checks, name) {
  if (!existsSync(path)) {
    checks.push({ name, status: 'FAIL', detail: `Missing file: ${path}` })
    return null
  }
  const contents = readFileSync(path, 'utf8')
  checks.push({ name, status: 'PASS', detail: path })
  return contents
}

function requireText(contents, text, checks, name) {
  if (contents === null) return
  checks.push({ name, status: contents.includes(text) ? 'PASS' : 'FAIL', detail: text })
}

function requireUniqueText(contents, text, checks, name) {
  if (contents === null) return
  const occurrences = contents.split(text).length - 1
  checks.push({ name, status: occurrences === 1 ? 'PASS' : 'FAIL', detail: `${text} (${occurrences} occurrences)` })
}

function requireUniquePattern(contents, pattern, checks, name, detail) {
  if (contents === null) return
  const occurrences = [...contents.matchAll(pattern)].length
  checks.push({ name, status: occurrences === 1 ? 'PASS' : 'FAIL', detail: `${detail} (${occurrences} occurrences)` })
}

function staticVerify(config, { root = repoRoot, manifest = config } = {}) {
  const outputRoot = resolve(root)
  const metadata = moduleMetadata(config)
  const selected = new Set(config.selectedActions)
  const checks = []
  const generated = expectedGeneratedPaths(config, { root: outputRoot })
  const missingGenerated = generated.filter((path) => !existsSync(path))
  checks.push({
    name: 'generated files',
    status: missingGenerated.length ? 'FAIL' : 'PASS',
    detail: missingGenerated.length ? `Missing: ${missingGenerated.join(', ')}` : `${generated.length} files present`,
  })

  const domains = read(resolve(outputRoot, 'apps/api/src/domains.ts'), checks, 'API domains')
  requireUniqueText(domains, `import { domain as ${metadata.plural} } from './routes/(authenticated)/${config.slug}/${config.slug}'`, checks, 'API domain import')
  requireUniqueText(domains, `  ${metadata.plural},`, checks, 'API domain registration')

  const catalog = read(resolve(outputRoot, 'apps/api/src/authorization/catalog.ts'), checks, 'authorization catalog')
  if (catalog !== null) {
    for (const action of config.selectedActions) {
      const code = config.actions[action].permission
      requireUniquePattern(catalog, new RegExp(`\\{\\s*code:\\s*['"]${code}['"],`, 'g'), checks, `permission definition ${code}`, code)
    }
  }
  try {
    const registration = integrate(manifest, { root: outputRoot })
    checks.push({ name: 'current owner integration', status: registration.status === 'READY' ? 'PASS' : 'FAIL', detail: registration.pending.join(', ') || 'All owner registrations are current.' })
  } catch (error) {
    checks.push({ name: 'current owner integration', status: 'FAIL', detail: error.message })
  }

  const group = config.navigation?.group ?? null
  if (config.navigation && metadata.routes.list) {
    const navigation = read(resolve(outputRoot, 'apps/web/src/manifest/navigation.ts'), checks, 'web navigation')
    requireUniqueText(navigation, `to: { name: '${metadata.routes.list}' }`, checks, 'navigation route')
    requireText(navigation, `permission: '${config.actions.list.permission}'`, checks, 'navigation permission')
    requireText(navigation, `title: ${quoted(config.navigation.title)}`, checks, 'navigation title')
  } else {
    checks.push({ name: 'web navigation', status: 'PASS', detail: 'navigation absent' })
  }

  const routeFiles = []
  if (group) {
    if (selected.has('list')) routeFiles.push(
      [`apps/web/src/routes/(authenticated)/${group}/${config.slug}/index.route.vue`, `title="${html(config.labels.listTitle)}"`, 'list title'],
    )
    if (selected.has('create')) routeFiles.push(
      [`apps/web/src/routes/(authenticated)/${group}/${config.slug}/create.route.vue`, `title="${html(config.labels.createTitle)}"`, 'create title'],
    )
    if (selected.has('detail')) routeFiles.push(
      [`apps/web/src/routes/(authenticated)/${group}/${config.slug}/${config.slug}.resource.ts`, `title: ${quoted(config.labels.detailTitle)}`, 'detail title'],
    )
    if (selected.has('update')) routeFiles.push(
      [`apps/web/src/routes/(authenticated)/${group}/${config.slug}/[${metadata.routeParam}]/edit.route.vue`, `title="${html(config.labels.editTitle)}"`, 'edit title'],
    )
  }
  for (const [relativePath, text, name] of routeFiles) {
    const contents = read(resolve(outputRoot, relativePath), checks, name)
    requireText(contents, text, checks, `${name} content`)
  }

  if (config.seed) {
    const seedPath = resolve(outputRoot, `apps/api/src/routes/(authenticated)/${config.slug}/${config.slug}.seed.ts`)
    const seed = read(seedPath, checks, 'module seed')
    requireText(seed, `export async function seed${config.symbol}()`, checks, 'module seed function')
    const seedOwner = read(resolve(outputRoot, 'apps/api/scripts/seed.ts'), checks, 'seed owner')
    requireUniqueText(seedOwner, `import { seed${config.symbol} } from '../src/routes/(authenticated)/${config.slug}/${config.slug}.seed'`, checks, 'seed owner import')
    requireUniqueText(seedOwner, `  await seed${config.symbol}()`, checks, 'seed owner call')
  }

  const failed = checks.filter((check) => check.status === 'FAIL')
  return { status: failed.length ? 'FAIL' : 'PASS', checks, failed }
}

export function verificationCommands(config, { withSeed = false } = {}) {
  const normalized = Object.hasOwn(config ?? {}, 'selectedActions') ? config : validateConfig(config)
  const metadata = moduleMetadata(normalized)
  const slug = normalized.slug
  const group = normalized.navigation?.group ?? null
  const selected = new Set(normalized.selectedActions)
  const hasApiAction = ['list', 'detail', 'create', 'update', 'delete'].some((action) => selected.has(action)) || normalized.needsTechnicalDetailRead
  const hasApiSpec = ['list', 'detail', 'create', 'update', 'delete'].some((action) => selected.has(action))
  const hasWebAction = ['list', 'detail', 'create', 'update'].some((action) => selected.has(action))
  const apiRouteFiles = ['src/domains.ts', 'src/authorization/catalog.ts']
  if (hasApiAction) {
    apiRouteFiles.unshift(
      `src/routes/(authenticated)/${slug}/${slug}.entity.ts`,
      `src/routes/(authenticated)/${slug}/${slug}.ts`,
      `src/routes/(authenticated)/${slug}/+scope.ts`,
    )
    if (selected.has('list')) apiRouteFiles.push(`src/routes/(authenticated)/${slug}/list/+server.ts`)
    if (selected.has('detail') || normalized.needsTechnicalDetailRead) apiRouteFiles.push(`src/routes/(authenticated)/${slug}/detail/[id]/+server.ts`)
    if (selected.has('create')) apiRouteFiles.push(`src/routes/(authenticated)/${slug}/create/+server.ts`)
    if (selected.has('update')) apiRouteFiles.push(`src/routes/(authenticated)/${slug}/update/[id]/+server.ts`)
    if (selected.has('delete')) apiRouteFiles.push(`src/routes/(authenticated)/${slug}/delete/[id]/+server.ts`)
  }
  if (hasApiSpec) apiRouteFiles.push(`src/routes/(authenticated)/${slug}/${slug}.routes.spec.ts`)
  if (normalized.seed) apiRouteFiles.push(`src/routes/(authenticated)/${slug}/${slug}.seed.ts`, 'scripts/seed.ts')
  const webFiles = [...(normalized.navigation ? ['src/manifest/navigation.ts'] : [])]
  if (hasWebAction && group) {
    webFiles.push(
      `src/routes/(authenticated)/${group}/${slug}/${slug}.schema.ts`,
      `src/routes/(authenticated)/${group}/${slug}/${slug}.resource.ts`,
    )
    if (selected.has('list')) webFiles.push(`src/routes/(authenticated)/${group}/${slug}/index.route.vue`)
    if (selected.has('create')) webFiles.push(`src/routes/(authenticated)/${group}/${slug}/create.route.vue`)
    if (selected.has('detail')) webFiles.push(`src/routes/(authenticated)/${group}/${slug}/[${metadata.routeParam}]/detail.route.vue`)
    if (selected.has('update')) webFiles.push(`src/routes/(authenticated)/${group}/${slug}/[${metadata.routeParam}]/edit.route.vue`)
  }
  const unsupportedRenderer = (normalized.fields ?? []).some((field) => field.rendererSupported === false)
  const hasBrowserFile = hasWebAction && normalized.navigation && !unsupportedRenderer && (selected.has('create') || normalized.seed)
  const e2eFiles = hasBrowserFile ? [`apps/web/e2e/${slug}.spec.ts`] : []
  const specs = []
  if (withSeed) specs.push(['pnpm', ['--filter', '@southneuhof/api', 'db:seed:test']])
  if (hasApiSpec) specs.push(['pnpm', ['--filter', '@southneuhof/api', 'test:focused', '--', `src/routes/(authenticated)/${slug}/${slug}.routes.spec.ts`]])
  if (e2eFiles.length) specs.push(['pnpm', ['--filter', '@southneuhof/framework-web', 'test:e2e', '--', `${slug}.spec.ts`]])
  specs.push(
    ['pnpm', ['--filter', '@southneuhof/api', 'lint:focused', '--', ...apiRouteFiles]],
    ['pnpm', ['--filter', '@southneuhof/framework-web', 'lint:focused', '--', ...webFiles]],
    ['pnpm', ['--filter', '@southneuhof/api', 'type-check']],
    ['pnpm', ['--filter', '@southneuhof/framework-web', 'type-check']],
    ['git', ['diff', '--check']],
  )
  return specs
}

function verificationInputs() {
  return [
    'scripts', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json',
    'apps/api/src', 'apps/api/drizzle', 'apps/api/scripts', 'apps/api/package.json',
    'apps/api/vitest.config.ts', 'apps/api/tsconfig.json', 'apps/api/drizzle.config.ts',
    'apps/api/.env', 'apps/api/.env.test', 'apps/web/src', 'apps/web/package.json',
    'apps/web/tsconfig.json', 'apps/web/tsconfig.app.json', 'apps/web/tsconfig.vitest.json',
    'apps/web/vite.config.ts', 'packages/loom', 'packages/sprindle', 'packages/sdk', 'packages/utilities',
  ]
}

function runChecks(config, { root, withSeed, timeoutMs, reports, inputs }) {
  const commands = []
  for (const [command, args] of verificationCommands(config, { withSeed })) {
    let result
    if (reports) {
      const evidence = resolve(reports, `${String(commands.length + 1).padStart(3, '0')}-command.json`)
      const report = recordCommand(command, args, { root, inputs, output: evidence, environment: 'Local checkout; API commands require the guarded .env.test target', timeoutMs })
      result = { ...report.result, status: report.status === 'PASS' ? 'PASS' : 'FAIL', evidence, evidenceStatus: report.status }
    } else result = runCommand(command, args, { cwd: root, timeoutMs })
    commands.push(result)
    if (result.status !== 'PASS') break
  }
  return commands
}

export function verify(value, { root = repoRoot, run = false, withSeed = false, timeoutMs = defaultCommandTimeoutMs, reports, extraInputs = [] } = {}) {
  const config = validateConfig(value)
  if (withSeed && !config.seed) throw new Error('--with-seed requires a manifest seed block.')
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs must be a positive integer.')
  const outputRoot = resolve(root)
  const inputs = [...verificationInputs(), ...extraInputs]
  if (reports) {
    reports = resolve(reports)
    for (const input of inputs) {
      const owner = resolve(outputRoot, input)
      if (reports === owner || reports.startsWith(`${owner}/`)) throw new Error('Reports directory must be outside verification inputs.')
    }
    if (existsSync(reports)) throw new Error('Reports directory already exists; choose a unique run directory.')
    mkdirSync(reports, { recursive: true })
  }
  const before = reports ? captureInputs({ root: outputRoot, inputs }) : null
  const staticResult = staticVerify(config, { root: outputRoot, manifest: value })
  const commands = staticResult.status === 'PASS' && run ? runChecks(config, { root: outputRoot, withSeed, timeoutMs, reports, inputs }) : []
  const commandFailure = commands.find((command) => command.status !== 'PASS')
  const browserSelected = new Set(config.selectedActions)
  const browserGroup = config.navigation?.group ?? null
  const result = {
    schemaVersion: 1,
    scope: run ? 'static-and-runtime-checks' : 'static',
    status: staticResult.status === 'PASS' && !commandFailure ? 'PASS' : 'FAIL',
    acceptance: 'NOT_REVIEWED',
    static: staticResult,
    runtime: { status: !run ? 'NOT_RUN' : staticResult.status !== 'PASS' ? 'BLOCKED' : commandFailure ? 'FAIL' : 'PASS' },
    commands,
    browser: {
      required: true, status: 'NOT_RUN',
      paths: browserSelected.has('list') && browserGroup ? [
        ...(browserSelected.has('list') ? [`/${browserGroup}/${config.slug}`] : []),
        ...(browserSelected.has('create') ? [`/${browserGroup}/${config.slug}/create`] : []),
        ...(browserSelected.has('detail') ? [`/${browserGroup}/${config.slug}/${config.seed?.records[0]?.[config.identity.key] ?? 'record-1'}/detail`] : []),
        ...(browserSelected.has('update') ? [`/${browserGroup}/${config.slug}/${config.seed?.records[0]?.[config.identity.key] ?? 'record-1'}/edit`] : []),
      ] : [],
    },
  }
  if (reports) {
    result.before = before
    result.after = captureInputs({ root: outputRoot, inputs })
    if (result.before.fingerprint !== result.after.fingerprint) {
      result.status = 'FAIL'
      result.evidenceStatus = 'INVALIDATED'
    }
    result.summary = resolve(reports, 'summary.json')
    writeFileSync(result.summary, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
  }
  return result
}

function parseArgs(argv) {
  let manifest
  let root
  let run = false
  let checkOnly = false
  let reports
  let extraInputs = []
  let withSeed = false
  let json = false
  let timeoutMs = defaultCommandTimeoutMs
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--manifest') {
      manifest = argv[index + 1]
      index += 1
      if (!manifest || manifest.startsWith('--')) throw new Error('--manifest requires a JSON file path.')
    } else if (argument === '--root') {
      root = argv[index + 1]
      index += 1
      if (!root || root.startsWith('--')) throw new Error('--root requires a repository directory.')
    } else if (argument === '--run') {
      if (checkOnly) throw new Error('Choose only one of --check-only or --run.')
      run = true
    } else if (argument === '--check-only') {
      checkOnly = true
      if (run) throw new Error('Choose only one of --check-only or --run.')
    } else if (argument === '--reports' || argument === '--input') {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a path.`)
      if (argument === '--reports') reports = value
      else extraInputs.push(value)
    } else if (argument === '--with-seed') {
      withSeed = true
    } else if (argument === '--json') {
      json = true
    } else if (argument === '--timeout-ms') {
      timeoutMs = Number(argv[index + 1])
      index += 1
      if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('--timeout-ms must be a positive integer.')
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  if (!manifest) throw new Error('Usage: node scripts/verify-module.mjs --manifest <file.json> [--check-only|--run] [--with-seed] [--timeout-ms <milliseconds>] [--root <directory>] [--reports <unique-directory>] [--input <path>] [--json]')
  return { manifest, root, run, withSeed, json, timeoutMs, reports, extraInputs }
}

function output(result, json) {
  if (json) return JSON.stringify(result, null, 2)
  return [
    `CHECKS ${result.status} (${result.scope}; module acceptance NOT_REVIEWED)`,
    `Static checks: ${result.static.status}`,
    ...result.static.checks.map((check) => `- ${check.status}: ${check.name}`),
    ...(result.commands.length ? [
      'Commands:',
      ...result.commands.flatMap((command) => [
        `- ${command.status}: ${command.command} (${command.durationMs} ms${command.timedOut ? ', timed out' : ''})`,
        ...(command.status === 'FAIL' && command.output ? [`  ${command.output}`] : []),
      ]),
    ] : []),
    '',
    'Authenticated browser paths to verify:',
    ...result.browser.paths.map((path) => `- ${path}`),
    'Browser verification and $verify-carta-module PASS remain required.',
  ].join('\n')
}

export function execute(argv, { root = repoRoot, cwd = process.cwd() } = {}) {
  if (argv.includes('--help')) return 'Usage: node scripts/verify-module.mjs --manifest <file.json> [--check-only|--run] [--root <directory>] [--reports <new-directory>] [--input <path>] [--with-seed] [--timeout-ms <n>] [--json]\nDefault is static check only. Runtime uses declared commands; neither mode establishes browser or semantic acceptance.'
  const { manifest, root: outputRoot, run, withSeed, json, timeoutMs, reports, extraInputs } = parseArgs(argv)
  const manifestPath = resolve(cwd, manifest)
  let config
  try {
    const raw = readFileSync(manifestPath, 'utf8')
    config = JSON.parse(raw)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot read module manifest ${manifestPath}: ${message}`)
  }
  return output(verify(config, { root: outputRoot ? resolve(cwd, outputRoot) : root, run, withSeed, timeoutMs, reports: reports ? resolve(cwd, reports) : undefined, extraInputs: [manifestPath, ...extraInputs.map(path => resolve(cwd, path))] }), json)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = execute(process.argv.slice(2))
    console.log(result)
    if (result.startsWith('{') ? JSON.parse(result).status !== 'PASS' : result.startsWith('CHECKS FAIL')) process.exitCode = 1
  } catch (error) {
    console.error(`verify-module: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
