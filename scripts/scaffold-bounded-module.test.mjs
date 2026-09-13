import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { test } from 'node:test'
import { applyBoundedModule, checkMigrationAttribution, checkMigrationSql, describeBoundedModule, execute, parseDrizzleExplain, rollbackInvocation, selectNewMigration, validateConfig } from './scaffold-bounded-module.mjs'
import { copyCurrentOwners } from './test-support/bounded-fixture.mjs'

const temporaryDirectories = []

function workspace(config) {
  const directory = mkdtempSync(join(tmpdir(), 'scaffold-bounded-module-'))
  temporaryDirectories.push(directory)
  const configPath = join(directory, 'config.json')
  const outputRoot = join(directory, 'repository')
  writeFileSync(configPath, JSON.stringify(config, null, 2))
  return { directory, configPath, outputRoot }
}

function config() {
  return {
    kind: 'bounded-module',
    slug: 'test-catalog',
    table: 'test_catalog',
    symbol: 'TestCatalog',
    title: 'Test Catalog',
    singular: 'Test Catalog',
    fields: [
      { key: 'label', type: 'text', label: 'Label', required: true },
      { key: 'enabled', type: 'boolean', label: 'Enabled', default: true },
    ],
    actions: {
      list: { fields: ['label', 'enabled'], permission: 'list-test-catalog' },
      detail: { fields: ['label', 'enabled'], permission: 'detail-test-catalog' },
      create: { fields: ['label', 'enabled'], permission: 'create-test-catalog' },
      update: { fields: ['label', 'enabled'], permission: 'update-test-catalog' },
      delete: { permission: 'delete-test-catalog' },
    },
    permissions: Object.fromEntries(['list', 'detail', 'create', 'update', 'delete'].map((action) => [`${action}-test-catalog`, {
      name: `${action} test catalog`,
      description: `${action} test catalog records.`,
    }])),
    navigation: {
      group: 'settings',
      after: 'settings-roles',
      title: 'Test Catalog',
      icon: 'folder',
    },
    seed: {
      records: [{ id: 'test-catalog-1', label: 'One', enabled: true }],
      updateFields: ['label', 'enabled'],
    },
    test: {
      record: { label: 'One', enabled: true },
      update: { label: 'Two' },
    },
  }
}

function withoutActions(value, keep) {
  const kept = Object.fromEntries(keep.map((action) => [action, value.actions[action]]))
  const used = new Set(Object.values(kept).map((entry) => entry.permission))
  return {
    ...value,
    actions: kept,
    permissions: Object.fromEntries(Object.entries(value.permissions).filter(([code]) => used.has(code))),
  }
}

test.afterEach(() => {
  while (temporaryDirectories.length) rmSync(temporaryDirectories.pop(), { recursive: true, force: true })
})

