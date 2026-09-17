import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { getDb } from '../src/db'
import {
  approvalDivisions,
  bimQuestions,
  businessClassifications,
  vendorDocumentRequirements,
} from '../src/routes/vendors/vendors.masters.entity'

/**
 * Vendor reference masters, extracted from the legacy HK-Circle dump
 * (`db_circle_dev.sql`) on 2026-09-17. They are reference lists, not vendor
 * records. Rows are upserted by their legacy identity, so a repeated seed run
 * keeps them current and preserves existing vendor references.
 */
function readMaster<T>(file: string): T[] {
  const path = fileURLToPath(new URL(`./master-data/${file}`, import.meta.url))
  return JSON.parse(readFileSync(path, 'utf8')) as T[]
}

export async function seedVendorMasters() {
  const db = getDb()
  const classifications = readMaster<{ id: string; businessField: 'subkon' | 'supplier' | 'jasa'; name: string }>('business-classifications.json')
  const requirements = readMaster<{
    id: string
    category: 'legal' | 'finance' | 'technical'
    name: string
    nameEn: string | null
    required: boolean
    appliesToForeign: boolean
    sortOrder: number
  }>('vendor-document-requirements.json')
  const questions = readMaster<{ id: string; question: string; sortOrder: number }>('bim-questions.json')
  const divisions = readMaster<{ code: string; name: string }>('approval-divisions.json')

  for (const chunk of chunks(classifications, 200)) {
    await db
      .insert(businessClassifications)
      .values(chunk.map((row) => ({ id: row.id, businessField: row.businessField, name: row.name, active: true })))
      .onConflictDoUpdate({
        target: businessClassifications.id,
        set: { businessField: sql`excluded.business_field`, name: sql`excluded.name`, active: true },
      })
  }

  for (const chunk of chunks(requirements, 200)) {
    await db
      .insert(vendorDocumentRequirements)
      .values(chunk.map((row) => ({
        id: row.id,
        category: row.category,
        name: row.name,
        nameEn: row.nameEn,
        required: row.required,
        appliesToForeign: row.appliesToForeign,
        sortOrder: row.sortOrder,
      })))
      .onConflictDoUpdate({
        target: vendorDocumentRequirements.id,
        set: {
          category: sql`excluded.category`,
          name: sql`excluded.name`,
          nameEn: sql`excluded.name_en`,
          required: sql`excluded.required`,
          appliesToForeign: sql`excluded.applies_to_foreign`,
          sortOrder: sql`excluded.sort_order`,
        },
      })
  }

  for (const chunk of chunks(questions, 200)) {
    await db
      .insert(bimQuestions)
      .values(chunk.map((row) => ({ id: row.id, question: row.question, sortOrder: row.sortOrder })))
      .onConflictDoUpdate({ target: bimQuestions.id, set: { question: sql`excluded.question`, sortOrder: sql`excluded.sort_order` } })
  }

  for (const chunk of chunks(divisions, 200)) {
    await db
      .insert(approvalDivisions)
      .values(chunk.map((row) => ({ code: row.code, name: row.name, active: true })))
      .onConflictDoUpdate({ target: approvalDivisions.code, set: { name: sql`excluded.name`, active: true } })
  }
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size))
  return result
}
