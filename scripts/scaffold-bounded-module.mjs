#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { integrate } from './integrate-bounded-module.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const symbolPattern = /^[A-Z][A-Za-z0-9]*$/
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const tablePattern = /^[a-z][a-z0-9_]*$/
const supportedTypes = new Set(['text', 'boolean', 'number'])
const supportedActions = ['list', 'detail', 'create', 'update', 'delete']
const defaultRenderers = { text: 'text', boolean: 'checkbox', number: 'number' }
const renderersByType = {
  text: new Set(['text', 'textarea']),
  boolean: new Set(['checkbox', 'radio', 'switch']),
  number: new Set(['number']),
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function knownKeys(value, allowed, name) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key))
  if (unknown.length) throw new Error(`${name} contains unsupported keys: ${unknown.join(', ')}. Use a normal module plan for unsupported behavior.`)
}

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required.`)
  return value.trim()
}

function identifier(value, name) {
  const result = requiredString(value, name)
  if (!identifierPattern.test(result)) throw new Error(`${name} must be a valid identifier.`)
  return result
}

function databaseName(value, name, fallback) {
  const result = value === undefined ? fallback : requiredString(value, name)
  if (!tablePattern.test(result)) throw new Error(`${name} must be a valid database identifier.`)
  return result
}

function snakeCase(value) {
  return value.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}

function deriveLabels(title, singular) {
  return {
    listTitle: title,
    detailTitle: singular,
    createTitle: `Create ${singular}`,
    editTitle: `Edit ${singular}`,
    submitLabel: 'Save',
  }
}

function validatePermissions(value) {
  if (!isObject(value)) throw new Error('permissions is required.')
  const codes = Object.keys(value)
  if (codes.length === 0) throw new Error('permissions must define at least one permission.')
  const entries = Object.fromEntries(codes.map((code) => {
    if (code.trim() === '') throw new Error('permissions contains an empty code.')
    const entry = value[code]
    const name = `permissions.${code}`
    if (!isObject(entry)) throw new Error(`${name} is required.`)
    knownKeys(entry, ['name', 'description'], name)
    return [code, {
      name: requiredString(entry.name, `${name}.name`),
      description: requiredString(entry.description, `${name}.description`),
    }]
  }))
  return entries
}

function validateNavigation(value, { hasList }) {
  if (value === undefined || value === null) return null
  if (!hasList) throw new Error('navigation is allowed only when the list action exists.')
  if (!isObject(value)) throw new Error('navigation must be an object when provided.')
  knownKeys(value, ['group', 'after', 'title', 'icon'], 'navigation')
  const group = requiredString(value.group, 'navigation.group')
  if (!slugPattern.test(group)) throw new Error('navigation.group must be a route segment.')
  const anchor = requiredString(value.after, 'navigation.after')
  const title = requiredString(value.title, 'navigation.title')
  const icon = requiredString(value.icon, 'navigation.icon')
  return { group, position: 'after', anchor, title, icon, separator: null }
}

function validateActionEntry(value, name, { fields, allowFields, usedPermissions }) {
  if (!isObject(value)) throw new Error(`${name} must be an object.`)
  knownKeys(value, [...(allowFields ? ['fields', 'permission'] : ['permission']), 'redirect'], name)
  if (value.redirect !== undefined && name !== 'actions.create' && name !== 'actions.update') {
    throw new Error(`${name}.redirect is allowed only on create and update actions.`)
  }
  let actionFields = []
  if (allowFields) {
    if (!Array.isArray(value.fields)) throw new Error(`${name}.fields must be an array.`)
    actionFields = value.fields.map((key, index) => identifier(key, `${name}.fields[${index}]`))
    if (new Set(actionFields).size !== actionFields.length) throw new Error(`${name}.fields must be unique.`)
    for (const key of actionFields) {
      if (!fields.some((field) => field.key === key)) throw new Error(`${name}.fields contains unsupported field "${key}".`)
    }
  } else if (value.fields !== undefined) {
    throw new Error(`${name} must not define fields.`)
  }
  const permission = requiredString(value.permission, `${name}.permission`)
  if (!Object.hasOwn(usedPermissions, permission)) usedPermissions[permission] = []
  usedPermissions[permission].push(name)
  let redirect
  if (value.redirect !== undefined) {
    redirect = requiredString(value.redirect, `${name}.redirect`)
  }
  return { fields: actionFields, permission, ...(redirect !== undefined ? { redirect } : {}) }
}

function validateActions(value, { fields }) {
  if (!isObject(value)) throw new Error('actions is required.')
  const names = Object.keys(value)
  if (names.length === 0) throw new Error('actions must have at least one key.')
  for (const name of names) {
    if (!supportedActions.includes(name)) throw new Error(`actions.${name} is unsupported.`)
  }
  const usedPermissions = {}
  const actions = Object.fromEntries(names.map((name) => [
    name,
    validateActionEntry(value[name], `actions.${name}`, { fields, allowFields: name !== 'delete', usedPermissions }),
  ]))
  const hasDetail = Object.hasOwn(actions, 'detail')
  const hasList = Object.hasOwn(actions, 'list')
  const hasRedirectTarget = hasDetail || hasList
  for (const name of ['create', 'update']) {
    if (!Object.hasOwn(actions, name)) continue
    const entry = actions[name]
    if (hasRedirectTarget) {
      if (entry.redirect !== undefined) throw new Error(`actions.${name}.redirect is allowed only when neither Detail nor List exists. Remove redirect; Create and Update redirect to Detail when Detail exists, otherwise to List when List exists.`)
    } else if (entry.redirect === undefined || entry.redirect.trim() === '') {
      throw new Error(`manifest must give a valid existing route name via \`redirect\` when neither Detail nor List exists (actions.${name}.redirect is required).`)
    }
  }
  return { actions, usedPermissions }
}

function rejectUnsupportedTopLevel(value) {
  const legacy = ['identity', 'actionFields', 'serverFields', 'auditFields', 'labels'].filter((key) => value[key] !== undefined)
  if (legacy.length) throw new Error(`manifest contains unsupported keys: ${legacy.join(', ')}. Remove ${legacy.join(', ')}; do not keep the old redundant identity and labels form as a compatibility input.`)
}

function deriveIdentity() {
  return {
    key: 'id',
    type: 'text',
    label: 'ID',
    required: false,
    renderer: 'text',
    rendererSupported: true,
    column: 'id',
    identity: true,
  }
}
function validateSeed(value, { fields }) {
  if (value === undefined || value === null) return null
  if (!isObject(value)) throw new Error('seed must be an object when provided.')
  knownKeys(value, ['records', 'updateFields'], 'seed')
  if (!Array.isArray(value.records) || value.records.length === 0) throw new Error('seed.records must be a non-empty array when seed is provided.')
  if (!Array.isArray(value.updateFields) || value.updateFields.length === 0) throw new Error('seed.updateFields must be a non-empty array when seed is provided.')
  const allowedKeys = new Set(['id', ...fields.map((field) => field.key)])
  const updateFields = value.updateFields.map((key, index) => identifier(key, `seed.updateFields[${index}]`))
  if (new Set(updateFields).size !== updateFields.length) throw new Error('seed.updateFields must be unique.')
  for (const key of updateFields) {
    if (!allowedKeys.has(key) || key === 'id') throw new Error(`seed.updateFields contains unsupported field "${key}".`)
  }
  const records = value.records.map((record, index) => {
    if (!isObject(record)) throw new Error(`seed.records[${index}] must be an object.`)
    if (!Object.hasOwn(record, 'id')) throw new Error('seed.records[${index}] must include id.')
    for (const key of Object.keys(record)) {
      if (!allowedKeys.has(key)) throw new Error(`seed.records[${index}] contains unsupported field "${key}".`)
    }
    return record
  })
  return { records, updateFields }
}

function validateTestFixture(value, { actions, fields, seed }) {
  const hasMutation = ['create', 'update', 'delete'].some((action) => Object.hasOwn(actions, action))
  if (value === undefined || value === null) {
    if (hasMutation) throw new Error('test.record is required for a selected mutation.')
    return { record: {}, browserNeedsSeed: (Object.hasOwn(actions, 'list') || Object.hasOwn(actions, 'detail')) && seed === null }
  }
  if (!isObject(value)) throw new Error('test must be an object when provided.')
  knownKeys(value, ['record', 'update'], 'test')
  if (!isObject(value.record)) throw new Error('test.record is required for a selected mutation.')
  const fieldByKey = Object.fromEntries(fields.map((field) => [field.key, field]))
  const allowedRecordKeys = new Set(fields.map((field) => field.key))
  const recordKeys = Object.keys(value.record)
  if (hasMutation && recordKeys.length === 0) throw new Error('test.record must include at least one field for a selected mutation.')
  for (const key of recordKeys) {
    if (!allowedRecordKeys.has(key)) throw new Error(`test.record contains unsupported field "${key}".`)
  }
  for (const [key, fieldValue] of Object.entries(value.record)) {
    const field = fieldByKey[key]
    const expected = field.type === 'boolean' ? 'boolean' : field.type === 'number' ? 'number' : 'string'
    if (typeof fieldValue !== expected) throw new Error(`test.record.${key} must be ${expected}.`)
    if (field.type === 'number' && !Number.isFinite(fieldValue)) throw new Error(`test.record.${key} must be a finite number.`)
  }
  if (Object.hasOwn(actions, 'update')) {
    const updateFields = actions.update.fields
    if (!isObject(value.update)) throw new Error('test.update is required for update.')
    const updateKeys = Object.keys(value.update)
    if (updateKeys.length === 0) throw new Error('test.update must change at least one update field.')
    for (const key of updateKeys) {
      if (!updateFields.includes(key)) throw new Error(`test.update contains unsupported field "${key}".`)
    }
    let changesField = false
    for (const key of updateKeys) {
      if (value.record[key] === undefined || value.record[key] !== value.update[key]) changesField = true
    }
    if (!changesField) throw new Error('test.update must change at least one update field.')
    for (const [key, fieldValue] of Object.entries(value.update)) {
      const field = fieldByKey[key]
      const expected = field.type === 'boolean' ? 'boolean' : field.type === 'number' ? 'number' : 'string'
      if (typeof fieldValue !== expected) throw new Error(`test.update.${key} must be ${expected}.`)
      if (field.type === 'number' && !Number.isFinite(fieldValue)) throw new Error(`test.update.${key} must be a finite number.`)
    }
  } else if (value.update !== undefined) {
    throw new Error('test.update is allowed only when the update action exists.')
  }
  const browserNeedsSeed = !hasMutation && (Object.hasOwn(actions, 'list') || Object.hasOwn(actions, 'detail')) && seed === null
  return {
    record: value.record,
    ...(Object.hasOwn(actions, 'update') ? { update: value.update } : {}),
    browserNeedsSeed,
  }
}

