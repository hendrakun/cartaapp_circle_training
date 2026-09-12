<script setup lang="ts">
/**
 * Record surface shell.
 *
 * Owns deterministic navigation, title, and route-owned controls.
 * `Detail` still owns loading, rendering, and error state, and its props are
 * forwarded unchanged.
 */
import { computed, useSlots } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { DetailProps, FieldsInput, LoadSignalContext, MaybePromise, RecordIdentity } from '../../contracts'
import Detail from '../core/Detail.vue'
import Card from '../base/Card.vue'
import NavigationHeader from './NavigationHeader.vue'

type DetailViewProps = {
  title?: string
  backTo?: RouteLocationRaw
} & (
  | {
      run: (context?: LoadSignalContext) => MaybePromise<Record<string, unknown> | undefined>
      fields: FieldsInput<Record<string, unknown>>
      id: RecordIdentity
      resource?: string
      namespace?: string
      searchParameters?: Record<string, unknown>
      detail?: never
    }
  | { detail: DetailProps; id?: never }
)

const props = defineProps<DetailViewProps>()
const slots = useSlots()
const detailSlots = computed(() => Object.entries(slots).filter(([name]) => name.startsWith('value:')))

const surface = computed(() => {
  if ('run' in props && props.run) {
    return {
      detail: {
        // @ts-ignore -- vue-tsc TS2590: union too complex under unbound generics in
        // the app program only; remove when vue-tsc materializes this. plans/11
        fields: props.fields,
        id: props.id,
        resource: props.resource,
        namespace: props.namespace,
        searchParameters: props.searchParameters,
        load: (context: import('../../contracts').RecordLoadContext) => props.run(context),
      } as DetailProps,
    }
  }
  return { detail: props.detail! }
})
</script>

<template>
  <section class="is-detail-view flex flex-col gap-2">
    <NavigationHeader :title="title ?? ''" :back-to="backTo ?? { name: 'dashboard' }">
      <template v-if="$slots.controls" #controls><slot name="controls" /></template>
    </NavigationHeader>

    <Card variant="outlined" color="surfaceContainer" class="p-0">
      <div class="p-3 sm:p-4">
      <Detail v-bind="surface.detail">
        <template v-for="([name], index) in detailSlots" #[name]="slotProps" :key="index">
          <slot :name="name" v-bind="slotProps ?? {}" />
        </template>
      </Detail>
      </div>
    </Card>
  </section>
</template>
