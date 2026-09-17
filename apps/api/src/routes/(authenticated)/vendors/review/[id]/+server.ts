import { defineRoute, HttpError, lockRow } from '@southneuhof/sprindle'
import { eq } from 'drizzle-orm'
import { getDb } from '../../../../../db'
import { requireOrgIdentity, requirePermission } from '../../../../../identity'
import { readJsonBody } from '../../../../../request-body'
import { vendorReviewInputSchema } from '../../../../vendors/vendors.contract'
import { vendorReviews, vendors, vendorReviewAspects } from '../../../../vendors/vendors.entity'
import { vendorDetail } from '../../vendors.access'

/**
 * One staff decision per review aspect. The vendor status is the aggregate:
 * rejected when any aspect is rejected, approved when every aspect is approved,
 * and submitted while an aspect is undecided.
 */
export const POST = defineRoute({
  openapi: { requestBody: vendorReviewInputSchema },
  authorize: requirePermission('approve-vendors'),
  action: async (args) => {
    const input = vendorReviewInputSchema.parse(await readJsonBody(args.c))
    const identity = await requireOrgIdentity(args)

    await getDb().transaction(async (tx) => {
      const locked = await lockRow(tx, vendors, args.params.id)
      if (locked.statusCode !== 'submitted') {
        throw new HttpError(409, 'invalid_transition', 'Only a vendor in review can receive an aspect decision.')
      }
      const now = new Date().toISOString()
      await tx
        .insert(vendorReviews)
        .values({
          vendorId: locked.id,
          aspect: input.aspect,
          decision: input.decision,
          note: input.note ?? null,
          reviewerUserId: identity.userId,
          reviewedAt: now,
          createdByUserId: identity.userId,
          updatedByUserId: identity.userId,
        })
        .onConflictDoUpdate({
          target: [vendorReviews.vendorId, vendorReviews.aspect],
          set: { decision: input.decision, note: input.note ?? null, reviewerUserId: identity.userId, reviewedAt: now, updatedAt: now, updatedByUserId: identity.userId },
        })

      const decisions = await tx.select({ aspect: vendorReviews.aspect, decision: vendorReviews.decision }).from(vendorReviews).where(eq(vendorReviews.vendorId, locked.id))
      const rejected = decisions.some((entry) => entry.decision === 'rejected')
      const approvedAll = vendorReviewAspects.every((aspect) => decisions.some((entry) => entry.aspect === aspect && entry.decision === 'approved'))
      const statusCode = rejected ? 'rejected' : approvedAll ? 'approved' : 'submitted'
      await tx
        .update(vendors)
        .set({
          statusCode,
          reviewNote: input.note ?? null,
          reviewedByUserId: identity.userId,
          reviewedAt: now,
          updatedAt: now,
          updatedByUserId: identity.userId,
        })
        .where(eq(vendors.id, locked.id))
    })

    const detail = await vendorDetail(args.params.id)
    if (!detail) throw new HttpError(409, 'invalid_transition', 'The vendor record disappeared during review.')
    return { data: detail }
  },
})
