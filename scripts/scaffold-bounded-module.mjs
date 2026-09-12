#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const identifierPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const symbolPattern = /^[A-Z][A-Za-z0-9]*$/
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const tablePattern = /^[a-z][a-z0-9_]*$/
const supportedTypes = new Set(['text', 'boolean', 'number'])
const permissionActions = ['list', 'detail', 'create', 'update', 'delete']
const resourceActions = ['list', 'detail', 'create', 'update']
const labelKeys = ['listTitle', 'detailTitle', 'createTitle', 'editTitle', 'submitLabel']
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

function validateOptions(field) {
  if (field.options === undefined) return
  if (!Array.isArray(field.options)) throw new Error(`Field "${field.key}" options must be an array.`)
  for (const [index, option] of field.options.entries()) {
    if (!isObject(option) || !('id' in option) || typeof option.name !== 'string' || option.name.trim() === '') {
      throw new Error(`Field "${field.key}" option ${index + 1} must have id and name.`)
    }
    knownKeys(option, ['id', 'name'], `Field ${field.key} option`)
    if (field.type === 'boolean' && typeof option.id !== 'boolean') {
      throw new Error(`Field "${field.key}" option ${index + 1} id must be boolean.`)
    }
    if (field.type === 'text' && typeof option.id !== 'string') {
      throw new Error(`Field "${field.key}" option ${index + 1} id must be text.`)
    }
    if (field.type === 'number' && (typeof option.id !== 'number' || !Number.isFinite(option.id))) {
      throw new Error(`Field "${field.key}" option ${index + 1} id must be a finite number.`)
    }
  }
}

function validateLabels(value) {
  if (!isObject(value)) throw new Error('labels is required.')
  knownKeys(value, labelKeys, 'labels')
  const labels = Object.fromEntries(labelKeys.map((key) => [key, requiredString(value[key], `labels.${key}`)]))
  return labels
}

function validatePermissions(value) {
  if (!isObject(value)) throw new Error('permissions is required.')
  knownKeys(value, ['moduleName', 'realm', 'entries'], 'permissions')
  const moduleName = requiredString(value.moduleName, 'permissions.moduleName')
  const realm = requiredString(value.realm, 'permissions.realm')
  if (realm !== 'system') throw new Error('The bounded generator supports only system permissions; use a normal module plan for scoped access.')
  if (!isObject(value.entries)) throw new Error('permissions.entries is required.')
  knownKeys(value.entries, permissionActions, 'permissions.entries')
  const entries = Object.fromEntries(permissionActions.map((action) => {
    const entry = value.entries[action]
    if (!isObject(entry)) throw new Error(`permissions.entries.${action} is required for this full CRUD generator; use a normal module plan for an action subset.`)
    knownKeys(entry, ['name', 'description'], `permissions.entries.${action}`)
    return [action, {
      name: requiredString(entry.name, `permissions.entries.${action}.name`),
      description: requiredString(entry.description, `permissions.entries.${action}.description`),
    }]
  }))
  return { moduleName, realm, entries }
}

function validateNavigation(value) {
  if (!isObject(value)) throw new Error('navigation is required.')
  knownKeys(value, ['group', 'after', 'before', 'title', 'icon', 'separator'], 'navigation')
  const group = requiredString(value.group, 'navigation.group')
  if (!slugPattern.test(group)) throw new Error('navigation.group must be a route segment.')
  const hasAfter = value.after !== undefined && value.after !== null
  const hasBefore = value.before !== undefined && value.before !== null
  if (hasAfter === hasBefore) throw new Error('navigation requires exactly one of after or before.')
  const position = hasAfter ? 'after' : 'before'
  const anchor = requiredString(value[position], `navigation.${position}`)
  const title = requiredString(value.title, 'navigation.title')
  const icon = requiredString(value.icon, 'navigation.icon')
  if (value.separator !== undefined && value.separator !== null) requiredString(value.separator, 'navigation.separator')
  return { group, position, anchor, title, icon, separator: value.separator ?? null }
}

