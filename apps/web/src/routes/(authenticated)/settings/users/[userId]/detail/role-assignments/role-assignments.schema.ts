import type { WebResourceSchema } from '@southneuhof/loom'
import { defineSchema } from '@/framework/schema'

export type RoleAssignment = {
  id: string
  roleCode: string
  name: string
  description: string | null
  active: boolean
  assigned: boolean
}

export type RoleAssignmentQuery = Record<string, never>
export type RoleAssignmentSchema = WebResourceSchema<RoleAssignment, RoleAssignmentQuery, Record<string, never>, Record<string, never>, string>

export const roleAssignmentsSchema = defineSchema<RoleAssignmentSchema>({ identity: 'id' })
