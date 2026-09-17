import { defineRoute, notFound } from '@southneuhof/sprindle'
import { eq } from 'drizzle-orm'
import { getDb } from '../../../../../../db'
import { businessClassificationPublicSchema } from '../../../../../vendors/vendors.contract'
import { businessClassifications } from '../../../../../vendors/vendors.masters.entity'

/** One classification for the lookup's selected value. */
export const GET = defineRoute({
  action: async (args) => {
    const row = (
      await getDb()
        .select({ id: businessClassifications.id, name: businessClassifications.name, businessField: businessClassifications.businessField })
        .from(businessClassifications)
        .where(eq(businessClassifications.id, args.params.id))
        .limit(1)
    )[0]
    if (!row) throw notFound()
    return { data: businessClassificationPublicSchema.parse(row) }
  },
})
