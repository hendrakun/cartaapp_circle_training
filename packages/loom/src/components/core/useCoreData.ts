/**
 * Shared plumbing for the three cores: the `data` XOR `load` rule and the
 * cache identity a core uses when no resource supplied a namespace.
 *
 * Cores stay resource-agnostic: no router, no permission store, no CRUD
 * operation names.
 */
import { getCurrentInstance } from 'vue'
import type { QueryKey, QueryNamespace, QueryValues, RecordIdentity } from '../../contracts'
import { collectionKey, recordKey } from '../../query'

export function assertSingleDataSource(component: string, data: unknown, load: unknown): void {
  if (data !== undefined && load !== undefined) {
    throw new Error(`[loom] ${component} accepts either \`data\` or \`load\`, not both.`)
  }
}

/** Stable per-instance identity, used only when no namespace is supplied. */
export function instanceIdentity(fallback: string): string {
  const instance = getCurrentInstance()
  return instance ? `${fallback}-${instance.uid}` : fallback
}

export function collectionCacheKey(resource: string, namespace: QueryNamespace | undefined, query: QueryValues, searchParameters: QueryValues): QueryKey {
  return collectionKey({ resource, namespace, query, searchParameters })
}

export function recordCacheKey(resource: string, id: RecordIdentity | undefined, variant: 'display' | 'form', namespace: QueryNamespace | undefined, searchParameters: QueryValues): QueryKey {
  return recordKey({ resource, id: id ?? null, variant, namespace, searchParameters })
}
