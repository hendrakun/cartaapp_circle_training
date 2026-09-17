import type { FieldsInput } from '@southneuhof/loom'
import { fromZod } from '@southneuhof/loom'
import { vendorProfilePatchSchema } from '@southneuhof/api/routes/vendors/vendors.contract'
import { z } from 'zod/v4'
import { vendorIdentityIssues } from './vendors.identity'
import { isForeignCompanyType, vendorCompanyTypeOptions } from './vendors.options'

/**
 * Plain field definitions for a direct `Form`. `defineFields` references belong
 * to `defineResource`.
 */
const required = { required: true }

export const vendorProfileFields = {
  companyName: { label: 'Company name', form: { renderer: 'text', props: required } },
  companyType: { label: 'Company type', form: { renderer: 'select', source: vendorCompanyTypeOptions, props: required } },
  npwp: {
    label: 'NPWP',
    form: {
      renderer: 'text',
      behavior: {
        visible: ({ draft }) => !isForeignCompanyType(draft.companyType),
        resetWhen: ({ draft }) => draft.companyType,
      },
    },
  },
  taxId: {
    label: 'Tax ID',
    form: {
      renderer: 'text',
      behavior: {
        visible: ({ draft }) => isForeignCompanyType(draft.companyType),
        resetWhen: ({ draft }) => draft.companyType,
      },
    },
  },
  address: { label: 'Address', form: { renderer: 'textarea', props: required } },
  province: { label: 'Province', form: { renderer: 'text' } },
  city: { label: 'City', form: { renderer: 'text', props: required } },
  district: { label: 'District', form: { renderer: 'text' } },
  village: { label: 'Village', form: { renderer: 'text' } },
  postalCode: { label: 'Postal code', form: { renderer: 'text' } },
  phone: { label: 'Phone', form: { renderer: 'text', props: required } },
} satisfies FieldsInput<Record<string, unknown>, Record<string, unknown>>

export const vendorProfileSchema = fromZod(
  vendorProfilePatchSchema.superRefine((input, context) => {
    for (const issue of vendorIdentityIssues(input)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message })
    }
  })
)

const profileKeys = ['companyName', 'companyType', 'npwp', 'taxId', 'address', 'province', 'city', 'district', 'village', 'postalCode', 'phone'] as const

/**
 * Only profile keys reach the form draft. Other record keys would otherwise be
 * submitted and rejected by the strict patch schema.
 */
export function vendorProfileInitial(vendor: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(profileKeys.flatMap((key) => (key in vendor ? [[key, vendor[key]]] : [])))
}
