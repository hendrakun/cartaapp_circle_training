import { defineRoute } from '@southneuhof/sprindle'
import { eq } from 'drizzle-orm'
import { getDb } from '../../../db'
import { orgIdentity } from '../../../identity'
import { vendors } from '../../vendors/vendors.entity'

export const GET = defineRoute({ action: async (args) => {
  const identity = await orgIdentity(args)
  const ownVendor = identity
    ? (await getDb()
        .select({ id: vendors.id, statusCode: vendors.statusCode })
        .from(vendors)
        .where(eq(vendors.ownerUserId, identity.userId))
        .limit(1))[0] ?? null
    : null
  return args.c.json({ data: { ...identity!, permissions: [...identity!.permissions], vendor: ownVendor } })
} })
