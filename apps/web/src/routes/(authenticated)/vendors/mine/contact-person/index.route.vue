<script setup lang="ts">
import { computed } from 'vue'
import { useVendorDetail } from '../../vendors.detail-state'
import { editableVendorStatuses } from '../../vendors.options'
import VendorContactsSection from '../../vendor-contacts-section.vue'

const mine = useVendorDetail()
const locked = computed(() => !(editableVendorStatuses as readonly string[]).includes(String(mine.vendor.value?.statusCode ?? '')))
const vendorId = computed(() => String(mine.vendor.value?.id ?? ''))
</script>

<template>
  <VendorContactsSection v-if="vendorId" :vendor-id="vendorId" :locked="locked" />
</template>