function validateField(value, name) {
  if (!isObject(value)) throw new Error(`${name} must be an object.`)
  knownKeys(value, ['key', 'type', 'label', 'required', 'default', 'renderer'], name)
  const key = identifier(value.key, `${name}.key`)
  if (key === 'id') throw new Error(`${name}.key "id" is reserved for the derived identity.`)
  const type = requiredString(value.type, `${name}.type`)
  if (!supportedTypes.has(type)) throw new Error(`${name}.type "${type}" is unsupported; use text, boolean, or number.`)
  const label = requiredString(value.label, `${name}.label`)

  let renderer
  let rendererSupported = true
  if (value.renderer === undefined || value.renderer === null) {
    renderer = defaultRenderers[type]
  } else {
    renderer = requiredString(value.renderer, `${name}.renderer`)
    if (!renderersByType[type].has(renderer)) rendererSupported = false
  }

  if (value.required !== undefined && typeof value.required !== 'boolean') throw new Error(`${name}.required must be boolean.`)
  if (Object.hasOwn(value, 'default')) {
    const expected = type === 'boolean' ? 'boolean' : type === 'number' ? 'number' : 'string'
    if (typeof value.default !== expected) throw new Error(`${name}.default must be ${expected}.`)
    if (type === 'number' && !Number.isFinite(value.default)) throw new Error(`${name}.default must be a finite number.`)
  }

  return {
    key,
    type,
    label,
    required: value.required ?? false,
    ...(Object.hasOwn(value, 'default') ? { default: value.default } : {}),
    renderer,
    rendererSupported,
    column: snakeCase(key),
  }
}

export function validateConfig(value) {
  if (!isObject(value)) throw new Error('Scaffold configuration must be a JSON object.')
  knownKeys(value, ['kind', 'slug', 'table', 'symbol', 'title', 'singular', 'fields', 'actions', 'permissions', 'navigation', 'seed', 'test'], 'manifest')

  if (value.kind !== 'bounded-module') throw new Error('kind must be bounded-module.')
  rejectUnsupportedTopLevel(value)
  const slug = requiredString(value.slug, 'slug')
  if (!slugPattern.test(slug)) throw new Error('slug must contain lowercase letters, numbers, and single hyphens.')
  const table = databaseName(requiredString(value.table, 'table'), 'table', '')
  const symbol = requiredString(value.symbol, 'symbol')
  if (!symbolPattern.test(symbol)) throw new Error('symbol must be a PascalCase identifier.')
  const title = requiredString(value.title, 'title')
  const singular = requiredString(value.singular, 'singular')

  if (!Array.isArray(value.fields) || value.fields.length === 0) throw new Error('fields must be a non-empty array.')
  const fields = value.fields.map((field, index) => validateField(field, `fields[${index}]`))
  const keys = fields.map((field) => field.key)
  if (new Set(keys).size !== keys.length) throw new Error('Field keys must be unique.')

  const identity = deriveIdentity()
  const labels = deriveLabels(title, singular)
  const { actions, usedPermissions } = validateActions(value.actions, { fields })
  const permissions = validatePermissions(value.permissions)
  for (const code of Object.keys(usedPermissions)) {
    if (!Object.hasOwn(permissions, code)) throw new Error(`Permission "${code}" is used but missing in permissions.`)
  }
  for (const code of Object.keys(permissions)) {
    if (!Object.hasOwn(usedPermissions, code)) throw new Error(`Permission "${code}" is defined but unused. Remove the unused definition.`)
  }
  const seed = validateSeed(value.seed, { fields })
  const test = validateTestFixture(value.test, { actions, fields, seed })
  const navigation = validateNavigation(value.navigation, { hasList: Object.hasOwn(actions, 'list') })

  const selectedActions = Object.keys(actions).sort((left, right) => left.localeCompare(right))
  const needsTechnicalDetailRead = selectedActions.includes('update') && !selectedActions.includes('detail')
  const technicalDependencies = needsTechnicalDetailRead ? [{
    action: 'detail',
    path: 'detail/[id]/+server.ts',
    permission: actions.update.permission,
    reason: 'Update without a Detail page still needs the API record-read route for edit hydration.',
  }] : []
  const technicalActions = needsTechnicalDetailRead
    ? { ...actions, detail: { fields: [...actions.update.fields], permission: actions.update.permission, technical: true } }
    : actions
  const actionFields = Object.fromEntries(
    Object.entries(actions).map(([action, entry]) => [action, entry.fields]),
  )
  const customRenderers = fields
    .filter((field) => !field.rendererSupported)
    .map((field) => `${field.key}:${field.renderer}`)
  const unsupported = []
  if (customRenderers.length) unsupported.push(`custom renderer for ${customRenderers.join(', ')} makes that UI action manual`)

  // Redirect rule (plan 018 §2 plus the Loom list fallback): Create and
  // Update redirect to Detail when Detail exists, else to List when List
  // exists, else to the manifest `redirect` route name. Route-existence
  // validation is a later part; here the manifest target is only required
  // to be a non-empty string.
  // Validation order matters: navigation rejects a missing List before the
  // redirect rule can misreport a create-only manifest as missing `redirect`.
  // A create/update-only manifest without Detail or List has no navigation
  // group, so the Detail/List targets are null there; the effective target
  // is then always the manifest `redirect`.
  const group = navigation?.group ?? null
  const detailRoute = group ? `${group}-${slug}-detail` : null
  const listRoute = group ? `${group}-${slug}` : null
  const redirects = {}
  for (const action of ['create', 'update']) {
    if (!Object.hasOwn(actions, action)) continue
    redirects[action] = Object.hasOwn(actions, 'detail') ? detailRoute : Object.hasOwn(actions, 'list') ? listRoute : actions[action].redirect
  }

  return {
    kind: value.kind,
    slug,
    table,
    symbol,
    title,
    singular,
    identity,
    fields,
    actions,
    technicalActions,
    actionFields,
    redirects,
    usedPermissions,
    permissions,
    navigation,
    seed,
    test,
    labels,
    selectedActions,
    technicalDependencies,
    needsTechnicalDetailRead,
    unsupported,
  }
}

function literal(value) {
  if (typeof value === 'string') return `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n').replaceAll('\r', '\\r')}'`
  return JSON.stringify(value)
}

function lowerCamel(symbol) {
  return `${symbol[0].toLowerCase()}${symbol.slice(1)}`
}

export function moduleMetadata(config) {
  const entity = lowerCamel(config.symbol)
  const routeParam = `${entity}Id`
  const group = config.navigation?.group ?? null
  const selected = new Set(config.selectedActions ?? Object.keys(config.actions ?? {}))
  // Plan 018 §2 and user binding: routes stay null for unselected actions
  // even when a technical read exists (the technical +server has no page or
  // route name). Route is also null without a navigation group.
  const routes = {
    list: selected.has('list') && group ? `${group}-${config.slug}` : null,
    detail: selected.has('detail') && group ? `${group}-${config.slug}-detail` : null,
    create: selected.has('create') && group ? `${group}-${config.slug}-create` : null,
    edit: selected.has('update') && group ? `${group}-${config.slug}-edit` : null,
  }
  const permissions = Object.fromEntries(
    Object.entries(config.actions ?? {}).map(([action, entry]) => [action, entry.permission]),
  )
  return { entity, plural: `${entity}s`, routeParam, routes, permissions }
}

function html(value) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function tableColumn(field) {
  const modifiers = []
  if (field.required) modifiers.push('notNull()')
  if (Object.hasOwn(field, 'default')) modifiers.push(`default(${literal(field.default)})`)
  const factory = field.type === 'number' ? 'doublePrecision' : field.type
  return `${field.key}: ${factory}(${literal(field.column)})${modifiers.map((modifier) => `.${modifier}`).join('')},`
}

function renderEntity(config) {
  const imports = ['boolean', 'doublePrecision', 'pgTable', 'text'].filter((value) => {
    if (value === 'boolean') return config.fields.some((field) => field.type === 'boolean')
    if (value === 'doublePrecision') return config.fields.some((field) => field.type === 'number')
    return true
  })
  const identity = `${config.identity.key}: text(${literal(config.identity.column)}).primaryKey().$defaultFn(() => crypto.randomUUID()),`
  const writeKeys = [config.identity.key]
  const write = writeKeys.map((key) => `${key}: true`).join(', ')
  const plural = `${lowerCamel(config.symbol)}s`

  return `import { createEntity } from '@southneuhof/sprindle/entity'
import { ${imports.join(', ')} } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'

export const ${plural} = pgTable(${literal(config.table)}, {
  ${identity}
${config.fields.map(tableColumn).map((line) => `  ${line}`).join('\n')}
})

const write = { ${write} } as const

export const ${lowerCamel(config.symbol)} = createEntity({
  table: ${plural},
  schemas: {
    create: createInsertSchema(${plural}).omit(write),
    update: createUpdateSchema(${plural}).omit(write),
    select: createSelectSchema(${plural}),
  },
})
`
}

function renderRoute(config) {
  const plural = `${lowerCamel(config.symbol)}s`
  const entity = lowerCamel(config.symbol)
  const metadata = moduleMetadata(config)
  return `import { defineDomainPart } from '@southneuhof/sprindle/model'
import { ${plural}, ${entity} } from './${config.slug}.entity'

export const domain = defineDomainPart({ tables: { ${plural} }, entities: [${entity}] })
`
}

function renderScope(config) {
  const entity = lowerCamel(config.symbol)
  return `import { defineScope } from '@southneuhof/sprindle'
import { ${entity} } from './${config.slug}.entity'

export default defineScope({ entity: ${entity} })
`
}

