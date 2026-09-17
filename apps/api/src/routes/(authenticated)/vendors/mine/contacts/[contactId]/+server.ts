import { defineRoute, notFound } from '@southneuhof/sprindle'
import { getDb } from '../../../../../../db'
import { readJsonBody } from '../../../../../../request-body'
import { publicRecord } from '../../../../../../storage/assets'
import { vendorContactInputSchema, vendorContactPublicSchema } from '../../../../../vendors/vendors.contract'
import { vendorContacts } from '../../../../../vendors/vendors.entity'
import { assertEditable, contactBelongsToVendor, promoteCommonDataStatus, requireOwnVendor } from '../../../vendors.access'

export const PATCH = defineRoute({
  openapi: { requestBody: vendorContactInputSchema },
  action: async (args) => {
    const input = vendorContactInputSchema.parse(await readJsonBody(args.c))
    const { identity, row } = await requireOwnVendor(args)
    assertEditable(row)
    const updated = (
      await getDb()
        .update(vendorContacts)
        .set({ ...input, updatedAt: new Date().toISOString(), updatedByUserId: identity.userId })
        .where(contactBelongsToVendor(row.id, args.params.contactId))
        .returning()
    )[0]
    if (!updated) throw notFound()
    return { data: publicRecord(vendorContactPublicSchema, updated) }
  },
})

export const DELETE = defineRoute({
  action: async (args) => {
    const { row } = await requireOwnVendor(args)
    assertEditable(row)
    const deleted = await getDb()
      .delete(vendorContacts)
      .where(contactBelongsToVendor(row.id, args.params.contactId))
      .returning({ id: vendorContacts.id })
    if (!deleted[0]) throw notFound()
    await promoteCommonDataStatus(getDb(), row.id)
    return { ok: true }
  },
})
