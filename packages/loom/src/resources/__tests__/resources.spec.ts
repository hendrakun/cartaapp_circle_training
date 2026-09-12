import { afterEach, describe, expect, it } from 'vitest'
import type { CollectionResult, WebResourceSchema } from '../../contracts'
import { createFrameworkQueryClient } from '../../query/client'
import { resolveFrameworkAdapters } from '../../adapters/projectAdapters'
import { resolveFrameworkFieldDefaults } from '../../fields/defaults'
import { resolveFields } from '../../fields/resolve'
import { defineFields } from '../../fields/defineFields'
import { createInputPropsRegistry } from '../../renderers/inputProps'
import { defineResource } from '../defineResource'
import { defineSchema } from '../defineSchema'
import { resourceActionForRoute, resetResourceActionRegistry } from '../routeAccess'
import { registerResourceRuntime, resetResourceRuntimeForTests } from '../runtime'

type Row = { id: string; name: string }
type Draft = { name: string }
type Schema = WebResourceSchema<Row, Record<string, never>, Draft, Draft, string>

const schema = defineSchema<Schema>({ identity: 'id' })
const fields = defineFields(schema, {
  name: { label: 'Name', table: { sortable: true }, form: { renderer: 'text' } },
})

type AssetRecord = { id: string; imgThumbnail: string | null }
type AssetDraft = { imgThumbnail?: string | null }
type AssetSchema = WebResourceSchema<AssetRecord, Record<string, never>, AssetDraft, AssetDraft, string>

const assetSchema = defineSchema<AssetSchema>({ identity: 'id' })
const assetFields = defineFields(assetSchema, {
  imgThumbnail: { label: 'Image', form: { renderer: 'image' } },
})

type DefaultRecord = { id: string; name: string; active: boolean }
type DefaultDraft = { name: string; active: boolean }
type DefaultSchema = WebResourceSchema<DefaultRecord, Record<string, never>, DefaultDraft, DefaultDraft, string>

const defaultSchema = defineSchema<DefaultSchema>({ identity: 'id' })
const defaultFields = defineFields(defaultSchema, {
  name: { label: 'Name' },
  active: { label: 'Resource active', form: { renderer: 'text' } },
})

function resource(access = { allows: () => true }) {
  registerResourceRuntime({
    queryClient: createFrameworkQueryClient(),
    adapters: resolveFrameworkAdapters({ access }),
    fieldDefaults: resolveFrameworkFieldDefaults(),
  })
  return defineResource(schema, {
    key: 'records',
    actions: {
      list: {
        run: async (): Promise<CollectionResult<Row>> => ({ data: [{ id: '1', name: 'One' }] }),
        fields: [fields.name],
        permission: 'records.list',
        route: { name: 'records-list' },
      },
      detail: {
        run: async ({ id }) => ({ id, name: 'One' }),
        fields: [fields.name],
        permission: 'records.detail',
        route: { name: 'records-detail', params: (id) => ({ id }) },
        title: 'Detail Record',
      },
      create: {
        run: async (input) => ({ id: '2', ...input }),
        fields: [fields.name],
        permission: 'records.create',
        route: { name: 'records-create' },
      },
      update: {
        run: async (id, input) => ({ id, name: input.name }),
        fields: [fields.name],
        permission: 'records.update',
        route: { name: 'records-edit', params: (id) => ({ id }) },
      },
      delete: {
        run: async () => undefined,
        permission: 'records.delete',
      },
      verify: { run: async (id: string, result: 'approved' | 'rejected') => `${id}:${result}` },
    },
  })
}

afterEach(() => {
  resetResourceRuntimeForTests()
  resetResourceActionRegistry()
})

