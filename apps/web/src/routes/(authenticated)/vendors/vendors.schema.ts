import { vendor } from '@southneuhof/api/routes/vendors/vendors.entity'
import { rpc } from '@/framework/rpc'
import { defineSchema } from '@/framework/schema'

/**
 * Vendor resource. The record is the API entity's public select shape. List and
 * detail use the standard transport; ownership and review operations use custom
 * actions because they are not standard CRUD.
 */
export const vendorsSchema = defineSchema(rpc.vendors, {
  identity: 'id',
  record: vendor.schemas.select,
})
