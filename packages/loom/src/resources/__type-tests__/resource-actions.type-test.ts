import { defineFields } from '../../fields/defineFields'
import { defineResource } from '../defineResource'
import type { CollectionResult, ValidationResult } from '../../contracts'

type Row = { id: string; name: string }
type Draft = { name: string }
type Query = { search?: string }
const querySchema = { validate: (value: unknown): ValidationResult<Query> => ({ success: true, data: value as Query }) }
const schema = {
  identity: 'id' as const,
  record: { schema: { validate: (value: unknown): ValidationResult<Row> => ({ success: true, data: value as Row }) } },
  query: { schema: querySchema },
  create: { schema: { validate: (value: unknown): ValidationResult<Draft> => ({ success: true, data: value as Draft }) } },
  update: { schema: { validate: (value: unknown): ValidationResult<Draft> => ({ success: true, data: value as Draft }) } },
}
const fields = defineFields(schema, { name: { label: 'Name', form: { renderer: 'text' } } })

const resource = defineResource(schema, {
  key: 'rows',
  actions: {
    list: { run: async () => ({ data: [] } satisfies CollectionResult<Row>), fields: [fields.name] },
    detail: { run: async ({ id }) => ({ id: String(id), name: 'One' }), fields: [fields.name] },
    create: { run: async (input: Draft) => ({ id: '1', ...input }), fields: [fields.name] },
    update: { run: async (id: string, input: Draft) => ({ id, ...input }), fields: [fields.name] },
    delete: { run: async (id: string) => id, permission: 'delete-rows' },
    verify: { run: async (id: string, result: 'approved' | 'rejected') => `${id}:${result}` },
  },
})

void resource.list().run({ query: {}, searchParameters: {} })
void resource.detail({ id: '1' }).run()
void resource.create().run({ name: 'One' })
void resource.update({ id: '1' }).run({ name: 'Updated' })
void resource.delete({ id: '1' }).run()
void resource.actions.verify.run('1', 'approved')