describe('action resources', () => {
  it('resolves typed default-only keys and keeps resource overrides', () => {
    const fieldDefaults = resolveFrameworkFieldDefaults({
      fields: {
        active: { label: 'Status', form: { renderer: 'switch', initialValue: () => true } },
      },
    })
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults,
    })
    const value = defineResource(defaultSchema, {
      key: 'default-only-fields',
      actions: {
        create: {
          run: async (input) => ({ id: '1', ...input }),
          fields: [defaultFields.name, 'active'],
        },
        update: {
          run: async (id, input) => ({ id, ...input }),
          fields: [defaultFields.name, 'active'],
        },
      },
    })

    const createFields = value.create().fields
    expect(createFields).toEqual([
      expect.objectContaining({ key: 'name' }),
      { key: 'active' },
    ])
    const resolved = resolveFields({ fields: createFields, surface: 'form', defaultFields: fieldDefaults.fields })
    expect(resolved.find((field) => field.key === 'active')).toMatchObject({ label: 'Status', renderer: 'switch' })
    expect(resolved.find((field) => field.key === 'active')?.initialValue?.()).toBe(true)

    const override = defineResource(defaultSchema, {
      key: 'resource-field-override',
      actions: {
        create: {
          run: async (input) => ({ id: '1', ...input }),
          fields: [defaultFields.active.override({ form: { renderer: 'radio' } })],
        },
      },
    })
    const overrideField = resolveFields({ fields: override.create().fields, surface: 'form', defaultFields: fieldDefaults.fields })[0]
    expect(overrideField).toMatchObject({ label: 'Resource active', renderer: 'radio' })
  })

  it('rejects mixed duplicate field selections', () => {
    const value = defineResource(defaultSchema, {
      key: 'duplicate-mixed-fields',
      actions: {
        create: {
          run: async (input) => ({ id: '1', ...input }),
          fields: [defaultFields.name.override({ label: 'Override' }), 'name'],
        },
      },
    })

    expect(() => value.create()).toThrow('duplicate field "name"')
  })

  it('allows equivalent route access contracts and keeps the latest resource key', () => {
    const routeName = 'records-equivalent-route'
    defineResource(schema, {
      key: 'records-project-a',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.detail',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })
    defineResource(schema, {
      key: 'records-project-b',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.detail',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })

    expect(resourceActionForRoute(routeName)).toEqual({
      resourceKey: 'records-project-b',
      action: 'detail',
      permission: 'records.detail',
    })
  })

  it('rejects route access contracts with different permissions', () => {
    const routeName = 'records-permission-conflict-route'
    defineResource(schema, {
      key: 'records-permission-a',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.detail.read',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })

    expect(() => defineResource(schema, {
      key: 'records-permission-b',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.detail.write',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })).toThrowError(`[loom] Route action conflict for "${routeName}".`)
  })

  it('rejects route access contracts with different actions', () => {
    const routeName = 'records-action-conflict-route'
    defineResource(schema, {
      key: 'records-action-a',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          permission: 'records.access',
          route: { name: routeName, params: (id) => ({ id }) },
        },
      },
    })

    expect(() => defineResource(schema, {
      key: 'records-action-b',
      actions: {
        list: {
          run: async () => ({ data: [] }),
          permission: 'records.access',
          route: { name: routeName },
        },
      },
    })).toThrowError(`[loom] Route action conflict for "${routeName}".`)
  })

  it('reads wire asset values before resource records reach the UI', async () => {
    const read = (value: unknown) => typeof value === 'string'
      ? { kind: 'file', id: value, url: `https://files.test/${value}`, name: value.split('/').pop() }
      : value
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
      inputProps: createInputPropsRegistry({ image: { value: { hydrate: read } } }),
    })
    const value = defineResource(assetSchema, {
      key: 'asset-records',
      actions: {
        detail: {
          run: async () => ({ id: '1', imgThumbnail: 'uploads/cover.png' }),
          fields: [assetFields.imgThumbnail],
        },
      },
    })

    await expect(value.detail({ id: '1' }).run()).resolves.toMatchObject({
      imgThumbnail: { kind: 'file', id: 'uploads/cover.png', name: 'cover.png' },
    })
  })

  it('builds standard surfaces and keeps custom actions explicit', async () => {
    const value = resource()
    const list = value.list()
    const record = { id: '1', name: 'One' }

    expect(list.fields).toEqual([expect.objectContaining({ key: 'name', label: 'Name', table: { sortable: true }, form: { renderer: 'text' } })])
    expect(list.resource).toBe('records')
    expect(list.createRoute).toEqual({ name: 'records-create' })
    expect(list.detailRoute?.(record)).toEqual({ name: 'records-detail', params: { id: '1' } })
    expect(list.updateRoute?.(record)).toEqual({ name: 'records-edit', params: { id: '1' } })
    expect(list.can?.('delete', record)).toBe(true)
    expect(list.can?.('update', record)).toBe(true)
    const detail = value.detail({ id: '1' })
    expect(detail.resource).toBe('records')
    expect(detail.title).toBe('Detail Record')
    expect(detail.backTo).toEqual({ name: 'records-list' })
    await expect(value.actions.verify.run('1', 'approved')).resolves.toBe('1:approved')
    expect(value.create().resource).toBe('records')
    expect(value.update({ id: '1' }).resource).toBe('records')
    await expect(value.create().run({ name: 'Two' })).resolves.toEqual({ id: '2', name: 'Two' })
    expect(value.create().defaultTo?.({ id: '2', name: 'Two' })).toEqual({ name: 'records-detail', params: { id: '2' } })
    expect(value.update({ id: '1' }).defaultTo?.({ id: '1', name: 'One' })).toEqual({ name: 'records-detail', params: { id: '1' } })
  })

  it('lets create and update replace or clear the detail defaultTo', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const list = { name: 'records-list' }
    const value = defineResource(schema, {
      key: 'records-override',
      actions: {
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          route: { name: 'records-detail', params: (id) => ({ id }) },
        },
        create: {
          run: async (input) => ({ id: '2', ...input }),
          defaultTo: list,
        },
        update: {
          run: async (id, input) => ({ id, name: input.name }),
          defaultTo: false,
        },
      },
    })

    expect(value.create().defaultTo?.({ id: '2', name: 'Two' })).toEqual(list)
    expect(value.update({ id: '1' }).defaultTo).toBeUndefined()
  })

  it('prefers a declared detail backTo over the inferred list route', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-backto',
      actions: {
        list: { run: async () => ({ data: [] }), route: { name: 'records-list' } },
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          route: { name: 'records-detail', params: (id) => ({ id }) },
          title: 'Custom Detail',
          backTo: { name: 'parent-tab' },
        },
      },
    })

    expect(value.detail({ id: '1' }).backTo).toEqual({ name: 'parent-tab' })
    expect(value.detail({ id: '1' }).title).toBe('Custom Detail')
  })

  it('infers detail backTo from a parameterized sibling list route', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-nested',
      actions: {
        list: { run: async () => ({ data: [] }), route: { name: 'parent-tab', params: { parentId: 'p1' } } },
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          route: { name: 'parent-tab-detail', params: (id) => ({ parentId: 'p1', id: String(id) }) },
        },
      },
    })

    expect(value.detail({ id: '1' }).backTo).toEqual({ name: 'parent-tab', params: { parentId: 'p1' } })
  })

  it('filters standard routes and row actions through access', () => {
    const value = resource({ allows: ({ operation }: { operation: string }) => operation === 'list' })
    const list = value.list()
    const record = { id: '1', name: 'One' }

    expect(list.createRoute).toBeUndefined()
    expect(list.detailRoute?.(record)).toBeUndefined()
    expect(list.updateRoute?.(record)).toBeUndefined()
    expect(list.can?.('create')).toBe(false)
  })

  it('answers undeclared operations through access on list and detail bags', () => {
    const asked: { operation: string; permission: string | null; record?: unknown }[] = []
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters({
        access: {
          allows: ({ operation, permission, record }) => {
            asked.push({ operation, permission: permission ?? null, record })
            return Array.isArray((record as { allowedOperations?: string[] } | undefined)?.allowedOperations)
              ? (record as { allowedOperations: string[] }).allowedOperations.includes(operation)
              : false
          },
        },
      }),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-bare',
      actions: {
        list: {
          run: async (): Promise<CollectionResult<Row>> => ({ data: [] }),
          fields: [fields.name],
          route: { name: 'records-list' },
        },
        detail: {
          run: async ({ id }) => ({ id, name: 'One' }),
          fields: [fields.name],
          route: { name: 'records-detail', params: (id) => ({ id }) },
        },
      },
    })

    const record = { id: '1', name: 'One', allowedOperations: ['update', 'delete'] }
    expect(value.list().can?.('delete', record)).toBe(true)
    expect(value.list().can?.('update', { id: '2', name: 'Two' })).toBe(false)
    expect(value.list().can?.('delete', { id: '2', name: 'Two' })).toBe(false)
    const detail = value.detail({ id: '1' })
    expect(typeof detail.can).toBe('function')
    expect(detail.can?.('delete', record)).toBe(true)
    expect(asked.every((call) => call.permission === null)).toBe(true)
  })

  it('injects operation and declared permission into form field context', () => {
    const value = resource()

    expect(value.create().context).toEqual({ operation: 'create', permission: 'records.create' })
    expect(value.update({ id: '1' }).context).toEqual({ operation: 'update', permission: 'records.update' })
  })

  it('keeps caller context keys and wins over reserved action keys', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-context',
      actions: {
        create: {
          run: async (input) => ({ id: '2', ...input }),
          fields: [fields.name],
          permission: 'records.create',
        },
        update: {
          run: async (id, input) => ({ id, name: input.name }),
          fields: [fields.name],
          permission: null,
        },
      },
    })

    expect(value.create({ context: { ticket: 't-1', operation: 'delete', permission: 'records.delete' } }).context).toEqual({
      ticket: 't-1',
      operation: 'create',
      permission: 'records.create',
    })
    expect(value.update({ id: '1', context: { ticket: 't-2', permission: 'records.delete' } }).context).toEqual({
      ticket: 't-2',
      operation: 'update',
      permission: null,
    })
  })

  it('composes form context even when the caller supplies none', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-no-permission',
      actions: {
        create: { run: async (input) => ({ id: '2', ...input }), fields: [fields.name] },
        update: { run: async (id, input) => ({ id, name: input.name }), fields: [fields.name] },
      },
    })

    expect(value.create().context).toEqual({ operation: 'create', permission: null })
    expect(value.update({ id: '1' }).context).toEqual({ operation: 'update', permission: null })
  })
})