function validateSeed(value, { identity, fields }) {
  if (value === undefined || value === null) return null
  if (!isObject(value)) throw new Error('seed must be an object when provided.')
  knownKeys(value, ['records', 'updateFields'], 'seed')
  if (!Array.isArray(value.records) || value.records.length === 0) throw new Error('seed.records must be a non-empty array when seed is provided.')
  if (!Array.isArray(value.updateFields) || value.updateFields.length === 0) throw new Error('seed.updateFields must be a non-empty array when seed is provided.')
  const allowedKeys = new Set([identity.key, ...fields.map((field) => field.key)])
  const updateFields = value.updateFields.map((key, index) => identifier(key, `seed.updateFields[${index}]`))
  if (new Set(updateFields).size !== updateFields.length) throw new Error('seed.updateFields must be unique.')
  for (const key of updateFields) {
    if (!allowedKeys.has(key) || key === identity.key) throw new Error(`seed.updateFields contains unsupported field "${key}".`)
  }
  const records = value.records.map((record, index) => {
    if (!isObject(record)) throw new Error(`seed.records[${index}] must be an object.`)
    if (!Object.hasOwn(record, identity.key)) throw new Error(`seed.records[${index}] must include ${identity.key}.`)
    for (const key of Object.keys(record)) {
      if (!allowedKeys.has(key)) throw new Error(`seed.records[${index}] contains unsupported field "${key}".`)
    }
    return record
  })
  return { records, updateFields }
}

function validateField(value, name, { domain }) {
  if (!isObject(value)) throw new Error(`${name} must be an object.`)
  knownKeys(value, ['key', 'type', 'column', 'required', 'default', ...(domain ? ['label', 'renderer', 'options'] : [])], name)
  if (!domain && value.required && !Object.hasOwn(value, 'default')) throw new Error(`${name} requires a default; use a normal module plan for server-computed fields.`)
  const key = identifier(value.key, `${name}.key`)
  const type = requiredString(value.type, `${name}.type`)
  if (!supportedTypes.has(type)) throw new Error(`${name}.type "${type}" is unsupported; use text, boolean, or number.`)

  if (domain) {
    requiredString(value.label, `${name}.label`)
    const renderer = requiredString(value.renderer, `${name}.renderer`)
    if (!renderersByType[type].has(renderer)) throw new Error(`${name}.renderer "${renderer}" is not valid for ${type}.`)
  }

  if (value.required !== undefined && typeof value.required !== 'boolean') throw new Error(`${name}.required must be boolean.`)
  if (Object.hasOwn(value, 'default')) {
    const expected = type === 'boolean' ? 'boolean' : type === 'number' ? 'number' : 'string'
    if (typeof value.default !== expected) throw new Error(`${name}.default must be ${expected}.`)
    if (type === 'number' && !Number.isFinite(value.default)) throw new Error(`${name}.default must be a finite number.`)
  }
  if (value.column !== undefined) databaseName(value.column, `${name}.column`, '')
  validateOptions({ ...value, key, type })

  return {
    ...value,
    key,
    type,
    column: databaseName(value.column, `${name}.column`, snakeCase(key)),
  }
}

function validateActionFields(value, fields) {
  const fieldKeys = fields.map((field) => field.key)
  const defaults = Object.fromEntries(resourceActions.map((action) => [action, [...fieldKeys]]))
  if (value === undefined || value === null) return defaults
  if (!isObject(value)) throw new Error('actionFields must be an object when provided.')

  for (const action of Object.keys(value)) {
    if (!resourceActions.includes(action)) throw new Error(`actionFields.${action} is unsupported.`)
  }

  return Object.fromEntries(resourceActions.map((action) => {
    const configured = value[action]
    if (configured === undefined) return [action, defaults[action]]
    if (!Array.isArray(configured)) throw new Error(`actionFields.${action} must be an array.`)
    const keys = configured.map((key, index) => identifier(key, `actionFields.${action}[${index}]`))
    if (new Set(keys).size !== keys.length) throw new Error(`actionFields.${action} must contain unique fields.`)
    for (const key of keys) {
      if (!fieldKeys.includes(key)) throw new Error(`actionFields.${action} contains unsupported field "${key}".`)
    }
    return [action, keys]
  }))
}

