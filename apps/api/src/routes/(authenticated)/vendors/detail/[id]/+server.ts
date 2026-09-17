import { defineRoute, notFound } from '@southneuhof/sprindle'
import { requirePermission } from '../../../../../identity'
import { vendorDetail } from '../../vendors.access'

export const GET = defineRoute({
  authorize: requirePermission('detail-vendors'),
  action: async (args) => {
    const detail = await vendorDetail(args.params.id)
    if (!detail) throw notFound()
    return { data: detail }
  },
})
