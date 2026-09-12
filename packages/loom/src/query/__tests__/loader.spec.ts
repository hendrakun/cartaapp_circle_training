import { describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useLoader } from '../loader'
import { collectionKey } from '../keys'
import { createFrameworkQueryClient, invalidateResourceData } from '../client'
import { collectionCacheKey, recordCacheKey } from '../../components/core/useCoreData'
import type { CollectionLoadContext, CollectionResult } from '../../contracts'
import { deferred, flush, withApp } from './harness'

interface Role extends Record<string, unknown> {
  id: number
  name: string
}

const context = { query: {}, searchParameters: {} }

describe('internal loader', () => {
  it('accepts synchronous, offline values through the same contract', async () => {
    const { result, app } = withApp(() =>
      useLoader<CollectionLoadContext, CollectionResult<Role>>({
        key: collectionKey({ resource: 'roles' }),
        context,
        load: () => ({ data: [{ id: 1, name: 'Admin' }] }),
      }),
    )
    await flush()

    expect(result.data.value?.data).toEqual([{ id: 1, name: 'Admin' }])
    app.unmount()
  })

  it('deduplicates loads that share a key even when the closure differs', async () => {
    const load = vi.fn(async () => ({ data: [{ id: 1, name: 'Admin' }] }))
    const queryClient = createFrameworkQueryClient()

    const { app } = withApp(
      () => ({
        first: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: { page: 1 } }),
          context,
          load: (loadContext) => load(loadContext),
        }),
        second: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: { page: 1 } }),
          context,
          load: (loadContext) => load(loadContext),
        }),
      }),
      { queryClient },
    )
    await flush(8)

    expect(load).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  it('separates caches for different keys', async () => {
    const load = vi.fn(async ({ query }: CollectionLoadContext) => ({ data: [{ id: Number(query.page), name: 'Role' }] }))
    const queryClient = createFrameworkQueryClient()

    const { app } = withApp(
      () => ({
        first: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: { page: 1 } }),
          context: { query: { page: 1 }, searchParameters: {} },
          load,
        }),
        second: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles', query: { page: 2 } }),
          context: { query: { page: 2 }, searchParameters: {} },
          load,
        }),
      }),
      { queryClient },
    )
    await flush(8)

    expect(load).toHaveBeenCalledTimes(2)
    app.unmount()
  })

  it('forwards an abort signal and cancels when the key changes', async () => {
    const page = ref(1)
    const pending = deferred<CollectionResult<Role>>()
    const signals: (AbortSignal | undefined)[] = []
    const queryClient = createFrameworkQueryClient()

    const { app } = withApp(
      () =>
        useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: computed(() => collectionKey({ resource: 'roles', query: { page: page.value } })),
          context: computed(() => ({ query: { page: page.value }, searchParameters: {} })),
          load: ({ signal }) => {
            signals.push(signal)
            return page.value === 1 ? pending.promise : Promise.resolve({ data: [] })
          },
        }),
      { queryClient },
    )
    await flush(6)

    expect(signals[0]).toBeInstanceOf(AbortSignal)
    expect(signals[0]?.aborted).toBe(false)

    page.value = 2
    await flush(6)

    expect(signals[0]?.aborted).toBe(true)
    pending.resolve({ data: [] })
    app.unmount()
  })

  it('normalizes failures through the data adapter', async () => {
    const { result, app } = withApp(
      () =>
        useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles' }),
          context,
          load: async () => {
            throw { message: 'Backend refused.' }
          },
        }),
      {
        queryClient: createFrameworkQueryClient({ retry: 0 }),
        adapters: { data: { normalizeError: (error) => ({ message: `normalized: ${(error as { message: string }).message}` }) } },
      },
    )
    await flush(10)

    expect(result.error.value?.message).toBe('normalized: Backend refused.')
    app.unmount()
  })

  it('does not load when data is supplied externally', async () => {
    const load = vi.fn(async () => ({ data: [] }))
    const { result, app } = withApp(() =>
      useLoader<CollectionLoadContext, CollectionResult<Role>>({
        key: collectionKey({ resource: 'roles' }),
        context,
        load: undefined,
        data: { data: [{ id: 9, name: 'Static' }] },
      }),
    )
    await flush()

    expect(load).not.toHaveBeenCalled()
    expect(result.data.value?.data).toEqual([{ id: 9, name: 'Static' }])
    app.unmount()
  })

  it('rejects supplying both data and load', () => {
    expect(() =>
      withApp(() =>
        useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles' }),
          context,
          load: () => ({ data: [] }),
          data: { data: [] },
        }),
      ),
    ).toThrow('`data` and `load` are alternatives')
  })

  it('invalidates by resource semantics without exposing keys', async () => {
    const load = vi.fn(async () => ({ data: [{ id: 1, name: 'Admin' }] }))
    const unrelated = vi.fn(async () => ({ data: [] }))
    const queryClient = createFrameworkQueryClient({ staleTime: 0 })

    const { app } = withApp(
      () => ({
        roles: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'roles' }),
          context,
          load,
        }),
        users: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionKey({ resource: 'users' }),
          context,
          load: unrelated,
        }),
      }),
      { queryClient },
    )
    await flush(8)
    expect(load).toHaveBeenCalledTimes(1)

    await invalidateResourceData(queryClient, { resource: 'roles' })
    await flush(8)

    expect(load).toHaveBeenCalledTimes(2)
    expect(unrelated).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  it('invalidates the keys used by table and detail cores', async () => {
    const listLoad = vi.fn(async () => ({ data: [{ id: 1, name: 'Admin' }] }))
    const detailLoad = vi.fn(async () => ({ id: 1, name: 'Admin' }))
    const queryClient = createFrameworkQueryClient({ staleTime: 0 })

    const { app } = withApp(
      () => ({
        list: useLoader<CollectionLoadContext, CollectionResult<Role>>({
          key: collectionCacheKey('roles', undefined, {}, {}),
          context,
          load: listLoad,
        }),
        detail: useLoader({
          key: recordCacheKey('roles', 1, 'display', undefined, {}),
          context: { id: 1, searchParameters: {} },
          load: detailLoad,
        }),
      }),
      { queryClient },
    )
    await flush(8)
    expect(listLoad).toHaveBeenCalledTimes(1)
    expect(detailLoad).toHaveBeenCalledTimes(1)

    await invalidateResourceData(queryClient, { resource: 'roles' })
    await flush(8)

    expect(listLoad).toHaveBeenCalledTimes(2)
    expect(detailLoad).toHaveBeenCalledTimes(2)

    await invalidateResourceData(queryClient, { resource: 'roles', id: 1 })
    await flush(8)

    expect(listLoad).toHaveBeenCalledTimes(3)
    expect(detailLoad).toHaveBeenCalledTimes(3)
    app.unmount()
  })

  it('refetches active orientation records and collections through base resource owners', async () => {
    const categoryResource = 'my-syllabus-categories'
    const categoryId = 'category-1'
    const syllabusResource = 'my-syllabi.category-1'
    const syllabusId = 'syllabus-1'
    const materialResource = 'my-learning-materials.category-1.syllabus-1'
    const materialId = 'material-1'
    const categoryLoad = vi.fn(async () => ({ id: categoryId, name: 'Orientation' }))
    const historyLoad = vi.fn(async () => [{ id: syllabusId, name: 'Syllabus' }])
    const syllabusLoad = vi.fn(async () => ({ id: syllabusId, name: 'Syllabus' }))
    const materialLoad = vi.fn(async () => ({ data: [{ id: materialId, name: 'Material' }] }))
    const actionNamespaceLoad = vi.fn(async () => ({ id: syllabusId, name: 'Private action query' }))
    const queryClient = createFrameworkQueryClient({ staleTime: 0 })

    const { app } = withApp(
      () => ({
        category: useLoader({
          key: recordCacheKey(categoryResource, categoryId, 'display', undefined, { categoryId }),
          context: { id: categoryId, searchParameters: { categoryId } },
          load: categoryLoad,
        }),
        histories: useLoader({
          key: collectionKey({ resource: categoryResource, namespace: `histories.${categoryId}`, searchParameters: { categoryId } }),
          context: { query: {}, searchParameters: { categoryId } },
          load: historyLoad,
        }),
        syllabus: useLoader({
          key: recordCacheKey(syllabusResource, syllabusId, 'display', undefined, { categoryId, syllabusId }),
          context: { id: syllabusId, searchParameters: { categoryId, syllabusId } },
          load: syllabusLoad,
        }),
        materials: useLoader({
          key: collectionKey({ resource: materialResource, query: { page: 1, limit: 100 }, searchParameters: { categoryId, syllabusId } }),
          context: { query: { page: 1, limit: 100 }, searchParameters: { categoryId, syllabusId } },
          load: materialLoad,
        }),
        privateActionQuery: useLoader({
          key: recordCacheKey(syllabusResource, syllabusId, 'display', `${syllabusResource}.detail.${syllabusId}`, { categoryId, syllabusId }),
          context: { id: syllabusId, searchParameters: { categoryId, syllabusId } },
          load: actionNamespaceLoad,
        }),
      }),
      { queryClient },
    )
    await flush(10)

    expect(categoryLoad).toHaveBeenCalledTimes(1)
    expect(historyLoad).toHaveBeenCalledTimes(1)
    expect(syllabusLoad).toHaveBeenCalledTimes(1)
    expect(materialLoad).toHaveBeenCalledTimes(1)
    expect(actionNamespaceLoad).toHaveBeenCalledTimes(1)

    await Promise.all([
      invalidateResourceData(queryClient, { resource: categoryResource, id: categoryId }),
      invalidateResourceData(queryClient, { resource: syllabusResource, id: syllabusId }),
      invalidateResourceData(queryClient, { resource: materialResource, id: materialId }),
    ])
    await flush(10)

    expect(categoryLoad).toHaveBeenCalledTimes(2)
    expect(historyLoad).toHaveBeenCalledTimes(2)
    expect(syllabusLoad).toHaveBeenCalledTimes(2)
    expect(materialLoad).toHaveBeenCalledTimes(2)
    expect(actionNamespaceLoad).toHaveBeenCalledTimes(2)
    app.unmount()
  })
})
