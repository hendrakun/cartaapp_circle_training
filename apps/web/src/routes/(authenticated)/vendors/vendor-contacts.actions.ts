import type { CollectionLoadContext, CollectionResult } from '@southneuhof/loom'
import { parseHonoResponse } from '@/framework/hono'
import { rpc } from '@/framework/rpc'
import type { VendorContactRecord } from './vendors.types'
import type { VendorContactInput } from './vendor-contacts.schema'

function pageSize(query: Record<string, unknown>) {
  const value = Number(query.limit)
  return Number.isInteger(value) && value > 0 ? value : 25
}

async function list({ query, searchParameters, signal }: CollectionLoadContext): Promise<CollectionResult<VendorContactRecord>> {
  const vendorId = String(searchParameters.vendor_id ?? '')
  if (!vendorId) return { data: [] }
  const size = pageSize(query)
  const page = Number(query.page) > 0 ? Number(query.page) : 1
  const payload = await parseHonoResponse<(typeof rpc.vendors)['contacts']['list']['$get']>(
    await rpc.vendors.contacts.list.$get({ query: { vendor_id: vendorId, page: String(page), limit: String(size) } }, { init: { signal } })
  )
  const data = payload.data as VendorContactRecord[]
  const total = typeof (payload as { total?: number }).total === 'number' ? (payload as { total: number }).total : data.length
  return { data, meta: { total, page, pageSize: size, totalPage: Math.max(1, Math.ceil(total / size)) } }
}

async function create(input: VendorContactInput): Promise<VendorContactRecord> {
  const payload = await parseHonoResponse<(typeof rpc.vendors)['mine']['contacts']['$post']>(await rpc.vendors.mine.contacts.$post({ json: input }))
  return payload.data as VendorContactRecord
}

async function update(id: string, input: VendorContactInput): Promise<VendorContactRecord> {
  const payload = await parseHonoResponse<(typeof rpc.vendors)['mine']['contacts'][':contactId']['$patch']>(
    await rpc.vendors.mine.contacts[':contactId'].$patch({ param: { contactId: id }, json: input })
  )
  return payload.data as VendorContactRecord
}

async function remove(id: string): Promise<unknown> {
  return parseHonoResponse<(typeof rpc.vendors)['mine']['contacts'][':contactId']['$delete']>(await rpc.vendors.mine.contacts[':contactId'].$delete({ param: { contactId: id } }))
}

export const vendorContactsActions = { list, create, update, remove }
