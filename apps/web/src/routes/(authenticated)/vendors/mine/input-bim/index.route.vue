<script setup lang="ts">
import { computed } from 'vue'
import { Form } from '@southneuhof/loom'
import Card from '@southneuhof/loom/components/base/Card.vue'
import { vendorsActions } from '../../vendors.actions'
import { useVendorDetail } from '../../vendors.detail-state'
import { editableVendorStatuses } from '../../vendors.options'
import { bimFieldsFor, bimInitial, bimPayload, bimSchemaFor } from '../../vendors.bim'
import type { BimDraft } from '../../vendors.bim.types'
import type { VendorDetail } from '../../vendors.types'

const mine = useVendorDetail()
const locked = computed(() => !(editableVendorStatuses as readonly string[]).includes(String(mine.vendor.value?.statusCode ?? '')))
const questions = computed(() => mine.detail.value?.bim ?? [])
const fields = computed(() => bimFieldsFor(questions.value))
const schema = computed(() => bimSchemaFor(questions.value))
const initialData = computed(() => bimInitial(questions.value))

const submit = {
  run: async (input: Record<string, unknown>) => vendorsActions.saveBim(bimPayload(questions.value, input as BimDraft)),
}
</script>

<template>
  <Card variant="outlined" class="p-4">
    <h2 class="mb-1 text-base font-semibold text-on-surface">Building Information Modeling</h2>
    <p class="mb-4 text-sm text-on-surface-variant">Answer every question. Add a note and an attachment when the question asks for them.</p>
    <Form
      :key="`${questions.length}:${mine.vendor.value?.updatedAt ?? ''}`"
      :fields="fields"
      :schema="schema"
      :initial-data="initialData"
      :submit="submit"
      :disabled="locked"
      submit-label="Save BIM answers"
      @submitted="(result) => mine.apply(result as VendorDetail)"
    />
  </Card>
</template>
