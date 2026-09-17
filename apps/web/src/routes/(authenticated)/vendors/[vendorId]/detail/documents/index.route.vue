<script setup lang="ts">
import { computed } from 'vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import { useVendorDetail } from '../../../vendors.detail-state'
import { vendorDocumentTypeLabels } from '../../../vendors.options'
import type { VendorDocumentSlot } from '../../../vendors.types'

const state = useVendorDetail()
const groups = computed(() => {
  const slots = state.detail.value?.documents ?? []
  return (['legal', 'finance', 'technical'] as const).map((category) => ({
    category,
    label: vendorDocumentTypeLabels[category]?.label ?? category,
    slots: slots.filter((slot) => slot.category === category),
  }))
})

function fileUrl(slot: VendorDocumentSlot) {
  return slot.file?.url
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Card v-for="group in groups" :key="group.category" variant="outlined" class="p-4">
      <h3 class="mb-3 text-sm font-semibold text-on-surface">{{ group.label }}</h3>
      <ul class="flex flex-col gap-2">
        <li v-for="slot in group.slots" :key="slot.requirementId" class="flex flex-col gap-1 border-b border-outline-variant pb-2 text-sm last:border-b-0">
          <span class="font-medium text-on-surface">{{ slot.name }}</span>
          <a v-if="slot.file" :href="fileUrl(slot)" target="_blank" rel="noopener noreferrer" class="text-info underline">{{ slot.file.name }}</a>
          <span v-else class="text-on-surface-variant">No file uploaded</span>
        </li>
      </ul>
    </Card>
  </div>
</template>
