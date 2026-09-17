import { storedAsset } from '../../storage/assets'
import {
  bimAnswerPublicSchema,
  vendorDocumentSlotPublicSchema,
  type BimAnswerPublic,
  type VendorDocumentSlotPublic,
} from './vendors.contract'
import { vendorDocumentRequirements, type bimQuestions } from './vendors.masters.entity'

type DocumentRow = {
  requirementId: string
  fileKey: string
  fileName: string
  mimeType: string | null
  fileSize: number | null
  updatedAt: string
}

type RequirementRow = typeof vendorDocumentRequirements.$inferSelect
type BimAnswerRow = {
  questionId: string
  answer: boolean
  note: string | null
  fileKey: string | null
  fileName: string | null
  mimeType: string | null
  fileSize: number | null
}
type BimQuestionRow = typeof bimQuestions.$inferSelect

/**
 * A stored object key becomes a public StoredAsset. The original file name
 * becomes its display name, because the object key is generated.
 */
export function storedAssetValue(row: { fileKey: string; fileName: string; fileSize: number | null; updatedAt: string }) {
  return {
    ...storedAsset(row.fileKey, {
      ...(row.fileSize == null ? {} : { size: row.fileSize }),
      updatedAt: row.updatedAt,
    }),
    name: row.fileName,
  }
}

/** One fixed document slot, empty or filled. */
export function publicDocumentSlot(requirement: RequirementRow, row: DocumentRow | undefined): VendorDocumentSlotPublic {
  return vendorDocumentSlotPublicSchema.parse({
    requirementId: requirement.id,
    category: requirement.category,
    name: requirement.name,
    nameEn: requirement.nameEn,
    required: requirement.required,
    appliesToForeign: requirement.appliesToForeign,
    sortOrder: requirement.sortOrder,
    file: row ? storedAssetValue(row) : null,
    updatedAt: row?.updatedAt ?? null,
  })
}

/** One BIM question with the vendor's answer, or null when unanswered. */
export function publicBimAnswer(question: BimQuestionRow, row: BimAnswerRow | undefined): BimAnswerPublic {
  return bimAnswerPublicSchema.parse({
    questionId: question.id,
    question: question.question,
    sortOrder: question.sortOrder,
    answer: row?.answer ?? null,
    note: row?.note ?? null,
    file: row?.fileKey && row.fileName ? storedAssetValue({ fileKey: row.fileKey, fileName: row.fileName, fileSize: row.fileSize, updatedAt: '' }) : null,
  })
}
