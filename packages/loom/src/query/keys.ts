/**
 * Deterministic internal query identities.
 *
 * Keys are framework-generated and private: application code never authors
 * them, and resources invalidate by resource/record semantics instead. Equal
 * logical inputs must produce equal keys so that resource prop factories may
 * return fresh closures per call without re-executing loads (plan 006).
 */
import type { QueryKey, QueryNamespace, QueryValues, RecordIdentity } from '../contracts'

export const resourceKeyPrefix = 'resource'

/** Stable serialization: property order and absent values never change identity. */
export function stableValue(value: unknown): unknown {
  if (value === undefined || value === null) return null
  if (Array.isArray(value)) return value.map(stableValue)
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const result: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue
      result[key] = stableValue(source[key])
    }
    return result
  }
  return value
}

export interface CollectionKeyInput {
  resource: string
  query?: QueryValues
  searchParameters?: QueryValues
  /** Distinguishes duplicate instances of one resource in a single view. */
  namespace?: QueryNamespace
}

export interface RecordKeyInput {
  resource: string
  id: RecordIdentity | null
  variant: 'display' | 'form'
  namespace?: QueryNamespace
  searchParameters?: QueryValues
}

export function resourceKey(resource: string): QueryKey {
  return [resourceKeyPrefix, resource]
}

export function collectionKey({ resource, query, searchParameters, namespace }: CollectionKeyInput): QueryKey {
  return [
    resourceKeyPrefix,
    resource,
    'list',
    namespace ?? null,
    stableValue({ ...searchParameters, ...query }),
  ]
}

export function recordKey({ resource, id, variant, namespace, searchParameters }: RecordKeyInput): QueryKey {
  return [resourceKeyPrefix, resource, 'detail', stableValue(id), variant, namespace ?? null, stableValue(searchParameters ?? {})]
}

export function isSameKey(left: QueryKey, right: QueryKey): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
