import { selectionValues } from '@southneuhof/api/schema'
import { vendorQualificationSchema, vendorCoverageSchema, vendorBusinessFieldSchema } from '@southneuhof/api/routes/vendors/vendors.entity'
import { fromZod, type FieldsInput } from '@southneuhof/loom'
import { z } from 'zod/v4'
import { businessClassifications } from './business-classifications.resource'
import { vendorCoverageOptions, vendorQualificationOptions } from './vendors.options'

/**
 * Bidang usaha owns the qualification, the coverage and the classification set.
 * The classification field is a searchable multi-select over the reference
 * resource, so it keeps the exact selected records, as the selection contract
 * requires.
 */
export const vendorBidangUsahaFields = {
  qualification: { label: 'Qualification', form: { renderer: 'select', source: vendorQualificationOptions, props: { required: true } } },
  coverage: { label: 'Coverage', form: { renderer: 'select', source: vendorCoverageOptions, props: { required: true } } },
  classifications: {
    label: 'Classifications',
    form: {
      span: 12,
      renderer: 'select',
      source: businessClassifications,
      props: { multi: true, pick: 'id', view: 'name', required: true },
      behavior: {
        props: ({ draft }) => ({ searchParameters: { business_field: draft.businessField } }),
        resetWhen: ({ draft }) => draft.businessField,
      },
    },
  },
} satisfies FieldsInput<Record<string, unknown>, Record<string, unknown>>

const classificationItem = z.object({
  id: z.string().trim().min(1),
  name: z.string(),
  businessField: vendorBusinessFieldSchema,
})

export const vendorBidangUsahaSchema = fromZod(
  z.object({
    qualification: vendorQualificationSchema,
    coverage: vendorCoverageSchema,
    classifications: selectionValues(classificationItem),
  })
)

export type VendorBidangUsahaInput = {
  qualification: 'mikro' | 'kecil' | 'menengah' | 'besar'
  coverage: 'lokal' | 'regional' | 'nasional' | 'internasional'
  classifications: { id: string; name: string; businessField: 'subkon' | 'supplier' | 'jasa' }[]
}
