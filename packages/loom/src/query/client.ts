/**
 * Internal cache runtime.
 *
 * TanStack Query is an implementation detail: it is installed by the framework
 * plugin, one client per Vue application, and never surfaces through public
 * component or resource APIs.
 */
import { inject, type InjectionKey } from 'vue'
import { QueryClient, useQueryClient } from '@tanstack/vue-query'
import { defaultQueryRuntimeDefaults, type QueryRuntimeDefaults } from '../adapters/projectAdapters'
import { recordKey, resourceKey } from './keys'
import type { RecordIdentity } from '../contracts'

export const frameworkQueryClientKey: InjectionKey<QueryClient> = Symbol.for('loom-query-client')

export function createFrameworkQueryClient(defaults: QueryRuntimeDefaults = defaultQueryRuntimeDefaults): QueryClient {
  const resolved = { ...defaultQueryRuntimeDefaults, ...defaults }
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: resolved.staleTime,
        retry: resolved.retry,
        refetchOnWindowFocus: resolved.refetchOnWindowFocus,
      },
    },
  })
}

export function useFrameworkQueryClient(): QueryClient {
  const client = inject(frameworkQueryClientKey, null)
  if (client) return client
  return useQueryClient()
}

export interface ResourceInvalidation {
  resource: string
  id?: RecordIdentity
}

/**
 * Semantic invalidation. Without an `id` every list and record of the resource
 * is invalidated; with one, only that record plus the resource's collections.
 */
export async function invalidateResourceData(client: QueryClient, { resource, id }: ResourceInvalidation): Promise<void> {
  if (id === undefined) {
    await client.invalidateQueries({ queryKey: resourceKey(resource) })
    return
  }
  await Promise.all([
    client.invalidateQueries({ queryKey: [...resourceKey(resource), 'list'] }),
    client.invalidateQueries({ queryKey: recordKey({ resource, id, variant: 'display' }).slice(0, 4) }),
  ])
}
