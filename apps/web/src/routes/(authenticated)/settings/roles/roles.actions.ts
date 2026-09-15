import { createHonoResourceActions } from '@/framework/hono'
import { rpc } from '@/framework/rpc'

const api = createHonoResourceActions(rpc.roles)

export const rolesActions = {
  list: api.list,
  detail: api.detail,
  create: api.create,
  update: api.update,
  delete: api.delete,
}
