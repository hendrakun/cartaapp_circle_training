<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import Checkbox from '@southneuhof/loom/components/inputs/CheckboxInput.vue'
import Select from '@southneuhof/loom/components/inputs/SelectInput.vue'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { vendorsActions } from '../../vendors.actions'
import { useVendorDetail } from '../../vendors.detail-state'
import { editableVendorStatuses } from '../../vendors.options'
import type { ApprovalDivision } from '../../vendors.types'

const mine = useVendorDetail()
const divisions = ref<ApprovalDivision[]>([])
const divisionCode = ref<string | null | undefined>(null)
const confirmed = ref(false)
const submitting = ref(false)

const locked = computed(() => !(editableVendorStatuses as readonly string[]).includes(String(mine.vendor.value?.statusCode ?? '')))
const missing = computed(() => mine.detail.value?.missing ?? [])
const ready = computed(() => missing.value.length === 0 && Boolean(divisionCode.value) && confirmed.value)

const missingLabels: Record<string, string> = {
  address: 'Address',
  city: 'City',
  phone: 'Phone',
  qualification: 'Qualification',
  coverage: 'Coverage',
  contact: 'At least one contact person',
  classification: 'At least one classification',
}

onMounted(async () => {
  divisionCode.value = mine.vendor.value?.approvalDivisionCode ?? null
  try {
    divisions.value = await vendorsActions.divisions()
  } catch {
    divisions.value = []
  }
})

function setDivision(value: unknown) {
  if (value == null) {
    divisionCode.value = null
    return
  }
  const first = Array.isArray(value) ? (value[0] as { code?: string } | undefined) : undefined
  divisionCode.value = first ? String(first.code ?? '') : String(value)
}

async function submitRegistration() {
  if (!ready.value || submitting.value) return
  submitting.value = true
  try {
    mine.apply(
      await vendorsActions.submitMine({
        divisionCode: String(divisionCode.value),
        confirmed: true,
      })
    )
    toast.success('Registration submitted for review.')
  } catch (error) {
    toast.error(errorMessage(error, 'The registration could not be submitted.'))
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Card variant="outlined" class="p-4">
    <h2 class="mb-1 text-base font-semibold text-on-surface">Konfirmasi Selesai</h2>
    <p class="mb-4 text-sm text-on-surface-variant">Choose the approval division and confirm, then submit for staff review.</p>

    <ul v-if="missing.length" class="mb-4 flex flex-col gap-1 text-sm text-error">
      <li v-for="field in missing" :key="field">Complete before submitting: {{ missingLabels[field] ?? field }}</li>
    </ul>
    <p v-else class="mb-4 text-sm text-success">Every required value is complete.</p>

    <div class="mb-4 flex max-w-md flex-col gap-1">
      <label for="field-division" class="text-sm font-medium text-on-surface">Approval division</label>
      <Select id="field-division" :model-value="divisionCode ?? null" @update:model-value="setDivision" :data="divisions" pick="code" view="name" :disabled="locked" placeholder="Select a division" />
    </div>

    <div class="mb-4 flex items-start gap-2">
      <Checkbox id="field-confirmed" v-model="confirmed" :disabled="locked" />
      <label for="field-confirmed" class="text-sm text-on-surface"> I confirm that the company data and the supporting documents are correct. </label>
    </div>

    <div class="flex flex-row justify-end">
      <Button :disabled="!ready || locked || submitting" @click="submitRegistration">Submit</Button>
    </div>

    <p v-if="locked" class="mt-3 text-sm text-on-surface-variant">This registration is already submitted and waits for the staff review.</p>
  </Card>
</template>
