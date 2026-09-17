import { storedAssetSchema, type StoredAsset } from '@southneuhof/api/schema'
import { fromZod, type FieldsInput } from '@southneuhof/loom'
import { z } from 'zod/v4'
import { emptyBimDraft, type BimDraft, type BimQuestion } from './vendors.bim.types'

/**
 * The questionnaire is one form. Each question owns three fields: the answer,
 * an optional note and an optional attachment. Field keys carry the question
 * id, so a question can grow without a second declaration path.
 */
export function bimFieldsFor(questions: BimQuestion[]): FieldsInput<BimDraft, BimDraft> {
  const fields: Record<string, unknown> = {}
  for (const question of questions) {
    fields[`q_${question.questionId}_answer`] = {
      label: question.question,
      span: 12,
      form: { renderer: 'radio', source: bimAnswerOptions, props: { required: true, direction: 'row' } },
    }
    fields[`q_${question.questionId}_note`] = { label: 'Note', span: 7, form: { renderer: 'textarea' } }
    fields[`q_${question.questionId}_file`] = {
      label: 'Attachment',
      span: 5,
      form: { renderer: 'file', props: { accept: 'application/pdf', maxSize: 16 * 1024 * 1024 } },
    }
  }
  return fields as FieldsInput<BimDraft, BimDraft>
}

export const bimAnswerOptions = [
  { id: 'yes', name: 'Ya' },
  { id: 'no', name: 'Tidak' },
]

export function bimSchemaFor(questions: BimQuestion[]) {
  const shape: Record<string, z.ZodType> = {}
  for (const question of questions) {
    shape[`q_${question.questionId}_answer`] = z.enum(['yes', 'no'])
    shape[`q_${question.questionId}_note`] = z.string().max(2000).nullable().optional()
    shape[`q_${question.questionId}_file`] = storedAssetSchema.nullable().optional()
  }
  return fromZod(z.object(shape))
}

/** Answers become the draft values: booleans become the radio choice. */
export function bimInitial(questions: BimQuestion[]): BimDraft {
  const draft = emptyBimDraft()
  for (const question of questions) {
    draft[`q_${question.questionId}_answer`] = question.answer === null ? null : question.answer ? 'yes' : 'no'
    draft[`q_${question.questionId}_note`] = question.note ?? null
    draft[`q_${question.questionId}_file`] = question.file ?? null
  }
  return draft
}

export function bimPayload(questions: BimQuestion[], draft: BimDraft): { questionId: string; answer: boolean; note: string | null; file: StoredAsset | null }[] {
  return questions.map((question) => ({
    questionId: question.questionId,
    answer: draft[`q_${question.questionId}_answer`] === 'yes',
    note: (draft[`q_${question.questionId}_note`] as string | null) ?? null,
    file: (draft[`q_${question.questionId}_file`] as StoredAsset | null | undefined) ?? null,
  }))
}