function renderServer(config, action, { permission } = {}) {
  const helper = action === 'delete' ? 'deleteRoute' : action
  const segment = ['detail', 'update', 'delete'].includes(action) ? `${action}/[id]` : action
  const identityPath = importPath(`apps/api/src/routes/(authenticated)/${config.slug}/${segment}/+server.ts`, 'apps/api/src/identity.ts')
  const code = permission ?? `${action}-${config.slug}`
  return `import { ${helper} } from '@southneuhof/sprindle'
import { requirePermission } from '${identityPath}'

export const ${action === 'create' ? 'POST' : action === 'update' ? 'PATCH' : action === 'delete' ? 'DELETE' : 'GET'} = ${helper}({ authorize: requirePermission('${code}') })
`
}

function renderSeed(config) {
  if (!config.seed) return null
  const entity = lowerCamel(config.symbol)
  const plural = `${entity}s`
  const rows = config.seed.records.map((record) => {
    const values = Object.entries(record).map(([key, value]) => `${key}: ${literal(value)}`).join(', ')
    return `  { ${values} },`
  }).join('\n')
  const updates = config.seed.updateFields.map((key) => `${key}: sql\`excluded.${config.fields.find((field) => field.key === key).column}\``).join(', ')
  return `import { sql } from 'drizzle-orm'
import { getDb } from '../../../db'
import { ${plural} } from './${config.slug}.entity'

const records = [
${rows}
]

export async function seed${config.symbol}() {
  const db = getDb()
  await db.insert(${plural}).values(records).onConflictDoUpdate({
    target: ${plural}.${config.identity.key},
    set: { ${updates} },
  })
}
`
}

function renderSchema(config) {
  const entity = lowerCamel(config.symbol)
  const plural = `${entity}s`
  const head = `import { ${entity} } from '@southneuhof/api/routes/(authenticated)/${config.slug}/${config.slug}.entity'
import { rpc } from '@/framework/rpc'
import type { z } from 'zod/v4'

export type ${config.symbol} = z.output<typeof ${entity}.schemas.select>
export type ${config.symbol}Create = z.input<typeof ${entity}.schemas.create>
export type ${config.symbol}Update = z.input<typeof ${entity}.schemas.update>
`
  if (config.identity.key !== 'id') {
    return `import { defineSchema, fromZod } from '@southneuhof/loom'
import type { AppResourceContract } from '@/framework/hono'
${head}
export const ${plural}Schema = defineSchema<AppResourceContract<typeof rpc['${config.slug}']>>({
  identity: ${literal(config.identity.key)},
  record: { schema: fromZod(${entity}.schemas.select) },
  create: { schema: fromZod(${entity}.schemas.create) },
  update: { schema: fromZod(${entity}.schemas.update) },
})
`
  }
  return `import { defineEntitySchema } from '@/framework/hono'
${head}
export const ${plural}Schema = defineEntitySchema(rpc['${config.slug}'], ${entity})
`
}

function renderField(field) {
  const formParts = [`renderer: ${literal(field.renderer)}`]
  if (field.options) formParts.push(`source: ${literal(field.options)} as const`)
  if (field.required) formParts.push('props: { required: true }')
  return `  ${field.key}: { label: ${literal(field.label)}, form: { ${formParts.join(', ')} } },`
}

function resourceEntry(config, action) {
  const metadata = moduleMetadata(config)
  const routeParam = metadata.routeParam
  const source = config.actions
  const fieldKeys = source[action].fields.map((key) => `fields.${key}`).join(', ')
  const permission = source[action].permission
  const initial = config.fields
    .filter((field) => Object.hasOwn(field, 'default'))
    .map((field) => `${field.key}: ${literal(field.default)}`)
    .join(', ')
  const initialData = initial ? `\n      initialData: { ${initial} },` : ''
  // Redirect rule (plan 018 §2 plus the Loom list fallback): Create/Update
  // carry no explicit defaultTo when Detail or List exists; Loom redirects
  // to Detail when Detail exists, else to List when List exists. Only the
  // explicit manifest redirect (no Detail and no List) emits defaultTo.
  // Loom's formDefaultTo with a string defaultTo navigates by route NAME via
  // router.replace.
  const redirectLine = !Object.hasOwn(source, 'detail') && !Object.hasOwn(source, 'list') && (action === 'create' || action === 'update')
    ? `\n      defaultTo: ${literal(config.redirects[action])},`
    : ''
  if (action === 'list') {
    return `    list: {
      run: api.list,
      fields: [${fieldKeys}],
      permission: '${permission}',
      route: { name: '${metadata.routes.list}' },
    },`
  }
  if (action === 'detail') {
    return `    detail: {
      run: api.detail,
      fields: [${fieldKeys}],
      permission: '${permission}',
      route: { name: '${metadata.routes.detail}', params: (id) => ({ ${routeParam}: String(id) }) },
      title: ${literal(config.labels.detailTitle)},
    },`
  }
  if (action === 'create') {
    return `    create: {
      run: api.create,
      fields: [${fieldKeys}],
      permission: '${permission}',
      route: { name: '${metadata.routes.create}' },${initialData}${redirectLine}
    },`
  }
  if (action === 'update') {
    return `    update: {
      run: api.update,
      fields: [${fieldKeys}],
      permission: '${permission}',
      route: { name: '${metadata.routes.edit}', params: (id) => ({ ${routeParam}: String(id) }) },${redirectLine}
    },`
  }
  return `    delete: { run: api.delete, permission: '${permission}' },`
}

function renderResource(config) {
  const entity = lowerCamel(config.symbol)
  const plural = `${entity}s`
  const entries = config.selectedActions.map((action) => resourceEntry(config, action)).join('\n')

  return `import { defineFields, defineResource } from '@southneuhof/loom'
import { createHonoResourceActions } from '@/framework/hono'
import { rpc } from '@/framework/rpc'
import { ${plural}Schema } from './${config.slug}.schema'

const api = createHonoResourceActions(rpc['${config.slug}'])

const fields = defineFields(${plural}Schema, {
${config.fields.map(renderField).join('\n')}
})

export const ${plural} = defineResource(${plural}Schema, {
  key: '${config.slug}',
  actions: {
${entries}
  },
})

export type { ${config.symbol}, ${config.symbol}Create, ${config.symbol}Update } from './${config.slug}.schema'
`
}

function renderRoutes(config) {
  const entity = lowerCamel(config.symbol)
  const plural = `${entity}s`
  const metadata = moduleMetadata(config)
  const routeParam = metadata.routeParam
  const listTitle = html(config.labels.listTitle)
  const createTitle = html(config.labels.createTitle)
  const editTitle = html(config.labels.editTitle)
  const submitLabel = html(config.labels.submitLabel)
  // Update without Detail hydrates through the technical read route: pass a
  // `load` function to FormView that calls the technical read via
  // createHonoResourceActions. The technical detail action is not a page or
  // resource entry; only the Update page uses it. The spread order matters:
  // `load` must come AFTER the resource spread so it overrides the
  // resource's own (absent) load with the technical read.
  const editTemplate = config.needsTechnicalDetailRead
    ? `<script setup lang="ts">
import { useRoute } from 'vue-router'
import { FormView } from '@southneuhof/loom'
import { createHonoResourceActions } from '@/framework/hono'
import { rpc } from '@/framework/rpc'
import { ${plural} } from '../${config.slug}.resource'

const route = useRoute('${metadata.routes.edit}')
const id = String(route.params.${routeParam})
const api = createHonoResourceActions(rpc['${config.slug}'])
const load = (context: { signal?: AbortSignal }) => api.detail({ id, searchParameters: {}, signal: context.signal })
</script>

<template><FormView v-bind="{ load, ...${plural}.update({ id } as never) }" title="${editTitle}" submit-label="${submitLabel}" /></template>
`
    : `<script setup lang="ts">
import { useRoute } from 'vue-router'
import { FormView } from '@southneuhof/loom'
import { ${plural} } from '../${config.slug}.resource'

const route = useRoute('${metadata.routes.edit}')
</script>

<template><FormView v-bind="${plural}.update({ id: String(route.params.${routeParam}) })" title="${editTitle}" submit-label="${submitLabel}" /></template>
`
  return {
    index: `<script setup lang="ts">
import { ListView } from '@southneuhof/loom'
import { ${plural} } from './${config.slug}.resource'
</script>

<template><ListView v-bind="${plural}.list()" title="${listTitle}" /></template>
`,
    create: `<script setup lang="ts">
import { FormView } from '@southneuhof/loom'
import { ${plural} } from './${config.slug}.resource'
</script>

<template><FormView v-bind="${plural}.create()" title="${createTitle}" submit-label="${submitLabel}" /></template>
`,
    detail: `<script setup lang="ts">
import { useRoute } from 'vue-router'
import { DetailView } from '@southneuhof/loom'
import { ${plural} } from '../${config.slug}.resource'

const route = useRoute('${metadata.routes.detail}')
</script>

<template><DetailView v-bind="${plural}.detail({ id: String(route.params.${routeParam}) })" /></template>
`,
    edit: editTemplate,
  }
}

