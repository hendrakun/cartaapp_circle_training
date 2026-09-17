import { defineRoute, HttpError } from '@southneuhof/sprindle'
import { asc, eq, inArray } from 'drizzle-orm'
import { getDb } from '../../../../../db'
import { readJsonBody } from '../../../../../request-body'
import { vendorClassificationInputSchema } from '../../../../vendors/vendors.contract'
import { vendorBusinessClassifications } from '../../../../vendors/vendors.entity'
import { businessClassifications } from '../../../../vendors/vendors.masters.entity'
import { assertEditable, promoteCommonDataStatus, requireOwnVendor, vendorDetail } from '../../vendors.access'

export const GET = defineRoute({
  action: async (args) => {
    const { row } = await requireOwnVendor(args)
    const db = getDb()
    const selected = await db
      .select({ id: businessClassifications.id, name: businessClassifications.name, businessField: businessClassifications.businessField })
      .from(vendorBusinessClassifications)
      .innerJoin(businessClassifications, eq(businessClassifications.id, vendorBusinessClassifications.classificationId))
      .where(eq(vendorBusinessClassifications.vendorId, row.id))
      .orderBy(asc(businessClassifications.name))
    return { data: { businessField: row.businessField, classifications: selected } }
  },
})

/** Replaces the whole selected set for the vendor's current business field. */
export const PUT = defineRoute({
  openapi: { requestBody: vendorClassificationInputSchema },
  action: async (args) => {
    const input = vendorClassificationInputSchema.parse(await readJsonBody(args.c))
    const { identity, row } = await requireOwnVendor(args)
    assertEditable(row)

    if (input.classificationIds.length) {
      const found = await getDb()
        .select({ id: businessClassifications.id, businessField: businessClassifications.businessField })
        .from(businessClassifications)
        .where(inArray(businessClassifications.id, input.classificationIds))
      if (found.length !== input.classificationIds.length) {
        throw new HttpError(422, 'classification_unknown', undefined, [{ field: 'classificationIds', message: 'A selected classification does not exist.' }])
      }
      const foreign = found.filter((entry) => entry.businessField !== row.businessField)
      if (foreign.length) {
        throw new HttpError(422, 'classification_field_mismatch', undefined, [
          { field: 'classificationIds', message: `A selected classification does not belong to the ${row.businessField} business field.` },
        ])
      }
    }

    await getDb().transaction(async (tx) => {
      await tx.delete(vendorBusinessClassifications).where(eq(vendorBusinessClassifications.vendorId, row.id))
      if (input.classificationIds.length) {
        await tx.insert(vendorBusinessClassifications).values(
          input.classificationIds.map((classificationId) => ({
            vendorId: row.id,
            classificationId,
            createdByUserId: identity.userId,
            updatedByUserId: identity.userId,
          })),
        )
      }
    })

    await promoteCommonDataStatus(getDb(), row.id)
    return { data: await vendorDetail(row.id) }
  },
})
