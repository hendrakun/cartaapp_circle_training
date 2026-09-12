<script setup lang="ts" generic="TRecord extends object = Record<string, unknown>, TQuery extends object = Record<string, unknown>">
import { computed, ref, useSlots } from 'vue'
import type { CollectionProps, QueryValues, RowReorderPayload, TableProps } from '../../contracts'
import Collection from './Collection.vue'
import TableContent from './TableContent.vue'

const props = withDefaults(defineProps<TableProps<TRecord, TQuery>>(), {
  searchParameters: () => ({}),
  pagination: 'auto',
  pageSizeOptions: () => [10, 25, 50, 100],
  defaultPageSize: 10,
  minColumnWidth: 96,
})

const emit = defineEmits<{
  (event: 'update:query', query: QueryValues): void
  (event: 'update:visibleColumns', columns: string[]): void
  (event: 'update:columnSizing', sizes: Record<string, number>): void
  (event: 'row-click', record: Record<string, unknown>, index: number): void
  (event: 'row-reorder', payload: RowReorderPayload): void
}>()

defineSlots<{
  collection?: (props: import('../../contracts').CollectionSlotProps<TRecord, TQuery>) => unknown
  [name: string]: unknown
}>()
const slots = useSlots()
const forwardedSlots = computed(() => Object.fromEntries(
  Object.entries(slots).filter(([name]) => name !== 'collection'),
))
const collectionRef = ref<{ refresh: () => Promise<void>; query: { value: QueryValues }; updateQuery: (patch: QueryValues) => void; replaceQuery: (values: QueryValues) => void }>()

const collectionProps = computed<CollectionProps<TRecord, TQuery>>(() => {
  const value: CollectionProps<TRecord, TQuery> = {
    data: props.data,
    load: props.load,
    resource: props.resource,
    searchParameters: props.searchParameters,
    namespace: props.namespace,
    pagination: props.pagination,
    pageSizeOptions: props.pageSizeOptions,
    defaultPageSize: props.defaultPageSize,
    reorderable: props.reorderable,
  }
  if (props.query !== undefined) value.query = props.query
  return value
})

function updateQuery(patch: QueryValues) {
  collectionRef.value?.updateQuery(patch)
  const values = collectionRef.value?.query.value
  if (values) emit('update:query', values)
}

function replaceQuery(values: QueryValues) {
  collectionRef.value?.replaceQuery(values)
  const next = collectionRef.value?.query.value
  if (next) emit('update:query', next)
}

function refresh() {
  return collectionRef.value?.refresh() ?? Promise.resolve()
}

function rowClick(record: Record<string, unknown>, index: number) {
  emit('row-click', record, index)
}

function rowReorder(payload: RowReorderPayload) {
  emit('row-reorder', payload)
}

/** Public read view of the collection-owned query state. */
const exposedQuery = computed<QueryValues>(() => collectionRef.value?.query ?? {})

defineExpose({ refresh, query: exposedQuery, updateQuery, replaceQuery })
</script>

<template>
  <Collection ref="collectionRef" v-bind="collectionProps" @update:query="emit('update:query', $event)">
    <template #default="collection">
      <TableContent
        :fields="props.fields"
        :records="collection.records"
        :meta="collection.meta"
        :loading="collection.loading"
        :error="collection.error"
        :empty="collection.empty"
        :query="collection.query"
        :refresh="collection.refresh"
        :update-query="collection.updateQuery"
        :search-parameters="props.searchParameters"
        :namespace="props.namespace"
        :pagination="props.pagination"
        :page-size-options="props.pageSizeOptions"
        :default-page-size="props.defaultPageSize"
        :min-column-width="props.minColumnWidth"
        :visible-columns="props.visibleColumns"
        :column-sizing="props.columnSizing"
        :reorderable="props.reorderable"
        :row-key="props.rowKey"
        :schema="props.schema"
        @update:query="collection.updateQuery"
        @update:visible-columns="emit('update:visibleColumns', $event)"
        @update:column-sizing="emit('update:columnSizing', $event)"
        @row-click="rowClick"
        @row-reorder="rowReorder"
      >
        <template v-if="$slots.collection" #collection="slotProps">
          <slot name="collection" v-bind="slotProps" />
        </template>
        <template v-for="(_, name) in forwardedSlots" #[name]="slotProps" :key="name">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>
      </TableContent>
    </template>
  </Collection>
</template>