function renderIntegrationTest(config) {
  const metadata = moduleMetadata(config)
  const selected = new Set(config.selectedActions)
  const permission = config.actions.list?.permission ?? Object.values(config.actions)[0]?.permission ?? ''
  // Route assertions reference only existing actions: assert a selected route
  // name, and assert absence only for actions the manifest omitted. The
  // assertions describe generated routes only: a later manual route (for
  // example an approved custom Detail page) can add a name that the
  // generated absence check does not know, so absence checks stay scoped to
  // generated files, not the final route table.
  const assertions = []
  if (selected.has('list')) assertions.push(`    expect(router.resolve('/${config.navigation.group}/${config.slug}').name).toBe('${metadata.routes.list}')`)
  else assertions.push(`    expect(router.getRoutes().map((route) => route.name)).not.toContain('${config.navigation.group}-${config.slug}')`)
  if (selected.has('create')) assertions.push(`    expect(router.resolve('/${config.navigation.group}/${config.slug}/create').name).toBe('${metadata.routes.create}')`)
  else assertions.push(`    expect(router.getRoutes().map((route) => route.name)).not.toContain('${config.navigation.group}-${config.slug}-create')`)
  if (selected.has('detail')) assertions.push(`    expect(router.resolve('/${config.navigation.group}/${config.slug}/record-1/detail').name).toBe('${metadata.routes.detail}')`)
  else assertions.push(`    expect(router.getRoutes().map((route) => route.name)).not.toContain('${config.navigation.group}-${config.slug}-detail')`)
  if (selected.has('update')) assertions.push(`    expect(router.resolve('/${config.navigation.group}/${config.slug}/record-1/edit').name).toBe('${metadata.routes.edit}')`)
  else assertions.push(`    expect(router.getRoutes().map((route) => route.name)).not.toContain('${config.navigation.group}-${config.slug}-edit')`)
  const navigationBlock = selected.has('list') ? `

    const group = navigation.find((module) => module.name === '${config.navigation.group}')
    expect(group?.routes).toContainEqual({
      to: { name: '${metadata.routes.list}' },
      permission: '${permission}',
      title: ${literal(config.navigation.title)},
      icon: ${literal(config.navigation.icon)},
    })` : ''
  return `import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
${selected.has('list') ? "import { navigation } from '@/manifest/navigation'\n" : ''}
const router = createRouter({ history: createMemoryHistory(), routes })

describe(${literal(`${config.title} route integration`)}, () => {
  it('registers the standard route tree and navigation entry', () => {
${assertions.join('\n')}${navigationBlock}
  })
})
`
}

function wrongJsonType(field) {
  return field.type === 'text' ? 123 : 'invalid-type'
}

function invalidPayloadLiteral(valid, actionKeys, fields) {
  const required = fields.find((field) => field.required && actionKeys.includes(field.key))
  if (required && Object.hasOwn(valid ?? {}, required.key)) {
    const copy = { ...(valid ?? {}) }
    copy[required.key] = wrongJsonType(required)
    return JSON.stringify(copy)
  }
  const first = fields.find((field) => field.key === actionKeys[0])
  if (!first) return '[]'
  return JSON.stringify({ ...(valid ?? {}), [first.key]: wrongJsonType(first) })
}

function renderApiSpec(config) {
  const selected = new Set(config.selectedActions)
  const entity = lowerCamel(config.symbol)
  const plural = `${entity}s`
  const permissions = [...new Set([...selected].map((action) => config.actions[action]?.permission).filter(Boolean))].sort()
  const record = config.test?.record ?? {}
  const updatePayload = config.test?.update ?? {}
  const hasCreate = selected.has('create')
  const hasList = selected.has('list')
  const hasDetail = selected.has('detail')
  const hasUpdate = selected.has('update')
  const hasDelete = selected.has('delete')
  const needsSetup = (hasList || hasDetail || hasUpdate || hasDelete) && Object.keys(record).length > 0
  const defineRecord = needsSetup || hasCreate
  const invalidCreate = hasCreate ? invalidPayloadLiteral(record, config.actions.create.fields, config.fields) : null
  const invalidUpdate = hasUpdate ? invalidPayloadLiteral(updatePayload, config.actions.update.fields, config.fields) : null
  const setupInsert = needsSetup ? `    await db.insert(${plural}).values({ id, ...record })\n` : ''
  const createBlock = hasCreate ? `    expect((await app.request('/${config.slug}/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: denied.cookie }, body: JSON.stringify(record) })).status).toBe(403)\n    expect((await app.request('/${config.slug}/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin.cookie }, body: JSON.stringify(${invalidCreate}) })).status).toBe(400)\n${needsSetup ? `    expect(await db.select().from(${plural}).where(eq(${plural}.id, id))).toHaveLength(1)\n` : ''}    const createResponse = await app.request('/${config.slug}/create', { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: admin.cookie }, body: JSON.stringify(record) })\n    expect(createResponse.status).toBe(201)\n    createdId = ((await createResponse.json()) as { data: { id: string } }).data.id\n    expect(await db.select().from(${plural}).where(eq(${plural}.id, createdId))).toMatchObject([record])\n` : ''
  const listBlock = hasList ? `    expect((await app.request('/${config.slug}/list', { headers: { Cookie: denied.cookie } })).status).toBe(403)\n    const listResponse = await app.request('/${config.slug}/list', { headers: { Cookie: admin.cookie } })\n    expect(listResponse.status).toBe(200)\n${needsSetup ? `    expect(JSON.stringify(await listResponse.json())).toContain(id)\n` : hasCreate ? `    expect(JSON.stringify(await listResponse.json())).toContain(createdId)\n` : ''}` : ''
  const detailTarget = needsSetup ? 'id' : hasCreate ? 'createdId' : 'id'
  const detailBlock = hasDetail ? `    expect((await app.request('/${config.slug}/detail/' + ${detailTarget}, { headers: { Cookie: denied.cookie } })).status).toBe(403)\n    const detailResponse = await app.request('/${config.slug}/detail/' + ${detailTarget}, { headers: { Cookie: admin.cookie } })\n    expect(detailResponse.status).toBe(200)\n${needsSetup || hasCreate ? `    expect(await detailResponse.json()).toMatchObject({ data: record })\n` : ''}` : ''
  const updateBlock = hasUpdate ? `    expect((await app.request('/${config.slug}/update/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: denied.cookie }, body: JSON.stringify(updatePayload) })).status).toBe(403)\n    expect((await app.request('/${config.slug}/update/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: admin.cookie }, body: JSON.stringify(${invalidUpdate}) })).status).toBe(400)\n    expect(await db.select().from(${plural}).where(eq(${plural}.id, id))).toMatchObject([record])\n    const updateResponse = await app.request('/${config.slug}/update/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Cookie: admin.cookie }, body: JSON.stringify(updatePayload) })\n    expect(updateResponse.status).toBe(200)\n    expect(await db.select().from(${plural}).where(eq(${plural}.id, id))).toMatchObject([{ ...record, ...updatePayload }])\n` : ''
  const deleteBlock = hasDelete ? `    expect((await app.request('/${config.slug}/delete/' + id, { method: 'DELETE', headers: { Cookie: denied.cookie } })).status).toBe(403)\n    expect(await db.select().from(${plural}).where(eq(${plural}.id, id))).toHaveLength(1)\n    const deleteResponse = await app.request('/${config.slug}/delete/' + id, { method: 'DELETE', headers: { Cookie: admin.cookie } })\n    expect(deleteResponse.status).toBe(200)\n    expect(await db.select().from(${plural}).where(eq(${plural}.id, id))).toHaveLength(0)\n` : ''
  const cleanupDeletes = hasCreate ? `    await db.delete(${plural}).where(eq(${plural}.id, id))\n    if (createdId) await db.delete(${plural}).where(eq(${plural}.id, createdId))\n` : `    await db.delete(${plural}).where(eq(${plural}.id, id))\n`
  return `import { afterAll, expect, it } from 'vitest'\nimport { eq } from 'drizzle-orm'\nimport { app } from '../../../app'\nimport { closeDb, getDb } from '../../../db'\nimport { cleanupSessions, createSystemSession, testId } from '../../../testing/session'\nimport { ${plural} } from './${config.slug}.entity'\n\nafterAll(() => closeDb())\n\nit(${literal(`proves ${config.title} standard actions`)}, async () => {\n  const db = getDb()\n  const admin = await createSystemSession(${JSON.stringify(permissions)})\n  const denied = await createSystemSession([])\n  const id = testId(${literal(config.slug)})\n${defineRecord ? `  const record = ${JSON.stringify(record)}\n` : ''}${hasUpdate ? `  const updatePayload = ${JSON.stringify(updatePayload)}\n` : ''}${hasCreate ? `  let createdId: string | undefined\n` : ''}  try {\n${setupInsert}${createBlock}${listBlock}${detailBlock}${updateBlock}${deleteBlock}  } finally {\n${cleanupDeletes}    await cleanupSessions()\n  }\n}, 60_000)\n`
}

function browserManualReason(config) {
  const selected = new Set(config.selectedActions)
  const hasWebAction = ['list', 'detail', 'create', 'update'].some((action) => selected.has(action))
  if (!hasWebAction || !config.navigation) return 'no web action selected'
  const unsupportedField = config.fields.find((field) => !field.rendererSupported)
  if (unsupportedField) return `custom renderer for ${unsupportedField.key}:${unsupportedField.renderer} makes that UI action manual`
  if (!selected.has('create') && !config.seed) return 'read-only journey needs a seed record'
  return null
}

