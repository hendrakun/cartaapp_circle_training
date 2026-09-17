import type { StoredAsset } from '@southneuhof/api/schema'

export type BimQuestion = {
  questionId: string
  question: string
  sortOrder: number
  answer: boolean | null
  note: string | null
  file: StoredAsset | null
}

export type BimDraft = Record<string, string | StoredAsset | null | undefined>

export function emptyBimDraft(): BimDraft {
  return {}
}