export function validateConfig(value) {
  if (!isObject(value)) throw new Error('Scaffold configuration must be a JSON object.')
  knownKeys(value, ['kind', 'slug', 'table', 'symbol', 'title', 'identity', 'fields', 'actionFields', 'serverFields', 'auditFields', 'labels', 'permissions', 'navigation', 'seed'], 'manifest')

  if (value.kind !== 'bounded-module') throw new Error('kind must be bounded-module.')
  const slug = requiredString(value.slug, 'slug')
  if (!slugPattern.test(slug)) throw new Error('slug must contain lowercase letters, numbers, and single hyphens.')
  const table = databaseName(requiredString(value.table, 'table'), 'table', '')
  const symbol = requiredString(value.symbol, 'symbol')
  if (!symbolPattern.test(symbol)) throw new Error('symbol must be a PascalCase identifier.')
  const title = requiredString(value.title, 'title')

  if (!isObject(value.identity)) throw new Error('identity is required.')
  knownKeys(value.identity, ['key', 'type', 'column', 'primary', 'generated'], 'identity')
  const identity = {
    ...value.identity,
    key: identifier(value.identity.key, 'identity.key'),
    type: requiredString(value.identity.type, 'identity.type'),
    column: databaseName(value.identity.column, 'identity.column', snakeCase(value.identity.key)),
  }
  if (identity.type !== 'text') throw new Error('identity.type must be text.')
  if (identity.primary !== true) throw new Error('identity.primary must be true.')
  if (identity.generated !== 'uuid') throw new Error('identity.generated must be uuid.')

  if (!Array.isArray(value.fields) || value.fields.length === 0) throw new Error('fields must be a non-empty array.')
  const fields = value.fields.map((field, index) => validateField(field, `fields[${index}]`, { domain: true }))
  const actionFields = validateActionFields(value.actionFields, fields)
  const explicitFields = (key) => {
    if (value[key] === undefined) return []
    if (!Array.isArray(value[key])) throw new Error(`${key} must be an array when provided.`)
    return value[key].map((field, index) => validateField(field, `${key}[${index}]`, { domain: false }))
  }
  const serverFields = explicitFields('serverFields')
  const auditFields = explicitFields('auditFields')
  const keys = [identity.key, ...fields, ...serverFields, ...auditFields].map((field) => typeof field === 'string' ? field : field.key)
  if (new Set(keys).size !== keys.length) throw new Error('Field keys, including identity and server fields, must be unique.')

  const labels = validateLabels(value.labels)
  if (labels.listTitle !== title) throw new Error('labels.listTitle must match title.')
  const permissions = validatePermissions(value.permissions)
  const navigation = validateNavigation(value.navigation)
  const seed = validateSeed(value.seed, { identity, fields })

  return { kind: value.kind, slug, table, symbol, title, identity, fields, actionFields, serverFields, auditFields, labels, permissions, navigation, seed }
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
  const routes = {
    list: `${config.navigation.group}-${config.slug}`,
    detail: `${config.navigation.group}-${config.slug}-detail`,
    create: `${config.navigation.group}-${config.slug}-create`,
    edit: `${config.navigation.group}-${config.slug}-edit`,
  }
  const permissions = Object.fromEntries(permissionActions.map((action) => [action, `${action}-${config.slug}`]))
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
  const allFields = [...config.fields, ...config.serverFields, ...config.auditFields]
  const imports = ['boolean', 'doublePrecision', 'pgTable', 'text'].filter((value) => {
    if (value === 'boolean') return allFields.some((field) => field.type === 'boolean')
    if (value === 'doublePrecision') return allFields.some((field) => field.type === 'number')
    return true
  })
  const identity = `${config.identity.key}: text(${literal(config.identity.column)}).primaryKey().$defaultFn(() => crypto.randomUUID()),`
  const writeKeys = [config.identity.key, ...config.serverFields, ...config.auditFields].map((field) => typeof field === 'string' ? field : field.key)
  const write = writeKeys.map((key) => `${key}: true`).join(', ')
  const plural = `${lowerCamel(config.symbol)}s`

  return `import { createEntity } from '@southneuhof/sprindle/entity'
import { ${imports.join(', ')} } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'

export const ${plural} = pgTable(${literal(config.table)}, {
  ${identity}
${allFields.map(tableColumn).map((line) => `  ${line}`).join('\n')}
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

function renderServer(config, action) {
  const helper = action === 'delete' ? 'deleteRoute' : action
  const segment = ['detail', 'update', 'delete'].includes(action) ? `${action}/[id]` : action
  const identityPath = importPath(`apps/api/src/routes/(authenticated)/${config.slug}/${segment}/+server.ts`, 'apps/api/src/identity.ts')
  return `import { ${helper} } from '@southneuhof/sprindle'
import { requirePermission } from '${identityPath}'

export const ${action === 'create' ? 'POST' : action === 'update' ? 'PATCH' : action === 'delete' ? 'DELETE' : 'GET'} = ${helper}({ authorize: requirePermission('${action}-${config.slug}') })
`
}

function renderRouteTest(config) {
  return `import { describe, expect, it } from 'vitest'
import { app } from '../../../app'

describe(${literal(`${config.title} routes`)}, () => {
  it('requires authentication', async () => {
    expect((await app.request('/${config.slug}/list')).status).toBe(401)
  })
})
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

function renderResource(config) {
  const entity = lowerCamel(config.symbol)
  const plural = `${entity}s`
  const metadata = moduleMetadata(config)
  const routeParam = metadata.routeParam
  const fieldKeys = (action) => config.actionFields[action].map((key) => `fields.${key}`).join(', ')
  const initial = config.fields
    .filter((field) => Object.hasOwn(field, 'default'))
    .map((field) => `${field.key}: ${literal(field.default)}`)
    .join(', ')
  const initialData = initial ? `\n      initialData: { ${initial} },` : ''

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
    list: {
      run: api.list,
      fields: [${fieldKeys('list')}],
      permission: '${metadata.permissions.list}',
      route: { name: '${metadata.routes.list}' },
    },
    detail: {
      run: api.detail,
      fields: [${fieldKeys('detail')}],
      permission: '${metadata.permissions.detail}',
      route: { name: '${metadata.routes.detail}', params: (id) => ({ ${routeParam}: String(id) }) },
      title: ${literal(config.labels.detailTitle)},
    },
    create: {
      run: api.create,
      fields: [${fieldKeys('create')}],
      permission: '${metadata.permissions.create}',
      route: { name: '${metadata.routes.create}' },${initialData}
    },
    update: {
      run: api.update,
      fields: [${fieldKeys('update')}],
      permission: '${metadata.permissions.update}',
      route: { name: '${metadata.routes.edit}', params: (id) => ({ ${routeParam}: String(id) }) },
    },
    delete: { run: api.delete, permission: '${metadata.permissions.delete}' },
  },
})

