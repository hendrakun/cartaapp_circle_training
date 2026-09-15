import { role } from '@southneuhof/api/routes/(authenticated)/roles/roles.entity'
import { defineEntitySchema } from '@/framework/hono'
import { rpc } from '@/framework/rpc'

export const rolesSchema = defineEntitySchema(rpc.roles, {
  select: role.schemas.select,
  create: role.schemas.create,
  update: role.schemas.update,
})
