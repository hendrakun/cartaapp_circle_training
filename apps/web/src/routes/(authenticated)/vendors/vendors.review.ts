import type { FieldsInput } from '@southneuhof/loom'
import { fromZod } from '@southneuhof/loom'
import { z } from 'zod/v4'

/**
 * Plain field definitions for the per-aspect review dialog. `defineFields`
 * references belong to `defineResource`.
 */
export const vendorReviewDecisionOptions = [
  { id: 'approved', name: 'Approve' },
  { id: 'rejected', name: 'Reject' },
]

export const vendorReviewFields = {
  decision: { label: 'Decision', form: { span: 12, renderer: 'radio', source: vendorReviewDecisionOptions, props: { required: true, direction: 'row' } } },
  note: { label: 'Note', form: { span: 12, renderer: 'textarea' } },
} satisfies FieldsInput<Record<string, unknown>, Record<string, unknown>>

export const vendorReviewSchema = fromZod(
  z
    .object({
      decision: z.enum(['approved', 'rejected']),
      note: z.string().trim().max(1000).nullable(),
    })
    .superRefine((input, context) => {
      if (input.decision === 'rejected' && !input.note) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'A reason is required when an aspect is rejected.' })
      }
    })
)

export type VendorReviewFormInput = { decision: 'approved' | 'rejected'; note: string | null }
