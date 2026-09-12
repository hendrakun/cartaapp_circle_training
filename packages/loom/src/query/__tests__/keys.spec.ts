import { describe, expect, it } from 'vitest'
import { collectionKey, isSameKey, recordKey, resourceKey, stableValue } from '../keys'

describe('query identities', () => {
  it('produces equal keys for equal logical inputs regardless of property order', () => {
    const first = collectionKey({ resource: 'roles', query: { page: 1, search: 'a' } })
    const second = collectionKey({ resource: 'roles', query: { search: 'a', page: 1 } })

    expect(isSameKey(first, second)).toBe(true)
  })

  it('ignores undefined entries but keeps null distinguishable from absent values', () => {
    expect(isSameKey(collectionKey({ resource: 'roles', query: { page: 1, search: undefined } }), collectionKey({ resource: 'roles', query: { page: 1 } }))).toBe(true)
    expect(stableValue({ search: null })).toEqual({ search: null })
  })

  it('separates two resources', () => {
    expect(isSameKey(collectionKey({ resource: 'roles' }), collectionKey({ resource: 'users' }))).toBe(false)
  })

  it('separates two record identities', () => {
    expect(isSameKey(recordKey({ resource: 'roles', id: 1, variant: 'display' }), recordKey({ resource: 'roles', id: 2, variant: 'display' }))).toBe(false)
    expect(isSameKey(recordKey({ resource: 'roles', id: '1', variant: 'display' }), recordKey({ resource: 'roles', id: 1, variant: 'display' }))).toBe(false)
  })

  it('separates two explicit table instances of one resource', () => {
    const active = collectionKey({ resource: 'users', namespace: 'assignees', query: { page: 1 } })
    const archived = collectionKey({ resource: 'users', namespace: 'archived', query: { page: 1 } })

    expect(isSameKey(active, archived)).toBe(false)
  })

  it('separates scoped collections of one resource', () => {
    const first = collectionKey({ resource: 'incident-actions', searchParameters: { incident_id: 1 } })
    const second = collectionKey({ resource: 'incident-actions', searchParameters: { incident_id: 2 } })

    expect(isSameKey(first, second)).toBe(false)
  })

  it('keeps every resource key under one invalidation prefix', () => {
    const prefix = resourceKey('roles')

    expect(collectionKey({ resource: 'roles' }).slice(0, prefix.length)).toEqual(prefix)
    expect(recordKey({ resource: 'roles', id: 1, variant: 'display' }).slice(0, prefix.length)).toEqual(prefix)
  })

  it('separates record variants and namespaces below one record prefix', () => {
    const display = recordKey({ resource: 'roles', id: 1, variant: 'display', namespace: 'detail' })
    const form = recordKey({ resource: 'roles', id: 1, variant: 'form', namespace: 'update' })
    expect(display.slice(0, 4)).toEqual(form.slice(0, 4))
    expect(display).not.toEqual(form)
  })

  it('serializes nested structures deterministically', () => {
    expect(stableValue({ b: 1, a: { d: [3, { f: 1, e: 2 }], c: 2 } })).toEqual({ a: { c: 2, d: [3, { e: 2, f: 1 }] }, b: 1 })
  })
})