function renderBrowserSpec(config) {
  const selected = new Set(config.selectedActions)
  const metadata = moduleMetadata(config)
  const firstField = config.fields[0]
  const record = config.test?.record ?? config.seed?.records[0] ?? {}
  const updatePayload = config.test?.update ?? {}
  const updateKey = Object.keys(updatePayload)[0]
  const updateValue = updateKey ? updatePayload[updateKey] : undefined
  const seed = config.seed?.records[0]
  const hasList = selected.has('list')
  const hasCreate = selected.has('create')
  const hasDetail = selected.has('detail')
  const hasUpdate = selected.has('update')
  const hasDelete = selected.has('delete')
  const lines = []
  lines.push(`import { expect, test } from './fixtures'`)
  lines.push('')
  lines.push(`test.use({ fastAuth: true })`)
  lines.push('')
  lines.push(`test(${literal(`${config.title} journey persists across reload`)}, async ({ authenticatedPage: page }) => {`)
  if (hasList) {
    lines.push(`  await page.goto('/${config.navigation.group}/${config.slug}')`)
    if (seed) lines.push(`  await expect(page.getByRole('cell', { name: ${literal(String(seed[firstField.key]))}, exact: true })).toBeVisible()`)
    // A list with no rows renders the empty slot ("No data"), not a table:
    // assert the list page chrome instead. The rows appear after Create below.
    else if (record[firstField.key] !== undefined) lines.push(`  await expect(page.getByRole('heading', { name: ${literal(config.labels.listTitle)} })).toBeVisible()`)
  }
  if (hasCreate) {
    lines.push(`  await page.goto('/${config.navigation.group}/${config.slug}/create')`)
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'boolean') continue
      lines.push(`  await page.getByRole('textbox', { name: ${literal(config.fields.find((field) => field.key === key)?.label ?? key)} }).fill(${literal(String(value))})`)
    }
    lines.push(`  await page.getByRole('button', { name: ${literal(config.labels.submitLabel)}, exact: true }).click()`)
    // The framework defaultTo (detail, else list) fires after a successful
    // submit. Save resolves through the resource run, so wait for the POST
    // response before asserting the redirect: without the wait the assertion
    // can run while the save is still in flight. Then expect the framework
    // redirect, not an explicit goto. Never assert the success toast: it
    // never paints after a real save.
    lines.push(`  await page.waitForResponse((response) => response.url().includes('/${config.slug}/create') && response.request().method() === 'POST')`)
    if (hasDetail) {
      lines.push(`  await expect(page).toHaveURL(new RegExp('/${config.navigation.group}/${config.slug}/.+/detail'))`)
      // DetailView renders the static resource title as the heading; the
      // record value renders in the detail table below it.
      lines.push(`  await expect(page.getByRole('heading', { name: ${literal(config.labels.detailTitle)} })).toBeVisible()`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(String(record[firstField.key]))}, exact: true })).toBeVisible()`)
    } else if (hasList) {
      lines.push(`  await expect(page).toHaveURL(new RegExp('/${config.navigation.group}/${config.slug}$'))`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(String(record[firstField.key]))}, exact: true })).toBeVisible()`)
    } else {
      lines.push(`  await expect(page.getByRole('button', { name: ${literal(config.labels.submitLabel)}, exact: true })).toBeVisible()`)
    }
  }
  if (hasDetail && !hasCreate) {
    // DetailView heading is the static resource title; the record value is
    // asserted in the read-only journey context below where available.
    lines.push(`  await expect(page.getByRole('heading', { name: ${literal(config.labels.detailTitle)} })).toBeVisible()`)
  }
  if (hasUpdate && updateKey) {
    // After saving the Update the framework defaultTo fires (detail, else
    // list). Wait for the PATCH response, then expect the redirect and
    // assert the saved value there, then reload and assert again to prove
    // persistence across reload. Do not assert the volatile success toast.
    // The journey is its own cleanup: it deletes the row it created, so
    // after a green run no same-valued row remains; keep the assertions
    // unscoped cells so a same-valued leftover from a previous RED run
    // fails loudly instead of passing on the wrong row. The Update page
    // needs a record id in the URL; the journey edits the record it just
    // created, whose id is unknown to the static spec, so open the List
    // first, follow the created row's Edit link, save, and expect the
    // redirect. The row link keeps working even when a seed record shares
    // the table.
    if (hasList) {
      lines.push(`  await page.goto('/${config.navigation.group}/${config.slug}')`)
      lines.push(`  await page.getByRole('row', { name: new RegExp(${literal(String(record[firstField.key]))}) }).getByRole('link', { name: /edit/i }).click()`)
    } else if (seed) {
      lines.push(`  await page.goto('/${config.navigation.group}/${config.slug}/${seed.id}/edit')`)
    }
    lines.push(`  await page.getByRole('textbox', { name: ${literal(config.fields.find((field) => field.key === updateKey)?.label ?? updateKey)} }).fill(${literal(String(updateValue))})`)
    lines.push(`  await page.getByRole('button', { name: ${literal(config.labels.submitLabel)}, exact: true }).click()`)
    lines.push(`  await page.waitForResponse((response) => response.url().includes('/${config.slug}/update/') && response.request().method() === 'PATCH')`)
    if (hasDetail) {
      lines.push(`  await expect(page).toHaveURL(new RegExp('/${config.navigation.group}/${config.slug}/.+/detail'))`)
      // Same static-title contract as after Create: heading is the resource
      // title, the saved value is asserted in the detail table.
      lines.push(`  await expect(page.getByRole('heading', { name: ${literal(config.labels.detailTitle)} })).toBeVisible()`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(String(updateValue))}, exact: true })).toBeVisible()`)
      lines.push(`  await page.goto('/${config.navigation.group}/${config.slug}')`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(String(updateValue))}, exact: true })).toBeVisible()`)
      lines.push(`  await page.reload()`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(String(updateValue))}, exact: true })).toBeVisible()`)
    } else if (hasList) {
      lines.push(`  await expect(page).toHaveURL(new RegExp('/${config.navigation.group}/${config.slug}$'))`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(String(updateValue))}, exact: true })).toBeVisible()`)
      lines.push(`  await page.reload()`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(String(updateValue))}, exact: true })).toBeVisible()`)
    } else {
      lines.push(`  await page.reload()`)
      lines.push(`  await expect(page.getByRole('textbox', { name: ${literal(config.fields.find((field) => field.key === updateKey)?.label ?? updateKey)} })).toHaveValue(${literal(String(updateValue))})`)
    }
  }
  if (hasDelete) {
    // Delete the UPDATED row when an Update ran (the journey renamed the
    // created value, so the created value no longer matches any row), else
    // the created row. The journey is its own cleanup: after a green run no
    // same-valued row remains, so the final absence assertion proves the
    // delete. The ListView delete control opens a confirmation dialog; the
    // row is only removed after the dialog Delete is clicked. Without a
    // List there is no generated delete surface; report manual.
    const deleteValue = hasUpdate && updateKey ? String(updateValue) : String(record[firstField.key] ?? '')
    if (hasList) {
      lines.push(`  await page.goto('/${config.navigation.group}/${config.slug}')`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(deleteValue)}, exact: true })).toBeVisible()`)
      lines.push(`  await page.getByRole('row', { name: new RegExp(${literal(deleteValue)}) }).getByRole('button', { name: /delete/i }).click()`)
      lines.push(`  await page.getByRole('button', { name: 'Delete', exact: true }).click()`)
      lines.push(`  await expect(page.getByRole('cell', { name: ${literal(deleteValue)}, exact: true })).toHaveCount(0)`)
    } else {
      lines.push(`  await page.getByRole('button', { name: /delete/i }).click()`)
    }
  }
  lines.push(`})`)
  lines.push('')
  return `${lines.join('\n')}`
}

function filesFor(config, root) {
  const apiRoot = `apps/api/src/routes/(authenticated)/${config.slug}`
  const apiFileRoot = apiRoot
  const selected = new Set(config.selectedActions)
  const hasApiAction = ['list', 'detail', 'create', 'update', 'delete'].some((action) => selected.has(action)) || config.needsTechnicalDetailRead
  const hasWebAction = ['list', 'detail', 'create', 'update'].some((action) => selected.has(action))
  // Selection rules (plan 018 §2): entity+domain+scope when any API action
  // is selected; schema+resource when any web action is selected (list,
  // detail, create, update are web actions; delete is API-only with no
  // page). API +server files, resource action entries, and Vue route files
  // cover selected actions plus the Update-hydration technical read only.
  // Base files are always emitted when their layer is selected; there is no
  // keep-when-unsure fallback beyond the layer rules above.
  // Navigation file handling stays conditional in scaffold(): integrate the
  // navigation owner only when List is selected.
  const webRoot = config.navigation ? `apps/web/src/routes/(authenticated)/${config.navigation.group}/${config.slug}` : null
  const routeRoot = webRoot ? `${webRoot}/[${lowerCamel(config.symbol)}Id]` : null
  const routes = hasWebAction && webRoot && routeRoot ? renderRoutes(config) : null
  const serverFor = (action, fileAction = action) => {
    if (selected.has(action)) return renderServer(config, fileAction, { permission: config.actions[action].permission })
    if (action === 'detail' && config.needsTechnicalDetailRead) return renderServer(config, 'detail', { permission: config.actions.update.permission })
    return null
  }
  const files = []
  if (hasApiAction) {
    files.push([`${apiRoot}/${config.slug}.entity.ts`, renderEntity(config)])
    files.push([`${apiRoot}/${config.slug}.ts`, renderRoute(config)])
    files.push([`${apiFileRoot}/+scope.ts`, renderScope(config)])
  }
  if (['list', 'detail', 'create', 'update', 'delete'].some((action) => selected.has(action))) {
    files.push([`${apiRoot}/${config.slug}.routes.spec.ts`, renderApiSpec(config)])
  }
  const apiServers = [
    ['list', `${apiFileRoot}/list/+server.ts`],
    ['detail', `${apiFileRoot}/detail/[id]/+server.ts`],
    ['create', `${apiFileRoot}/create/+server.ts`],
    ['update', `${apiFileRoot}/update/[id]/+server.ts`],
    ['delete', `${apiFileRoot}/delete/[id]/+server.ts`],
  ]
  for (const [action, path] of apiServers) {
    const contents = serverFor(action)
    if (contents) files.push([path, contents])
  }
  if (hasWebAction && webRoot && routeRoot) {
    files.push([`${webRoot}/${config.slug}.schema.ts`, renderSchema(config)])
    files.push([`${webRoot}/${config.slug}.resource.ts`, renderResource(config)])
    if (selected.has('list')) files.push([`${webRoot}/index.route.vue`, routes.index])
    if (selected.has('create')) files.push([`${webRoot}/create.route.vue`, routes.create])
    files.push([`${webRoot}/${config.slug}.integration.spec.ts`, renderIntegrationTest(config)])
    if (selected.has('detail')) files.push([`${routeRoot}/detail.route.vue`, routes.detail])
    if (selected.has('update')) files.push([`${routeRoot}/edit.route.vue`, routes.edit])
  }
  const seed = renderSeed(config)
  if (seed) files.push([`${apiRoot}/${config.slug}.seed.ts`, seed])
  if (!browserManualReason(config)) {
    files.push([`apps/web/e2e/${config.slug}.spec.ts`, renderBrowserSpec(config)])
  }
  return files.map(([relativePath, contents]) => ({ path: resolve(root, relativePath), contents }))
}

function importPath(file, target) {
  const path = relative(dirname(file), target).split(sep).join('/').replace(/\.(?:ts|tsx)$/, '')
  return path.startsWith('.') ? path : `./${path}`
}

function checkFiles(files, root) {
  const paths = files.map(file => file.path)
  if (new Set(paths).size !== paths.length) throw new Error('Duplicate output path.')
  for (const file of files) {
    for (let path = file.path; path !== dirname(path); path = dirname(path)) {
      let stat
      try { stat = lstatSync(path) } catch (error) { if (error.code !== 'ENOENT') throw error }
      if (stat?.isSymbolicLink()) throw new Error(`Symbolic links are not supported: ${path}`)
      if (stat && path === file.path) throw new Error(`Refusing to overwrite existing generated file: ${file.path}`)
      if (stat && !stat.isDirectory()) throw new Error(`Output parent is not a directory: ${path}`)
      if (path === root) break
    }
  }
}

