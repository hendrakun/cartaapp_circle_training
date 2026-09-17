import { isForeignCompanyType } from './vendors.options'

export type VendorIdentityInput = {
  companyType?: unknown
  npwp?: string | null
  taxId?: string | null
}

/**
 * Client mirror of the API `identityRuleIssues` rule: a domestic vendor needs a
 * 16-digit NPWP, a foreign vendor needs a tax ID. The server stays authoritative.
 */
export function vendorIdentityIssues(input: VendorIdentityInput): { field: 'npwp' | 'taxId'; message: string }[] {
  const npwpDigits = (input.npwp ?? '').replace(/[^0-9]/g, '')
  const foreign = isForeignCompanyType(input.companyType)
  const issues: { field: 'npwp' | 'taxId'; message: string }[] = []
  if (foreign) {
    if (!input.taxId) issues.push({ field: 'taxId', message: 'Tax ID is required for foreign vendors.' })
    if (npwpDigits) issues.push({ field: 'npwp', message: 'NPWP is for domestic vendors only.' })
    return issues
  }
  if (npwpDigits.length !== 16) issues.push({ field: 'npwp', message: 'NPWP must have exactly 16 digits.' })
  if (input.taxId) issues.push({ field: 'taxId', message: 'Tax ID is for foreign vendors only.' })
  return issues
}