export type { ${config.symbol}, ${config.symbol}Create, ${config.symbol}Update } from './${config.slug}.schema'
`
}

function renderResourceTest(config) {
  const entity = lowerCamel(config.symbol)
  const plural = `${entity}s`
  const metadata = moduleMetadata(config)
  const routeParam = metadata.routeParam
  const keys = Object.fromEntries(resourceActions.map((action) => [action, literal(config.actionFields[action])]))
  return `import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createFrameworkQueryClient, registerResourceRuntime, resetResourceRuntimeForTests, resolveFields, resolveFrameworkAdapters, resolveFrameworkFieldDefaults } from '@southneuhof/loom'
import { appFieldDefaults } from '@/configs/defaults'
import { ${plural} } from './${config.slug}.resource'

beforeEach(() => registerResourceRuntime({ adapters: resolveFrameworkAdapters(), queryClient: createFrameworkQueryClient(), fieldDefaults: resolveFrameworkFieldDefaults(appFieldDefaults) }))
afterEach(() => resetResourceRuntimeForTests())

function fields(value: unknown, surface: 'form' | 'table' | 'detail') {
  return resolveFields({ fields: value as never, surface, defaultFields: resolveFrameworkFieldDefaults(appFieldDefaults).fields })
}

describe(${literal(`${config.title} resource`)}, () => {
  it('exposes only the configured domain fields', () => {
    expect(fields(${plural}.list().fields, 'table').map((field) => field.key)).toEqual(${keys.list})
    expect(fields(${plural}.detail({ id: '1' }).fields, 'detail').map((field) => field.key)).toEqual(${keys.detail})
    expect(fields(${plural}.create().fields, 'form').map((field) => field.key)).toEqual(${keys.create})
    expect(fields(${plural}.update({ id: '1' }).fields, 'form').map((field) => field.key)).toEqual(${keys.update})
  })

  it('maps standard CRUD routes', () => {
    const list = ${plural}.list()
    expect(list.createRoute).toEqual({ name: '${metadata.routes.create}' })
    expect(list.detailRoute?.({ id: '1' } as never)).toEqual({ name: '${metadata.routes.detail}', params: { ${routeParam}: '1' } })
    expect(list.updateRoute?.({ id: '1' } as never)).toEqual({ name: '${metadata.routes.edit}', params: { ${routeParam}: '1' } })
    expect(${plural}.delete({ id: '1' })).toHaveProperty('run')
  })
})
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
    edit: `<script setup lang="ts">
import { useRoute } from 'vue-router'
import { FormView } from '@southneuhof/loom'
import { ${plural} } from '../${config.slug}.resource'

const route = useRoute('${metadata.routes.edit}')
</script>

<template><FormView v-bind="${plural}.update({ id: String(route.params.${routeParam}) })" title="${editTitle}" submit-label="${submitLabel}" /></template>
`,
  }
}

