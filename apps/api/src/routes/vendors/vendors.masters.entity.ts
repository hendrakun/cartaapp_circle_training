import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, pgTable, text } from 'drizzle-orm/pg-core'
import type { VendorDocumentType } from './vendors.entity'

/**
 * Reference masters for the vendor area. They are seeded from the legacy
 * dump and have no CRUD routes. `business_classifications` uses the legacy
 * `peng_klasifikasi` identity, and `vendor_document_requirements` uses the
 * legacy `penilaiain_approval` identity, so a seed run stays idempotent.
 */

export const businessClassifications = pgTable('business_classifications', {
  id: text('id').primaryKey(),
  businessField: text('business_field').notNull(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
}, (table) => [
  check('business_classifications_field_check', sql`${table.businessField} in ('subkon', 'supplier', 'jasa')`),
  index('business_classifications_field_name_idx').on(table.businessField, table.name),
])

export const vendorDocumentRequirements = pgTable('vendor_document_requirements', {
  id: text('id').primaryKey(),
  category: text('category').notNull().$type<VendorDocumentType>(),
  name: text('name').notNull(),
  nameEn: text('name_en'),
  required: boolean('required').notNull().default(true),
  appliesToForeign: boolean('applies_to_foreign').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
}, (table) => [
  check('vendor_document_requirements_category_check', sql`${table.category} in ('legal', 'finance', 'technical')`),
  index('vendor_document_requirements_category_idx').on(table.category, table.sortOrder),
])

export const bimQuestions = pgTable('bim_questions', {
  id: text('id').primaryKey(),
  question: text('question').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const approvalDivisions = pgTable('approval_divisions', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
})
