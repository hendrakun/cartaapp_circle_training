import { defineRoute, HttpError } from '@southneuhof/sprindle'
import { and, eq, ne } from 'drizzle-orm'
import { getDb } from '../../../../db'
import { readJsonBody } from '../../../../request-body'
import { identityRuleIssues, normalizeNpwp, vendorProfilePatchSchema } from '../../../vendors/vendors.contract'
import { vendorBusinessClassifications, vendors } from '../../../vendors/vendors.entity'
import { assertEditable, promoteCommonDataStatus, requireOwnVendor, vendorDetail } from '../vendors.access'

/**
 * Owner profile and company grouping. The route has no record identifier: the
 * signed-in account resolves its own vendor, so a foreign identifier cannot be
 * supplied.
 */
export const GET = defineRoute({
  action: async (args) => {
    const { row } = await requireOwnVendor(args)
    return { data: await vendorDetail(row.id) }
  },
})

export const PATCH = defineRoute({
  openapi: { requestBody: vendorProfilePatchSchema },
  action: async (args) => {
    const input = vendorProfilePatchSchema.parse(await readJsonBody(args.c))
    const { identity, row } = await requireOwnVendor(args)
    assertEditable(row)

    const companyType = input.companyType ?? row.companyType
    const npwp = input.npwp === undefined ? row.npwp : normalizeNpwp(input.npwp)
    const taxId = input.taxId === undefined ? row.taxId : input.taxId
    const issues = identityRuleIssues({ companyType, npwp, taxId })
    if (issues.length) throw new HttpError(422, 'vendor_profile_invalid', undefined, issues)

    if (npwp) {
      const taken = (
        await getDb()
          .select({ id: vendors.id })
          .from(vendors)
          .where(and(eq(vendors.npwp, npwp), ne(vendors.id, row.id)))
          .limit(1)
      )[0]
      if (taken) throw new HttpError(422, 'npwp_exists', undefined, [{ field: 'npwp', message: 'NPWP is already registered.' }])
    }

    const merged = {
      ...row,
      ...(input.companyName === undefined ? {} : { companyName: input.companyName }),
      companyType,
      npwp,
      taxId,
      ...(input.businessField === undefined ? {} : { businessField: input.businessField }),
      ...(input.qualification === undefined ? {} : { qualification: input.qualification }),
      ...(input.coverage === undefined ? {} : { coverage: input.coverage }),
      ...(input.address === undefined ? {} : { address: input.address }),
      ...(input.province === undefined ? {} : { province: input.province }),
      ...(input.city === undefined ? {} : { city: input.city }),
      ...(input.district === undefined ? {} : { district: input.district }),
      ...(input.village === undefined ? {} : { village: input.village }),
      ...(input.postalCode === undefined ? {} : { postalCode: input.postalCode }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
    }

    await getDb().transaction(async (tx) => {
      await tx
        .update(vendors)
        .set({
          companyName: merged.companyName,
          companyType: merged.companyType,
          npwp: merged.npwp,
          taxId: merged.taxId,
          businessField: merged.businessField,
          qualification: merged.qualification,
          coverage: merged.coverage,
          address: merged.address,
          province: merged.province,
          city: merged.city,
          district: merged.district,
          village: merged.village,
          postalCode: merged.postalCode,
          phone: merged.phone,
          updatedAt: new Date().toISOString(),
          updatedByUserId: identity.userId,
        })
        .where(eq(vendors.id, row.id))
      // A classification belongs to one business field, so a field change clears
      // the previous selection instead of keeping mismatched rows.
      if (merged.businessField !== row.businessField) {
        await tx.delete(vendorBusinessClassifications).where(eq(vendorBusinessClassifications.vendorId, row.id))
      }
      await promoteCommonDataStatus(tx, row.id)
    })

    return { data: await vendorDetail(row.id) }
  },
})
