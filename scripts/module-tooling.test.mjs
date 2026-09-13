import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test, afterEach } from 'node:test'
import { execute as scaffoldExecute, scaffold, validateConfig } from './scaffold-bounded-module.mjs'
import { integrate } from './integrate-bounded-module.mjs'
import { verify, execute, runCommand } from './verify-module.mjs'
import { boundedConfig, copyCurrentOwners, sourceRoot, ownerPaths } from './test-support/bounded-fixture.mjs'

const directories = []
function workspace() { const root = mkdtempSync(join(tmpdir(), 'carta-current-')); directories.push(root); return root }
afterEach(() => { for (const root of directories.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('generated resource and route use the current package, guard and detail permission', () => {
  const root = workspace()
  const result = scaffold(boundedConfig(), { root })
  const resource = readFileSync(result.generated.find(path => path.endsWith('.resource.ts')), 'utf8')
  const route = readFileSync(join(root, 'apps/api/src/routes/(authenticated)/test-catalog/detail/[id]/+server.ts'), 'utf8')
  assert.ok(resource.includes("from '@southneuhof/loom'"))
  assert.ok(resource.includes("permission: 'detail-test-catalog'"))
  assert.ok(route.includes("from '../../../../../identity'"))
  assert.ok(route.includes("detail({ authorize: requirePermission('detail-test-catalog') })"))
  for (const path of result.generated) assert.ok(!readFileSync(path, 'utf8').includes('@southneuhof/is-vue-framework'), path)
})

test('current checkout owners integrate with typed permission definitions and seedDatabase', () => {
  const root = workspace(), value = boundedConfig()
  copyCurrentOwners(root)
  scaffold(value, { root })
  const before = ownerPaths.map(path => readFileSync(join(root, path), 'utf8'))
  const pending = integrate(value, { root })
  assert.equal(pending.status, 'PENDING')
  assert.deepEqual(ownerPaths.map(path => readFileSync(join(root, path), 'utf8')), before)
  assert.equal(integrate(value, { root, apply: true }).status, 'APPLIED')
  assert.equal(integrate(value, { root, apply: true }).status, 'UP_TO_DATE')
  const catalog = readFileSync(join(root, ownerPaths[1]), 'utf8')
  for (const action of ['list', 'detail', 'create', 'update', 'delete']) {
    const code = `${action}-test-catalog`
    assert.match(catalog, new RegExp(`code: ["']${code}["']`))
  }
  assert.match(readFileSync(join(root, ownerPaths[2]), 'utf8'), /await seedTestCatalog\(\)/)
  assert.equal(verify(value, { root }).status, 'PASS')
})

test('generator supports action subsets but refuses unknown actions and unused permissions', () => {
  const value = boundedConfig()
  const used = new Set([value.actions.list.permission])
  const subset = {
    ...value,
    actions: { list: value.actions.list },
    permissions: Object.fromEntries(Object.entries(value.permissions).filter(([code]) => used.has(code))),
    navigation: value.navigation,
    seed: value.seed,
  }
  delete subset.test
  assert.doesNotThrow(() => validateConfig(subset))
  assert.throws(() => validateConfig({ ...value, actions: { ...value.actions, archive: { permission: 'archive-test-catalog' } } }), /unsupported/)
  assert.throws(() => validateConfig({ ...value, permissions: { ...value.permissions, 'extra-test-catalog': { name: 'Extra', description: 'Extra.' } } }), /unused/)
})

test('static verification explicitly distinguishes unrun runtime and unreviewed acceptance', () => {
  const root = workspace(), value = boundedConfig()
  copyCurrentOwners(root); scaffold(value, { root }); integrate(value, { root, apply: true })
  const result = verify(value, { root })
  assert.equal(result.scope, 'static')
  assert.equal(result.runtime.status, 'NOT_RUN')
  assert.equal(result.acceptance, 'NOT_REVIEWED')
})

test('mutually exclusive verification flags are rejected in both orders before any run', () => {
  const root = workspace()
  writeFileSync(join(root, 'manifest.json'), JSON.stringify(boundedConfig()))
  for (const modes of [['--run', '--check-only'], ['--check-only', '--run']]) {
    assert.throws(() => execute(['--manifest', 'manifest.json', ...modes], { cwd: root, root }), /only one|exclusive/)
  }
})

test('command evidence retains full output and its working directory', () => {
  const root = workspace()
  const result = runCommand(process.execPath, ['-e', 'process.stdout.write("x".repeat(5000))'], { cwd: root })
  assert.equal(result.output.length, 5000)
  assert.equal(result.cwd, root)
})

test('node CLI --manifest --check writes nothing and rejects invalid manifests without writes', () => {
  const root = workspace(), manifest = join(root, 'module.json')
  writeFileSync(manifest, JSON.stringify(boundedConfig()))
  const before = readdirSync(root)
  const preview = JSON.parse(scaffoldExecute(['--manifest', manifest, '--root', root, '--check', '--json'], { cwd: root, root }))
  assert.equal(preview.status, 'VALID')
  assert.deepEqual(preview.writes, [])
  assert.deepEqual(readdirSync(root), before)
  writeFileSync(manifest, '{')
  assert.throws(() => scaffoldExecute(['--manifest', manifest, '--root', root, '--check', '--json'], { cwd: root, root }))
  assert.equal(existsSync(join(root, 'apps')), false)
})

test('helper command help is read-only and succeeds without a manifest', () => {
  const root = workspace()
  for (const name of ['scaffold-bounded-module', 'integrate-bounded-module', 'verify-module']) {
    const result = spawnSync(process.execPath, [join(sourceRoot, `scripts/${name}.mjs`), '--help'], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /Usage:/)
  }
  assert.deepEqual(readdirSync(root), [])
})

test('integration rejects mutually exclusive check/apply flags without touching owners', () => {
  const root = workspace(); copyCurrentOwners(root)
  const manifest = join(root, 'manifest.json'); writeFileSync(manifest, JSON.stringify(boundedConfig()))
  const before = ownerPaths.map(path => readFileSync(join(root, path), 'utf8'))
  for (const modes of [['--check', '--apply'], ['--apply', '--check']]) {
    const result = spawnSync(process.execPath, [join(sourceRoot, 'scripts/integrate-bounded-module.mjs'), '--manifest', manifest, '--root', root, ...modes], { encoding: 'utf8' })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /exclusive/)
    assert.deepEqual(ownerPaths.map(path => readFileSync(join(root, path), 'utf8')), before)
  }
})

test('unknown manifest keys are rejected rather than silently ignored', () => {
  const value = boundedConfig()
  for (const candidate of [
    { ...value, fields: [{ ...value.fields[0], relation: 'customers' }] },
    { ...value, permissions: { ...value.permissions, 'extra-test-catalog': { name: 'Extra', description: 'Extra.' } } },
    { ...value, identity: { key: 'id', type: 'text', primary: true, generated: 'uuid' } },
    { ...value, labels: { listTitle: 'Test Catalog' } },
  ]) assert.throws(() => validateConfig(candidate), /unsupported|unused|normal module plan/)
})

test('durable static reports are scoped, fresh, non-overwriting and detect same-file edits', async () => {
  const { checkFreshness } = await import('./module-evidence.mjs')
  const root = workspace(), value = boundedConfig(); copyCurrentOwners(root)
  scaffold(value, { root }); integrate(value, { root, apply: true })
  const reports = join(root, 'reports/static')
  const result = verify(value, { root, reports })
  const saved = JSON.parse(readFileSync(join(reports, 'summary.json'), 'utf8'))
  assert.equal(saved.status, result.status); assert.equal(saved.scope, 'static')
  assert.equal(saved.acceptance, 'NOT_REVIEWED'); assert.equal(saved.runtime.status, 'NOT_RUN')
  assert.equal(checkFreshness(saved).fresh, true)
  assert.throws(() => verify(value, { root, reports }), /exist|overwrite/i)
  const owner = join(root, ownerPaths[1])
  writeFileSync(owner, `${readFileSync(owner, 'utf8')}\n// changed after verification\n`)
  assert.equal(checkFreshness(saved).fresh, false)
})

test('node CLI --manifest/--config mismatch throws without writes', () => {
  const root = workspace()
  const first = join(root, 'first.json'), second = join(root, 'second.json')
  writeFileSync(first, JSON.stringify(boundedConfig()))
  writeFileSync(second, JSON.stringify(boundedConfig()))
  assert.throws(() => scaffoldExecute(['--manifest', first, '--config', second, '--root', root, '--check'], { cwd: root, root }), /must match/)
  assert.equal(existsSync(join(root, 'apps')), false)
})

test('node CLI rejects --check with --apply together without writes', () => {
  const root = workspace(), manifest = join(root, 'module.json')
  writeFileSync(manifest, JSON.stringify(boundedConfig()))
  for (const modes of [['--check', '--apply'], ['--apply', '--check']]) {
    assert.throws(() => scaffoldExecute(['--manifest', manifest, '--root', root, ...modes], { cwd: root, root }), /mutually exclusive/)
  }
  assert.equal(existsSync(join(root, 'apps')), false)
})

test('worksheet initialization uses the canonical asset, preserves existing work and rejects traversal', () => {
  const root = workspace(), tool = join(sourceRoot, '.agents/skills/carta-module-development/scripts/init_worksheet.py')
  const target = join(root, 'worksheet.md')
  const first = spawnSync('python3', [tool, 'inventory', '--path', target], { cwd: root, encoding: 'utf8' })
  assert.equal(first.status, 0, first.stderr)
  assert.match(readFileSync(target, 'utf8'), /# inventory worksheet/)
  writeFileSync(target, 'ongoing work')
  const second = spawnSync('python3', [tool, 'inventory', '--path', target], { encoding: 'utf8' })
  assert.equal(second.status, 0); assert.equal(readFileSync(target, 'utf8'), 'ongoing work')
  const unsafe = spawnSync('python3', [tool, '../outside'], { cwd: root, encoding: 'utf8' })
  assert.notEqual(unsafe.status, 0)
})

test('runtime report stops at the first failing command and preserves the exact failure', () => {
  const root = workspace(), value = boundedConfig(); copyCurrentOwners(root)
  scaffold(value, { root }); integrate(value, { root, apply: true })
  const manifest = join(root, 'manifest.json'); writeFileSync(manifest, JSON.stringify(value))
  const bin = workspace(), fake = join(bin, 'pnpm')
  writeFileSync(fake, '#!/bin/sh\nprintf "controlled command failure\\n" >&2\nexit 7\n', { mode: 0o755 })
  const result = spawnSync(process.execPath, [join(sourceRoot, 'scripts/verify-module.mjs'), '--manifest', manifest, '--root', root, '--run', '--reports', join(root, 'reports/failure'), '--json'], {
    encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  })
  assert.equal(result.status, 1, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.runtime.status, 'FAIL'); assert.equal(report.commands.length, 1)
  assert.equal(report.commands[0].exitCode, 7); assert.equal(report.acceptance, 'NOT_REVIEWED')
  assert.match(readFileSync(`${report.commands[0].evidence}.stderr.log`, 'utf8'), /controlled command failure/)
  assert.equal(JSON.parse(readFileSync(report.summary, 'utf8')).status, 'FAIL')
})
