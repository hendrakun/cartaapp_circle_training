<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ListView } from '@southneuhof/loom'
import { vendorContacts } from '../../../vendor-contacts.resource'

const route = useRoute('vendors-detail-contacts')
const vendorId = computed(() => String(route.params.vendorId))
const list = computed(() => vendorContacts.list({ searchParameters: { vendor_id: vendorId.value } }))
</script>

<template>
  <ListView v-bind="list" title="Contacts" :export="false" />
</template>
