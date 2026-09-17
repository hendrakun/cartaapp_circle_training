import { createHonoResourceActions, parseHonoResponse } from '@/framework/hono'
import { rpc } from '@/framework/rpc'
import type { StoredAsset } from '@southneuhof/api/schema'
import type { ApprovalDivision, VendorClassificationRecord, VendorDetail, VendorReviewRecord } from './vendors.types'

const api = createHonoResourceActions(rpc.vendors)

async function detailData(response: Response): Promise<VendorDetail> {
  return ((await response.json()) as { data: VendorDetail }).data
}

/** The signed-in account's own registration. The server resolves the owner. */
async function mine(): Promise<VendorDetail> {
  return detailData(await rpc.vendors.mine.$get())
}

/** One vendor for the staff detail surface. The payload carries every child list. */
async function staffDetail(id: string): Promise<VendorDetail> {
  return detailData(await rpc.vendors.detail[':id'].$get({ param: { id } }))
}

/** The staff list keeps the plain record, so the resource detail unwraps the payload. */
async function detail(context: Parameters<typeof api.detail>[0]) {
  const payload = await api.detail(context)
  return (payload as unknown as { vendor: typeof payload } | undefined)?.vendor
}

async function saveMine(input: Record<string, unknown>): Promise<VendorDetail> {
  return detailData(await rpc.vendors.mine.$patch({ json: input }))
}

async function saveClassifications(input: { businessField: string; classificationIds: string[] }): Promise<VendorDetail> {
  return detailData(await rpc.vendors.mine.classifications.$put({ json: { classificationIds: input.classificationIds } }))
}

async function attachDocument(requirementId: string, file: StoredAsset): Promise<VendorDetail> {
  return detailData(await rpc.vendors.mine.documents[':requirementId'].$put({ param: { requirementId }, json: { file } }))
}

async function removeDocument(requirementId: string): Promise<VendorDetail> {
  return detailData(await rpc.vendors.mine.documents[':requirementId'].$delete({ param: { requirementId } }))
}

async function saveBim(answers: { questionId: string; answer: boolean; note?: string | null; file?: StoredAsset | null }[]): Promise<VendorDetail> {
  return detailData(await rpc.vendors.mine.bim.$put({ json: { answers } }))
}

async function submitMine(input: { divisionCode: string; confirmed: true }): Promise<VendorDetail> {
  return detailData(await rpc.vendors.mine.submit.$post({ json: input }))
}

async function divisions(): Promise<ApprovalDivision[]> {
  const payload = await parseHonoResponse<(typeof rpc.vendors)['divisions']['list']['$get']>(await rpc.vendors.divisions.list.$get())
  return (payload as { data: ApprovalDivision[] }).data
}

async function review(id: string, input: { aspect: VendorReviewRecord['aspect']; decision: VendorReviewRecord['decision']; note?: string | null }): Promise<VendorDetail> {
  return detailData(await rpc.vendors.review[':id'].$post({ param: { id }, json: input }))
}

async function classificationsFor(businessField: string, search: string, signal?: AbortSignal): Promise<VendorClassificationRecord[]> {
  const payload = await parseHonoResponse<(typeof rpc.vendors)['classifications']['list']['$get']>(
    await rpc.vendors.classifications.list.$get({ query: { business_field: businessField, search: search || undefined, limit: '50' } }, { init: { signal } })
  )
  return (payload as { data: VendorClassificationRecord[] }).data
}

export const vendorsActions = {
  list: api.list,
  detail,
  staffDetail,
  mine,
  saveMine,
  saveClassifications,
  attachDocument,
  removeDocument,
  saveBim,
  submitMine,
  divisions,
  review,
  classificationsFor,
}
