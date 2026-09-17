import { storedAssetSchema, type StoredAsset } from '@southneuhof/api/schema'
import { fromZod, type FieldsInput } from '@southneuhof/loom'
import { z } from 'zod/v4'

/** One fixed document slot. The HTTP shape carries the complete asset object. */
export const vendorDocumentFields = {
  file: {
    label: 'File',
    form: {
      span: 12,
      renderer: 'file',
      props: { accept: 'application/pdf', maxSize: 16 * 1024 * 1024, required: true },
    },
  },
} satisfies FieldsInput<Record<string, unknown>, Record<string, unknown>>

export const vendorDocumentSchema = fromZod(z.object({ file: storedAssetSchema }))

export type VendorDocumentInput = { file: StoredAsset }
