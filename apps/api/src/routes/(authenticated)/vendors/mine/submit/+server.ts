import { defineRoute, HttpError, lockRow } from '@southneuhof/sprindle'
import { eq } from 'drizzle-orm'
import { getDb } from '../../../../../db'
import { readJsonBody } from '../../../../../request-body'
import { vendorSubmitInputSchema } from '../../../../vendors/vendors.contract'
import { vendorReviews, vendors } from '../../../../vendors/vendors.entity'
import { approvalDivisions } from '../../../../vendors/vendors.masters.entity'
import { assertEditable, countVendorChildren, requireOwnVendor, vendorDetail } from '../../vendors.access'

/**
 * Submits the owner's vendor for staff review and locks further edits. Missing
 * document slots or BIM answers do not block the submission; the reviewer sees
 * them as gaps.
 */
export const POST = defineRoute({
  openapi: { requestBody: vendorSubmitInputSchema },
  action: async (args) => {
    const input = vendorSubmitInputSchema.parse(await readJsonBody(args.c))
    const { identity, row } = await requireOwnVendor(args)
    assertEditable(row)
    if (!row.emailVerifiedAt) throw new HttpError(409, 'email_not_verified', 'Verify the registration email before submitting.')

    const division = (
      await getDb().select({ code: approvalDivisions.code }).from(approvalDivisions).where(eq(approvalDivisions.code, input.divisionCode)).limit(1)
    )[0]
    if (!division) throw new HttpError(422, 'division_unknown', undefined, [{ field: 'divisionCode', message: 'Select an approval division.' }])

    const children = await countVendorChildren(getDb(), row.id)
    const missing: string[] = []
    if (!row.address) missing.push('address')
    if (!row.city) missing.push('city')
    if (!row.phone) missing.push('phone')
    if (!row.qualification) missing.push('qualification')
    if (!row.coverage) missing.push('coverage')
    if (!children.contacts) missing.push('contact')
    if (!children.classifications) missing.push('classification')
    if (missing.length) {
      throw new HttpError(422, 'vendor_incomplete', undefined, missing.map((field) => ({ field, message: 'This value is required before submission.' })))
    }

    await getDb().transaction(async (tx) => {
      const locked = await lockRow(tx, vendors, row.id)
      if (!['email_verified', 'profile_complete', 'rejected'].includes(locked.statusCode)) {
        throw new HttpError(409, 'invalid_transition', 'The vendor registration is not ready to submit.')
      }
      const now = new Date().toISOString()
      // A resubmission starts a new review round, so the previous decisions do not apply.
      await tx.delete(vendorReviews).where(eq(vendorReviews.vendorId, locked.id))
      await tx
        .update(vendors)
        .set({
          statusCode: 'submitted',
          submittedAt: now,
          confirmedAt: now,
          approvalDivisionCode: input.divisionCode,
          reviewNote: null,
          reviewedAt: null,
          reviewedByUserId: null,
          updatedAt: now,
          updatedByUserId: identity.userId,
        })
        .where(eq(vendors.id, locked.id))
    })

    return { data: await vendorDetail(row.id) }
  },
})
