<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppRouterView from '@/components/routing/AppRouterView.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import Chip from '@southneuhof/loom/components/base/Chip.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import { vendorStatusLabels } from '../vendors.options'
import { provideVendorDetail } from '../vendors.detail-state'

/**
 * The vendor area owns its menu rail. This is a user-approved exception to the
 * app Tabs convention for several child sections: the vendor works through a
 * fixed eight-step checklist, so the rail shows the step and its state.
 */
const mine = provideVendorDetail()
const route = useRoute()

const menu = [
  { name: 'vendors-mine', label: 'Data Perusahaan', area: 'data_perusahaan' },
  { name: 'vendors-mine-contact-person', label: 'Contact Person', area: 'contact_person' },
  { name: 'vendors-mine-bidang-usaha', label: 'Bidang Usaha', area: 'bidang_usaha' },
  { name: 'vendors-mine-data-pendukung-legal', label: 'Data Pendukung Legal', area: 'data_pendukung_legal' },
  { name: 'vendors-mine-data-pendukung-teknis', label: 'Data Pendukung Teknis', area: 'data_pendukung_teknis' },
  { name: 'vendors-mine-data-pendukung-keuangan', label: 'Data Pendukung Keuangan', area: 'data_pendukung_keuangan' },
  { name: 'vendors-mine-input-bim', label: 'Input BIM', area: 'input_bim' },
  { name: 'vendors-mine-konfirmasi-selesai', label: 'Konfirmasi Selesai', area: 'konfirmasi_selesai' },
] as const

const statusLabel = computed(() => vendorStatusLabels[String(mine.vendor.value?.statusCode ?? '')]?.label ?? String(mine.vendor.value?.statusCode ?? ''))
const statusColor = computed(() => vendorStatusLabels[String(mine.vendor.value?.statusCode ?? '')]?.color ?? 'primary')

function complete(area: string) {
  return mine.detail.value?.progress?.[area] === true
}

function isActive(name: string) {
  return route.name === name
}

onMounted(mine.load)
</script>

<template>
  <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
    <Card variant="outlined" class="w-full p-3 lg:sticky lg:top-0 lg:w-72 lg:shrink-0">
      <div class="flex flex-col gap-1 border-b border-outline-variant pb-3">
        <p class="text-sm font-semibold text-on-surface">{{ mine.vendor.value?.companyName ?? 'Vendor registration' }}</p>
        <p class="text-xs text-on-surface-variant">{{ mine.vendor.value?.username ?? '' }}</p>
        <Chip class="mt-1" :color="statusColor as never">{{ statusLabel }}</Chip>
      </div>

      <nav class="mt-3 flex flex-col gap-1" aria-label="Vendor areas">
        <RouterLink
          v-for="item in menu"
          :key="item.name"
          :to="{ name: item.name }"
          class="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-on-surface hover:bg-surface-container-high"
          :class="isActive(item.name) ? 'bg-secondary-container text-on-secondary-container font-medium' : ''"
        >
          <span class="min-w-0 truncate">{{ item.label }}</span>
          <Icon :name="complete(item.area) ? 'checkbox-circle' : 'information'" :class="complete(item.area) ? 'text-success' : 'text-on-surface-variant'" />
        </RouterLink>
      </nav>

      <div v-if="mine.status.value === 'missing'" class="mt-3">
        <p class="text-sm text-on-surface-variant">No vendor registration belongs to this account.</p>
      </div>
      <div v-else-if="mine.status.value === 'error'" class="mt-3 flex flex-col gap-2">
        <p role="alert" class="text-sm text-error">{{ mine.error.value }}</p>
        <Button variant="tonal" @click="mine.load">Try again</Button>
      </div>
    </Card>

    <div class="min-w-0 flex-1">
      <p v-if="mine.status.value === 'loading'" role="status" aria-live="polite" class="text-sm text-on-surface">Memuat…</p>
      <AppRouterView v-else-if="mine.status.value === 'ready'" />
    </div>
  </div>
</template>
