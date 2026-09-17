<script setup lang="ts">
import { computed } from 'vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import { useVendorDetail } from '../vendors.detail-state'
import { editableVendorStatuses } from '../vendors.options'
import VendorProfileForm from '../vendor-profile-form.vue'
import type { VendorDetail } from '../vendors.types'

const mine = useVendorDetail()
const locked = computed(() => !(editableVendorStatuses as readonly string[]).includes(String(mine.vendor.value?.statusCode ?? '')))
</script>

<template>
  <Card variant="outlined" class="p-4">
    <h2 class="mb-3 text-base font-semibold text-on-surface">Data Perusahaan</h2>
    <dl class="mb-4 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
      <div class="flex gap-2">
        <dt class="text-on-surface-variant">Username</dt>
        <dd class="font-medium text-on-surface">{{ mine.vendor.value?.username ?? '-' }}</dd>
      </div>
      <div class="flex gap-2">
        <dt class="text-on-surface-variant">Email</dt>
        <dd class="font-medium text-on-surface">{{ mine.vendor.value?.email ?? '-' }}</dd>
      </div>
    </dl>
    <p v-if="!mine.vendor.value?.emailVerifiedAt" class="mb-3 text-sm text-on-surface-variant">Verify the registration email before submitting.</p>
    <p v-else-if="locked" class="mb-3 text-sm text-on-surface-variant">This registration is locked until the staff review finishes.</p>
    <VendorProfileForm :vendor="(mine.vendor.value ?? {}) as Record<string, unknown>" :locked="locked" @saved="(result) => mine.apply(result as VendorDetail)" />
  </Card>
</template>
