<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { DetailView } from '@southneuhof/loom'
import AppRouterView from '@/components/routing/AppRouterView.vue'
import Tabs from '@/components/routing/Tabs.vue'
import type { RouteTab } from '@/router/tabs'
import { vendorsActions } from '../vendors.actions'
import { provideVendorDetail } from '../vendors.detail-state'
import { vendors } from '../vendors.resource'
import VendorReviewControls from '../vendor-review-controls.vue'

const route = useRoute('vendors-detail')
const vendorId = computed(() => String(route.params.vendorId))
const state = provideVendorDetail(() => vendorsActions.staffDetail(vendorId.value))

const tabs = [
  { action: { permission: 'detail-vendors', to: { name: 'vendors-detail-contacts', params: { vendorId: vendorId.value } } }, label: 'Contacts' },
  { action: { permission: 'detail-vendors', to: { name: 'vendors-detail-documents', params: { vendorId: vendorId.value } } }, label: 'Documents' },
  { action: { permission: 'detail-vendors', to: { name: 'vendors-detail-bim', params: { vendorId: vendorId.value } } }, label: 'BIM' },
  { action: { permission: 'detail-vendors', to: { name: 'vendors-detail-reviews', params: { vendorId: vendorId.value } } }, label: 'Reviews' },
] satisfies readonly RouteTab[]

onMounted(state.load)
</script>

<template>
  <div class="flex flex-col gap-2">
    <DetailView v-bind="vendors.detail({ id: vendorId })">
      <template #controls>
        <VendorReviewControls />
      </template>
    </DetailView>
    <Tabs label="Vendor" :items="tabs" />
    <AppRouterView />
  </div>
</template>
