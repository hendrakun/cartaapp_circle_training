import { describe, expect, it } from 'vitest'
import { resolveFields } from '@southneuhof/loom'
import { vendorBidangUsahaFields } from './vendors.bidang-usaha'
import { vendorDocumentFields } from './vendors.documents'
import { vendorProfileFields } from './vendors.profile'
import { vendorReviewFields } from './vendors.review'
import { vendorRegisterFields } from '@/routes/(public)/vendors/register/vendors.register'

/**
 * A direct `Form` or `DialogForm` receives plain field definitions.
 * `defineFields` returns references for `defineResource`, and an unresolved
 * reference silently loses its renderer, source and props, so the control
 * cannot hold a value.
 */
const directFormCatalogs = {
  register: vendorRegisterFields,
  profile: vendorProfileFields,
  bidangUsaha: vendorBidangUsahaFields,
  documents: vendorDocumentFields,
  review: vendorReviewFields,
}

describe('direct form field catalogs', () => {
  it('resolves every declared field with its declared control and source', () => {
    for (const [name, catalog] of Object.entries(directFormCatalogs)) {
      const resolved = resolveFields({ fields: catalog, surface: 'form' })
      expect(
        resolved.map((field) => field.key),
        `${name} field keys`
      ).toEqual(Object.keys(catalog))
      for (const field of resolved) {
        const declared = (catalog as Record<string, { form?: { renderer?: string; source?: unknown } }>)[field.key]!
        expect(field.renderer, `${name}.${field.key} renderer`).toBe(declared.form?.renderer)
        expect(field.label, `${name}.${field.key} label`).not.toBe(field.key)
        if (declared.form?.source !== undefined) expect(field.source, `${name}.${field.key} source`).toBe(declared.form.source)
      }
    }
  })
})
