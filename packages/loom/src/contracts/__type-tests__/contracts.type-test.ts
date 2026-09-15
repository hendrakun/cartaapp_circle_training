import { defineFields, defineResource } from '../../index'
import type { CollectionResult, WebResourceSchema } from '../index'

type Role = { id: string; name: string }
type Schema = WebResourceSchema<Role, Record<string, never>, Role, Role, string>
const schema: Schema = { identity: 'id' }
const fields = defineFields(schema, { name: { label: 'Name' } })
const roles = defineResource(schema, {
  key: 'roles',
  actions: {
    list: { run: async () => ({ data: [{ id: '1', name: 'Admin' }] } satisfies CollectionResult<Role>), fields: [fields.name] },
    detail: { run: async ({ id }) => ({ id: String(id), name: 'Admin' }), fields: [fields.name] },
  },
})
void roles.list()
void roles.detail({ id: '1' })
