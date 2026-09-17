import { createEntity } from '@southneuhof/sprindle/entity'
import { sql } from 'drizzle-orm'
import { boolean, check, integer, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { z } from 'zod/v4'
import { users } from '../(authenticated)/users/users.entity'
import { approvalDivisions, bimQuestions, businessClassifications, vendorDocumentRequirements } from './vendors.masters.entity'

export const vendorStatusCodeSchema = z.enum([
  'registered',
  'email_verified',
  'profile_complete',
  'submitted',
  'approved',
  'rejected',
])
export type VendorStatusCode = z.infer<typeof vendorStatusCodeSchema>

export const vendorCompanyTypeSchema = z.enum([
  'pt',
  'cv',
  'firma',
  'yayasan',
  'koperasi',
  'but',
  'foreign_company',
  'foreign_individual',
  'other',
])
export type VendorCompanyType = z.infer<typeof vendorCompanyTypeSchema>

export const vendorBusinessFieldSchema = z.enum(['subkon', 'supplier', 'jasa'])
export type VendorBusinessField = z.infer<typeof vendorBusinessFieldSchema>

export const vendorDocumentTypeSchema = z.enum(['legal', 'finance', 'technical'])
export type VendorDocumentType = z.infer<typeof vendorDocumentTypeSchema>

export const vendorQualificationSchema = z.enum(['mikro', 'kecil', 'menengah', 'besar'])
export type VendorQualification = z.infer<typeof vendorQualificationSchema>

export const vendorCoverageSchema = z.enum(['lokal', 'regional', 'nasional', 'internasional'])
export type VendorCoverage = z.infer<typeof vendorCoverageSchema>

export const vendorReviewAspectSchema = z.enum(['legal', 'finance', 'technical', 'bim'])
export type VendorReviewAspect = z.infer<typeof vendorReviewAspectSchema>

export const vendorReviewDecisionSchema = z.enum(['approved', 'rejected'])
export type VendorReviewDecision = z.infer<typeof vendorReviewDecisionSchema>

export const vendorReviewAspects = vendorReviewAspectSchema.options

const auditFields = {
  createdByUserId: text('created_by_user_id').references(() => users.id),
  updatedByUserId: text('updated_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow(),
}

export const vendors = pgTable(
  'vendors',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    companyName: text('company_name').notNull(),
    companyType: text('company_type').notNull().$type<VendorCompanyType>(),
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    npwp: text('npwp').unique(),
    taxId: text('tax_id'),
    businessField: text('business_field').notNull().$type<VendorBusinessField>(),
    qualification: text('qualification').$type<VendorQualification>(),
    coverage: text('coverage').$type<VendorCoverage>(),
    address: text('address'),
    province: text('province'),
    city: text('city'),
    district: text('district'),
    village: text('village'),
    postalCode: text('postal_code'),
    phone: text('phone'),
    statusCode: text('status_code').notNull().default('registered').$type<VendorStatusCode>(),
    emailVerifiedAt: timestamp('email_verified_at', { mode: 'string' }),
    verificationToken: text('verification_token').unique(),
    submittedAt: timestamp('submitted_at', { mode: 'string' }),
    approvalDivisionCode: text('approval_division_code').references(() => approvalDivisions.code, { onDelete: 'restrict' }),
    confirmedAt: timestamp('confirmed_at', { mode: 'string' }),
    reviewedByUserId: text('reviewed_by_user_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { mode: 'string' }),
    reviewNote: text('review_note'),
    ...auditFields,
  },
  (table) => [
    check('vendors_status_code_check', sql`${table.statusCode} in ('registered', 'email_verified', 'profile_complete', 'submitted', 'approved', 'rejected')`),
    check('vendors_company_type_check', sql`${table.companyType} in ('pt', 'cv', 'firma', 'yayasan', 'koperasi', 'but', 'foreign_company', 'foreign_individual', 'other')`),
    check('vendors_business_field_check', sql`${table.businessField} in ('subkon', 'supplier', 'jasa')`),
    check('vendors_username_check', sql`${table.username} ~ '^[A-Za-z0-9._-]{3,160}$'`),
    check('vendors_npwp_check', sql`${table.npwp} is null or ${table.npwp} ~ '^[0-9]{16}$'`),
    check('vendors_qualification_check', sql`${table.qualification} is null or ${table.qualification} in ('mikro', 'kecil', 'menengah', 'besar')`),
    check('vendors_coverage_check', sql`${table.coverage} is null or ${table.coverage} in ('lokal', 'regional', 'nasional', 'internasional')`),
  ],
)

export const vendorContacts = pgTable('vendor_contacts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  role: text('role'),
  phone: text('phone'),
  email: text('email'),
  ...auditFields,
})

/** The vendor's choice from the classification master. Replaced as a set. */
export const vendorBusinessClassifications = pgTable('vendor_business_classifications', {
  vendorId: text('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  classificationId: text('classification_id')
    .notNull()
    .references(() => businessClassifications.id, { onDelete: 'restrict' }),
  ...auditFields,
}, (table) => [primaryKey({ columns: [table.vendorId, table.classificationId] })])

/** One file per fixed document slot. */
export const vendorDocuments = pgTable('vendor_documents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  requirementId: text('requirement_id')
    .notNull()
    .references(() => vendorDocumentRequirements.id, { onDelete: 'restrict' }),
  fileKey: text('file_key').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  ...auditFields,
}, (table) => [uniqueIndex('vendor_documents_slot_idx').on(table.vendorId, table.requirementId)])

/** One answer per BIM question. */
export const bimAnswers = pgTable('bim_answers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  questionId: text('question_id')
    .notNull()
    .references(() => bimQuestions.id, { onDelete: 'restrict' }),
  answer: boolean('answer').notNull(),
  note: text('note'),
  fileKey: text('file_key'),
  fileName: text('file_name'),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  ...auditFields,
}, (table) => [uniqueIndex('bim_answers_question_idx').on(table.vendorId, table.questionId)])