function renderIntegrationTest(config) {
  const metadata = moduleMetadata(config)
  return `import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import { navigation } from '@/manifest/navigation'

const router = createRouter({ history: createMemoryHistory(), routes })

describe(${literal(`${config.title} route integration`)}, () => {
  it('registers the standard route tree and navigation entry', () => {
    expect(router.resolve('/${config.navigation.group}/${config.slug}').name).toBe('${metadata.routes.list}')
    expect(router.resolve('/${config.navigation.group}/${config.slug}/create').name).toBe('${metadata.routes.create}')
    expect(router.resolve('/${config.navigation.group}/${config.slug}/record-1/detail').name).toBe('${metadata.routes.detail}')
    expect(router.resolve('/${config.navigation.group}/${config.slug}/record-1/edit').name).toBe('${metadata.routes.edit}')

    const group = navigation.find((module) => module.name === '${config.navigation.group}')
    expect(group?.routes).toContainEqual({
      to: { name: '${metadata.routes.list}' },
      permission: '${metadata.permissions.list}',
      title: ${literal(config.navigation.title)},
      icon: ${literal(config.navigation.icon)},
    })
  })
})
`
}

function filesFor(config, root) {
  const apiRoot = `apps/api/src/routes/(authenticated)/${config.slug}`
  const apiFileRoot = apiRoot
  const webRoot = `apps/web/src/routes/(authenticated)/${config.navigation.group}/${config.slug}`
  const routeRoot = `${webRoot}/[${lowerCamel(config.symbol)}Id]`
  const routes = renderRoutes(config)
  const files = [
    [`${apiRoot}/${config.slug}.entity.ts`, renderEntity(config)],
    [`${apiRoot}/${config.slug}.ts`, renderRoute(config)],
    [`${apiRoot}/${config.slug}.routes.spec.ts`, renderRouteTest(config)],
    [`${apiFileRoot}/+scope.ts`, renderScope(config)],
    [`${apiFileRoot}/list/+server.ts`, renderServer(config, 'list')],
    [`${apiFileRoot}/detail/[id]/+server.ts`, renderServer(config, 'detail')],
    [`${apiFileRoot}/create/+server.ts`, renderServer(config, 'create')],
    [`${apiFileRoot}/update/[id]/+server.ts`, renderServer(config, 'update')],
    [`${apiFileRoot}/delete/[id]/+server.ts`, renderServer(config, 'delete')],
    [`${webRoot}/${config.slug}.schema.ts`, renderSchema(config)],
    [`${webRoot}/${config.slug}.resource.ts`, renderResource(config)],
    [`${webRoot}/${config.slug}.resource.spec.ts`, renderResourceTest(config)],
    [`${webRoot}/index.route.vue`, routes.index],
    [`${webRoot}/create.route.vue`, routes.create],
    [`${webRoot}/${config.slug}.integration.spec.ts`, renderIntegrationTest(config)],
    [`${routeRoot}/detail.route.vue`, routes.detail],
    [`${routeRoot}/edit.route.vue`, routes.edit],
  ]
  const seed = renderSeed(config)
  if (seed) files.push([`${apiRoot}/${config.slug}.seed.ts`, seed])
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
  const value = config.navigation?.position ? config : validateConfig(config)
  return filesFor(value, resolve(root)).map((file) => file.path).sort((left, right) => left.localeCompare(right))
}

