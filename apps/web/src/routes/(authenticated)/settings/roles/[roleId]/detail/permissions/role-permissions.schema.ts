import type { WebResourceSchema } from '@southneuhof/loom'
import { defineSchema } from '@/framework/schema'

export type RolePermission = {
  id: string
  permissionCode: string
  name: string
  description: string | null
  assigned: boolean
}
export type RolePermissionSchema = WebResourceSchema<RolePermission, Record<string, unknown>, Record<string, never>, Record<string, never>, string>

export const rolePermissionsSchema = defineSchema<RolePermissionSchema>({ identity: 'id' })
