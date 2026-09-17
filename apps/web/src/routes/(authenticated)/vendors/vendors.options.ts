/** Closed choice sets shared by the vendor display chips and form selects. */

export const vendorCompanyTypeLabels: Record<string, { label: string; color?: string }> = {
  pt: { label: 'PT' },
  cv: { label: 'CV' },
  firma: { label: 'Firma' },
  yayasan: { label: 'Yayasan' },
  koperasi: { label: 'Koperasi' },
  but: { label: 'BUT' },
  foreign_company: { label: 'Foreign company' },
  foreign_individual: { label: 'Foreign individual' },
  other: { label: 'Other' },
}

export const vendorBusinessFieldLabels: Record<string, { label: string; color?: string }> = {
  subkon: { label: 'Main/subcontractor' },
  supplier: { label: 'Supplier' },
  jasa: { label: 'Service provider' },
}

export const vendorStatusLabels: Record<string, { label: string; color?: string }> = {
  registered: { label: 'Registered', color: 'neutral' },
  email_verified: { label: 'Email verified', color: 'info' },
  profile_complete: { label: 'Profile complete', color: 'info' },
  submitted: { label: 'Submitted', color: 'warning' },
  approved: { label: 'Approved', color: 'success' },
  rejected: { label: 'Rejected', color: 'error' },
}

export const vendorDocumentTypeLabels: Record<string, { label: string; color?: string }> = {
  legal: { label: 'Legal' },
  finance: { label: 'Finance' },
  technical: { label: 'Technical' },
}

export const vendorCompanyTypeOptions = Object.entries(vendorCompanyTypeLabels).map(([id, value]) => ({ id, name: value.label }))
export const vendorBusinessFieldOptions = Object.entries(vendorBusinessFieldLabels).map(([id, value]) => ({ id, name: value.label }))
export const vendorDocumentTypeOptions = Object.entries(vendorDocumentTypeLabels).map(([id, value]) => ({ id, name: value.label }))

export function isForeignCompanyType(companyType: unknown): boolean {
  return companyType === 'foreign_company' || companyType === 'foreign_individual'
}

/** Statuses where the owner can still change the registration. */
export const editableVendorStatuses = ['registered', 'email_verified', 'profile_complete', 'rejected'] as const
export const submittableVendorStatuses = ['email_verified', 'profile_complete', 'rejected'] as const

export const vendorQualificationLabels: Record<string, { label: string; color?: string }> = {
  mikro: { label: 'Micro' },
  kecil: { label: 'Small' },
  menengah: { label: 'Medium' },
  besar: { label: 'Large' },
}

export const vendorCoverageLabels: Record<string, { label: string; color?: string }> = {
  lokal: { label: 'Local' },
  regional: { label: 'Regional' },
  nasional: { label: 'National' },
  internasional: { label: 'International' },
}

export const vendorReviewAspectLabels: Record<string, string> = {
  legal: 'Legal',
  finance: 'Finance',
  technical: 'Technical',
  bim: 'Building Information Modeling',
}

export const vendorQualificationOptions = Object.entries(vendorQualificationLabels).map(([id, value]) => ({ id, name: value.label }))
export const vendorCoverageOptions = Object.entries(vendorCoverageLabels).map(([id, value]) => ({ id, name: value.label }))
