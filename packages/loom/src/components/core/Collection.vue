<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
import { computed, getCurrentInstance, ref, toRef, watch } from 'vue'
import type { CollectionLoadContext, CollectionProps, CollectionResult, CollectionSlotProps, QueryValues } from '../../contracts'
import { useLoader, useNamespacedQuery } from '../../query'
import { assertSingleDataSource, collectionCacheKey, instanceIdentity } from './useCoreData'

const props = withDefaults(defineProps<CollectionProps<TRecord, TQuery>>(), {
  searchParameters: () => ({}),
  pagination: 'always',
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
})

const emit = defineEmits<{
  (event: 'update:query', query: QueryValues): void
}>()

assertSingleDataSource('Table', props.data, props.load)

const defaults = computed<QueryValues>(() => ({ page: 1, limit: props.defaultPageSize }))
const hasControlledQuery = 'query' in (getCurrentInstance()?.vnode.props ?? {})
const controlled = ref<QueryValues>({ ...defaults.value, ...(props.query as QueryValues | undefined) })
const query = useNamespacedQuery({
  namespace: toRef(() => props.namespace ?? 'collection'),
  defaults,
  local: hasControlledQuery || !props.namespace ? controlled : undefined,
})

watch(
  () => props.query,
  (value) => {
    if (!hasControlledQuery) return
    controlled.value = { ...defaults.value, ...((value ?? {}) as QueryValues) }
  },
)

if (!hasControlledQuery) watch(query.values, (value) => emit('update:query', value), { deep: true })

const fallbackOwner = instanceIdentity('collection')
const owner = computed(() => props.resource ?? props.namespace ?? fallbackOwner)
const effectiveQuery = computed<QueryValues>(() => {
  const values = query.values.value
  if (!props.reorderable) return values
  const { page: _page, limit: _limit, sort_by: _sortBy, sort: _sort, ...filters } = values
  return filters
})
const loaded = useLoader<CollectionLoadContext<TQuery>, CollectionResult<TRecord>>({
  key: computed(() => collectionCacheKey(owner.value, props.namespace, effectiveQuery.value, props.searchParameters ?? {})),
  context: computed(() => ({ query: effectiveQuery.value as TQuery, searchParameters: props.searchParameters ?? {} })),
  load: computed(() => props.load),
  data: computed(() => (props.data ? { data: props.data } : undefined)),
})

const records = computed(() => loaded.data.value?.data ?? [])
const meta = computed(() => loaded.data.value?.meta)
const empty = computed(() => !loaded.loading.value && !loaded.error.value && records.value.length === 0)

function updateQuery(patch: QueryValues) {
  query.update(patch)
  if (hasControlledQuery) emit('update:query', query.values.value)
}

function replaceQuery(values: QueryValues) {
  query.replace(values)
  if (hasControlledQuery) emit('update:query', query.values.value)
}

const slotProps = computed<CollectionSlotProps<TRecord, TQuery>>(() => ({
  records: records.value,
  meta: meta.value,
  loading: loaded.loading.value,
  error: loaded.error.value,
  empty: empty.value,
  query: query.values.value as TQuery,
  refresh: loaded.refresh,
  updateQuery,
}))

defineExpose({ refresh: loaded.refresh, query: query.values, updateQuery, replaceQuery })
</script>

<template>
  <slot v-bind="slotProps" />
</template>
