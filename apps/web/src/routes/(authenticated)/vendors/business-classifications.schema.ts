import type { WebResourceSchema } from '@southneuhof/loom'
import { z } from 'zod/v4'
import { defineSchema } from '@/framework/schema'
import type { VendorClassificationRecord } from './vendors.types'

export type BusinessClassificationSchema = WebResourceSchema<VendorClassificationRecord, Record<string, unknown>, Record<string, never>, Record<string, never>, string>

export const businessClassificationsSchema = defineSchema<BusinessClassificationSchema>({
  identity: 'id',
  record: z.object({
    id: z.string(),
    name: z.string(),
    businessField: z.enum(['subkon', 'supplier', 'jasa']),
  }),
})
