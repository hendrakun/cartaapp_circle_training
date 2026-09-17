import { defineDomainPart } from '@southneuhof/sprindle/model'
import { approvalDivisions, bimQuestions, businessClassifications, vendorDocumentRequirements } from './vendors.masters.entity'
import { bimAnswers, vendor, vendorBusinessClassifications, vendorContacts, vendorDocuments, vendorReviews, vendors } from './vendors.entity'

export const domain = defineDomainPart({
  tables: {
    vendors,
    vendorContacts,
    vendorBusinessClassifications,
    vendorDocuments,
    bimAnswers,
    vendorReviews,
    businessClassifications,
    vendorDocumentRequirements,
    bimQuestions,
    approvalDivisions,
  },
  entities: [vendor],
})

export default { domain }