export function scaffold(value, { root = repoRoot } = {}) {
  const config = validateConfig(value)
  const outputRoot = resolve(root)
  const files = filesFor(config, outputRoot)
  const metadata = moduleMetadata(config)
  const generated = files.map((file) => file.path).sort((left, right) => left.localeCompare(right))
  const integration = [
    'apps/api/src/authorization/catalog.ts',
    'apps/api/src/domains.ts',
    'apps/web/src/manifest/navigation.ts',
    ...(config.seed ? ['apps/api/scripts/seed.ts'] : []),
  ].map((path) => resolve(outputRoot, path)).sort((left, right) => left.localeCompare(right))
  const manual = [resolve(outputRoot, 'apps/web/src/route-map.d.ts')]

  writeFiles(files, outputRoot)

  return {
    generated,
    integration,
    manual,
    routes: metadata.routes,
    permissions: metadata.permissions,
    checks: {
      apiTest: resolve(outputRoot, `apps/api/src/routes/(authenticated)/${config.slug}/${config.slug}.routes.spec.ts`),
      webTests: [
        resolve(outputRoot, `apps/web/src/routes/(authenticated)/${config.navigation.group}/${config.slug}/${config.slug}.resource.spec.ts`),
        resolve(outputRoot, `apps/web/src/routes/(authenticated)/${config.navigation.group}/${config.slug}/${config.slug}.integration.spec.ts`),
      ],
      apiTypeCheck: 'pnpm --filter @southneuhof/api type-check',
      webTypeCheck: 'pnpm --filter @southneuhof/framework-web type-check',
    },
  }
}

function parseArgs(argv) {
  let configPath
  let outputRoot
  let json = false
  let check = false
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--check') {
      check = true
    } else if (argument === '--json') {
      json = true
    } else if (argument === '--config') {
      configPath = argv[index + 1]
      index += 1
      if (!configPath || configPath.startsWith('--')) throw new Error('--config requires a JSON file path.')
    } else if (argument === '--root') {
      outputRoot = argv[index + 1]
      index += 1
      if (!outputRoot || outputRoot.startsWith('--')) throw new Error('--root requires an output directory.')
    } else {
      throw new Error(`Unknown argument: ${argument}`)
    }
  }
  if (!configPath) throw new Error('Usage: node scripts/scaffold-bounded-module.mjs --config <file.json> [--root <directory>] [--check] [--json]')
  return { configPath, outputRoot, json, check }
}

function output(result, json) {
  if (json) return JSON.stringify(result, null, 2)
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

export function execute(argv, { root = repoRoot, cwd = process.cwd() } = {}) {
  if (argv.includes('--help')) return 'Usage: node scripts/scaffold-bounded-module.mjs --config <file.json> [--root <directory>] [--check] [--json]\n--config selects kind: bounded-module (complete CRUD module) or routes (route files only).\n--check validates without writes; routes also previews paths and source. Otherwise creates files without overwriting.\nRoutes manifest: { kind: "routes", routes: [{ path, imports?, script?, template? }] }.\npath: repository-relative +server.ts, +scope.ts, or *.route.vue under apps/api/src/routes or apps/web/src/routes.\nimports: [{ binding, from }] for package imports, or [{ binding, path }] for repository-relative source targets.\nscript: agent-supplied TypeScript (required for API). template: required Vue template for web.\nNo database writes. Review scope, access checks, and parent outlets before generation.'
  const { configPath, outputRoot, json, check } = parseArgs(argv)
  const absoluteConfigPath = resolve(cwd, configPath)
  let config
  try {
    config = JSON.parse(readFileSync(absoluteConfigPath, 'utf8'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Cannot read scaffold config ${absoluteConfigPath}: ${message}`)
  }
  const targetRoot = outputRoot ? resolve(cwd, outputRoot) : resolve(root)
  if (config?.kind === 'routes') {
    const files = routeFiles(config, targetRoot)
    if (!check) writeFiles(files, targetRoot)
    const result = { status: check ? 'VALID' : 'GENERATED', files, writes: check ? [] : files.map(file => file.path) }
    return json ? JSON.stringify(result, null, 2) : `${result.status}\n${files.map(file => `- ${file.path}\n${file.contents}`).join('\n')}`
  }
  if (check) { validateConfig(config); return output({ status: 'VALID', scope: 'manifest', writes: [] }, json) }
  return output(scaffold(config, { root: outputRoot ? resolve(cwd, outputRoot) : root }), json)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(execute(process.argv.slice(2)))
  } catch (error) {
    console.error(`scaffold-bounded-module: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
