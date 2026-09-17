import type { WebResourceSchema } from '@southneuhof/loom'
import { z } from 'zod/v4'
import { defineSchema } from '@/framework/schema'
import type { VendorContactRecord } from './vendors.types'

export type VendorContactInput = {
  name: string
  role?: string | null
  phone?: string | null
  email?: string | null
}

export type VendorContactSchema = WebResourceSchema<VendorContactRecord, Record<string, unknown>, VendorContactInput, Partial<VendorContactInput>, string>

const contactFields = {
  name: z.string().trim().min(1).max(160),
  role: z.string().trim().max(160).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
  email: z.string().trim().email().max(255).nullable().optional(),
}

export const vendorContactsSchema = defineSchema<VendorContactSchema>({
  identity: 'id',
  create: z.object(contactFields),
  update: z.object(contactFields),
})