test('creates explicit source files and stable absolute output', () => {
  const setup = workspace(config())
  const result = JSON.parse(execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  const expectedRelative = [
    'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.entity.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.routes.spec.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.seed.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/+scope.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/list/+server.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/detail/[id]/+server.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/create/+server.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/update/[id]/+server.ts',
    'apps/api/src/routes/(authenticated)/test-catalog/delete/[id]/+server.ts',
    'apps/web/e2e/test-catalog.spec.ts',
    'apps/web/src/routes/(authenticated)/settings/test-catalog/[testCatalogId]/detail.route.vue',
    'apps/web/src/routes/(authenticated)/settings/test-catalog/[testCatalogId]/edit.route.vue',
    'apps/web/src/routes/(authenticated)/settings/test-catalog/create.route.vue',
    'apps/web/src/routes/(authenticated)/settings/test-catalog/index.route.vue',
    'apps/web/src/routes/(authenticated)/settings/test-catalog/test-catalog.integration.spec.ts',
    'apps/web/src/routes/(authenticated)/settings/test-catalog/test-catalog.resource.ts',
    'apps/web/src/routes/(authenticated)/settings/test-catalog/test-catalog.schema.ts',
  ].map((path) => resolve(setup.outputRoot, path)).sort()

  assert.deepEqual(result.generated, expectedRelative)
  assert.deepEqual(result.generated, [...result.generated].sort())
  assert.deepEqual(result.integration, [...result.integration].sort())
  assert.deepEqual(result.manual, [...result.manual].sort())
  assert.ok(result.generated.every((path) => isAbsolute(path) && readFileSync(path, 'utf8')))
  assert.ok(result.manual.every((path) => isAbsolute(path)))
  assert.ok(result.integration.some((path) => path.endsWith('/apps/api/src/domains.ts')))
  assert.ok(result.integration.some((path) => path.endsWith('/apps/api/src/authorization/catalog.ts')))
  assert.ok(result.integration.some((path) => path.endsWith('/apps/api/scripts/seed.ts')))
  assert.ok(result.integration.some((path) => path.endsWith('/apps/web/src/manifest/navigation.ts')))
  assert.equal(result.manual.length, 1)
  assert.ok(result.manual.some((path) => path.endsWith('/apps/web/src/route-map.d.ts')))
  assert.equal(result.routes.list, 'settings-test-catalog')
  assert.equal(result.permissions.list, 'list-test-catalog')

  const entity = readFileSync(result.generated.find((path) => path.endsWith('.entity.ts')), 'utf8')
  assert.match(entity, /label: text\('label'\)/)
  assert.match(entity, /enabled: boolean\('enabled'\)/)
  assert.doesNotMatch(entity, /\b(name|description|active)\s*:/)
  assert.doesNotMatch(entity, /serverFields|auditFields/)

  const createRoute = readFileSync(result.generated.find((path) => path.endsWith('/create.route.vue')), 'utf8')
  assert.match(createRoute, /title="Create Test Catalog"/)
  assert.match(createRoute, /submit-label="Save"/)
  assert.match(createRoute, /<template><FormView v-bind="testCatalogs\.create\(\)" title="Create Test Catalog" submit-label="Save" \/><\/template>/)

  const editRoute = readFileSync(result.generated.find((path) => path.endsWith('/edit.route.vue')), 'utf8')
  assert.match(editRoute, /title="Edit Test Catalog"/)
  assert.match(editRoute, /<template><FormView v-bind="testCatalogs\.update\(\{ id: String\(route\.params\.testCatalogId\) \}\)" title="Edit Test Catalog" submit-label="Save" \/><\/template>/)

  const resource = readFileSync(result.generated.find((path) => path.endsWith('.resource.ts')), 'utf8')
  assert.match(resource, /title: 'Test Catalog'/)

  const detailRoute = readFileSync(result.generated.find((path) => path.endsWith('/detail.route.vue')), 'utf8')
  assert.doesNotMatch(detailRoute, /title=|back-to=/)
  assert.match(detailRoute, /<template><DetailView v-bind="testCatalogs\.detail\(\{ id: String\(route\.params\.testCatalogId\) \}\)" \/><\/template>/)

  const seed = readFileSync(result.generated.find((path) => path.endsWith('.seed.ts')), 'utf8')
  assert.match(seed, /testCatalogs\.id/)
  assert.match(seed, /label: sql`excluded\.label`/)

  const schema = readFileSync(result.generated.find((path) => path.endsWith('.schema.ts')), 'utf8')
  assert.match(schema, /import \{ defineEntitySchema \} from '@\/framework\/hono'/)
  assert.match(schema, /export const testCatalogsSchema = defineEntitySchema\(rpc\['test-catalog'\], testCatalog\)/)
})

test('validates selected actions with derived identity, labels, and technical reads', () => {
  const cases = [
    {
      name: 'list-only',
      keep: ['list'],
      seed: null,
      navigation: null,
      test: null,
      selected: ['list'],
      technical: [],
    },
    {
      name: 'update-without-detail',
      keep: ['list', 'update'],
      selected: ['list', 'update'],
      technical: [{ action: 'detail', path: 'detail/[id]/+server.ts', permission: 'update-test-catalog' }],
    },
    {
      name: 'full',
      keep: ['list', 'detail', 'create', 'update', 'delete'],
      selected: ['create', 'delete', 'detail', 'list', 'update'],
      technical: [],
    },
    {
      name: 'shared permission',
      keep: ['list', 'detail'],
      share: 'read-test-catalog',
      test: null,
      seed: { records: [{ id: 'test-catalog-1', label: 'One' }], updateFields: ['label'] },
      selected: ['detail', 'list'],
      technical: [],
    },
  ]

  for (const item of cases) {
    const value = withoutActions(config(), item.keep)
    if (item.share) {
      for (const action of item.keep) value.actions[action].permission = item.share
      value.permissions = { [item.share]: { name: 'Read test catalog', description: 'Read test catalog records.' } }
    }
    if (item.seed === null) delete value.seed
    else if (item.seed) value.seed = item.seed
    if (item.navigation === null) delete value.navigation
    if (item.test === null) delete value.test
    else if (item.test) value.test = item.test
    else if (!Object.hasOwn(value.actions, 'update')) delete value.test.update
    const normalized = validateConfig(value)
    assert.deepEqual(normalized.selectedActions, item.selected, item.name)
    assert.equal(normalized.identity.key, 'id', item.name)
    assert.equal(normalized.labels.listTitle, 'Test Catalog', item.name)
    assert.equal(normalized.labels.submitLabel, 'Save', item.name)
    assert.deepEqual(
      normalized.technicalDependencies.map(({ action, path, permission }) => ({ action, path, permission })),
      item.technical,
      item.name,
    )
    if (item.name === 'shared permission') {
      assert.deepEqual(normalized.usedPermissions[item.share].sort(), ['actions.detail', 'actions.list'], item.name)
    }
    if (item.name === 'update-without-detail') {
      assert.equal(normalized.needsTechnicalDetailRead, true, item.name)
    }
  }
})

test('rejects invalid selected actions, permission use, navigation, seed, and test data', () => {
  const cases = [
    ['empty actions', (value) => { value.actions = {}; value.permissions = {} }, /actions must have at least one key/],
    ['unknown action', (value) => { value.actions.archive = { permission: 'archive-test-catalog' } }, /actions\.archive is unsupported/],
    ['unknown action field', (value) => { value.actions.list.fields = ['missing'] }, /actions\.list\.fields contains unsupported field/],
    ['delete with fields', (value) => { value.actions.delete.fields = [] }, /actions\.delete contains unsupported keys/],
    ['missing permission', (value) => { delete value.permissions['list-test-catalog'] }, /used but missing/],
    ['unused permission', (value) => { value.permissions['extra-test-catalog'] = { name: 'Extra', description: 'Extra.' } }, /defined but unused/],
    ['navigation without list', (value) => { const kept = withoutActions(value, ['list', 'detail']); delete kept.test.update; kept.navigation = { group: 'settings', after: 'settings-roles', title: 'Test Catalog', icon: 'folder' }; delete kept.actions.list; kept.permissions = Object.fromEntries(Object.entries(kept.permissions).filter(([code]) => code !== 'list-test-catalog')); Object.assign(value, kept) }, /navigation is allowed only when the list action exists/],
    ['legacy identity', (value) => { value.identity = { key: 'id', type: 'text', primary: true, generated: 'uuid' } }, /unsupported keys: identity/],
    ['legacy labels', (value) => { value.labels = { listTitle: 'Test Catalog' } }, /unsupported keys: labels/],
    ['missing test update', (value) => { delete value.test.update }, /test\.update is required for update/],
    ['unchanged test update', (value) => { value.test.update = { label: 'One', enabled: true } }, /must change at least one update field/],
    ['missing singular', (value) => { delete value.singular }, /singular is required/],
    ['redirect on list', (value) => { value.actions.list.redirect = 'other' }, /allowed only on create and update/],
    ['redirect with detail', (value) => { value.actions.create.redirect = 'other' }, /allowed only when neither Detail nor List exists/],
    ['missing redirect without targets', (value) => { const kept = withoutActions(value, ['create']); delete kept.navigation; kept.test = { record: { label: 'One', enabled: true } }; Object.assign(value, kept) }, /must give a valid existing route name via `redirect`/],
  ]

  for (const [, mutate, error] of cases) {
    const value = config()
    mutate(value)
    assert.throws(() => validateConfig(value), error)
  }
})

test('renders only selected actions and redirects', () => {
  const value = withoutActions(config(), ['list', 'create', 'update'])
  const normalized = validateConfig(value)
  assert.deepEqual(normalized.redirects, { create: 'settings-test-catalog', update: 'settings-test-catalog' })
  const setup = workspace(value)
  const result = JSON.parse(execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  assert.ok(!result.generated.some((path) => path.endsWith('detail.route.vue')))
  assert.ok(!result.generated.some((path) => path.endsWith('delete/[id]/+server.ts')))
  assert.ok(!result.generated.some((path) => path.endsWith('.resource.spec.ts')))
  assert.ok(result.generated.some((path) => path.endsWith('test-catalog.routes.spec.ts')))
  assert.equal(result.checks.apiTest, resolve(setup.outputRoot, 'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.routes.spec.ts'))
  assert.ok(result.generated.includes(result.checks.apiTest))
  assert.ok(result.generated.some((path) => path.endsWith('create.route.vue')))
  assert.ok(result.generated.some((path) => path.endsWith('create/+server.ts')))
  const technical = result.generated.find((path) => path.endsWith('detail/[id]/+server.ts'))
  assert.ok(technical)
  assert.match(readFileSync(technical, 'utf8'), /requirePermission\('update-test-catalog'\)/)
  const edit = readFileSync(result.generated.find((path) => path.endsWith('edit.route.vue')), 'utf8')
  assert.match(edit, /const load = /)
  assert.match(edit, /createHonoResourceActions/)
  assert.match(edit, /api\.detail\(/)
  assert.match(edit, /FormView v-bind="\{ load, \.\.\..*\.update\(.*\) \}"/)
  const resource = readFileSync(result.generated.find((path) => path.endsWith('.resource.ts')), 'utf8')
  assert.doesNotMatch(resource, /detail: \{/)
  assert.doesNotMatch(resource, /delete: \{/)
  assert.match(resource, /create: \{/)
  assert.match(resource, /update: \{/)
  assert.match(resource, /list: \{/)
  // No Detail selected: Loom infers the detail redirect, so no explicit
  // defaultTo is emitted (matches hand-written modules). Only the
  // no-Detail-no-List manifest redirect emits defaultTo (see solo below).
  assert.doesNotMatch(resource, /defaultTo/)
  const integration = readFileSync(result.generated.find((path) => path.endsWith('.integration.spec.ts')), 'utf8')
  assert.match(integration, /settings-test-catalog/)
  assert.doesNotMatch(integration, /record-1\/detail/)
  assert.deepEqual(Object.keys(result.permissions).sort(), ['create', 'list', 'update'])
  assert.deepEqual(result.redirects, { create: 'settings-test-catalog', update: 'settings-test-catalog' })
  assert.equal(result.routes.detail, null)
  assert.equal(result.routes.list, 'settings-test-catalog')
  assert.equal(result.routes.create, 'settings-test-catalog-create')
  assert.equal(result.routes.edit, 'settings-test-catalog-edit')

  const solo = withoutActions(config(), ['create'])
  delete solo.navigation
  solo.test = { record: { label: 'One', enabled: true } }
  assert.throws(() => validateConfig(solo), /must give a valid existing route name via `redirect`/)
  solo.actions.create.redirect = 'settings-home'
  const withRedirect = validateConfig(solo)
  assert.equal(withRedirect.redirects.create, 'settings-home')
  const soloSetup = workspace(solo)
  const soloResult = JSON.parse(execute(['--config', soloSetup.configPath, '--json'], { root: soloSetup.outputRoot, cwd: soloSetup.directory }))
  assert.ok(!soloResult.generated.some((path) => path.endsWith('.vue')))
  assert.ok(!soloResult.generated.some((path) => path.endsWith('.schema.ts')))
  assert.ok(!soloResult.generated.some((path) => path.endsWith('.integration.spec.ts')))
  assert.ok(soloResult.generated.some((path) => path.endsWith('create/+server.ts')))
})

test('browser journey stays on the page after submit and proves persistence on the list', () => {
  const setup = workspace(config())
  const result = JSON.parse(execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  const browser = result.generated.find((path) => path.endsWith('apps/web/e2e/test-catalog.spec.ts'))
  assert.ok(browser)
  const spec = readFileSync(browser, 'utf8')
  // Create: submit, then navigate to the list and assert there (no redirect,
  // no toast assertion: the toast is volatile and may never paint).
  const createSubmit = spec.indexOf(`name: 'Save', exact: true }).click()`)
  assert.ok(createSubmit > 0)
  assert.match(spec, /exact: true \}\)\.click\(\)\n  await page\.waitForResponse\(\(response\) => response\.url\(\).includes\('\/test-catalog\/create'\) && response\.request\(\).method\(\) === 'POST'\)\n  await page\.goto\('\/settings\/test-catalog'\)\n  await expect\(page\.getByRole\('cell'/)
  assert.match(spec, /exact: true \}\)\.click\(\)\n  await page\.waitForResponse\(\(response\) => response\.url\(\).includes\('\/test-catalog\/update\/'\) && response\.request\(\).method\(\) === 'PATCH'\)/)
  assert.doesNotMatch(spec, /Changes saved/)
  // The journey deletes the row it created, so assertions stay unscoped
  // cells: a same-valued leftover from a red run must fail loudly. The
  // delete step targets the UPDATED value (the journey renamed the row).
  assert.match(spec, /await expect\(page\.getByRole\('cell', \{ name: 'Two', exact: true \}\)\)\.toBeVisible\(\)/)
  assert.match(spec, /getByRole\('row', \{ name: new RegExp\('Two'\) \}\)\.getByRole\('button', \{ name: \/delete\/i \}\)/)
  // Update via the created row's Edit link (seed id stays untouched), then
  // list + reload assertions.
  assert.match(spec, /getByRole\('row'.*getByRole\('link', \{ name: \/edit\/i \}\)\.click\(\)/)
  assert.match(spec, /await page\.reload\(\)/)
  // Resource carries no defaultTo when Detail or List exists.
  const resource = readFileSync(result.generated.find((path) => path.endsWith('.resource.ts')), 'utf8')
  assert.doesNotMatch(resource, /defaultTo/)
})

test('generates the API proof spec with permission, persistence, and cleanup checks', () => {
  const setup = workspace(config())
  const result = JSON.parse(execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  const specPath = result.generated.find((path) => path.endsWith('test-catalog.routes.spec.ts'))
  assert.ok(specPath)
  const spec = readFileSync(specPath, 'utf8')
  assert.match(spec, /createSystemSession/)
  assert.match(spec, /toBe\(403\)/)
  assert.match(spec, /toBe\(400\)/)
  assert.match(spec, /cleanupSessions/)
  assert.match(spec, /closeDb/)
  assert.match(spec, /from '\.\.\/\.\.\/\.\.\/app'/)
  assert.match(spec, /from '\.\.\/\.\.\/\.\.\/db'/)
  assert.match(spec, /from '\.\.\/\.\.\/\.\.\/testing\/session'/)
  assert.match(spec, /testCatalogs/)
  assert.match(spec, /eq\(testCatalogs\.id, id\)/)
  assert.match(spec, /\{ \.\.\.record, \.\.\.updatePayload \}/)
  assert.match(spec, /finally/)
})

test('marks an explicit unsupported renderer as unsupported and manual', () => {
  const value = config()
  value.fields[0].renderer = 'lookup'
  const normalized = validateConfig(value)
  assert.equal(normalized.fields[0].renderer, 'lookup')
  assert.equal(normalized.fields[0].rendererSupported, false)
  assert.ok(normalized.unsupported.some((entry) => entry.includes('label:lookup') && entry.includes('manual')))
  const setup = workspace(value)
  const result = JSON.parse(execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  const resource = readFileSync(result.generated.find((path) => path.endsWith('.resource.ts')), 'utf8')
  assert.match(resource, /renderer: 'lookup'/)
})

test('generates different field lists for each resource action', () => {
  const value = config()
  value.fields.push({ key: 'category', type: 'text', label: 'Category', required: true })
  value.actions.list.fields = ['label', 'enabled']
  value.actions.detail.fields = ['label']
  value.actions.create.fields = ['category', 'label', 'enabled']
  value.actions.update.fields = ['category', 'label', 'enabled']
  const setup = workspace(value)
  const result = JSON.parse(execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  const resource = readFileSync(result.generated.find((path) => path.endsWith('.resource.ts')), 'utf8')

  assert.match(resource, /fields: \[fields\.label, fields\.enabled\]/)
  assert.match(resource, /fields: \[fields\.label\]/)
  assert.match(resource, /fields: \[fields\.category, fields\.label, fields\.enabled\]/)
  assert.ok(!result.generated.some((path) => path.endsWith('.resource.spec.ts')))
  // Renderer decisions stay covered here: derived text/checkbox renderers
  // appear in the resource output, which the removed shape spec used to
  // check (number is covered in 'generates bounded numeric fields').
  assert.match(resource, /label: \{ label: 'Label', form: \{ renderer: 'text'/)
  assert.match(resource, /category: \{ label: 'Category', form: \{ renderer: 'text'/)
  assert.match(resource, /enabled: \{ label: 'Enabled', form: \{ renderer: 'checkbox'/)
})

test('generates bounded numeric fields', () => {
  const value = config()
  value.fields.push({ key: 'rank', type: 'number', label: 'Rank', required: true, default: 1 })
  value.actions.list.fields.push('rank')
  value.actions.detail.fields.push('rank')
  value.actions.create.fields.push('rank')
  value.actions.update.fields.push('rank')
  const setup = workspace(value)
  const result = JSON.parse(execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  const entity = readFileSync(result.generated.find((path) => path.endsWith('.entity.ts')), 'utf8')
  const resource = readFileSync(result.generated.find((path) => path.endsWith('.resource.ts')), 'utf8')
  assert.match(entity, /rank: doublePrecision\('rank'\)\.notNull\(\)\.default\(1\)/)
  assert.match(resource, /rank: \{ label: 'Rank', form: \{ renderer: 'number'/)
})

test('human output lists generated and manual absolute paths', () => {
  const setup = workspace(config())
  const output = execute(['--config', setup.configPath], { root: setup.outputRoot, cwd: setup.directory })
  assert.match(output, /Generated files:/)
  assert.match(output, /Integration files:/)
  assert.match(output, /Manual files:/)
  assert.match(output, /Routes:/)
  assert.match(output, /Permissions:/)
  assert.match(output, new RegExp(`${setup.outputRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*test-catalog\\.entity\\.ts`))
})

test('does not generate a seed file when seed metadata is absent', () => {
  const value = config()
  delete value.seed
  const setup = workspace(value)
  const result = JSON.parse(execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }))

  assert.ok(!result.generated.some((path) => path.endsWith('.seed.ts')))
  assert.ok(!result.integration.some((path) => path.endsWith('/apps/api/scripts/seed.ts')))
})

test('refuses to overwrite existing generated output', () => {
  const setup = workspace(config())
  const entityPath = join(setup.outputRoot, 'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.entity.ts')
  mkdirSync(join(setup.outputRoot, 'apps/api/src/routes/(authenticated)/test-catalog'), { recursive: true })
  writeFileSync(entityPath, 'keep this file')

  assert.throws(
    () => execute(['--config', setup.configPath, '--json'], { root: setup.outputRoot, cwd: setup.directory }),
    /Refusing to overwrite existing generated file/,
  )
  assert.equal(readFileSync(entityPath, 'utf8'), 'keep this file')
})

test('rejects missing metadata, duplicate keys, and unsupported types', () => {
  const cases = [
    ['missing title', (value) => { delete value.title }, /title is required/],
    ['missing kind', (value) => { delete value.kind }, /kind must be bounded-module/],
    ['missing singular', (value) => { delete value.singular }, /singular is required/],
    ['duplicate keys', (value) => { value.fields[1].key = value.fields[0].key }, /Field keys.*unique/],
    ['unsupported type', (value) => { value.fields[0].type = 'date' }, /unsupported/],
    ['unknown action field', (value) => { value.actions.list.fields = ['missing'] }, /actions\.list\.fields contains unsupported field/],
  ]

  for (const [, mutate, error] of cases) {
    const value = config()
    mutate(value)
    const setup = workspace(value)
    assert.throws(() => execute(['--config', setup.configPath], { root: setup.outputRoot, cwd: setup.directory }), error)
  }
})

test('route operation previews and creates nested API scopes, actions, and web pages only', () => {
  const routes = [
    { path: 'apps/api/src/routes/(authenticated)/projects/[projectId]/tasks/+scope.ts', imports: [{ binding: '{ defineScope }', from: '@southneuhof/sprindle' }], script: 'export default defineScope({})' },
    { path: 'apps/api/src/routes/(authenticated)/projects/[projectId]/tasks/detail/[taskId]/+server.ts', imports: [{ binding: '{ detail }', from: '@southneuhof/sprindle' }, { binding: '{ requirePermission }', path: 'apps/api/src/identity.ts' }], script: "export const GET = detail({ param: 'taskId', authorize: requirePermission('detail-tasks') })" },
    { path: 'apps/web/src/routes/(authenticated)/projects/[projectId]/detail/tasks/index.route.vue', imports: [{ binding: '{ tasks }', path: 'apps/web/src/routes/(authenticated)/projects/tasks.resource.ts' }], template: '<ListView v-bind="tasks.list()" />' },
  ]
  const { configPath, outputRoot } = workspace({ kind: 'routes', routes })
  const args = ['--config', configPath, '--root', outputRoot, '--json']
  const preview = JSON.parse(execute([...args, '--check']))
  assert.deepEqual(preview.writes, [])
  assert.throws(() => readFileSync(preview.files[0].path), /ENOENT/)
  const result = JSON.parse(execute(args))
  assert.equal(result.writes.length, 3)
  assert.deepEqual(result.files, preview.files)
  for (const file of result.files) assert.equal(readFileSync(file.path, 'utf8'), `${file.contents.trimEnd()}\n`)
  assert.match(result.files[1].contents, /from '\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/identity'/)
  assert.match(result.files[2].contents, /from '\.\.\/\.\.\/\.\.\/tasks.resource'/)
  assert.throws(() => execute(args), /Refusing to overwrite/)
})

test('route operation rejects invalid batches before writing', () => {
  const valid = { path: 'apps/api/src/routes/health/+server.ts', script: 'export const GET = handler' }
  for (const invalid of [
    { ...valid, path: '../outside/+server.ts' },
    { ...valid, path: 'apps/web/src/routes/page.ts' },
    { ...valid, template: '<div />' },
    { ...valid, script: undefined },
    { ...valid, imports: [{ binding: '{ x }', from: 'x', path: 'x.ts' }] },
    valid,
  ]) {
    const { configPath, outputRoot } = workspace({ kind: 'routes', routes: [valid, invalid] })
    assert.throws(() => execute(['--config', configPath, '--root', outputRoot]))
    assert.throws(() => readFileSync(join(outputRoot, valid.path)), /ENOENT/)
  }
})


test('route operation rejects symbolic link destinations and blocked parents', () => {
  for (const link of [false, true]) {
    const { directory, configPath, outputRoot } = workspace({ kind: 'routes', routes: [
      { path: 'apps/api/src/routes/health/+server.ts', script: 'export const GET = handler' },
    ] })
    const parent = join(outputRoot, 'apps/api/src/routes')
    mkdirSync(parent, { recursive: true })
    if (link) symlinkSync(directory, join(parent, 'health'))
    else writeFileSync(join(parent, 'health'), 'keep')
    assert.throws(() => execute(['--config', configPath, '--root', outputRoot, '--check']), /Symbolic links|not a directory/)
  }
})

test('drizzle migration helpers gate unrelated operations and roll back only this invocation', () => {
  const table = 'test_catalog'
  const manifestFiles = (outputRoot) => ([
    { path: join(outputRoot, 'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.entity.ts'), contents: 'entity' },
  ])

  // checkMigrationAttribution: journal present + no destination clash passes;
  // missing journal or an existing destination throws. Full git-dirty check
  // stays in --apply orchestration (plan 018 step 6), not here.
  {
    const directory = mkdtempSync(join(tmpdir(), 'drizzle-attribution-'))
    temporaryDirectories.push(directory)
    mkdirSync(join(directory, 'apps/api/drizzle/meta'), { recursive: true })
    writeFileSync(join(directory, 'apps/api/drizzle/meta/_journal.json'), JSON.stringify({ version: 1, entries: [] }))
    const accepted = checkMigrationAttribution({ root: directory, config: { table }, files: manifestFiles(directory) })
    assert.equal(accepted.table, table)
    rmSync(join(directory, 'apps/api/drizzle/meta/_journal.json'))
    assert.throws(() => checkMigrationAttribution({ root: directory, config: { table }, files: manifestFiles(directory) }), /journal is missing or unparseable/)
    mkdirSync(join(directory, 'apps/api/drizzle/meta'), { recursive: true })
    writeFileSync(join(directory, 'apps/api/drizzle/meta/_journal.json'), 'not json')
    assert.throws(() => checkMigrationAttribution({ root: directory, config: { table }, files: manifestFiles(directory) }), /journal is missing or unparseable/)
    writeFileSync(join(directory, 'apps/api/drizzle/meta/_journal.json'), JSON.stringify({ version: 1, entries: [] }))
    mkdirSync(join(directory, 'apps/api/src/routes/(authenticated)/test-catalog'), { recursive: true })
    writeFileSync(join(directory, 'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.entity.ts'), 'pre-existing')
    assert.throws(() => checkMigrationAttribution({ root: directory, config: { table }, files: manifestFiles(directory) }), /Refusing to overwrite/)
  }

  // parseDrizzleExplain: accept only creation of the manifest table (+ its
  // indexes). Fixtures mirror the real CLI statement shapes from
  // drizzle-kit api-postgres.mjs prepareStatement(type, args).
  const gate = { table, columns: ['id', 'label'] }
  const accept = {
    status: 'ok',
    dialect: 'postgresql',
    statements: [
      { type: 'create_table', table: { schema: 'public', name: 'test_catalog' } },
      { type: 'create_index', index: { schema: 'public', table: 'test_catalog', name: 'test_catalog_label_idx' } },
    ],
    hints: [],
  }
  const accepted = parseDrizzleExplain(accept, gate)
  assert.equal(accepted.ok, true)
  assert.equal(accepted.operations.length, 2)

  // Neighboring shapes ({ operations }, bare array) use the same gate.
  assert.equal(parseDrizzleExplain({ operations: [{ type: 'create_table', table: { name: 'test_catalog' } }] }, gate).ok, true)
  assert.equal(parseDrizzleExplain([{ type: 'create_table', table: { name: 'test_catalog' } }], gate).ok, true)

  // Reject: operation on an unrelated table, even when the type is a creation.
  const unrelated = parseDrizzleExplain({
    status: 'ok',
    dialect: 'postgresql',
    statements: [
      { type: 'create_table', table: { schema: 'public', name: 'test_catalog' } },
      { type: 'create_index', index: { schema: 'public', table: 'other_table', name: 'other_idx' } },
    ],
    hints: [],
  }, gate)
  assert.equal(unrelated.ok, false)
  assert.match(unrelated.explanation, /only table "test_catalog" is allowed/)
  assert.match(unrelated.explanation, /other_table/)

  // Reject: drop operation on the manifest table itself.
  const drop = parseDrizzleExplain({
    status: 'ok',
    dialect: 'postgresql',
    statements: [{ type: 'drop_table', table: { schema: 'public', name: 'test_catalog' } }],
    hints: [],
  }, gate)
  assert.equal(drop.ok, false)
  assert.match(drop.explanation, /only creation of table "test_catalog" is allowed/)

  // Reject: alter on the manifest table and rename on any table.
  assert.equal(parseDrizzleExplain({ statements: [{ type: 'alter_column', column: { table: 'test_catalog', name: 'label' } }] }, gate).ok, false)
  assert.equal(parseDrizzleExplain({ statements: [{ type: 'rename_table', schema: 'public', from: 'test_catalog', to: 'test_catalog_v2' }] }, gate).ok, false)

  // Reject: lone add-column (table already exists, being altered) and raw
  // SQL strings with no attributable operation type.
  assert.equal(parseDrizzleExplain({ statements: [{ type: 'add_column', column: { table: 'test_catalog', name: 'label' } }] }, gate).ok, false)
  const rawSql = parseDrizzleExplain({ statements: ['CREATE TABLE "test_catalog" ("id" text);'] }, gate)
  assert.equal(rawSql.ok, false)

  // Reject: command-failure-shaped input (non-ok status, error object, empty
  // input, and no_changes without statements).
  assert.equal(parseDrizzleExplain({ status: 'error', message: 'boom' }, gate).ok, false)
  assert.equal(parseDrizzleExplain({ status: 'no_changes', dialect: 'postgresql' }, gate).ok, false)
  assert.equal(parseDrizzleExplain(null, gate).ok, false)
  assert.equal(parseDrizzleExplain({ status: 'ok', statements: [] }, gate).ok, false)

  // selectNewMigration: exactly one new directory passes; zero or two throw.
  // No live Drizzle, temp dirs only.
  {
    const directory = mkdtempSync(join(tmpdir(), 'drizzle-select-'))
    temporaryDirectories.push(directory)
    const drizzleDir = join(directory, 'apps/api/drizzle')
    mkdirSync(join(drizzleDir, '0000_first'), { recursive: true })
    writeFileSync(join(drizzleDir, '0000_first', 'migration.sql'), 'CREATE TABLE "old" ("id" text);')
    assert.throws(() => selectNewMigration({ root: directory, before: ['0000_first'] }), /exactly one new migration directory, found 0/)
    mkdirSync(join(drizzleDir, '0001_new', 'other'), { recursive: true })
    writeFileSync(join(drizzleDir, '0001_new', 'migration.sql'), 'CREATE TABLE "test_catalog" ("id" text);')
    mkdirSync(join(directory, 'apps/api/drizzle/meta'), { recursive: true })
    writeFileSync(join(directory, 'apps/api/drizzle/meta/_journal.json'), JSON.stringify({ entries: [{ tag: '0001_new', snapshot: 'x' }] }))
    const found = selectNewMigration({ root: directory, before: ['0000_first'] })
    assert.ok(found.dir.endsWith('0001_new'))
    assert.match(found.sql, /CREATE TABLE "test_catalog"/)
    assert.equal(found.journalEntry?.tag, '0001_new')
    mkdirSync(join(drizzleDir, '0002_second'), { recursive: true })
    writeFileSync(join(drizzleDir, '0002_second', 'migration.sql'), 'CREATE TABLE "x" ("id" text);')
    assert.throws(() => selectNewMigration({ root: directory, before: ['0000_first'] }), /exactly one new migration directory, found 2/)
  }

  // rollbackInvocation: removes only createdFiles, restores owner bytes, and
  // reports remaining paths instead of silently dropping them.
  {
    const directory = mkdtempSync(join(tmpdir(), 'drizzle-rollback-'))
    temporaryDirectories.push(directory)
    const created = join(directory, 'created.entity.ts')
    const owner = join(directory, 'owner.ts')
    const preExisting = join(directory, 'pre-existing.ts')
    writeFileSync(created, 'new file')
    writeFileSync(owner, 'mutated owner')
    writeFileSync(preExisting, 'keep me')
    const result = rollbackInvocation({ root: directory, createdFiles: [created], ownerBytes: new Map([[owner, 'original owner']]) })
    assert.deepEqual(result.remaining, [])
    assert.throws(() => readFileSync(created, 'utf8'), /ENOENT/)
    assert.equal(readFileSync(owner, 'utf8'), 'original owner')
    assert.equal(readFileSync(preExisting, 'utf8'), 'keep me')

    // A created file that vanishes before rollback is not an error: it is
    // already gone, so it counts as restored.
    const gone = rollbackInvocation({ root: directory, createdFiles: [join(directory, 'already-gone.ts')], ownerBytes: new Map() })
    assert.deepEqual(gone.remaining, [])

    // A failing owner restore is reported, never thrown away: point the
    // owner path at a directory so the rewrite fails.
    const blockedDir = join(directory, 'blocked-owner')
    mkdirSync(blockedDir, { recursive: true })
    const failing = rollbackInvocation({ root: directory, createdFiles: [], ownerBytes: new Map([[blockedDir, 'original']]) })
    assert.deepEqual(failing.remaining, [blockedDir])
    assert.throws(() => readFileSync(blockedDir, 'utf8'), /EISDIR/)
  }
})

test('bounded --manifest/--check/--apply CLI surface with detailed preview', async () => {
  const setup = workspace(config())
  // --manifest is the preferred alias; --config still works for both --check and routes.
  const jsonPreview = JSON.parse(execute(['--manifest', setup.configPath, '--check', '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  assert.deepEqual(jsonPreview.preview.selectedActions, ['create', 'delete', 'detail', 'list', 'update'])
  assert.deepEqual(jsonPreview.preview.technicalDependencies, [])
  assert.deepEqual(jsonPreview.preview.migrationIntent, { table: 'test_catalog', columns: ['id', 'label', 'enabled'] })
  assert.deepEqual(jsonPreview.preview.seed, { registered: true })
  assert.equal(jsonPreview.preview.apiTest.path, resolve(setup.outputRoot, 'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.routes.spec.ts'))
  assert.equal(jsonPreview.preview.browserTest.path, resolve(setup.outputRoot, 'apps/web/e2e/test-catalog.spec.ts'))
  assert.deepEqual(jsonPreview.preview.unsupported, [])
  assert.ok(jsonPreview.preview.generated.includes(jsonPreview.preview.apiTest.path))
  assert.ok(jsonPreview.preview.generated.includes(jsonPreview.preview.browserTest.path))
  assert.deepEqual(jsonPreview.writes, [])
  // describeBoundedModule and --check --json agree, and both write nothing.
  const direct = describeBoundedModule(config(), { root: setup.outputRoot })
  assert.deepEqual(direct, jsonPreview.preview)
  assert.throws(() => readFileSync(jsonPreview.preview.generated[0], 'utf8'), /ENOENT/)
  // Human --check prints the required sections.
  const human = execute(['--manifest', setup.configPath, '--check'], { root: setup.outputRoot, cwd: setup.directory })
  for (const section of ['Selected actions:', 'Technical dependencies:', 'Generated files:', 'Integration files:', 'Migration intent:', 'Seed:', 'API test:', 'Browser test:', 'Manual work:']) {
    assert.match(human, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  // --config alias still accepts the same manifest.
  const alias = JSON.parse(execute(['--config', setup.configPath, '--check', '--json'], { root: setup.outputRoot, cwd: setup.directory }))
  assert.deepEqual(alias.preview, jsonPreview.preview)
  // Mismatched aliases and --check/--apply together both throw.
  const other = workspace(config())
  assert.throws(() => execute(['--manifest', setup.configPath, '--config', other.configPath, '--check'], { root: setup.outputRoot, cwd: setup.directory }), /must match/)
  assert.throws(() => execute(['--manifest', setup.configPath, '--check', '--apply'], { root: setup.outputRoot, cwd: setup.directory }), /mutually exclusive/)
  assert.throws(() => execute(['--manifest', setup.configPath, '--apply'], { root: setup.outputRoot, cwd: setup.directory }), /use applyBoundedModule\(\) async entrypoint/)
  // --help documents the public surface.
  assert.match(execute(['--help']), /--manifest <path> --check/)
  assert.match(execute(['--help']), /--manifest <path> --apply/)
  assert.match(execute(['--help']), /deprecated alias/)
  // checkMigrationSql: manifest table passes; DROP/ALTER/RENAME or another table fails.
  assert.equal(checkMigrationSql('CREATE TABLE "test_catalog" ("id" text);', { table: 'test_catalog' }).ok, true)
  assert.equal(checkMigrationSql('CREATE TABLE "other" ("id" text);', { table: 'test_catalog' }).ok, false)
  assert.equal(checkMigrationSql('ALTER TABLE "test_catalog" ADD COLUMN "x" text;', { table: 'test_catalog' }).ok, false)
  assert.equal(checkMigrationSql('DROP TABLE "test_catalog";', { table: 'test_catalog' }).ok, false)
})

test('bounded --apply orchestrates migration with rollback on unrelated operations', async () => {
  const calls = []
  const migrationSqlFor = (root, table) => {
    const dir = join(root, 'apps/api/drizzle/0001_test_catalog')
    mkdirSync(dir, { recursive: true })
    const sql = `CREATE TABLE "${table}" ("id" text PRIMARY KEY, "label" text NOT NULL);\nCREATE INDEX "test_catalog_label_idx" ON "${table}" ("label");\n`
    writeFileSync(join(dir, 'migration.sql'), sql)
    return sql
  }
  const runnerFor = (explainJson, { root } = {}) => ({ command, args }) => {
    calls.push({ command, args })
    if (args.includes('--explain')) {
      return { status: 0, exitCode: 0, stdout: JSON.stringify(explainJson), stderr: '' }
    }
    if (root) migrationSqlFor(root, 'test_catalog')
    return { status: 0, exitCode: 0, stdout: 'generated', stderr: '' }
  }
  const explainOk = {
    status: 'ok',
    statements: [
      { type: 'create_table', table: 'test_catalog' },
      { type: 'create_index', index: { table: 'test_catalog', name: 'test_catalog_label_idx' } },
    ],
  }
  const ownerSnapshot = (root) => ({
    domains: readFileSync(join(root, 'apps/api/src/domains.ts'), 'utf8'),
    catalog: readFileSync(join(root, 'apps/api/src/authorization/catalog.ts'), 'utf8'),
  })

  // Success path: owners are pre-created via copyCurrentOwners, the mock
  // runner approves the explain gate, and one new migration dir proves the SQL.
  {
    calls.length = 0
    const directory = mkdtempSync(join(tmpdir(), 'bounded-apply-'))
    temporaryDirectories.push(directory)
    const root = join(directory, 'repository')
    copyCurrentOwners(root)
    const manifest = config()
    mkdirSync(join(root, 'apps/api/drizzle/meta'), { recursive: true })
    writeFileSync(join(root, 'apps/api/drizzle/meta/_journal.json'), JSON.stringify({ version: 1, entries: [] }))
    const before = ownerSnapshot(root)
    const result = await applyBoundedModule({ manifest, root, runner: runnerFor(explainOk, { root }), env: {} })
    assert.match(result.migration.sql, /CREATE TABLE "test_catalog"/)
    assert.ok(result.migration.dir.endsWith('0001_test_catalog'))
    assert.ok(result.generated.some((path) => path.endsWith('test-catalog.entity.ts')))
    assert.ok(result.integration.some((path) => path.endsWith('/apps/api/src/domains.ts')))
    assert.ok(result.integration.some((path) => path.endsWith('/apps/api/src/authorization/catalog.ts')))
    assert.ok(result.integration.some((path) => path.endsWith('/apps/api/scripts/seed.ts')))
    assert.ok(result.integration.some((path) => path.endsWith('/apps/web/src/manifest/navigation.ts')))
    assert.notEqual(readFileSync(join(root, 'apps/api/src/domains.ts'), 'utf8'), before.domains)
    assert.notEqual(readFileSync(join(root, 'apps/api/src/authorization/catalog.ts'), 'utf8'), before.catalog)
    assert.ok(readFileSync(join(root, 'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.entity.ts'), 'utf8').includes('test_catalog'))
    // No migrate, push, or seed invocation reaches the runner.
    const seen = calls.flatMap((call) => call.args.map(String))
    assert.ok(!seen.some((arg) => /migrate|db:push|seed/.test(arg)))
    assert.ok(calls.some((call) => call.args.includes('--explain')))
    assert.ok(calls.some((call) => call.args.includes('--name')))
  }

  // Failure path: unrelated explain output rolls back created files and
  // restores owner bytes while pre-existing files stay untouched.
  {
    calls.length = 0
    const directory = mkdtempSync(join(tmpdir(), 'bounded-apply-rollback-'))
    temporaryDirectories.push(directory)
    const root = join(directory, 'repository')
    copyCurrentOwners(root)
    const preExisting = join(root, 'pre-existing.ts')
    writeFileSync(preExisting, 'keep me')
    mkdirSync(join(root, 'apps/api/drizzle/meta'), { recursive: true })
    writeFileSync(join(root, 'apps/api/drizzle/meta/_journal.json'), JSON.stringify({ version: 1, entries: [] }))
    const before = ownerSnapshot(root)
    const explainBad = {
      status: 'ok',
      statements: [
        { type: 'create_table', table: 'test_catalog' },
        { type: 'create_table', table: 'other_table' },
      ],
    }
    const manifest = config()
    await assert.rejects(() => applyBoundedModule({ manifest, root, runner: runnerFor(explainBad), env: {} }), /unrelated operations/)
    assert.throws(() => readFileSync(join(root, 'apps/api/src/routes/(authenticated)/test-catalog/test-catalog.entity.ts'), 'utf8'), /ENOENT/)
    assert.equal(readFileSync(join(root, 'apps/api/src/domains.ts'), 'utf8'), before.domains)
    assert.equal(readFileSync(join(root, 'apps/api/src/authorization/catalog.ts'), 'utf8'), before.catalog)
    assert.equal(readFileSync(preExisting, 'utf8'), 'keep me')
    const seen = calls.flatMap((call) => call.args.map(String))
    assert.ok(!seen.some((arg) => /migrate|db:push|seed/.test(arg)))
  }
})
