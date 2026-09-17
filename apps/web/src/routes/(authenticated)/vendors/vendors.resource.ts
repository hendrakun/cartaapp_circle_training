import { defineFields, defineResource } from '@southneuhof/loom'
import { vendorsActions } from './vendors.actions'
import { vendorsSchema } from './vendors.schema'
import { vendorBusinessFieldLabels, vendorCompanyTypeLabels, vendorCoverageLabels, vendorQualificationLabels, vendorStatusLabels } from './vendors.options'

const fields = defineFields(vendorsSchema, {
  companyName: { label: 'Company name' },
  username: { label: 'Username' },
  companyType: { label: 'Company type', display: { renderer: 'chip', props: { options: vendorCompanyTypeLabels } } },
  email: { label: 'Email' },
  npwp: { label: 'NPWP' },
  taxId: { label: 'Tax ID' },
  businessField: { label: 'Business field', display: { renderer: 'chip', props: { options: vendorBusinessFieldLabels } } },
  city: { label: 'City' },
  province: { label: 'Province' },
  phone: { label: 'Phone' },
  qualification: { label: 'Qualification', display: { renderer: 'chip', props: { options: vendorQualificationLabels } } },
  coverage: { label: 'Coverage', display: { renderer: 'chip', props: { options: vendorCoverageLabels } } },
  statusCode: { label: 'Status', display: { renderer: 'chip', props: { options: vendorStatusLabels } } },
  submittedAt: { label: 'Submitted at', display: { format: 'datetime' } },
  reviewedAt: { label: 'Reviewed at', display: { format: 'datetime' } },
  reviewNote: { label: 'Review note' },
  createdAt: { label: 'Created at', display: { format: 'datetime' } },
  updatedAt: { label: 'Updated at', display: { format: 'datetime' } },
})

export const vendors = defineResource(vendorsSchema, {
  key: 'vendors',
  actions: {
    list: {
      run: vendorsActions.list,
      fields: [fields.companyName, fields.username, fields.companyType, fields.businessField, fields.city, fields.statusCode, fields.submittedAt],
      permission: 'view-vendors',
      route: { name: 'vendors' },
    },
    detail: {
      run: vendorsActions.detail,
      fields: [
        fields.companyName,
        fields.username,
        fields.companyType,
        fields.email,
        fields.npwp,
        fields.taxId,
        fields.businessField,
        fields.qualification,
        fields.coverage,
        fields.city,
        fields.province,
        fields.phone,
        fields.statusCode,
        fields.submittedAt,
        fields.reviewedAt,
        fields.reviewNote,
        fields.createdAt,
      ],
      permission: 'view-vendors',
      route: { name: 'vendors-detail', params: (id) => ({ vendorId: String(id) }) },
      title: 'Vendor detail',
    },
    mine: { run: vendorsActions.mine },
    saveMine: { run: vendorsActions.saveMine },
    submitMine: { run: vendorsActions.submitMine },
    review: { run: vendorsActions.review },
  },
})