describe('defineActionResource delete permission invariant', () => {
  it('throws when a delete action omits permission', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    expect(() =>
      defineResource(schema, {
        key: 'records-delete-ungated',
        actions: {
          // @ts-expect-error delete permission is required
          delete: { run: async (id: string) => id },
        },
      }),
    ).toThrowError(/action "delete" needs an explicit permission/)
  })

  it('accepts an explicit null permission as allow-all', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-delete-null',
      actions: { delete: { run: async (id: string) => id, permission: null } },
    })
    expect(value.delete({ id: '1' })).toBeDefined()
  })
})

describe('action-bag cache bound', () => {
  it('evicts oldest bags once the cache limit is exceeded', () => {
    registerResourceRuntime({
      queryClient: createFrameworkQueryClient(),
      adapters: resolveFrameworkAdapters(),
      fieldDefaults: resolveFrameworkFieldDefaults(),
    })
    const value = defineResource(schema, {
      key: 'records-cache-bound',
      actions: {
        detail: { run: async ({ id }) => ({ id: String(id), name: 'One' }), fields: [fields.name] },
        delete: { run: async (id) => id, permission: null },
      },
    })
    const first = value.detail({ id: '0' })
    expect(value.detail({ id: '0' })).toBe(first)
    for (let i = 1; i <= 200; i += 1) value.detail({ id: String(i) })
    expect(value.detail({ id: '0' })).not.toBe(first)
  })
})
