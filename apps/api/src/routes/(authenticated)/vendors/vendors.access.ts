import { HttpError, forbidden, notFound, unauthorized } from '@southneuhof/sprindle'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { getDb, type DbOrTx } from '../../../db'
import { orgIdentity, requireOrgIdentity, type OrgIdentity } from '../../../identity'
import { publicRecord } from '../../../storage/assets'
import { isForeignCompanyType, vendorDetailPublicSchema, type VendorDetailPublic } from '../../vendors/vendors.contract'
import { publicBimAnswer, publicDocumentSlot } from '../../vendors/vendors.documents'
import {
  bimAnswers,
  vendorBusinessClassifications,
  vendorContacts,
  vendorDocuments,
  vendorReviews,
  vendors,
  type VendorStatusCode,
} from '../../vendors/vendors.entity'
import { bimQuestions, businessClassifications, vendorDocumentRequirements } from '../../vendors/vendors.masters.entity'

export type OwnVendorRow = typeof vendors.$inferSelect

const editableStatuses: readonly VendorStatusCode[] = ['registered', 'email_verified', 'profile_complete', 'rejected']
const submittedStatuses: readonly VendorStatusCode[] = ['submitted']
const decidedStatuses: readonly VendorStatusCode[] = ['approved', 'rejected']

export function assertEditable(row: OwnVendorRow): void {
  if (!editableStatuses.includes(row.statusCode)) {
    throw new HttpError(409, 'vendor_locked', 'The vendor registration is locked until the staff review completes.')
  }
}

export function assertSubmitted(row: OwnVendorRow): void {
  if (!submittedStatuses.includes(row.statusCode)) {
    throw new HttpError(409, 'invalid_transition', 'The vendor registration is not in review.')
  }
}

export function isLocked(row: OwnVendorRow): boolean {
  return !editableStatuses.includes(row.statusCode)
}

export function isDecided(row: OwnVendorRow): boolean {
  return decidedStatuses.includes(row.statusCode)
}

/** Resolves the vendor owned by the signed-in account. */
export async function requireOwnVendor(args: Parameters<typeof requireOrgIdentity>[0]): Promise<{ identity: OrgIdentity; row: OwnVendorRow }> {
  const identity = await requireOrgIdentity(args)
  const row = (await getDb().select().from(vendors).where(eq(vendors.ownerUserId, identity.userId)).limit(1))[0]
  if (!row) throw notFound('No vendor registration belongs to this account.')
  return { identity, row }
}

/**
 * Read guard for a vendor's child collections: staff need `detail-vendors`,
 * and a vendor owner reads only its own record.
 */
export function authorizeVendorRead() {
  return async (args: Parameters<typeof orgIdentity>[0]) => {
    const identity = await orgIdentity(args)
    if (!identity) throw unauthorized()
    if (identity.permissions.has('detail-vendors')) return
    const vendorId = args.c.req.query('vendor_id')
    if (!vendorId) throw forbidden('Missing vendor scope.')
    const owned = (
      await getDb()
        .select({ id: vendors.id })
        .from(vendors)
        .where(and(eq(vendors.id, vendorId), eq(vendors.ownerUserId, identity.userId)))
        .limit(1)
    )[0]
    if (!owned) throw forbidden('This vendor does not belong to this account.')
  }
}

export function contactBelongsToVendor(vendorId: string, contactId: string) {
  return and(eq(vendorContacts.id, contactId), eq(vendorContacts.vendorId, vendorId))
}

export function documentSlotBelongsToVendor(vendorId: string, requirementId: string) {
  return and(eq(vendorDocuments.vendorId, vendorId), eq(vendorDocuments.requirementId, requirementId))
}

/** Document requirements that apply to this company type. */
export async function applicableRequirements(db: DbOrTx, companyType: string) {
  const rows = await db
    .select()
    .from(vendorDocumentRequirements)
    .where(isForeignCompanyType(companyType) ? eq(vendorDocumentRequirements.appliesToForeign, true) : undefined)
    .orderBy(asc(vendorDocumentRequirements.category), asc(vendorDocumentRequirements.sortOrder), asc(vendorDocumentRequirements.id))
  return rows
}

export type VendorProgress = {
  areas: Record<string, boolean>
  missing: string[]
}

/**
 * One completeness rule set for the vendor menu and the submit guard.
 * Documents and BIM answers do not block submit; the reviewer sees them.
 */
