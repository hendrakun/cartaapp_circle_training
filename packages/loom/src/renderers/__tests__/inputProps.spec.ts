import { describe, expect, it } from 'vitest'
import { createInputPropsRegistry } from '../inputProps'

describe('input props registry', () => {
  it('resolves defaults, source, then explicit props without mutation', () => {
    const source = { query: 'north' }
    const explicit = { query: 'private', nested: { explicit: true } }
    const registry = createInputPropsRegistry({
      lookup: { defaults: { dense: true, nested: { defaults: true } }, normalize: (value: typeof source) => ({ query: value.query, load: () => undefined, nested: { source: true } }) },
    })
    expect(registry.resolve('lookup', { source, props: explicit, context: { field: { key: 'sectionId' } } })).toEqual({
      dense: true, query: 'private', load: expect.any(Function), nested: { explicit: true },
    })
    expect(source).toEqual({ query: 'north' })
    expect(explicit).toEqual({ query: 'private', nested: { explicit: true } })
  })

  it('accepts falsy sources and passes explicit props through without a source', () => {
    const registry = createInputPropsRegistry({ flag: { normalize: (value: false | 0) => ({ value }) } })
    expect(registry.resolve('flag', { source: false })).toEqual({ value: false })
    expect(registry.resolve('unknown', { props: { native: true } })).toEqual({ native: true })
  })

  it('rejects missing, async, and non-plain source normalizers with field context', () => {
    const registry = createInputPropsRegistry({
      missing: {},
      async: { normalize: () => Promise.resolve({}) },
      array: { normalize: () => [] as unknown as Record<string, unknown> },
      map: { normalize: () => new Map() as unknown as Record<string, unknown> },
    })
    expect(() => registry.resolve('unknown', { source: {}, context: { field: { key: 'x' } } })).toThrow('unknown')
    expect(() => registry.resolve('missing', { source: {}, context: { field: { key: 'x' } } })).toThrow('missing')
    expect(() => registry.resolve('async', { source: {}, context: { field: { key: 'x' } } })).toThrow('synchronously')
    expect(() => registry.resolve('array', { source: {} })).toThrow('plain object')
    expect(() => registry.resolve('map', { source: {} })).toThrow('plain object')
  })

  it('hydrates loaded values', () => {
    const canonical = { kind: 'file', id: 'asset-1', url: 'https://files.test/asset-1', name: 'asset-1' }
    const registry = createInputPropsRegistry({ image: { value: { hydrate: (value) => canonical ?? value } } })

    expect(registry.hydrate('image', 'asset-1')).toBe(canonical)
  })

  it('validates built-in number, file/image, and multi-lookup control values', () => {
    const canonical = { kind: 'file', id: 'asset-1', url: 'https://files.test/asset-1', name: 'asset-1' }
    const registry = createInputPropsRegistry({})

    expect(registry.contract('number').validate?.(undefined, {})).toBeUndefined()
    expect(registry.contract('number').validate?.(12, {})).toBeUndefined()
    expect(registry.contract('number').validate?.('12', {})).toContain('finite number')
    expect(registry.contract('number').validate?.(Number.NaN, {})).toContain('finite number')
    for (const renderer of ['file', 'image'] as const) {
      expect(registry.contract(renderer).validate?.(canonical, {})).toBeUndefined()
      expect(registry.contract(renderer).validate?.({ id: 'asset-1' }, {})).toContain('uploaded asset')
      expect(registry.contract(renderer).validate?.('asset-1', {})).toContain('uploaded asset')
      expect(registry.contract(renderer).validate?.([canonical], { props: { multi: true } })).toBeUndefined()
      expect(registry.contract(renderer).validate?.(canonical, { props: { multi: true } })).toContain('array')
      expect(registry.contract(renderer).validate?.(['asset-1'], { props: { multi: true } })).toContain('array')
      expect(registry.contract(renderer).validate?.([], { props: { multi: true } })).toBeUndefined()
    }
    expect(registry.contract('lookup').validate?.([{ id: 'lookup-1' }], { props: { multi: true } })).toBeUndefined()
    expect(registry.contract('lookup').validate?.(['lookup-1'], { props: { multi: true } })).toContain('lookup records')
  })

  it('lets an adapter override its default validation', () => {
    const registry = createInputPropsRegistry({
      number: {
        validate: (value) => value === 12 ? undefined : 'Use twelve.',
      },
    })
    const contract = registry.contract('number')

    expect(contract.validate?.(12, {})).toBeUndefined()
    expect(contract.validate?.(10, {})).toBe('Use twelve.')
  })

})
