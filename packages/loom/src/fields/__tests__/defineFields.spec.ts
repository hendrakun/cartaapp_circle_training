import { afterEach, describe, expect, it } from 'vitest'
import type { CollectionResult, ValidationResult } from '../../contracts'
import { createFrameworkQueryClient } from '../../query/client'
import { resolveFrameworkAdapters } from '../../adapters/projectAdapters'
import { resolveFrameworkFieldDefaults } from '../defaults'
import { defineFields } from '../defineFields'
import { resolveFields } from '../resolve'
import { defineResource } from '../../resources/defineResource'
import { registerResourceRuntime, resetResourceRuntimeForTests } from '../../resources/runtime'

type Row = { id: string; name: string; status: string }
type Draft = { name: string }

function schema() {
  return {
    identity: 'id' as const,
    record: { schema: { validate: (value: unknown): ValidationResult<Row> => ({ success: true, data: value as Row }) } },
    create: { schema: { validate: (value: unknown): ValidationResult<Draft> => ({ success: true, data: value as Draft }) } },
    update: { schema: { validate: (value: unknown): ValidationResult<Draft> => ({ success: true, data: value as Draft }) } },
  }
}

function setupRuntime() {
  registerResourceRuntime({
    queryClient: createFrameworkQueryClient(),
    adapters: resolveFrameworkAdapters({ access: { allows: () => true } }),
    fieldDefaults: resolveFrameworkFieldDefaults(),
  })
}

afterEach(() => resetResourceRuntimeForTests())

describe('defineFields', () => {
  it('freezes references and applies one terminal shallow override', () => {
    const resourceSchema = schema()
    const base = defineFields(resourceSchema, {
      name: {
        label: 'Name',
        display: { renderer: 'text', props: { nested: { base: true }, values: ['base'], keep: true } },
        form: {
          renderer: 'text',
          source: { resource: 'base' },
          props: { nested: { base: true }, required: true },
          behavior: { visible: () => true, disabled: () => false },
        },
      },
    })
    const patch = {
      label: 'New name',
      display: { props: { nested: { override: true }, values: ['override'] } },
      form: {
        source: { resource: 'override' },
        props: { nested: { override: true }, required: false },
        behavior: { disabled: () => true },
      },
    }
    const variant = base.name.override(patch)

    expect(Object.isFrozen(base.name)).toBe(true)
    expect(Object.isFrozen(variant)).toBe(true)
    expect('override' in variant).toBe(false)
    expect(patch.form.props).toEqual({ nested: { override: true }, required: false })

    setupRuntime()
    const resource = defineResource(resourceSchema, {
      key: 'field-overrides',
      actions: {
        list: { run: async () => ({ data: [] } satisfies CollectionResult<Row>), fields: [base.name] },
        detail: { run: async ({ id }) => ({ id, name: 'One', status: 'new' }), fields: [variant] },
        update: { run: async (id: string, input: Draft) => ({ id, ...input, status: 'updated' }), fields: [variant] },
      },
    })

    const listField = resolveFields({ fields: resource.list().fields, surface: 'table' })[0]
    const detailField = resolveFields({ fields: resource.detail({ id: '1' }).fields, surface: 'detail' })[0]
    const updateField = resolveFields({ fields: resource.update({ id: '1' }).fields, surface: 'form' })[0]

    expect(listField).toMatchObject({ label: 'Name', renderer: 'text', props: { nested: { base: true }, values: ['base'], keep: true } })
    expect(detailField).toMatchObject({ label: 'New name', renderer: 'text', props: { nested: { override: true }, values: ['override'], keep: true } })
    expect(updateField).toMatchObject({
      label: 'New name',
      source: { resource: 'override' },
      props: { nested: { override: true }, required: false },
    })
    expect(updateField.behavior?.visible).toBeTypeOf('function')
    expect(updateField.behavior?.disabled?.({ draft: { name: 'One' }, value: 'One', context: {} })).toBe(true)
  })

  it('keeps action order, rejects foreign schemas, and rejects duplicate keys', () => {
    const resourceSchema = schema()
    const fields = defineFields(resourceSchema, {
      name: { label: 'Name' },
      status: { label: 'Status' },
    })
    setupRuntime()

    const ordered = defineResource(resourceSchema, {
      key: 'ordered-fields',
      actions: {
        list: {
          run: async () => ({ data: [] } satisfies CollectionResult<Row>),
          fields: [fields.status, fields.name],
        },
      },
    })
    expect(ordered.list().fields).toEqual([
      expect.objectContaining({ key: 'status' }),
      expect.objectContaining({ key: 'name' }),
    ])

    const foreignSchema = schema()
    const foreignFields = defineFields(foreignSchema, { name: { label: 'Name' } })
    const foreign = defineResource(resourceSchema, {
      key: 'foreign-fields',
      actions: { list: { run: async () => ({ data: [] } satisfies CollectionResult<Row>), fields: [foreignFields.name] } },
    })
    expect(() => foreign.list()).toThrow('different schema')

    const duplicate = defineResource(resourceSchema, {
      key: 'duplicate-fields',
      actions: { list: { run: async () => ({ data: [] } satisfies CollectionResult<Row>), fields: [fields.name, fields.name] } },
    })
    expect(() => duplicate.list()).toThrow('duplicate field "name"')
  })
})
