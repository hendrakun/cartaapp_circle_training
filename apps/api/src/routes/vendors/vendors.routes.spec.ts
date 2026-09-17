import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { app } from '../../app'
import { closeDb, getDb } from '../../db'
import { cleanupSessions, createSystemSession } from '../../testing/session'
import { getAuth } from '../auth/auth'
import { users } from '../(authenticated)/users/users.entity'
import { vendors } from './vendors.entity'
import { approvalDivisions, bimQuestions, businessClassifications, vendorDocumentRequirements } from './vendors.masters.entity'

const PASSWORD = 'password-123'
const DIVISION_CODE = 'T00'
const ownedVendorIds = new Set<string>()
const ownedUserIds = new Set<string>()

/**
 * The test target runs migrations but not the reference seed, so this spec
 * owns the master rows it needs. Fixture ids are stable, and every assertion
 * tolerates the real seeded rows as well.
 */
const classificationFixtures = [
  { id: 'test-subkon-1', businessField: 'subkon' as const, name: 'Test Subkon Satu' },
  { id: 'test-supplier-1', businessField: 'supplier' as const, name: 'Test Supplier Satu' },
  { id: 'test-supplier-2', businessField: 'supplier' as const, name: 'Test Supplier Dua' },
  { id: 'test-supplier-3', businessField: 'supplier' as const, name: 'Test Supplier Tiga' },
  { id: 'test-jasa-1', businessField: 'jasa' as const, name: 'Test Jasa Satu' },
]
const requirementFixtures = [
  { id: 'test-legal-1', category: 'legal' as const, name: 'Test Legal Satu', appliesToForeign: true, sortOrder: 1 },
  { id: 'test-legal-2', category: 'legal' as const, name: 'Test Legal Dua', appliesToForeign: true, sortOrder: 2 },
  { id: 'test-finance-domestic', category: 'finance' as const, name: 'Test Finance Domestic', appliesToForeign: false, sortOrder: 3 },
]
const questionFixtures = [
  { id: 'test-bim-1', question: 'Test BIM satu?', sortOrder: 1 },
  { id: 'test-bim-2', question: 'Test BIM dua?', sortOrder: 2 },
]
const divisionFixtures = [
  { code: DIVISION_CODE, name: 'Test Divisi Approver' },
  { code: 'T01', name: 'Test Divisi Approver Dua' },
]

async function seedMasterFixtures() {
  const db = getDb()
  await db
    .insert(businessClassifications)
    .values(classificationFixtures)
    .onConflictDoNothing()
  await db
    .insert(vendorDocumentRequirements)
    .values(requirementFixtures.map((row) => ({ ...row, required: true })))
    .onConflictDoNothing()
  await db.insert(bimQuestions).values(questionFixtures).onConflictDoNothing()
  await db.insert(approvalDivisions).values(divisionFixtures).onConflictDoNothing()
}

function id(prefix: string) {
  return `vendor-test-${prefix}-${crypto.randomUUID()}`
}

function uniqueNpwp() {
  return `${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 1e9)
    .toString()
    .padStart(9, '0')}`.slice(0, 16)
}

