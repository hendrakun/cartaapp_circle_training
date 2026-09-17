<script setup lang="ts">
import { computed } from 'vue'
import { Form } from '@southneuhof/loom'
import Card from '@southneuhof/loom/components/base/Card.vue'
import { vendorsActions } from '../../vendors.actions'
import { useVendorDetail } from '../../vendors.detail-state'
import { editableVendorStatuses } from '../../vendors.options'
import { vendorBidangUsahaFields, vendorBidangUsahaSchema, type VendorBidangUsahaInput } from '../../vendors.bidang-usaha'
import type { VendorDetail } from '../../vendors.types'

const mine = useVendorDetail()
const locked = computed(() => !(editableVendorStatuses as readonly string[]).includes(String(mine.vendor.value?.statusCode ?? '')))

/** The draft keeps the selected record objects; the action sends their ids. */
const initialData = computed(() => ({
  qualification: mine.vendor.value?.qualification ?? null,
  coverage: mine.vendor.value?.coverage ?? null,
  classifications: mine.detail.value?.classifications ?? [],
}))

const submit = {
  run: async (input: VendorBidangUsahaInput) => {
    const saved = await vendorsActions.saveClassifications({
      businessField: String(mine.vendor.value?.businessField ?? ''),
      classificationIds: input.classifications.map((row) => row.id),
    })
    if (input.qualification !== mine.vendor.value?.qualification || input.coverage !== mine.vendor.value?.coverage) {
      const profile = await vendorsActions.saveMine({ qualification: input.qualification, coverage: input.coverage })
      mine.apply(profile)
    }
    return saved
  },
}
</script>

<template>
  <Card variant="outlined" class="p-4">
    <h2 class="mb-3 text-base font-semibold text-on-surface">Bidang Usaha</h2>
    <p class="mb-3 text-sm text-on-surface-variant">
      Business field: <strong>{{ mine.vendor.value?.businessField ?? '-' }}</strong
      >. The classification list follows this field.
    </p>
    <Form
      :key="`${mine.vendor.value?.businessField ?? ''}:${mine.vendor.value?.updatedAt ?? ''}`"
      :fields="vendorBidangUsahaFields"
      :schema="vendorBidangUsahaSchema"
      :initial-data="initialData"
      :submit="submit"
      :disabled="locked"
      submit-label="Save bidang usaha"
      @submitted="(result) => mine.apply(result as VendorDetail)"
    />
  </Card>
</template>
