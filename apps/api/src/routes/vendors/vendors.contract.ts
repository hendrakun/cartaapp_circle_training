import type { ErrorIssue } from '@southneuhof/sprindle'
import { z } from 'zod/v4'
import { optionalText, storedAssetSchema } from '../../schema'
import {
  vendorBusinessFieldSchema,
  vendorCompanyTypeSchema,
  vendorCoverageSchema,
  vendorDocumentTypeSchema,
  vendorQualificationSchema,
  vendorReviewAspectSchema,
  vendorReviewDecisionSchema,
  vendor,
  type VendorCompanyType,
} from './vendors.entity'

const domesticCompanyTypes = ['pt', 'cv', 'firma', 'yayasan', 'koperasi', 'but', 'other'] as const
const foreignCompanyTypes = ['foreign_company', 'foreign_individual'] as const

export function isForeignCompanyType(companyType: string): boolean {
  return (foreignCompanyTypes as readonly string[]).includes(companyType)
}

export function isDomesticCompanyType(companyType: string): boolean {
  return (domesticCompanyTypes as readonly string[]).includes(companyType)
}

export function normalizeNpwp(value: string | null | undefined): string | null {
  const digits = value?.replace(/[^0-9]/g, '') ?? ''
  return digits || null
}

export const vendorUsernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must have at least 3 characters.')
  .max(160, 'Username must have at most 160 characters.')
  .regex(/^[A-Za-z0-9._-]+$/, 'Username can use letters, digits, dot, underscore and hyphen only.')

/** Shared NPWP and tax ID rules for a complete vendor identity. */
export function identityRuleIssues(input: { companyType: VendorCompanyType; npwp: string | null; taxId: string | null }): ErrorIssue[] {
  const issues: ErrorIssue[] = []
  if (isDomesticCompanyType(input.companyType)) {
    if (!input.npwp || input.npwp.length !== 16) {
      issues.push({ field: 'npwp', message: 'NPWP must have exactly 16 digits.' })
    }
    if (input.taxId) issues.push({ field: 'taxId', message: 'Tax ID is for foreign vendors only.' })
  }
  if (isForeignCompanyType(input.companyType)) {
    if (!input.taxId) issues.push({ field: 'taxId', message: 'Tax ID is required for foreign vendors.' })
    if (input.npwp) issues.push({ field: 'npwp', message: 'NPWP is for domestic vendors only.' })
  }
  return issues
}

export const vendorProfilePatchSchema = z
  .object({
    companyName: z.string().trim().min(1).max(255).optional(),
    companyType: vendorCompanyTypeSchema.optional(),
    npwp: z.string().trim().max(40).nullable().optional(),
    taxId: z.string().trim().max(64).nullable().optional(),
    businessField: vendorBusinessFieldSchema.optional(),
    qualification: vendorQualificationSchema.nullable().optional(),
    coverage: vendorCoverageSchema.nullable().optional(),
    address: optionalText(500),
    province: optionalText(120),
    city: optionalText(120),
    district: optionalText(120),
    village: optionalText(120),
    postalCode: optionalText(12),
    phone: optionalText(60),
  })
  .strict()

export const vendorContactInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    role: optionalText(160),
    phone: optionalText(60),
    email: optionalText(255),
  })
  .strict()

export const vendorClassificationInputSchema = z
  .object({
    classificationIds: z.array(z.string().trim().min(1)).max(200).superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'A classification can be selected only once.' })
    }),
  })
  .strict()

/** The HTTP shape carries the complete asset object, as the asset contract requires. */
export const vendorDocumentInputSchema = z
  .object({
    file: storedAssetSchema,
  })
  .strict()

export const bimAnswersInputSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string().trim().min(1),
            answer: z.boolean(),
            note: optionalText(2000),
            file: storedAssetSchema.nullable().optional(),
          })
          .strict(),
      )
      .max(50)
      .superRefine((answers, context) => {
        if (new Set(answers.map((entry) => entry.questionId)).size !== answers.length) {
          context.addIssue({ code: z.ZodIssueCode.custom, message: 'A question can be answered only once.' })
        }
      }),
  })
  .strict()

export const vendorSubmitInputSchema = z
  .object({
    divisionCode: z.string().trim().min(1).max(20),
    confirmed: z.literal(true),
  })
  .strict()

export const vendorReviewInputSchema = z
  .object({
    aspect: vendorReviewAspectSchema,
    decision: vendorReviewDecisionSchema,
    note: optionalText(1000),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.decision === 'rejected' && !input.note) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'A reason is required when an aspect is rejected.' })
    }
  })

export const vendorContactPublicSchema = z.object({
  id: z.string(),
  vendorId: z.string(),
  name: z.string(),
  role: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const vendorClassificationPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  businessField: vendorBusinessFieldSchema,
})

/** One fixed document slot with its current file, or null when empty. */
export const vendorDocumentSlotPublicSchema = z.object({
  requirementId: z.string(),
  category: vendorDocumentTypeSchema,
  name: z.string(),
  nameEn: z.string().nullable(),
  required: z.boolean(),
  appliesToForeign: z.boolean(),
  sortOrder: z.number(),
  file: storedAssetSchema.nullable(),
  updatedAt: z.string().nullable(),
})

export const bimAnswerPublicSchema = z.object({
  questionId: z.string(),
  question: z.string(),
  sortOrder: z.number(),
  answer: z.boolean().nullable(),
  note: z.string().nullable(),
  file: storedAssetSchema.nullable(),
})

export const vendorReviewPublicSchema = z.object({
  aspect: vendorReviewAspectSchema,
  decision: vendorReviewDecisionSchema,
  note: z.string().nullable(),
  reviewerUserId: z.string(),
  reviewedAt: z.string(),
})

export const approvalDivisionPublicSchema = z.object({
  code: z.string(),
  name: z.string(),
})

const progressAreaSchema = z.object({
  'data_perusahaan': z.boolean(),
  'contact_person': z.boolean(),
  'bidang_usaha': z.boolean(),
  'data_pendukung_legal': z.boolean(),
  'data_pendukung_teknis': z.boolean(),
  'data_pendukung_keuangan': z.boolean(),
  'input_bim': z.boolean(),
  'konfirmasi_selesai': z.boolean(),
})

export const vendorDetailPublicSchema = z.object({
  vendor: vendor.schemas.select,
  contacts: z.array(vendorContactPublicSchema),
  classifications: z.array(vendorClassificationPublicSchema),
  documents: z.array(vendorDocumentSlotPublicSchema),
  bim: z.array(bimAnswerPublicSchema),
  reviews: z.array(vendorReviewPublicSchema),
  progress: progressAreaSchema,
  missing: z.array(z.string()),
})

export type VendorDetailPublic = z.output<typeof vendorDetailPublicSchema>
export type VendorDocumentSlotPublic = z.output<typeof vendorDocumentSlotPublicSchema>
export type BimAnswerPublic = z.output<typeof bimAnswerPublicSchema>

/** One classification of the reference master. */
export const businessClassificationPublicSchema = z.object({
  id: z.string(),
  name: z.string(),
  businessField: vendorBusinessFieldSchema,
})

export type BusinessClassificationPublic = z.output<typeof businessClassificationPublicSchema>