function writeFiles(files, root) {
  checkFiles(files, root)
  for (const file of files) {
    mkdirSync(dirname(file.path), { recursive: true })
    writeFileSync(file.path, `${file.contents.trimStart().trimEnd()}\n`, { flag: 'wx' })
  }
}

function routeFiles(value, root) {
  knownKeys(value, ['kind', 'routes'], 'manifest')
  if (!Array.isArray(value.routes) || !value.routes.length) throw new Error('routes must be a non-empty array.')
  const files = value.routes.map((route, index) => {
    const name = `routes[${index}]`
    if (!isObject(route)) throw new Error(`${name} must be an object.`)
    knownKeys(route, ['path', 'imports', 'script', 'template'], name)
    const destination = requiredString(route.path, `${name}.path`)
    const path = resolve(root, destination)
    const within = relative(root, path).split(sep).join('/')
    if (isAbsolute(destination) || !/^apps\/(api|web)\/src\/routes\/.+/.test(within)) throw new Error(`${name}.path must be inside an application route directory.`)
    const web = within.startsWith('apps/web/')
    if (web ? !basename(path).endsWith('.route.vue') : !['+server.ts', '+scope.ts'].includes(basename(path))) throw new Error(`${name}.path has an unsupported route filename.`)
    if (route.imports !== undefined && !Array.isArray(route.imports)) throw new Error(`${name}.imports must be an array.`)
    const imports = (route.imports ?? []).map(entry => {
      if (!isObject(entry)) throw new Error(`${name}.imports entries must be objects.`)
      knownKeys(entry, ['binding', 'from', 'path'], `${name}.imports`)
      const binding = requiredString(entry.binding, 'import binding')
      if ((entry.from === undefined) === (entry.path === undefined)) throw new Error('Each import requires either from or path.')
      const source = entry.path === undefined ? requiredString(entry.from, 'import from') : importPath(path, resolve(root, requiredString(entry.path, 'import path')))
      return `import ${binding} from ${literal(source)}`
    }).join('\n')
    const script = route.script === undefined && web ? '' : requiredString(route.script, `${name}.script`)
    if (web && route.script !== undefined && typeof route.script !== 'string') throw new Error(`${name}.script must be text.`)
    const body = [imports, script].filter(Boolean).join('\n\n')
    if (!web && route.template !== undefined) throw new Error(`${name}.template is only supported for web routes.`)
    const contents = web ? `${body ? `<script setup lang="ts">\n${body}\n</script>\n\n` : ''}<template>\n${requiredString(route.template, `${name}.template`)}\n</template>\n` : body
    return { path, contents }
  })
  checkFiles(files, root)
  return files
}

export function expectedGeneratedPaths(config, { root = repoRoot } = {}) {
  const value = Object.hasOwn(config ?? {}, 'selectedActions') ? config : validateConfig(config)
  return filesFor(value, resolve(root)).map((file) => file.path).sort((left, right) => left.localeCompare(right))
}

// Plan 018 step 3 part A: Drizzle migration helpers. Pure logic only; no CLI
// invocation and no change to scaffold() behavior or CLI args. Full git-dirty
// check happens in --apply orchestration (step 6), not here.
const drizzleAllowedOpTypes = new Set(['create-table', 'create-index', 'add-column'])
const drizzleOutRelative = 'apps/api/drizzle'
const drizzleJournalRelative = 'apps/api/drizzle/meta/_journal.json'

export function checkMigrationAttribution({ root, config, files }) {
  const outputRoot = resolve(root ?? repoRoot)
  const journalPath = resolve(outputRoot, drizzleJournalRelative)
  let journal
  try {
    journal = JSON.parse(readFileSync(journalPath, 'utf8'))
  } catch {
    throw new Error(`Migration journal is missing or unparseable: ${journalPath}`)
  }
  if (!journal || typeof journal !== 'object') {
    throw new Error(`Migration journal is missing or unparseable: ${journalPath}`)
  }
  checkFiles(files, outputRoot)
  return { journalPath, journal, table: config?.table ?? null }
}

function drizzleOpinion(value) {
  if (value === null || value === undefined) return 'missing value'
  if (typeof value === 'object') {
    try { return JSON.stringify(value) } catch { return String(value) }
  }
  return String(value)
}

function drizzleNormalizeOperations(json) {
  if (!isObject(json) && !Array.isArray(json)) return null
  if (Array.isArray(json)) return json
  for (const key of ['operations', 'actions', 'statements', 'changes']) {
    if (Array.isArray(json[key])) return json[key]
  }
  return null
}

function drizzleOperationTarget(operation) {
  if (typeof operation === 'string') return { type: 'raw-sql', table: null, raw: operation }
  if (!isObject(operation)) return { type: typeof operation, table: null, raw: operation }
  const rawType = typeof operation.type === 'string' ? operation.type : typeof operation.action === 'string' ? operation.action : typeof operation.kind === 'string' ? operation.kind : typeof operation.op === 'string' ? operation.op : 'unknown'
  const table = drizzleStatementTable(operation, rawType)
  return { type: rawType, table, raw: operation }
}

function drizzleNestedTable(value, rawType, key) {
  if (typeof value === 'string') return value
  if (!isObject(value)) return null
  // Column/index/unique/check/pk/fk/policy payloads carry both the table
  // name and the object name: prefer the table keys so a column named
  // "label" is never mistaken for a table.
  if (key !== 'table') {
    if (typeof value.table === 'string') return value.table
    if (typeof value.tableName === 'string') return value.tableName
    return null
  }
  if (typeof value.name === 'string') return value.name
  if (typeof value.table === 'string') return value.table
  if (typeof value.tableName === 'string') return value.tableName
  void rawType
  return null
}

function drizzleStatementTable(operation, rawType) {
  for (const key of ['table', 'tableName', 'tableTo']) {
    const candidate = operation[key]
    if (typeof candidate === 'string') return candidate
    if (isObject(candidate)) {
      const nested = drizzleNestedTable(candidate, rawType, 'table')
      if (nested) return nested
    }
  }
  for (const key of ['column', 'index', 'unique', 'check', 'pk', 'fk', 'policy']) {
    const nested = drizzleNestedTable(operation[key], rawType, key)
    if (nested) return nested
  }
  if (typeof operation.name === 'string' && /table/i.test(rawType)) return operation.name
  return null
}

