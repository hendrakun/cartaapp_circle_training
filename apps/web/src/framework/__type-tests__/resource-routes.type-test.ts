import { defineFields, defineResource } from '@southneuhof/loom'
import type { CollectionResult, ValidationResult } from '@southneuhof/loom'

type Row = { id: string; name: string }
type Draft = { name: string }
type Query = { search?: string }
const validate = <T>(value: unknown): ValidationResult<T> => ({ success: true, data: value as T })
const schema = {
  identity: 'id' as const,
  record: { schema: { validate: validate<Row> } },
  query: { schema: { validate: validate<Query> } },
  create: { schema: { validate: validate<Draft> } },
  update: { schema: { validate: validate<Draft> } },
}
const fields = defineFields(schema, { name: { label: 'Name', form: { renderer: 'text' } } })
const list = async () => ({ data: [] }) satisfies CollectionResult<Row>
const detail = async ({ id }: { id?: string }) => ({ id: id ?? '1', name: 'One' })
const create = async (input: Draft) => ({ id: '1', ...input })
const update = async (id: string, input: Draft) => ({ id, ...input })
const wrongParams = { userId: '1', roleId: '2' }
const wrongParamsCallback = (_id: string) => wrongParams

const validName = 'settings-users' as const
const valid = defineResource(schema, {
  key: 'valid-routes',
  actions: {
    list: { run: list, fields: [fields.name], route: { name: validName } },
    detail: { run: detail, fields: [fields.name], route: { name: 'settings-users-detail', params: (id) => ({ userId: id }) } },
    create: { run: create, fields: [fields.name], route: { name: 'settings-users-create' } },
    update: { run: update, fields: [fields.name], route: { name: 'settings-users-edit' } },
  },
})

defineResource(schema, {
  key: 'valid-parameter-routes',
  actions: {
    list: { run: list, route: { name: 'settings-users-detail-role-assignments' } },
    detail: { run: detail, route: { name: 'settings-users-detail', params: {} } },
    create: { run: create, route: { name: 'settings-users-detail', params: { userId: 1 } } },
    update: { run: update, route: { name: 'settings-users-detail', params: (id) => ({ userId: String(id) }) } },
  },
})

defineResource(schema, {
  key: 'invalid-direct-parameter-key',
  actions: {
    // @ts-expect-error settings-users-detail has no roleId parameter.
    list: { run: list, route: { name: 'settings-users-detail', params: { roleId: '2' } } },
  },
})

defineResource(
  schema,
  // @ts-expect-error an inferred variable cannot add route parameter keys.
  {
    key: 'invalid-inferred-parameter-key',
    actions: { detail: { run: detail, route: { name: 'settings-users-detail', params: wrongParams } } },
  }
)

defineResource(schema, {
  key: 'invalid-direct-parameter-value',
  actions: {
    // @ts-expect-error route parameter values cannot be boolean.
    create: { run: create, route: { name: 'settings-users-detail', params: { userId: true } } },
  },
})

defineResource(
  schema,
  // @ts-expect-error callback returns cannot add route parameter keys.
  {
    key: 'invalid-inferred-callback-key',
    actions: { update: { run: update, route: { name: 'settings-users-detail', params: wrongParamsCallback } } },
  }
)

defineResource(schema, {
  key: 'invalid-callback-parameter-routes',
  actions: {
    // @ts-expect-error callback returns must use the selected route's keys.
    detail: { run: detail, route: { name: 'settings-users-detail', params: () => ({ roleId: '2' }) } },
    // @ts-expect-error callback route parameter values cannot be objects.
    update: { run: update, route: { name: 'settings-users-edit', params: () => ({ userId: {} }) } },
  },
})

void valid.detail({ id: '1' }).run()
void valid.create().run({ name: 'One' })
void valid.update({ id: '1' }).run({ name: 'Updated' })

defineResource(schema, {
  key: 'invalid-list-route',
  actions: {
    // @ts-expect-error missing-resource-route is not generated.
    list: { run: list, route: { name: 'missing-resource-route' } },
  },
})

defineResource(schema, {
  key: 'invalid-detail-route',
  actions: {
    // @ts-expect-error missing-resource-route is not generated.
    detail: { run: detail, route: { name: 'missing-resource-route' } },
  },
})

defineResource(schema, {
  key: 'invalid-create-route',
  actions: {
    // @ts-expect-error missing-resource-route is not generated.
    create: { run: create, route: { name: 'missing-resource-route' } },
  },
})

defineResource(schema, {
  key: 'invalid-update-route',
  actions: {
    // @ts-expect-error missing-resource-route is not generated.
    update: { run: update, route: { name: 'missing-resource-route' } },
  },
})

const dynamicName: string = 'settings-users'
defineResource(schema, {
  key: 'dynamic-route',
  actions: {
    // @ts-expect-error plain strings can contain unknown route names.
    list: { run: list, route: { name: dynamicName } },
  },
})

defineResource(schema, { key: 'route-optional', actions: { list: { run: list } } })
