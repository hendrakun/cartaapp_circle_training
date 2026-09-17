import { defineRoute, notFound } from '@southneuhof/sprindle'
import { getDb } from '../../../../../../db'
import { readJsonBody } from '../../../../../../request-body'
import { storedAssetInput } from '../../../../../../schema'
import { vendorDocumentInputSchema } from '../../../../../vendors/vendors.contract'
import { vendorDocuments } from '../../../../../vendors/vendors.entity'
import { applicableRequirements, assertEditable, documentSlotBelongsToVendor, requireOwnVendor, vendorDetail } from '../../../vendors.access'

async function requireApplicableRequirement(companyType: string, requirementId: string) {
  const requirements = await applicableRequirements(getDb(), companyType)
  const requirement = requirements.find((entry) => entry.id === requirementId)
  if (!requirement) throw notFound()
  return requirement
}

/** Attaches or replaces the file for one fixed document slot. */
export const PUT = defineRoute({
  openapi: { requestBody: vendorDocumentInputSchema },
  action: async (args) => {
    const input = vendorDocumentInputSchema.parse(await readJsonBody(args.c))
    const { identity, row } = await requireOwnVendor(args)
    assertEditable(row)
    await requireApplicableRequirement(row.companyType, args.params.requirementId)

    const now = new Date().toISOString()
    const values = {
      vendorId: row.id,
      requirementId: args.params.requirementId,
      fileKey: storedAssetInput.parse(input.file),
      fileName: input.file.name,
      mimeType: input.file.mimeType ?? null,
      fileSize: input.file.size ?? null,
      updatedAt: now,
      updatedByUserId: identity.userId,
    }
    await getDb()
      .insert(vendorDocuments)
      .values({ ...values, createdByUserId: identity.userId })
      .onConflictDoUpdate({
        target: [vendorDocuments.vendorId, vendorDocuments.requirementId],
        set: {
          fileKey: values.fileKey,
          fileName: values.fileName,
          mimeType: values.mimeType,
          fileSize: values.fileSize,
          updatedAt: now,
          updatedByUserId: identity.userId,
        },
      })

    return { data: await vendorDetail(row.id) }
  },
})

/**
 * Removes the file from one slot. The stored object stays because another
 * record can reference the same upload key.
 */
export const DELETE = defineRoute({
  action: async (args) => {
    const { row } = await requireOwnVendor(args)
    assertEditable(row)
    const deleted = await getDb()
      .delete(vendorDocuments)
      .where(documentSlotBelongsToVendor(row.id, args.params.requirementId))
      .returning({ id: vendorDocuments.id })
    if (!deleted[0]) throw notFound()
    return { data: await vendorDetail(row.id) }
  },
})