function drizzleLowerType(type) {
  return String(type).toLowerCase().replace(/[^a-z]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function parseDrizzleExplain(json, { table, columns } = {}) {
  const expectedTable = requiredString(table, 'table')
  const expectedColumns = Array.isArray(columns) ? columns.map((column) => requiredString(column, 'columns entry')) : []
  // Real CLI shape (drizzle-kit generate --explain --output json) is
  // { status, dialect, statements: [{ type, ... }], hints }. Accept the
  // neighboring { operations | actions | changes } shapes too. Anything
  // else (command failure, no_changes without statements) is rejected.
  if (isObject(json) && typeof json.status === 'string' && json.status !== 'ok') {
    return { ok: false, operations: [], explanation: `Drizzle explain output reports status "${json.status}". Full explanation: ${drizzleOpinion(json)}` }
  }
  const operations = drizzleNormalizeOperations(json)
  if (!operations) {
    return { ok: false, operations: [], explanation: `Drizzle explain output is not a known operation list: ${drizzleOpinion(json)}` }
  }
  const normalized = operations.map(drizzleOperationTarget)
  for (const operation of normalized) {
    const lowered = drizzleLowerType(operation.type)
    // Defensive gate: only creation of the manifest table passes. A fresh
    // table arrives as create_table (+ create_index for declared indexes).
    // add_column passes only next to a create_table for the manifest table
    // (part of the table creation); a lone add-column means an existing
    // table is being altered. Every other create/add type (enum, schema,
    // sequence, role, policy, view, FK, unique, PK, check, ...) and every
    // drop, alter, rename, recreate, move, revoke, or grant fails the gate.
    const isCreate = lowered.startsWith('create-') || lowered.startsWith('add-')
    const isDestructive = lowered.startsWith('drop-') || lowered.startsWith('alter-') || lowered.startsWith('rename-') || lowered.startsWith('recreate-') || lowered.startsWith('move-') || lowered.includes('revoke') || lowered.includes('grant') || lowered === 'raw-sql' || lowered === 'unknown'
    if (!isCreate || isDestructive || !drizzleAllowedOpTypes.has(lowered)) {
      return { ok: false, operations: normalized, explanation: `Rejected Drizzle operation type "${operation.type}": only creation of table "${expectedTable}" is allowed. Full explanation: ${drizzleOpinion(json)}` }
    }
    if (operation.table !== expectedTable) {
      return { ok: false, operations: normalized, explanation: `Rejected Drizzle operation on table "${operation.table ?? '(unknown)'}": only table "${expectedTable}" is allowed. Full explanation: ${drizzleOpinion(json)}` }
    }
  }
  if (normalized.length === 0) {
    return { ok: false, operations: normalized, explanation: `Drizzle explain output contains no operations for table "${expectedTable}". Full explanation: ${drizzleOpinion(json)}` }
  }
  // add-column passes only as part of a new-table creation, i.e. next to a
  // create-table for the manifest table. A lone add-column means the table
  // already exists and is being altered, which the gate rejects.
  const hasCreateTable = normalized.some((operation) => drizzleLowerType(operation.type) === 'create-table')
  if (!hasCreateTable && normalized.some((operation) => drizzleLowerType(operation.type) === 'add-column')) {
    return { ok: false, operations: normalized, explanation: `Rejected Drizzle add-column without creation of table "${expectedTable}". Full explanation: ${drizzleOpinion(json)}` }
  }
  void expectedColumns
  return { ok: true, operations: normalized }
}

function drizzleListMigrationDirs(root) {
  const drizzleDir = resolve(root, drizzleOutRelative)
  let entries
  try {
    entries = readdirSync(drizzleDir, { withFileTypes: true })
  } catch (error) {
    throw new Error(`Cannot list migration directories in ${drizzleDir}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return entries.filter((entry) => entry.isDirectory() && entry.name !== 'meta').map((entry) => entry.name).sort()
}

export function selectNewMigration({ root, before }) {
  const outputRoot = resolve(root ?? repoRoot)
  const beforeSet = new Set(Array.isArray(before) ? before : [])
  const after = drizzleListMigrationDirs(outputRoot)
  const created = after.filter((name) => !beforeSet.has(name))
  if (created.length !== 1) {
    throw new Error(`Expected exactly one new migration directory, found ${created.length}: ${created.join(', ') || '(none)'}`)
  }
  const dir = resolve(outputRoot, drizzleOutRelative, created[0])
  let entries
  try {
    entries = readdirSync(dir)
  } catch (error) {
    throw new Error(`Cannot read new migration directory ${dir}: ${error instanceof Error ? error.message : String(error)}`)
  }
  const sqlName = entries.filter((name) => name.endsWith('.sql')).sort()[0]
  if (!sqlName) throw new Error(`New migration directory has no SQL file: ${dir}`)
  const sqlPath = resolve(dir, sqlName)
  const sql = readFileSync(sqlPath, 'utf8')
  const journalPath = resolve(outputRoot, drizzleJournalRelative)
  let journalEntry = null
  try {
    const journal = JSON.parse(readFileSync(journalPath, 'utf8'))
    const journalEntries = Array.isArray(journal?.entries) ? journal.entries : []
    journalEntry = journalEntries.find((entry) => entry?.tag === created[0]) ?? null
  } catch {
    journalEntry = null
  }
  return { dir, sql, journalEntry }
}

export function rollbackInvocation({ root, createdFiles, ownerBytes }) {
  const outputRoot = resolve(root ?? repoRoot)
  const created = Array.isArray(createdFiles) ? createdFiles : []
  const restored = []
  const remaining = []
  for (const file of created) {
    const path = typeof file === 'string' ? file : file?.path
    if (!path) continue
    try {
      if (existsSync(path)) unlinkSync(path)
      restored.push(path)
    } catch {
      remaining.push(path)
    }
  }
  const entries = ownerBytes instanceof Map ? [...ownerBytes.entries()] : isObject(ownerBytes) ? Object.entries(ownerBytes) : []
  for (const [path, original] of entries) {
    try {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, original)
      restored.push(path)
    } catch {
      remaining.push(path)
    }
  }
  void outputRoot
  return { restored, remaining }
}

function integrationOwnerRelPaths(config) {
  return [
    'apps/api/src/authorization/catalog.ts',
    'apps/api/src/domains.ts',
    ...(config.navigation ? ['apps/web/src/manifest/navigation.ts'] : []),
    ...(config.seed ? ['apps/api/scripts/seed.ts'] : []),
  ]
}

function integrationOwnerPaths(config, outputRoot) {
  return integrationOwnerRelPaths(config).map((path) => resolve(outputRoot, path)).sort((left, right) => left.localeCompare(right))
}

export function scaffold(value, { root = repoRoot } = {}) {
  const config = validateConfig(value)
  const outputRoot = resolve(root)
  const files = filesFor(config, outputRoot)
  const metadata = moduleMetadata(config)
  const generated = files.map((file) => file.path).sort((left, right) => left.localeCompare(right))
  const integration = integrationOwnerPaths(config, outputRoot)
  const manual = [resolve(outputRoot, 'apps/web/src/route-map.d.ts')]

  writeFiles(files, outputRoot)

  // Navigation file handling stays conditional: integrate only the List
  // navigation entry, and keep the owner path only when List is selected.
  return {
    generated,
    integration,
    manual,
    routes: metadata.routes,
    permissions: Object.fromEntries(Object.entries(config.actions).map(([action, entry]) => [action, entry.permission])),
    redirects: config.redirects,
    selectedActions: config.selectedActions,
    technicalDependencies: config.technicalDependencies,
    checks: {
      apiTest: resolve(outputRoot, `apps/api/src/routes/(authenticated)/${config.slug}/${config.slug}.routes.spec.ts`),
      apiTypeCheck: 'pnpm --filter @southneuhof/api type-check',
      webTypeCheck: 'pnpm --filter @southneuhof/framework-web type-check',
      webTests: config.navigation
        ? [resolve(outputRoot, `apps/web/src/routes/(authenticated)/${config.navigation.group}/${config.slug}/${config.slug}.integration.spec.ts`)]
        : [],
    },
  }
}

function parseArgs(argv) {
  let manifestPath
  let configAliasPath
  let outputRoot
  let json = false
  let check = false
  let apply = false
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--check') {
      check = true
    } else if (argument === '--apply') {
      apply = true
    } else if (argument === '--json') {
      json = true
    } else if (argument === '--manifest' || argument === '--config') {
      const value = argv[index + 1]
      index += 1
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a JSON file path.`)
      if (argument === '--manifest') manifestPath = value
      else configAliasPath = value
    } else if (argument === '--root') {
      outputRoot = argv[index + 1]
      index += 1
      if (!outputRoot || outputRoot.startsWith('--')) throw new Error('--root requires an output directory.')
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  if (check && apply) throw new Error('--check and --apply are mutually exclusive.')
  if (manifestPath !== undefined && configAliasPath !== undefined && manifestPath !== configAliasPath) {
    throw new Error('--manifest and --config must match when both are given.')
  }
  const configPath = manifestPath ?? configAliasPath
  if (!configPath) throw new Error('Usage: pnpm scaffold:bounded-module -- --manifest <path> [--check|--apply] [--root <directory>] [--json] (--config is a deprecated alias for --manifest)')
  return { configPath, outputRoot, json, check, apply }
}

export function describeBoundedModule(value, { root = repoRoot } = {}) {
  // Read-only preview for --check (plan 018 section 6). Pure path math and
  // validation only; never touches the filesystem, so tests assert no writes.
  const config = Object.hasOwn(value ?? {}, 'selectedActions') ? value : validateConfig(value)
  const outputRoot = resolve(root)
  const generated = filesFor(config, outputRoot).map((file) => file.path).sort((left, right) => left.localeCompare(right))
  const integration = integrationOwnerPaths(config, outputRoot)
  const migrationIntent = { table: config.table, columns: ['id', ...config.fields.map((field) => field.column)] }
  const seed = { registered: config.seed !== null && config.seed !== undefined }
  const hasApiAction = ['list', 'detail', 'create', 'update', 'delete'].some((action) => config.selectedActions.includes(action))
  const apiTest = hasApiAction
    ? { path: resolve(outputRoot, `apps/api/src/routes/(authenticated)/${config.slug}/${config.slug}.routes.spec.ts`) }
    : { manual: 'no API action selected' }
  const browserPath = resolve(outputRoot, `apps/web/e2e/${config.slug}.spec.ts`)
  const browserReason = browserManualReason(config)
  const browserTest = browserReason === null ? { path: browserPath } : { manual: browserReason }
  return {
    selectedActions: config.selectedActions,
    technicalDependencies: config.technicalDependencies,
    generated,
    integration,
    migrationIntent,
    seed,
    apiTest,
    browserTest,
    unsupported: config.unsupported,
  }
}

function output(result, json) {
  if (json) return JSON.stringify(result, null, 2)
  if (result.status === 'VALID' && result.preview) {
    const preview = result.preview
    const line = (label, value) => `${label}: ${value}`
    return [
      'Selected actions:',
      ...preview.selectedActions.map((action) => `- ${action}`),
      '',
      'Technical dependencies:',
      ...(preview.technicalDependencies.length ? preview.technicalDependencies.map((entry) => `- ${entry.action} ${entry.path} (${entry.permission})`) : ['- none']),
      '',
      'Generated files:',
      ...preview.generated.map((path) => `- ${path}`),
      '',
      'Integration files:',
      ...preview.integration.map((path) => `- ${path}`),
      '',
      `Migration intent: table ${preview.migrationIntent.table} columns ${preview.migrationIntent.columns.join(', ')}`,
      '',
      line('Seed', preview.seed.registered ? 'registered' : 'omitted'),
      line('API test', preview.apiTest.path ?? `manual: ${preview.apiTest.manual}`),
      line('Browser test', preview.browserTest.path ?? `manual: ${preview.browserTest.manual}`),
      '',
      'Manual work:',
      ...(preview.unsupported.length ? preview.unsupported.map((entry) => `- ${entry}`) : ['- none']),
    ].join('\n')
  }
  if (result.status === 'VALID') return 'Manifest VALID (no files written)'
  return [
    'Generated files:',
    ...result.generated.map((path) => `- ${path}`),
    '',
    'Integration files:',
    ...result.integration.map((path) => `- ${path}`),
    '',
    'Manual files:',
    ...result.manual.map((path) => `- ${path}`),
    '',
    'Routes:',
    ...Object.entries(result.routes).map(([key, value]) => `- ${key}: ${value}`),
    '',
    'Permissions:',
    ...Object.entries(result.permissions).map(([key, value]) => `- ${key}: ${value}`),
  ].join('\n')
}

const boundedHelp = 'Usage: pnpm scaffold:bounded-module -- --manifest <path> [--check|--apply] [--root <directory>] [--json]\n--manifest selects kind: bounded-module (selected actions module) or routes (route files only). --config is a deprecated alias for --manifest.\nExamples:\n  pnpm scaffold:bounded-module -- --manifest <path> --check\n  pnpm scaffold:bounded-module -- --manifest <path> --apply\n--check validates without writes and previews selected actions, technical dependencies, generated paths, integration owners, migration intent, seed, tests, and manual work. --apply runs the transactional sequence and never applies a migration or seed.\nRoutes manifest: { kind: "routes", routes: [{ path, imports?, script?, template? }] }.\npath: repository-relative +server.ts, +scope.ts, or *.route.vue under apps/api/src/routes or apps/web/src/routes.\nimports: [{ binding, from }] for package imports, or [{ binding, path }] for repository-relative source targets.\nscript: agent-supplied TypeScript (required for API). template: required Vue template for web.\nNo database writes. Review scope, access checks, and parent outlets before generation.'

function readManifestConfig(configPath, cwd) {
  const absoluteConfigPath = resolve(cwd, configPath)
  try {
    return JSON.parse(readFileSync(absoluteConfigPath, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot read scaffold config ${absoluteConfigPath}: ${message}`)
  }
}

export function execute(argv, { root = repoRoot, cwd = process.cwd() } = {}) {
  if (argv.includes('--help')) return boundedHelp
  const { configPath, outputRoot, json, check, apply } = parseArgs(argv)
  const config = readManifestConfig(configPath, cwd)
  const targetRoot = outputRoot ? resolve(cwd, outputRoot) : resolve(root)
  if (config?.kind === 'routes') {
    if (apply) throw new Error('use applyBoundedModule() async entrypoint')
    const files = routeFiles(config, targetRoot)
    if (!check) writeFiles(files, targetRoot)
    const result = { status: check ? 'VALID' : 'GENERATED', files, writes: check ? [] : files.map(file => file.path) }
    return json ? JSON.stringify(result, null, 2) : `${result.status}\n${files.map(file => `- ${file.path}\n${file.contents}`).join('\n')}`
  }
  if (apply) throw new Error('use applyBoundedModule() async entrypoint')
  if (check) {
    const preview = describeBoundedModule(config, { root: targetRoot })
    return output({ status: 'VALID', scope: 'manifest', preview, writes: [] }, json)
  }
  return output(scaffold(config, { root: outputRoot ? resolve(cwd, outputRoot) : root }), json)
}

// Plan 018 step 6a: --apply helpers. Pure gates first; the async entrypoint
// below owns the transactional sequence.
export function checkMigrationSql(sql, { table } = {}) {
  const expectedTable = requiredString(table, 'table')
  const text = typeof sql === 'string' ? sql : ''
  if (!text.includes(expectedTable)) {
    return { ok: false, explanation: `Migration SQL does not mention table "${expectedTable}".` }
  }
  const upper = text.toUpperCase()
  for (const forbidden of ['DROP TABLE', 'ALTER TABLE', 'RENAME']) {
    if (upper.includes(forbidden)) {
      return { ok: false, explanation: `Migration SQL contains forbidden operation "${forbidden}" for table "${expectedTable}".` }
    }
  }
  // CREATE TABLE for another table is forbidden; creation of the manifest
  // table itself passes. Match quoted and unquoted identifiers with an
  // optional schema qualifier, and compare only the leaf table name.
  const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)(?:\s*\.\s*(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*))?)/gi
  for (const match of text.matchAll(createTablePattern)) {
    const reference = (match[1] ?? '').trim()
    const leaf = reference.split('.').pop().trim().replace(/^"|"$/g, '')
    if (leaf !== expectedTable) {
      return { ok: false, explanation: `Migration SQL creates unrelated table "${reference}" instead of only "${expectedTable}".` }
    }
  }
  return { ok: true }
}

function applyGitDirtyGuard(root) {
  if (!existsSync(join(root, '.git'))) return
  const status = spawnSync('git', ['status', '--porcelain', '--', 'apps/api/src/routes', 'apps/api/drizzle'], { cwd: root, encoding: 'utf8' })
  if (status.error) throw new Error(`git status check failed: ${status.error.message}`)
  if (status.status !== 0) throw new Error(`git status check failed: ${(status.stderr ?? '').trim()}`)
  const dirty = String(status.stdout ?? '').split('\n').map((line) => line.trim()).filter(Boolean)
  if (dirty.some((line) => line.includes('.entity.ts') || line.includes('drizzle/'))) {
    throw new Error('pre-existing changes under entity or migration path')
  }
}

function snapshotDrizzleDirs(root) {
  const drizzleDir = resolve(root, drizzleOutRelative)
  try {
    return readdirSync(drizzleDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'meta')
      .map((entry) => entry.name)
      .sort()
  } catch (error) {
    if (error instanceof Error && error.code === 'ENOENT') return []
    throw new Error(`Cannot list migration directories in ${drizzleDir}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function snapshotOwnerBytes(config, outputRoot) {
  const ownerBytes = new Map()
  for (const relativePath of integrationOwnerRelPaths(config)) {
    const path = resolve(outputRoot, relativePath)
    if (existsSync(path)) ownerBytes.set(path, readFileSync(path, 'utf8'))
  }
  return ownerBytes
}

function defaultDrizzleRunner({ command, args, cwd, env }) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8' })
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', exitCode: result.status ?? 1 }
}

function failApply({ root, createdFiles, ownerBytes, message, cause }) {
  const rollback = rollbackInvocation({ root, createdFiles, ownerBytes })
  const remaining = rollback.remaining.length ? ` Remaining paths: ${rollback.remaining.join(', ')}.` : ''
  const detail = cause ? ` ${cause}` : ''
  throw new Error(`${message}${detail}${remaining}`)
}

function runDrizzleStep({ runner, command, args, cwd, env, root, createdFiles, ownerBytes, failureLabel }) {
  let result
  try {
    result = runner({ command, args, cwd, env })
  } catch (error) {
    failApply({ root, createdFiles, ownerBytes, message: `${failureLabel} failed:`, cause: error instanceof Error ? error.message : String(error) })
  }
  const failed = result?.status !== 0 || result?.exitCode !== 0
  if (failed || result === undefined || result === null) {
    const detail = result ? `${(result.stderr ?? '').trim()} ${(result.stdout ?? '').trim()}`.trim() : 'no runner result'
    failApply({ root, createdFiles, ownerBytes, message: `${failureLabel} failed:`, cause: detail || 'no runner result' })
  }
  return result
}

export async function applyBoundedModule({ manifest, root = repoRoot, runner = defaultDrizzleRunner, env = process.env } = {}) {
  if (!isObject(manifest)) throw new Error('Scaffold configuration must be a JSON object.')
  const config = validateConfig(manifest)
  const outputRoot = resolve(root)
  // (a) validated above.
  // (b) destination-exists gate before any write.
  const files = filesFor(config, outputRoot)
  checkFiles(files, outputRoot)
  // (c) git-dirty guard via node:child_process, never the Drizzle runner.
  applyGitDirtyGuard(outputRoot)
  // (d) owner anchors via read-only integrate; a missing file throws with the owner path.
  try {
    integrate(manifest, { root: outputRoot, apply: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(message)
  }
  // (e) snapshot owner bytes for the integration owners that exist.
  const ownerBytes = snapshotOwnerBytes(config, outputRoot)
  // (f) snapshot drizzle dirs for the before-list.
  const before = snapshotDrizzleDirs(outputRoot)
  // (g) write new source files only. Owners wait for step (k).
  writeFiles(files, outputRoot)
  const createdFiles = files.map((file) => file.path)
  const drizzleCwd = resolve(outputRoot, 'apps/api')
  const drizzleEnv = { ...env, DATABASE_URL: env?.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/carta' }
  // (h) explain gate.
  const explain = runDrizzleStep({
    runner,
    command: 'node',
    args: ['./node_modules/drizzle-kit/bin.cjs', 'generate', '--explain', '--output', 'json'],
    cwd: drizzleCwd,
    env: drizzleEnv,
    root: outputRoot,
    createdFiles,
    ownerBytes,
    failureLabel: 'Drizzle explain',
  })
  let explainJson
  try {
    explainJson = JSON.parse(String(explain.stdout ?? ''))
  } catch {
    failApply({ root: outputRoot, createdFiles, ownerBytes, message: 'Drizzle explain output is not JSON:', cause: String(explain.stdout ?? '').slice(0, 2000) })
  }
  const gate = { table: config.table, columns: ['id', ...config.fields.map((field) => field.column)] }
  const gated = parseDrizzleExplain(explainJson, gate)
  if (!gated.ok) {
    failApply({ root: outputRoot, createdFiles, ownerBytes, message: 'Drizzle explain reports unrelated operations:', cause: gated.explanation })
  }
  // (i) normal generate.
  runDrizzleStep({
    runner,
    command: 'node',
    args: ['./node_modules/drizzle-kit/bin.cjs', 'generate', '--name', config.slug],
    cwd: drizzleCwd,
    env: drizzleEnv,
    root: outputRoot,
    createdFiles,
    ownerBytes,
    failureLabel: 'Drizzle generate',
  })
  // (j) one new migration directory + SQL gate.
  let migration
  try {
    migration = selectNewMigration({ root: outputRoot, before })
  } catch (error) {
    failApply({ root: outputRoot, createdFiles, ownerBytes, message: 'Migration selection failed:', cause: error instanceof Error ? error.message : String(error) })
  }
  const sqlGate = checkMigrationSql(migration.sql, { table: config.table })
  if (!sqlGate.ok) {
    failApply({ root: outputRoot, createdFiles, ownerBytes, message: 'Migration SQL mismatch:', cause: `${sqlGate.explanation} SQL: ${String(migration.sql).slice(0, 2000)}` })
  }
  // (k) integrate owners last. Never run db:migrate here.
  const integrated = integrate(manifest, { root: outputRoot, apply: true })
  return {
    generated: createdFiles.slice().sort((left, right) => left.localeCompare(right)),
    integration: [...integrated.changed].sort((left, right) => left.localeCompare(right)),
    migration: { dir: migration.dir, sql: migration.sql },
    technicalDependencies: config.technicalDependencies,
    redirects: config.redirects,
  }
}

export async function runApplyCli(argv, { root = repoRoot, cwd = process.cwd(), env = process.env, runner } = {}) {
  if (argv.includes('--help')) return boundedHelp
  const { configPath, outputRoot, json } = parseArgs(argv)
  const manifest = readManifestConfig(configPath, cwd)
  if (manifest?.kind === 'routes') throw new Error('use applyBoundedModule() async entrypoint')
  const result = await applyBoundedModule({ manifest, root: outputRoot ? resolve(cwd, outputRoot) : resolve(root), runner, env })
  if (json) return JSON.stringify(result, null, 2)
  return [
    'Migration:',
    `- ${result.migration.dir}`,
    result.migration.sql,
    '',
    'Generated files:',
    ...result.generated.map((path) => `- ${path}`),
    '',
    'Integration files:',
    ...result.integration.map((path) => `- ${path}`),
  ].join('\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  const main = async () => {
    if (argv.includes('--help')) {
      console.log(execute(argv))
      return
    }
    const { apply } = parseArgs(argv)
    if (!apply) {
      console.log(execute(argv))
      return
    }
    console.log(await runApplyCli(argv, { cwd: process.cwd(), env: process.env }))
  }
  main().catch((error) => {
    console.error(`scaffold-bounded-module: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
