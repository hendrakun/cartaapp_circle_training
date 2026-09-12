<script setup lang="ts">
/**
 * Record core.
 *
 * Owns record loading, field rendering, and loading/empty/error states. It owns
 * no page layout, route navigation, or edit and delete controls.
 */
import { computed } from 'vue'
import type { DetailProps, RecordLoadContext, RecordResult } from '../../contracts'
import { displayValue, resolveFields, useFrameworkFieldDefaults } from '../../fields'
import { useLoader } from '../../query'
import { useRendererRegistry } from '../../renderers/registry'
import { assertSingleDataSource, instanceIdentity, recordCacheKey } from './useCoreData'

const props = withDefaults(defineProps<DetailProps>(), {
  searchParameters: () => ({}),
})

assertSingleDataSource('Detail', props.data, props.load)

const renderers = useRendererRegistry('detail')
const fieldDefaults = useFrameworkFieldDefaults()

const fields = computed(() => resolveFields({
  fields: props.fields,
  surface: 'detail',
  defaults: fieldDefaults.detail,
  defaultFields: fieldDefaults.fields,
}))
const fallbackOwner = instanceIdentity('detail')
const owner = computed(() => props.resource ?? props.namespace ?? fallbackOwner)

const loaded = useLoader<RecordLoadContext, RecordResult>({
  key: computed(() => recordCacheKey(owner.value, props.id, 'display', props.namespace, props.searchParameters ?? {})),
  context: computed(() => ({ id: props.id, searchParameters: props.searchParameters ?? {} })),
  load: computed(() => props.load),
  data: computed(() => props.data),
})

const record = computed(() => loaded.data.value)
const entries = computed(() =>
  fields.value.map((field) => ({
    field,
    value: record.value ? displayValue(record.value, field) : undefined,
  })),
)

defineExpose({ refresh: loaded.refresh })
</script>

<template>
  <div class="is-detail">
    <slot v-if="loaded.loading.value" name="loading">
      <p role="status" aria-live="polite">Memuat…</p>
    </slot>

    <slot v-else-if="loaded.error.value" name="error" :error="loaded.error.value">
      <p role="alert">{{ loaded.error.value?.message }}</p>
    </slot>

    <slot v-else-if="!record" name="empty">
      <p>Data tidak ditemukan.</p>
    </slot>

    <div v-else class="overflow-x-auto">
      <table class="w-full border-collapse">
        <tbody>
          <tr v-for="entry in entries" :key="entry.field.key">
            <th scope="row" class="w-px whitespace-nowrap py-1 pe-3 text-left align-center text-sm font-normal text-on-surface">
              {{ entry.field.label }}
            </th>
            <td aria-hidden="true" class="w-px whitespace-nowrap py-1 pe-3 align-top text-on-surface-variant">:</td>
            <td :data-emphasis="entry.field.emphasis" class="min-w-0 break-words py-1 text-sm text-on-surface">
              <slot :name="`value:${entry.field.key}`" :value="entry.value" :record="record" :field="entry.field">
                <component
                  :is="renderers.require(entry.field.renderer)"
                  v-if="entry.field.renderer"
                  v-bind="entry.field.props"
                  :value="entry.value"
                  :record="record"
                  :field="entry.field"
                />
                <template v-else>{{ entry.value ?? '-' }}</template>
              </slot>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