function uniqueUsername(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function asset(key: string, name: string, size?: number) {
  return {
    kind: 'file',
    id: key,
    url: `http://localhost:5180/files/object?key=${encodeURIComponent(key)}`,
    name,
    mimeType: 'application/pdf',
    ...(size === undefined ? {} : { size }),
  }
}

type RegisterBody = Record<string, unknown>

async function register(body: RegisterBody) {
  return app.request('/vendors/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function request(path: string, method: string, body: unknown, cookie = '') {
  return app.request(path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

/** Registers, verifies the email, and returns the owner cookie plus vendor id. */
async function registeredOwner(prefix: string, overrides: RegisterBody = {}) {
  const email = `${id(prefix)}@example.invalid`
  const created = await register({
    companyName: `PT ${prefix}`,
    companyType: 'pt',
    email,
    username: uniqueUsername(prefix),
    npwp: uniqueNpwp(),
    businessField: 'supplier',
    password: PASSWORD,
    passwordConfirmation: PASSWORD,
    ...overrides,
  })
  if (created.status !== 201) throw new Error(`Registration failed with ${created.status}: ${await created.text()}`)
  const body = (await created.json()) as { data: { vendor: { id: string }; verificationLink: string } }
  ownedVendorIds.add(body.data.vendor.id)
  const verified = await app.request(body.data.verificationLink)
  if (verified.status !== 200) throw new Error(`Verification failed with ${verified.status}`)
  const ownerUserId = (await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]!.id
  ownedUserIds.add(ownerUserId)
  const signedIn = await getAuth().api.signInEmail({ body: { email, password: PASSWORD }, returnHeaders: true })
  return { vendorId: body.data.vendor.id, email, cookie: signedIn.headers.get('set-cookie')?.split(';')[0] ?? '' }
}

type Detail = {
  vendor: { statusCode: string; username: string; npwp: string | null; qualification: string | null; coverage: string | null; confirmedAt: string | null }
  contacts: { id: string; name: string }[]
  classifications: { id: string; name: string; businessField: string }[]
  documents: { requirementId: string; category: string; required: boolean; file: { id: string; name: string } | null }[]
  bim: { questionId: string; answer: boolean | null; note: string | null; file: { id: string; name: string } | null }[]
  reviews: { aspect: string; decision: string; note: string | null }[]
  progress: Record<string, boolean>
  missing: string[]
}

async function detailOf(cookie: string, path = '/vendors/mine'): Promise<Detail> {
  const response = await request(path, 'GET', undefined, cookie)
  if (response.status !== 200) throw new Error(`Detail failed with ${response.status}`)
  return ((await response.json()) as { data: Detail }).data
}

function requirementIds(detail: Detail) {
  return detail.documents.map((slot) => slot.requirementId)
}

/** Fills the values that submit requires. */
async function completeCommonData(owner: { cookie: string }, businessField = 'supplier') {
  const profile = await request(
    '/vendors/mine',
    'PATCH',
    { address: 'Jalan Uji 1', city: 'Jakarta', province: '31', phone: '021-555000', qualification: 'menengah', coverage: 'nasional', businessField },
    owner.cookie,
  )
  if (profile.status !== 200) throw new Error(`Profile failed with ${profile.status}: ${await profile.text()}`)
  const contact = await request('/vendors/mine/contacts', 'POST', { name: 'Budi', role: 'Director', phone: '0812', email: 'budi@example.invalid' }, owner.cookie)
  if (contact.status !== 200) throw new Error(`Contact failed with ${contact.status}`)
  const supplierIds = classificationFixtures.filter((row) => row.businessField === businessField).map((row) => row.id)
  const saved = await request('/vendors/mine/classifications', 'PUT', { classificationIds: supplierIds }, owner.cookie)
  if (saved.status !== 200) throw new Error(`Classifications failed with ${saved.status}: ${await saved.text()}`)
  return { classificationIds: supplierIds }
}

async function submitVendor(cookie: string, body: unknown = { divisionCode: DIVISION_CODE, confirmed: true }) {
  return request('/vendors/mine/submit', 'POST', body, cookie)
}

function staffSession(prefix: string) {
  return createSystemSession(['list-vendors', 'detail-vendors', 'approve-vendors'], `${prefix}-${crypto.randomUUID()}`)
}

describe('vendor onboarding', () => {
  beforeAll(seedMasterFixtures)

  afterAll(async () => {
    const db = getDb()
    if (ownedVendorIds.size) await db.delete(vendors).where(inArray(vendors.id, [...ownedVendorIds]))
    if (ownedUserIds.size) await db.delete(users).where(inArray(users.id, [...ownedUserIds]))
    await cleanupSessions()
    await closeDb()
  })

  describe('public registration', () => {
    it('registers a domestic vendor and keeps the account inactive until verification', async () => {
      const email = `${id('domestic')}@example.invalid`
      const username = uniqueUsername('domestic')
      const response = await register({
        companyName: 'PT Step Satu',
        companyType: 'pt',
        email,
        username,
        npwp: '01.234.567.8-901.234.5',
        businessField: 'supplier',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      })

      expect(response.status).toBe(201)
      const body = (await response.json()) as { data: { vendor: { id: string; statusCode: string; npwp: string; username: string }; verificationLink: string } }
      ownedVendorIds.add(body.data.vendor.id)
      expect(body.data.vendor.statusCode).toBe('registered')
      expect(body.data.vendor.npwp).toBe('0123456789012345')
      expect(body.data.vendor.username).toBe(username)
      const owner = (await getDb().select({ name: users.name, statusCode: users.statusCode, emailVerified: users.emailVerified }).from(users).where(eq(users.email, email)).limit(1))[0]
      ownedUserIds.add((await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]!.id)
      expect(owner?.name).toBe(username)
      expect(owner?.statusCode).toBe('non_active')
      expect(owner?.emailVerified).toBe(false)
      expect(body.data.verificationLink).toContain(body.data.vendor.id)
    })

    it('requires exactly 16 NPWP digits', async () => {
      const base = { companyName: 'PT Panjang NPWP', companyType: 'pt', businessField: 'supplier', password: PASSWORD, passwordConfirmation: PASSWORD }
      expect((await register({ ...base, email: `${id('npwp-short')}@example.invalid`, username: uniqueUsername('npwp-short'), npwp: uniqueNpwp().slice(0, 15) })).status).toBe(400)
      expect((await register({ ...base, email: `${id('npwp-long')}@example.invalid`, username: uniqueUsername('npwp-long'), npwp: `${uniqueNpwp()}9` })).status).toBe(400)
      const exact = await register({ ...base, email: `${id('npwp-exact')}@example.invalid`, username: uniqueUsername('npwp-exact'), npwp: uniqueNpwp() })
      expect(exact.status).toBe(201)
      ownedVendorIds.add(((await exact.json()) as { data: { vendor: { id: string } } }).data.vendor.id)
    })

    it('requires a unique username', async () => {
      const base = { companyName: 'PT Username', companyType: 'pt', businessField: 'supplier', password: PASSWORD, passwordConfirmation: PASSWORD }
      const username = uniqueUsername('taken')
      const first = await register({ ...base, email: `${id('username-first')}@example.invalid`, username, npwp: uniqueNpwp() })
      expect(first.status).toBe(201)
      ownedVendorIds.add(((await first.json()) as { data: { vendor: { id: string } } }).data.vendor.id)
      const duplicate = await register({ ...base, email: `${id('username-dup')}@example.invalid`, username, npwp: uniqueNpwp() })
      expect(duplicate.status).toBe(422)
      expect((await duplicate.json()).error).toBe('username_exists')
      expect((await register({ ...base, email: `${id('username-short')}@example.invalid`, username: 'ab', npwp: uniqueNpwp() })).status).toBe(400)
    })

    it('registers a foreign vendor with a tax id', async () => {
      const email = `${id('foreign')}@example.invalid`
      const response = await register({
        companyName: 'Foreign Company',
        companyType: 'foreign_company',
        email,
        username: uniqueUsername('foreign'),
        taxId: 'TAX-998',
        businessField: 'jasa',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      })

      expect(response.status).toBe(201)
      const body = (await response.json()) as { data: { vendor: { id: string; taxId: string; npwp: null } } }
      ownedVendorIds.add(body.data.vendor.id)
      ownedUserIds.add((await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]!.id)
      expect(body.data.vendor.taxId).toBe('TAX-998')
      expect(body.data.vendor.npwp).toBeNull()
    })

    it('rejects a foreign vendor without a tax id', async () => {
      const response = await register({
        companyName: 'Foreign Without Tax',
        companyType: 'foreign_individual',
        email: `${id('foreign-missing')}@example.invalid`,
        username: uniqueUsername('foreign-missing'),
        businessField: 'jasa',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      })
      expect(response.status).toBe(400)
    })

    it('rejects duplicate email and npwp without creating a second account', async () => {
      const email = `${id('dup')}@example.invalid`
      const first = {
        companyName: 'PT Duplikat',
        companyType: 'cv',
        email,
        username: uniqueUsername('dup'),
        npwp: uniqueNpwp(),
        businessField: 'subkon',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      }
      expect((await register(first)).status).toBe(201)
      ownedVendorIds.add((await getDb().select({ id: vendors.id }).from(vendors).where(eq(vendors.email, email)).limit(1))[0]!.id)
      ownedUserIds.add((await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]!.id)
      expect((await register({ ...first, npwp: uniqueNpwp() })).status).toBe(409)
      const npwpDup = await register({ ...first, email: `${id('dup2')}@example.invalid`, username: uniqueUsername('dup2') })
      expect(npwpDup.status).toBe(422)
      expect((await npwpDup.json()).error).toBe('npwp_exists')
    })

    it('verifies the email once and rejects a reused link', async () => {
      const email = `${id('verify')}@example.invalid`
      const created = await register({
        companyName: 'PT Verifikasi',
        companyType: 'pt',
        email,
        username: uniqueUsername('verify'),
        npwp: uniqueNpwp(),
        businessField: 'supplier',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      })
      const { data } = (await created.json()) as { data: { vendor: { id: string }; verificationLink: string } }
      ownedVendorIds.add(data.vendor.id)
      ownedUserIds.add((await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]!.id)

      const verify = await app.request(data.verificationLink)
      expect(verify.status).toBe(200)
      expect(((await verify.json()) as { data: { vendor: { statusCode: string } } }).data.vendor.statusCode).toBe('email_verified')
      expect((await app.request(data.verificationLink)).status).toBe(404)
      const owner = (await getDb().select({ statusCode: users.statusCode, emailVerified: users.emailVerified }).from(users).where(eq(users.email, email)).limit(1))[0]
      expect(owner?.statusCode).toBe('active')
      expect(owner?.emailVerified).toBe(true)
    })

    it('resends a verification link and reports an unknown email as missing', async () => {
      const email = `${id('resend')}@example.invalid`
      const created = await register({
        companyName: 'PT Kirim Ulang',
        companyType: 'pt',
        email,
        username: uniqueUsername('resend'),
        npwp: uniqueNpwp(),
        businessField: 'jasa',
        password: PASSWORD,
        passwordConfirmation: PASSWORD,
      })
      const { data } = (await created.json()) as { data: { vendor: { id: string } } }
      ownedVendorIds.add(data.vendor.id)
      ownedUserIds.add((await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0]!.id)

      expect((await request('/vendors/resend-verification', 'POST', { email })).status).toBe(200)
      expect((await request('/vendors/resend-verification', 'POST', { email: `${id('unknown')}@example.invalid` })).status).toBe(404)
    })
  })

  describe('account audience', () => {
    it('reports the owned vendor on the identity payload and leaves staff empty', async () => {
      const owner = await registeredOwner('identity')
      const ownerResponse = await app.request('/me', { headers: { Cookie: owner.cookie } })
      expect(ownerResponse.status).toBe(200)
      const ownerBody = (await ownerResponse.json()) as { data: { vendor: { id: string; statusCode: string } | null } }
      expect(ownerBody.data.vendor).toMatchObject({ id: owner.vendorId, statusCode: 'email_verified' })

      const staff = await staffSession('vendor-staff-identity')
      const staffResponse = await app.request('/me', { headers: { Cookie: staff.cookie } })
      const staffBody = (await staffResponse.json()) as { data: { vendor: unknown } }
      expect(staffBody.data.vendor).toBeNull()
    })
  })

  describe('reference reads', () => {
    it('lists and searches classifications, and reads one for a lookup', async () => {
      const owner = await registeredOwner('reference')
      const list = await request('/vendors/classifications/list?business_field=supplier&limit=5', 'GET', undefined, owner.cookie)
      expect(list.status).toBe(200)
      const page = (await list.json()) as { data: { id: string; name: string; businessField: string }[]; total: number }
      expect(page.data.length).toBeGreaterThanOrEqual(3)
      expect(page.total).toBeGreaterThanOrEqual(3)
      expect(page.data.every((row) => row.businessField === 'supplier')).toBe(true)

      const search = await request('/vendors/classifications/list?business_field=supplier&search=Test%20Supplier&limit=5', 'GET', undefined, owner.cookie)
      expect(((await search.json()) as { data: unknown[] }).data.length).toBeGreaterThanOrEqual(3)

      const detail = await request(`/vendors/classifications/detail/${page.data[0]!.id}`, 'GET', undefined, owner.cookie)
      expect(detail.status).toBe(200)
      expect(((await detail.json()) as { data: { id: string } }).data.id).toBe(page.data[0]!.id)
      expect((await request('/vendors/classifications/detail/nope', 'GET', undefined, owner.cookie)).status).toBe(404)
    })

    it('lists the active approval divisions', async () => {
      const owner = await registeredOwner('divisions')
      const response = await request('/vendors/divisions/list', 'GET', undefined, owner.cookie)
      expect(response.status).toBe(200)
      const rows = ((await response.json()) as { data: { code: string; name: string }[] }).data
      expect(rows.length).toBeGreaterThanOrEqual(2)
      expect(rows.some((row) => row.code === DIVISION_CODE)).toBe(true)
    })
  })

  describe('business field and classifications', () => {
    it('saves qualification, coverage and a classification set', async () => {
      const owner = await registeredOwner('classification')
      await completeCommonData(owner)
      const detail = await detailOf(owner.cookie)
      expect(detail.vendor.qualification).toBe('menengah')
      expect(detail.vendor.coverage).toBe('nasional')
      expect(detail.classifications.map((row) => row.id).sort()).toEqual(['test-supplier-1', 'test-supplier-2', 'test-supplier-3'])
      expect(detail.progress['bidang_usaha']).toBe(true)
    })

    it('replaces the whole set and rejects foreign or unknown classifications', async () => {
      const owner = await registeredOwner('classification-replace')
      await completeCommonData(owner)
      const kept = 'test-supplier-1'

      const replaced = await request('/vendors/mine/classifications', 'PUT', { classificationIds: [kept] }, owner.cookie)
      expect(replaced.status).toBe(200)
      expect((await detailOf(owner.cookie)).classifications.map((row) => row.id)).toEqual([kept])

      const unknown = await request('/vendors/mine/classifications', 'PUT', { classificationIds: ['does-not-exist'] }, owner.cookie)
      expect(unknown.status).toBe(422)
      expect((await unknown.json()).error).toBe('classification_unknown')

      const mismatch = await request('/vendors/mine/classifications', 'PUT', { classificationIds: ['test-jasa-1'] }, owner.cookie)
      expect(mismatch.status).toBe(422)
      expect((await mismatch.json()).error).toBe('classification_field_mismatch')
      expect((await detailOf(owner.cookie)).classifications.map((row) => row.id)).toEqual([kept])

      const duplicate = await request('/vendors/mine/classifications', 'PUT', { classificationIds: [kept, kept] }, owner.cookie)
      expect(duplicate.status).toBe(400)
    })

    it('clears the classification set when the business field changes', async () => {
      const owner = await registeredOwner('classification-field-change')
      await completeCommonData(owner)
      expect((await detailOf(owner.cookie)).classifications.length).toBeGreaterThan(0)
      const changed = await request('/vendors/mine', 'PATCH', { businessField: 'jasa' }, owner.cookie)
      expect(changed.status).toBe(200)
      expect((await detailOf(owner.cookie)).classifications).toHaveLength(0)
    })
  })

  describe('fixed document slots', () => {
    it('attaches, replaces and removes one file per requirement', async () => {
      const owner = await registeredOwner('documents')
      const detail = await detailOf(owner.cookie)
      expect(requirementIds(detail)).toEqual(expect.arrayContaining(['test-legal-1', 'test-legal-2', 'test-finance-domestic']))
      expect(detail.documents.every((slot) => slot.file === null)).toBe(true)

      const attached = await request('/vendors/mine/documents/test-legal-1', 'PUT', { file: asset('uploads/vendor-test-legal.pdf', 'nib.pdf', 1200) }, owner.cookie)
      expect(attached.status).toBe(200)
      const afterAttach = (await ((await attached.json()) as { data: Detail }).data).documents.find((slot) => slot.requirementId === 'test-legal-1')!
      expect(afterAttach.file).toMatchObject({ id: 'uploads/vendor-test-legal.pdf', name: 'nib.pdf' })

      const replaced = await request('/vendors/mine/documents/test-legal-1', 'PUT', { file: asset('uploads/vendor-test-legal-v2.pdf', 'nib-v2.pdf') }, owner.cookie)
      expect(replaced.status).toBe(200)
      const afterReplace = (await ((await replaced.json()) as { data: Detail }).data).documents.find((slot) => slot.requirementId === 'test-legal-1')!
      expect(afterReplace.file).toMatchObject({ name: 'nib-v2.pdf' })
      expect((await detailOf(owner.cookie)).documents.filter((slot) => slot.requirementId === 'test-legal-1')).toHaveLength(1)

      expect((await request('/vendors/mine/documents/test-legal-1', 'DELETE', undefined, owner.cookie)).status).toBe(200)
      expect((await detailOf(owner.cookie)).documents.find((slot) => slot.requirementId === 'test-legal-1')!.file).toBeNull()
      expect((await request('/vendors/mine/documents/test-legal-1', 'DELETE', undefined, owner.cookie)).status).toBe(404)
      expect((await request('/vendors/mine/documents/nope', 'PUT', { file: asset('uploads/vendor-test-x.pdf', 'x.pdf') }, owner.cookie)).status).toBe(404)
    })

    it('hides a domestic-only slot from a foreign vendor', async () => {
      const foreign = await registeredOwner('documents-foreign', { companyType: 'foreign_company', taxId: 'TAX-1', npwp: undefined })
      const detail = await detailOf(foreign.cookie)
      expect(requirementIds(detail)).toContain('test-legal-1')
      expect(requirementIds(detail)).not.toContain('test-finance-domestic')
      expect((await request('/vendors/mine/documents/test-finance-domestic', 'PUT', { file: asset('uploads/vendor-test-y.pdf', 'y.pdf') }, foreign.cookie)).status).toBe(404)
    })
  })

  describe('BIM answers', () => {
    it('saves one answer per question and replaces them on the next save', async () => {
      const owner = await registeredOwner('bim')
      const detail = await detailOf(owner.cookie)
      expect(detail.bim.map((entry) => entry.questionId)).toEqual(expect.arrayContaining(['test-bim-1', 'test-bim-2']))
      expect(detail.bim.every((entry) => entry.answer === null)).toBe(true)
      expect(detail.progress['input_bim']).toBe(false)

      const saved = await request(
        '/vendors/mine/bim',
        'PUT',
        {
          answers: [
            { questionId: 'test-bim-1', answer: true, note: 'Mulai 2019', file: asset('uploads/vendor-test-bim.pdf', 'portofolio.pdf') },
            { questionId: 'test-bim-2', answer: false },
          ],
        },
        owner.cookie,
      )
      expect(saved.status).toBe(200)
      const afterSave = (await ((await saved.json()) as { data: Detail }).data)
      expect(afterSave.bim.find((entry) => entry.questionId === 'test-bim-1')).toMatchObject({ answer: true, note: 'Mulai 2019' })
      expect(afterSave.bim.find((entry) => entry.questionId === 'test-bim-1')!.file).toMatchObject({ name: 'portofolio.pdf' })
      expect(afterSave.bim.find((entry) => entry.questionId === 'test-bim-2')).toMatchObject({ answer: false })
      expect(afterSave.progress['input_bim']).toBe(true)

      const replaced = await request('/vendors/mine/bim', 'PUT', { answers: [{ questionId: 'test-bim-1', answer: false, note: 'Revisi' }] }, owner.cookie)
      expect(replaced.status).toBe(200)
      const afterReplace = (await ((await replaced.json()) as { data: Detail }).data)
      expect(afterReplace.bim.find((entry) => entry.questionId === 'test-bim-1')).toMatchObject({ answer: false, note: 'Revisi', file: null })
      expect(afterReplace.bim.find((entry) => entry.questionId === 'test-bim-2')!.answer).toBe(false)

      const unknown = await request('/vendors/mine/bim', 'PUT', { answers: [{ questionId: 'nope', answer: true }] }, owner.cookie)
      expect(unknown.status).toBe(422)
      expect((await unknown.json()).error).toBe('bim_question_unknown')
    })
  })

  describe('owner completion and submit', () => {
    it('completes, submits once, and locks further edits', async () => {
      const owner = await registeredOwner('owner-happy')
      expect((await detailOf(owner.cookie)).vendor.statusCode).toBe('email_verified')

      await completeCommonData(owner)
      const completed = await detailOf(owner.cookie)
      expect(completed.vendor.statusCode).toBe('profile_complete')
      expect(completed.missing).toEqual([])
      expect(completed.progress['data_perusahaan']).toBe(true)
      expect(completed.progress['contact_person']).toBe(true)

      const submitted = await submitVendor(owner.cookie)
      expect(submitted.status).toBe(200)
      const detail = (await submitted.json()) as { data: Detail }
      expect(detail.data.vendor.statusCode).toBe('submitted')
      expect(detail.data.vendor.confirmedAt).not.toBeNull()
      expect(detail.data.reviews).toHaveLength(0)

      expect((await request('/vendors/mine', 'PATCH', { phone: '021-777' }, owner.cookie)).status).toBe(409)
      expect((await submitVendor(owner.cookie)).status).toBe(409)
      expect((await request('/vendors/mine/classifications', 'PUT', { classificationIds: [] }, owner.cookie)).status).toBe(409)
      expect((await request('/vendors/mine/bim', 'PUT', { answers: [] }, owner.cookie)).status).toBe(409)
    })

    it('refuses submission while required values are missing and keeps the record unchanged', async () => {
      const owner = await registeredOwner('owner-incomplete')
      const submitted = await submitVendor(owner.cookie)
      expect(submitted.status).toBe(422)
      const body = (await submitted.json()) as { error: string; issues: { field: string }[] }
      expect(body.error).toBe('vendor_incomplete')
      expect(body.issues.map((issue) => issue.field)).toEqual(['address', 'city', 'phone', 'qualification', 'coverage', 'contact', 'classification'])
      expect((await detailOf(owner.cookie)).vendor.statusCode).toBe('email_verified')
    })

    it('requires a real division and the confirmation, but allows missing documents and BIM answers', async () => {
      const owner = await registeredOwner('owner-division')
      await completeCommonData(owner)

      expect((await submitVendor(owner.cookie, { divisionCode: 'nope', confirmed: true })).status).toBe(422)
      expect((await submitVendor(owner.cookie, { divisionCode: DIVISION_CODE })).status).toBe(400)

      const detail = await detailOf(owner.cookie)
      expect(detail.documents.some((slot) => slot.file === null)).toBe(true)
      expect(detail.bim.some((entry) => entry.answer === null)).toBe(true)

      const submitted = await submitVendor(owner.cookie)
      expect(submitted.status).toBe(200)
      const after = (await ((await submitted.json()) as { data: Detail }).data)
      expect(after.vendor.statusCode).toBe('submitted')
      expect(after.progress['konfirmasi_selesai']).toBe(true)
    })

    it('keeps contacts, classifications and documents inside the owning vendor', async () => {
      const first = await registeredOwner('owner-a')
      const second = await registeredOwner('owner-b')
      await completeCommonData(first)
      await completeCommonData(second)

      const contactResponse = await request('/vendors/mine/contacts', 'POST', { name: 'Hendra' }, first.cookie)
      const contactId = ((await contactResponse.json()) as { data: { id: string } }).data.id
      expect((await request(`/vendors/mine/contacts/${contactId}`, 'DELETE', undefined, second.cookie)).status).toBe(404)
      expect((await request('/vendors/mine/documents/test-legal-1', 'PUT', { file: asset('uploads/vendor-test-own.pdf', 'own.pdf') }, first.cookie)).status).toBe(200)
      expect((await request('/vendors/mine/documents/test-legal-1', 'DELETE', undefined, second.cookie)).status).toBe(404)
      expect((await app.request(`/vendors/contacts/list?vendor_id=${first.vendorId}`, { headers: { Cookie: first.cookie } })).status).toBe(200)
      expect((await app.request(`/vendors/contacts/list?vendor_id=${second.vendorId}`, { headers: { Cookie: first.cookie } })).status).toBe(403)
    })

    it('requires a session for owner routes', async () => {
      expect((await app.request('/vendors/mine')).status).toBe(401)
      expect((await request('/vendors/mine/classifications', 'PUT', { classificationIds: [] })).status).toBe(401)
      expect((await request('/vendors/mine/bim', 'PUT', { answers: [] })).status).toBe(401)
      expect((await submitVendor('')).status).toBe(401)
    })
  })

  describe('staff review', () => {
    async function submittedVendor(prefix: string) {
      const owner = await registeredOwner(prefix)
      await completeCommonData(owner)
      const detail = await detailOf(owner.cookie)
      await request('/vendors/mine/documents/test-legal-1', 'PUT', { file: asset(`uploads/${prefix}-doc.pdf`, 'doc.pdf') }, owner.cookie)
      await request('/vendors/mine/bim', 'PUT', { answers: [{ questionId: detail.bim[0]!.questionId, answer: true }] }, owner.cookie)
      expect((await submitVendor(owner.cookie)).status).toBe(200)
      return owner
    }

    it('lists and reads a vendor with its slots, answers and progress', async () => {
      const owner = await submittedVendor('staff-read')
      const staff = await staffSession('vendor-staff-read')
      const list = await app.request(`/vendors/list?search=${encodeURIComponent(owner.email)}`, { headers: { Cookie: staff.cookie } })
      expect(list.status).toBe(200)
      const listed = (await list.json()) as { data: { id: string; statusCode: string }[]; total: number }
      expect(listed.data.map((row) => row.id)).toEqual([owner.vendorId])
      expect(listed.total).toBe(1)

      const detail = await app.request(`/vendors/detail/${owner.vendorId}`, { headers: { Cookie: staff.cookie } })
      expect(detail.status).toBe(200)
      const body = (await detail.json()) as { data: Detail }
      expect(requirementIds(body.data)).toContain('test-legal-1')
      expect(body.data.bim.length).toBeGreaterThanOrEqual(2)
      expect(body.data.reviews).toHaveLength(0)
      expect(body.data.progress['data_perusahaan']).toBe(true)
    })

    it('decides one aspect at a time and derives the aggregate status', async () => {
      const owner = await submittedVendor('staff-aspects')
      const staff = await staffSession('vendor-staff-aspects')

      const legal = await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect: 'legal', decision: 'approved', note: 'Legal is complete' }, staff.cookie)
      expect(legal.status).toBe(200)
      let detail = (await legal.json()) as { data: Detail }
      expect(detail.data.vendor.statusCode).toBe('submitted')
      expect(detail.data.reviews).toHaveLength(1)

      for (const aspect of ['finance', 'technical']) {
        const response = await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect, decision: 'approved' }, staff.cookie)
        expect(response.status).toBe(200)
        detail = (await response.json()) as { data: Detail }
        expect(detail.data.vendor.statusCode).toBe('submitted')
      }

      const bim = await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect: 'bim', decision: 'approved' }, staff.cookie)
      expect(bim.status).toBe(200)
      detail = (await bim.json()) as { data: Detail }
      expect(detail.data.vendor.statusCode).toBe('approved')
      expect(detail.data.reviews).toHaveLength(4)

      expect((await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect: 'legal', decision: 'approved' }, staff.cookie)).status).toBe(409)
    })

    it('rejects with a required reason, blocks further decisions, and lets the owner repair and resubmit', async () => {
      const owner = await submittedVendor('staff-reject')
      const staff = await staffSession('vendor-staff-reject')

      expect((await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect: 'legal', decision: 'rejected' }, staff.cookie)).status).toBe(400)
      expect((await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect: 'nope', decision: 'approved' }, staff.cookie)).status).toBe(400)

      const rejected = await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect: 'legal', decision: 'rejected', note: 'NIB is unreadable' }, staff.cookie)
      expect(rejected.status).toBe(200)
      const detail = (await rejected.json()) as { data: Detail }
      expect(detail.data.vendor.statusCode).toBe('rejected')
      expect(detail.data.reviews.find((review) => review.aspect === 'legal')?.note).toBe('NIB is unreadable')
      expect((await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect: 'bim', decision: 'approved' }, staff.cookie)).status).toBe(409)

      expect((await request('/vendors/mine', 'PATCH', { phone: '061-444' }, owner.cookie)).status).toBe(200)
      const resubmitted = await submitVendor(owner.cookie)
      expect(resubmitted.status).toBe(200)
      const afterResubmit = (await resubmitted.json()) as { data: Detail }
      expect(afterResubmit.data.vendor.statusCode).toBe('submitted')
      expect(afterResubmit.data.reviews).toHaveLength(0)
    })

    it('denies staff routes without the matching permission', async () => {
      const owner = await submittedVendor('staff-denied')
      expect((await app.request('/vendors/list')).status).toBe(401)
      expect((await app.request(`/vendors/detail/${owner.vendorId}`)).status).toBe(401)

      const viewer = await createSystemSession(['list-vendors'], `vendor-staff-viewer-${crypto.randomUUID()}`)
      expect((await app.request(`/vendors/detail/${owner.vendorId}`, { headers: { Cookie: viewer.cookie } })).status).toBe(403)
      expect((await request(`/vendors/review/${owner.vendorId}`, 'POST', { aspect: 'legal', decision: 'approved' }, viewer.cookie)).status).toBe(403)
      expect((await app.request(`/vendors/contacts/list?vendor_id=${owner.vendorId}`, { headers: { Cookie: viewer.cookie } })).status).toBe(403)
      expect((await getDb().select({ statusCode: vendors.statusCode }).from(vendors).where(eq(vendors.id, owner.vendorId)).limit(1))[0]?.statusCode).toBe('submitted')
    })

    it('answers 404 for an unknown vendor detail and review', async () => {
      const staff = await staffSession('vendor-staff-missing')
      const missing = id('missing-vendor')
      expect((await app.request(`/vendors/detail/${missing}`, { headers: { Cookie: staff.cookie } })).status).toBe(404)
      expect((await request(`/vendors/review/${missing}`, 'POST', { aspect: 'legal', decision: 'approved' }, staff.cookie)).status).toBe(404)
    })
  })
})
