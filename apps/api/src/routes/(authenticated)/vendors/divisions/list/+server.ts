import { defineRoute } from '@southneuhof/sprindle'
import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../../../../db'
import { approvalDivisions } from '../../../../vendors/vendors.masters.entity'

/** Approval divisions offered by the completion step. Eight active rows. */
export const GET = defineRoute({
  action: async () => ({
    data: await getDb()
      .select({ code: approvalDivisions.code, name: approvalDivisions.name })
      .from(approvalDivisions)
      .where(eq(approvalDivisions.active, true))
      .orderBy(asc(approvalDivisions.name)),
  }),
})
