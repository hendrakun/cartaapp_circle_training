import { role } from '@southneuhof/api/routes/(authenticated)/roles/roles.entity'
import { defineSchema } from '@/framework/schema'
import { rpc } from '@/framework/rpc'

export const rolesSchema = defineSchema(rpc.roles, {
  identity: 'id',
  record: role.schemas.select,
  create: role.schemas.create,
  update: role.schemas.update,
})
