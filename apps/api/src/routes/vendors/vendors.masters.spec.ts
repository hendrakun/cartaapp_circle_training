import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * The vendor reference lists come from the legacy HK-Circle dump. This spec
 * guards the extracted files, so a bad extraction cannot reach the seed.
 */
function readMaster<T>(file: string): T[] {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../../../scripts/master-data/${file}`, import.meta.url)), 'utf8')) as T[]
}

describe('vendor reference master data', () => {
  it('keeps the classification list per business field', () => {
    const rows = readMaster<{ id: string; businessField: string; name: string }>('business-classifications.json')
    const perField = rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.businessField]: (acc[row.businessField] ?? 0) + 1 }), {})
    expect(perField).toEqual({ subkon: 135, supplier: 216, jasa: 99 })
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)
    expect(rows.every((row) => row.name.length > 0)).toBe(true)
  })

  it('keeps the fixed document requirements per category', () => {
    const rows = readMaster<{ id: string; category: string; name: string; nameEn: string | null; required: boolean; appliesToForeign: boolean; sortOrder: number }>(
      'vendor-document-requirements.json',
    )
    const perCategory = rows.reduce<Record<string, number>>((acc, row) => ({ ...acc, [row.category]: (acc[row.category] ?? 0) + 1 }), {})
    expect(perCategory).toEqual({ technical: 2, finance: 6, legal: 6 })
    expect(rows.filter((row) => !row.appliesToForeign).map((row) => row.id).sort()).toEqual(['13', '23'])
    expect(rows.every((row) => row.required)).toBe(true)
    expect(rows.every((row) => row.name.length > 0 && !row.name.includes('\\'))).toBe(true)
  })

  it('keeps the eleven BIM questions', () => {
    const rows = readMaster<{ id: string; question: string; sortOrder: number }>('bim-questions.json')
    expect(rows).toHaveLength(11)
    expect(rows.every((row) => row.question.length > 20)).toBe(true)
    expect(new Set(rows.map((row) => row.id)).size).toBe(11)
  })

  it('keeps the eight approval divisions', () => {
    const rows = readMaster<{ code: string; name: string }>('approval-divisions.json')
    expect(rows).toHaveLength(8)
    expect(rows.some((row) => row.code === '00')).toBe(true)
    expect(new Set(rows.map((row) => row.code)).size).toBe(8)
  })
})
