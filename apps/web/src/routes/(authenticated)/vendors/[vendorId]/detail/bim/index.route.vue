<script setup lang="ts">
import Card from '@southneuhof/loom/components/base/Card.vue'
import { useVendorDetail } from '../../../vendors.detail-state'

const state = useVendorDetail()
</script>

<template>
  <Card variant="outlined" class="p-4">
    <h3 class="mb-3 text-sm font-semibold text-on-surface">Building Information Modeling</h3>
    <ul class="flex flex-col gap-3">
      <li v-for="entry in state.detail.value?.bim ?? []" :key="entry.questionId" class="flex flex-col gap-1 border-b border-outline-variant pb-3 text-sm last:border-b-0">
        <span class="text-on-surface">{{ entry.question }}</span>
        <span class="text-on-surface-variant">
          Answer: <strong>{{ entry.answer === null ? 'Not answered' : entry.answer ? 'Ya' : 'Tidak' }}</strong>
        </span>
        <span v-if="entry.note" class="text-on-surface-variant">Note: {{ entry.note }}</span>
        <a v-if="entry.file" :href="entry.file.url" target="_blank" rel="noopener noreferrer" class="text-info underline">{{ entry.file.name }}</a>
      </li>
    </ul>
  </Card>
</template>
