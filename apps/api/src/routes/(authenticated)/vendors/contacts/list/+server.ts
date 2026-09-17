import { defineRoute } from '@southneuhof/sprindle'
import { count, eq } from 'drizzle-orm'
import { z } from 'zod/v4'
import { getDb } from '../../../../../db'

import { publicRecord } from '../../../../../storage/assets'
import { vendorContactPublicSchema } from '../../../../vendors/vendors.contract'
import { vendorContacts } from '../../../../vendors/vendors.entity'
import { authorizeVendorRead } from '../../vendors.access'

const querySchema = z.object({
  vendor_id: z.string().trim().min(1),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

export const GET = defineRoute({
  authorize: authorizeVendorRead(),
  action: async (args) => {
    const query = querySchema.parse(args.c.req.query())
    const db = getDb()
    const rows = await db
      .select()
      .from(vendorContacts)
      .where(eq(vendorContacts.vendorId, query.vendor_id))
      .orderBy(vendorContacts.name, vendorContacts.id)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit)
    const total = (await db.select({ value: count() }).from(vendorContacts).where(eq(vendorContacts.vendorId, query.vendor_id)))[0]?.value ?? 0
    return { data: rows.map((row) => publicRecord(vendorContactPublicSchema, row)), total: Number(total) }
  },
})
