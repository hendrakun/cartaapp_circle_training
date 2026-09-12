import { defineRoute, notFound } from '@southneuhof/sprindle'
import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '../../../../../db'
import { requirePermission } from '../../../../../identity'
import { permissions } from '../../../permissions/permissions.entity'
import { rolePermissions, roles } from '../../roles.entity'

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  sort_by: z.enum(['permissionCode', 'name', 'description', 'assigned']).default('permissionCode'),
  sort: z.enum(['asc', 'desc']).default('asc'),
})

export const GET = defineRoute({ authorize: requirePermission('list-role-permissions'), action: async (args) => {
  const query = querySchema.parse(args.c.req.query())
  const role = (await getDb().select({ id: roles.id }).from(roles).where(eq(roles.id, args.params.roleId)).limit(1))[0]
  if (!role) throw notFound()
  const search = query.search ? `%${query.search}%` : undefined
  const where = and(eq(permissions.active, true), search ? or(
    ilike(permissions.permissionCode, search),
    ilike(permissions.name, search),
    ilike(permissions.description, search),
  ) : undefined)
  const sortColumn = query.sort_by === 'assigned'
    ? sql`coalesce(${rolePermissions.active}, false)`
    : permissions[query.sort_by]
  const rows = await getDb()
    .select({
      id: permissions.id,
      permissionCode: permissions.permissionCode,
      name: permissions.name,
      description: permissions.description,
      assigned: rolePermissions.active,
    })
    .from(permissions)
    .leftJoin(rolePermissions, and(
      eq(rolePermissions.permissionId, permissions.id),
      eq(rolePermissions.roleId, args.params.roleId),
    ))
    .where(where)
    .orderBy(query.sort === 'desc' ? desc(sortColumn) : asc(sortColumn), asc(permissions.id))
    .limit(query.limit)
    .offset((query.page - 1) * query.limit)
  const [total] = await getDb().select({ value: count() }).from(permissions).where(where)
  const data = rows.map((row) => ({ ...row, assigned: row.assigned === true }))
  return { data, total: total!.value }
} })
