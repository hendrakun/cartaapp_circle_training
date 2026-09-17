import { defineFields, defineResource } from '@southneuhof/loom'
import { createHonoResourceActions } from '@/framework/hono'
import { rpc } from '@/framework/rpc'
import { businessClassificationsSchema } from './business-classifications.schema'

const api = createHonoResourceActions(rpc.vendors.classifications)

const fields = defineFields(businessClassificationsSchema, {
  name: { label: 'Classification' },
  businessField: { label: 'Business field' },
})

/**
 * Searchable classification reference for the multi-select on the bidang usaha
 * page. The owner and staff read the same list.
 */
export const businessClassifications = defineResource(businessClassificationsSchema, {
  key: 'business-classifications',
  actions: {
    list: { run: api.list, fields: [fields.name], permission: null },
    detail: { run: api.detail, fields: [fields.name], permission: null },
  },
})
