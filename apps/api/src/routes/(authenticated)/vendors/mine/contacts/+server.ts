import { defineRoute } from '@southneuhof/sprindle'
import { getDb } from '../../../../../db'
import { readJsonBody } from '../../../../../request-body'
import { publicRecord } from '../../../../../storage/assets'
import { vendorContactInputSchema, vendorContactPublicSchema } from '../../../../vendors/vendors.contract'
import { vendorContacts } from '../../../../vendors/vendors.entity'
import { assertEditable, promoteCommonDataStatus, requireOwnVendor } from '../../vendors.access'

export const POST = defineRoute({
  openapi: { requestBody: vendorContactInputSchema },
  action: async (args) => {
    const input = vendorContactInputSchema.parse(await readJsonBody(args.c))
    const { identity, row } = await requireOwnVendor(args)
    assertEditable(row)
    const inserted = (
      await getDb()
        .insert(vendorContacts)
        .values({ vendorId: row.id, ...input, createdByUserId: identity.userId, updatedByUserId: identity.userId })
        .returning()
    )[0]
    await promoteCommonDataStatus(getDb(), row.id)
    return { data: publicRecord(vendorContactPublicSchema, inserted) }
  },
})