export function vendorProgress(input: {
  row: OwnVendorRow
  contactCount: number
  classificationCount: number
  documents: { required: boolean; filled: boolean }[]
  bim: { answered: boolean }[]
}): VendorProgress {
  const { row } = input
  const profileComplete = Boolean(row.address && row.city && row.phone)
  const fieldsComplete = Boolean(row.qualification && row.coverage)
  const classificationComplete = input.classificationCount > 0
  const requiredDocuments = input.documents.filter((slot) => slot.required)
  const documentComplete = requiredDocuments.every((slot) => slot.filled)
  const bimComplete = input.bim.length > 0 && input.bim.every((entry) => entry.answered)
  const confirmed = Boolean(row.confirmedAt) || isLocked(row)
  const missing: string[] = []
  if (!profileComplete) missing.push('address', 'city', 'phone')
  if (input.contactCount === 0) missing.push('contact')
  if (!fieldsComplete) missing.push('qualification', 'coverage')
  if (!classificationComplete) missing.push('classification')
  return {
    areas: {
      'data_perusahaan': profileComplete,
      'contact_person': input.contactCount > 0,
      'bidang_usaha': fieldsComplete && classificationComplete,
      'data_pendukung_legal': documentComplete,
      'data_pendukung_teknis': documentComplete,
      'data_pendukung_keuangan': documentComplete,
      'input_bim': bimComplete,
      'konfirmasi_selesai': confirmed,
    },
    missing,
  }
}

/** Loads the full owner or staff payload for one vendor. */
export async function vendorDetail(vendorId: string): Promise<VendorDetailPublic | undefined> {
  const db = getDb()
  const row = (await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1))[0]
  if (!row) return undefined

  const [contacts, classificationRows, documentRows, requirements, questionRows, answerRows, reviewRows] = await Promise.all([
    db.select().from(vendorContacts).where(eq(vendorContacts.vendorId, vendorId)).orderBy(asc(vendorContacts.name), asc(vendorContacts.id)),
    db
      .select({ id: businessClassifications.id, name: businessClassifications.name, businessField: businessClassifications.businessField })
      .from(vendorBusinessClassifications)
      .innerJoin(businessClassifications, eq(businessClassifications.id, vendorBusinessClassifications.classificationId))
      .where(eq(vendorBusinessClassifications.vendorId, vendorId))
      .orderBy(asc(businessClassifications.name)),
    db.select().from(vendorDocuments).where(eq(vendorDocuments.vendorId, vendorId)),
    applicableRequirements(db, row.companyType),
    db.select().from(bimQuestions).orderBy(asc(bimQuestions.sortOrder), asc(bimQuestions.id)),
    db.select().from(bimAnswers).where(eq(bimAnswers.vendorId, vendorId)),
    db.select().from(vendorReviews).where(eq(vendorReviews.vendorId, vendorId)),
  ])

  const documentByRequirement = new Map(documentRows.map((document) => [document.requirementId, document]))
  const answerByQuestion = new Map(answerRows.map((answer) => [answer.questionId, answer]))
  const slots = requirements.map((requirement) => publicDocumentSlot(requirement, documentByRequirement.get(requirement.id)))
  const bim = questionRows.map((question) => publicBimAnswer(question, answerByQuestion.get(question.id)))
  const progress = vendorProgress({
    row,
    contactCount: contacts.length,
    classificationCount: classificationRows.length,
    documents: slots.map((slot) => ({ required: slot.required, filled: slot.file !== null })),
    bim: bim.map((entry) => ({ answered: entry.answer !== null })),
  })

  return publicRecord(vendorDetailPublicSchema, {
    vendor: row,
    contacts,
    classifications: classificationRows,
    documents: slots,
    bim,
    reviews: reviewRows.map((review) => ({
      aspect: review.aspect,
      decision: review.decision,
      note: review.note,
      reviewerUserId: review.reviewerUserId,
      reviewedAt: review.reviewedAt,
    })),
    progress: progress.areas,
    missing: progress.missing,
  }) as VendorDetailPublic
}

export async function countVendorChildren(db: DbOrTx, vendorId: string) {
  const [contacts, classifications] = await Promise.all([
    db.select({ id: vendorContacts.id }).from(vendorContacts).where(eq(vendorContacts.vendorId, vendorId)),
    db
      .select({ id: vendorBusinessClassifications.classificationId })
      .from(vendorBusinessClassifications)
      .where(eq(vendorBusinessClassifications.vendorId, vendorId)),
  ])
  return { contacts: contacts.length, classifications: classifications.length }
}

export function requirementIdsFrom(rows: { requirementId: string }[]) {
  return rows.length ? inArray(vendorDocuments.requirementId, rows.map((row) => row.requirementId)) : undefined
}

/**
 * Promotes the stored status to `profile_complete` once the common data is
 * present. The status only moves forward here: the submit guard checks the
 * real values, so a later removal cannot open a locked record.
 */
export async function promoteCommonDataStatus(db: DbOrTx, vendorId: string) {
  const row = (await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1))[0]
  if (!row || (row.statusCode !== 'registered' && row.statusCode !== 'email_verified')) return
  const children = await countVendorChildren(db, vendorId)
  const complete =
    Boolean(row.address && row.city && row.phone && row.qualification && row.coverage) && children.contacts > 0 && children.classifications > 0
  if (!complete) return
  await db.update(vendors).set({ statusCode: 'profile_complete', updatedAt: new Date().toISOString() }).where(eq(vendors.id, vendorId))
}
