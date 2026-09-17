import type { StoredAsset } from '@southneuhof/api/schema'

export type VendorContactRecord = {
  id: string
  vendorId: string
  name: string
  role: string | null
  phone: string | null
  email: string | null
  createdAt: string
  updatedAt: string
}

export type VendorClassificationRecord = {
  id: string
  name: string
  businessField: 'subkon' | 'supplier' | 'jasa'
}

export type VendorDocumentSlot = {
  requirementId: string
  category: 'legal' | 'finance' | 'technical'
  name: string
  nameEn: string | null
  required: boolean
  appliesToForeign: boolean
  sortOrder: number
  file: StoredAsset | null
  updatedAt: string | null
}

export type BimAnswerRecord = {
  questionId: string
  question: string
  sortOrder: number
  answer: boolean | null
  note: string | null
  file: StoredAsset | null
}

export type VendorReviewRecord = {
  aspect: 'legal' | 'finance' | 'technical' | 'bim'
  decision: 'approved' | 'rejected'
  note: string | null
  reviewerUserId: string
  reviewedAt: string
}

export type VendorProgressAreas = {
  data_perusahaan: boolean
  contact_person: boolean
  bidang_usaha: boolean
  data_dokumen_legal: boolean
  data_dokumen_teknis: boolean
  data_dokumen_keuangan: boolean
  input_bim: boolean
  konfirmasi_selesai: boolean
}

export type VendorRecord = {
  id: string
  companyName: string
  companyType: string
  email: string
  username: string
  npwp: string | null
  taxId: string | null
  businessField: 'subkon' | 'supplier' | 'jasa'
  qualification: 'mikro' | 'kecil' | 'menengah' | 'besar' | null
  coverage: 'lokal' | 'regional' | 'nasional' | 'internasional' | null
  address: string | null
  province: string | null
  city: string | null
  district: string | null
  village: string | null
  postalCode: string | null
  phone: string | null
  statusCode: string
  emailVerifiedAt: string | null
  submittedAt: string | null
  approvalDivisionCode: string | null
  confirmedAt: string | null
  reviewNote: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
}

export type VendorDetail = {
  vendor: VendorRecord
  contacts: VendorContactRecord[]
  classifications: VendorClassificationRecord[]
  documents: VendorDocumentSlot[]
  bim: BimAnswerRecord[]
  reviews: VendorReviewRecord[]
  progress: Record<string, boolean>
  missing: string[]
}

export type ApprovalDivision = {
  code: string
  name: string
}

export const vendorReviewAspects = ['legal', 'finance', 'technical', 'bim'] as const
