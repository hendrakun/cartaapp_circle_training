import type { CollectionLoadContext, CollectionResult } from '@southneuhof/loom'
import { parseHonoResponse } from '@/framework/hono'
import { rpc } from '@/framework/rpc'
import type { RolePermission } from './role-permissions.schema'

type ListEndpoint = (typeof rpc.roles)[':roleId']['permissions']['$get']

function positiveInt(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

async function list({ query, searchParameters, signal }: CollectionLoadContext): Promise<CollectionResult<RolePermission>> {
  const roleId = String(searchParameters.role_id ?? '')
  if (!roleId) return { data: [] }
  const wireQuery = Object.fromEntries(
    Object.entries(query)
      .filter(([, value]) => value != null && value !== '')
      .map(([key, value]) => [key, String(value)])
  )
  const payload = await parseHonoResponse<ListEndpoint>(await rpc.roles[':roleId'].permissions.$get({ param: { roleId }, query: wireQuery }, { init: { signal } }))
  const data = payload.data as RolePermission[]
  const envelope = payload as unknown as Record<string, unknown>
  const params = query as Record<string, unknown>
  const total = typeof envelope.total === 'number' ? envelope.total : data.length
  const page = positiveInt(envelope.page ?? params.page, 1)
  const pageSize = positiveInt(envelope.limit ?? envelope.pageSize ?? params.limit, 10)
  const totalPage = typeof envelope.totalPage === 'number' ? envelope.totalPage : Math.ceil(total / pageSize)
  return { data, meta: { total, page, pageSize, totalPage } }
}

async function set(roleId: string, permissionId: string, assigned: boolean): Promise<RolePermission> {
  const route = rpc.roles[':roleId'].permissions[':permissionId']
  const request = { param: { roleId, permissionId } }
  if (assigned) return (await parseHonoResponse<typeof route.$put>(await route.$put(request))).data as RolePermission
  return (await parseHonoResponse<typeof route.$delete>(await route.$delete(request))).data as RolePermission
}

export const rolePermissionsActions = { list, set }