/** One decision per review aspect. A later decision replaces the earlier one. */
export const vendorReviews = pgTable('vendor_reviews', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id')
    .notNull()
    .references(() => vendors.id, { onDelete: 'cascade' }),
  aspect: text('aspect').notNull().$type<VendorReviewAspect>(),
  decision: text('decision').notNull().$type<VendorReviewDecision>(),
  note: text('note'),
  reviewerUserId: text('reviewer_user_id')
    .notNull()
    .references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { mode: 'string' }).notNull().defaultNow(),
  ...auditFields,
}, (table) => [
  uniqueIndex('vendor_reviews_aspect_idx').on(table.vendorId, table.aspect),
  check('vendor_reviews_aspect_check', sql`${table.aspect} in ('legal', 'finance', 'technical', 'bim')`),
  check('vendor_reviews_decision_check', sql`${table.decision} in ('approved', 'rejected')`),
])

const vendorWrite = {
  id: true,
  ownerUserId: true,
  statusCode: true,
  emailVerifiedAt: true,
  verificationToken: true,
  submittedAt: true,
  approvalDivisionCode: true,
  confirmedAt: true,
  reviewedByUserId: true,
  reviewedAt: true,
  reviewNote: true,
  createdByUserId: true,
  updatedByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const

export const vendor = createEntity({
  table: vendors,
  schemas: {
    create: createInsertSchema(vendors).omit(vendorWrite),
    update: createUpdateSchema(vendors).omit({ ...vendorWrite, email: true, username: true }),
    select: createSelectSchema(vendors).extend({
      statusCode: vendorStatusCodeSchema,
      companyType: vendorCompanyTypeSchema,
      businessField: vendorBusinessFieldSchema,
      qualification: vendorQualificationSchema.nullable(),
      coverage: vendorCoverageSchema.nullable(),
    }),
  },
})

export const vendorPublicSchema = vendor.schemas.select
