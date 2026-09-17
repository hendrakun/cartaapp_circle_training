<script setup lang="ts">
import Card from '@southneuhof/loom/components/base/Card.vue'
import Chip from '@southneuhof/loom/components/base/Chip.vue'
import { useVendorDetail } from '../../../vendors.detail-state'
import { vendorReviewAspectLabels } from '../../../vendors.options'

const state = useVendorDetail()
</script>

<template>
  <Card variant="outlined" class="p-4">
    <h3 class="mb-3 text-sm font-semibold text-on-surface">Review decisions</h3>
    <ul class="flex flex-col gap-2">
      <li v-for="review in state.detail.value?.reviews ?? []" :key="review.aspect" class="flex flex-col gap-1 border-b border-outline-variant pb-2 text-sm last:border-b-0">
        <span class="flex items-center gap-2">
          <span class="font-medium text-on-surface">{{ vendorReviewAspectLabels[review.aspect] ?? review.aspect }}</span>
          <Chip :color="review.decision === 'approved' ? 'success' : 'error'">{{ review.decision === 'approved' ? 'Approved' : 'Rejected' }}</Chip>
        </span>
        <span v-if="review.note" class="text-on-surface-variant">{{ review.note }}</span>
      </li>
    </ul>
    <p v-if="!(state.detail.value?.reviews ?? []).length" class="text-sm text-on-surface-variant">No aspect decision yet.</p>
  </Card>
</template>
