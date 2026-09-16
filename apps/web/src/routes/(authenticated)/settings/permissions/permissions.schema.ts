import { permission } from '@southneuhof/api/routes/(authenticated)/permissions/permissions.entity'
import { rpc } from '@/framework/rpc'
import { defineSchema } from '@/framework/schema'

export const permissionsSchema = defineSchema(rpc.permissions, { identity: 'id', record: permission.schemas.select })
