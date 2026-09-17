import { defineRoute, HttpError } from '@southneuhof/sprindle'
import { inArray } from 'drizzle-orm'
import { getDb } from '../../../../../db'
import { readJsonBody } from '../../../../../request-body'
import { storedAssetInput } from '../../../../../schema'
import { bimAnswersInputSchema } from '../../../../vendors/vendors.contract'
import { bimAnswers } from '../../../../vendors/vendors.entity'
import { bimQuestions } from '../../../../vendors/vendors.masters.entity'
import { assertEditable, requireOwnVendor, vendorDetail } from '../../vendors.access'

/** Saves every answered question in one transaction. */
export const PUT = defineRoute({
  openapi: { requestBody: bimAnswersInputSchema },
  action: async (args) => {
    const input = bimAnswersInputSchema.parse(await readJsonBody(args.c))
    const { identity, row } = await requireOwnVendor(args)
    assertEditable(row)

    const known = await getDb().select({ id: bimQuestions.id }).from(bimQuestions)
    const knownIds = new Set(known.map((question) => question.id))
    const unknown = input.answers.filter((answer) => !knownIds.has(answer.questionId))
    if (unknown.length) {
      throw new HttpError(422, 'bim_question_unknown', undefined, unknown.map((answer) => ({ field: answer.questionId, message: 'This BIM question does not exist.' })))
    }

    const now = new Date().toISOString()
    await getDb().transaction(async (tx) => {
      if (input.answers.length) {
        const answeredIds = input.answers.map((answer) => answer.questionId)
        await tx.delete(bimAnswers).where(inArray(bimAnswers.questionId, answeredIds))
        await tx.insert(bimAnswers).values(
          input.answers.map((answer) => ({
            vendorId: row.id,
            questionId: answer.questionId,
            answer: answer.answer,
            note: answer.note ?? null,
            fileKey: answer.file ? storedAssetInput.parse(answer.file) : null,
            fileName: answer.file?.name ?? null,
            mimeType: answer.file?.mimeType ?? null,
            fileSize: answer.file?.size ?? null,
            createdByUserId: identity.userId,
            updatedByUserId: identity.userId,
            updatedAt: now,
          })),
        )
      }
    })

    return { data: await vendorDetail(row.id) }
  },
})
