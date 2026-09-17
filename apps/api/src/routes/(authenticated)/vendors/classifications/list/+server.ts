import { defineRoute } from '@southneuhof/sprindle'
import { and, asc, count, eq, ilike } from 'drizzle-orm'
import { z } from 'zod/v4'
import { getDb } from '../../../../../db'
import { businessClassificationPublicSchema } from '../../../../vendors/vendors.contract'
import { vendorBusinessFieldSchema } from '../../../../vendors/vendors.entity'
import { businessClassifications } from '../../../../vendors/vendors.masters.entity'

const querySchema = z.object({
  business_field: vendorBusinessFieldSchema.optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/**
 * Searchable classification reference. Vendors and staff read the same list,
 * so a session is enough.
 */
export const GET = defineRoute({
  action: async (args) => {
    const query = querySchema.parse(args.c.req.query())
    const where = and(
      eq(businessClassifications.active, true),
      query.business_field ? eq(businessClassifications.businessField, query.business_field) : undefined,
      query.search ? ilike(businessClassifications.name, `%${query.search}%`) : undefined,
    )
    const db = getDb()
    const [rows, totalRows] = await Promise.all([
      db
        .select({ id: businessClassifications.id, name: businessClassifications.name, businessField: businessClassifications.businessField })
        .from(businessClassifications)
        .where(where)
        .orderBy(asc(businessClassifications.name), asc(businessClassifications.id))
        .limit(query.limit)
        .offset((query.page - 1) * query.limit),
      db.select({ value: count() }).from(businessClassifications).where(where),
    ])
    return { data: rows.map((row) => businessClassificationPublicSchema.parse(row)), total: Number(totalRows[0]?.value ?? 0) }
  },
})
