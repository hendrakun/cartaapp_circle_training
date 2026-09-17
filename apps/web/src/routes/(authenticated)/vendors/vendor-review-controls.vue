<script setup lang="ts">
import { vendorReviewAspects } from './vendors.types'
import VendorAspectReview from './vendor-aspect-review.vue'
</script>

<template>
  <div class="flex flex-col gap-2">
    <span class="text-sm font-medium text-on-surface">Review per aspect</span>
    <VendorAspectReview v-for="aspect in vendorReviewAspects" :key="aspect" :aspect="aspect" />
  </div>
</template>
