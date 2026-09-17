<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { DialogForm } from '@southneuhof/loom'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Chip from '@southneuhof/loom/components/base/Chip.vue'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { vendorsActions } from './vendors.actions'
import { useVendorDetail } from './vendors.detail-state'
import { vendorReviewAspectLabels } from './vendors.options'
import { vendorReviewFields, vendorReviewSchema, type VendorReviewFormInput } from './vendors.review'
import type { VendorDetail } from './vendors.types'

const props = defineProps<{ aspect: 'legal' | 'finance' | 'technical' | 'bim' }>()

const state = useVendorDetail()
const canDecide = computed(() => state.vendor.value?.statusCode === 'submitted')
const decision = computed(() => state.detail.value?.reviews.find((review) => review.aspect === props.aspect))
const label = computed(() => vendorReviewAspectLabels[props.aspect] ?? props.aspect)

async function decide(input: VendorReviewFormInput) {
  try {
    state.apply(
      await vendorsActions.review(String(state.vendor.value?.id ?? ''), {
        aspect: props.aspect,
        decision: input.decision,
        note: input.note ?? null,
      })
    )
  } catch (error) {
    toast.error(errorMessage(error, 'The decision could not be saved.'))
    throw error
  }
}

function preset(value: 'approved' | 'rejected') {
  return { decision: value, note: null }
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-lg border border-outline-variant p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-sm font-medium text-on-surface">{{ label }}</span>
      <Chip :color="decision ? (decision.decision === 'approved' ? 'success' : 'error') : 'neutral'">
        {{ decision ? (decision.decision === 'approved' ? 'Approved' : 'Rejected') : 'Pending' }}
      </Chip>
    </div>
    <p v-if="decision?.note" class="text-xs text-on-surface-variant">{{ decision.note }}</p>
    <div class="flex flex-row flex-wrap items-center gap-2">
      <DialogForm
        v-for="value in ['approved', 'rejected'] as const"
        :key="`${aspect}-${value}`"
        :fields="vendorReviewFields"
        :schema="vendorReviewSchema"
        :initial-data="preset(value)"
        :submit="decide"
        :title="`${value === 'approved' ? 'Approve' : 'Reject'} ${label}`"
        :disabled="!canDecide"
      >
        <template #trigger>
          <Button :variant="value === 'approved' ? 'filled' : 'outlined'" :color="value === 'approved' ? 'success' : 'error'" :disabled="!canDecide">
            {{ value === 'approved' ? 'Approve' : 'Reject' }}
          </Button>
        </template>
      </DialogForm>
    </div>
    <p v-if="!canDecide" class="text-xs text-on-surface-variant">A decision needs a vendor that is in review.</p>
  </div>
</template>
