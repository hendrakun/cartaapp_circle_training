<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import { DialogForm } from '@southneuhof/loom'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import ConfirmationDialog from '@southneuhof/loom/components/composites/ConfirmationDialog.vue'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { vendorsActions } from './vendors.actions'
import { useVendorDetail } from './vendors.detail-state'
import { editableVendorStatuses } from './vendors.options'
import { vendorDocumentFields, vendorDocumentSchema } from './vendors.documents'
import type { StoredAsset } from '@southneuhof/api/schema'
import type { VendorDocumentSlot } from './vendors.types'

const props = defineProps<{ category: 'legal' | 'finance' | 'technical'; title: string }>()

const mine = useVendorDetail()
const busy = ref<string>()
const locked = computed(() => !(editableVendorStatuses as readonly string[]).includes(String(mine.vendor.value?.statusCode ?? '')))
const slots = computed(() => (mine.detail.value?.documents ?? []).filter((slot) => slot.category === props.category))

async function attach(slot: VendorDocumentSlot, input: { file: StoredAsset }) {
  busy.value = slot.requirementId
  try {
    mine.apply(await vendorsActions.attachDocument(slot.requirementId, input.file))
    toast.success(`${slot.name} saved.`)
  } finally {
    busy.value = undefined
  }
}

async function remove(slot: VendorDocumentSlot) {
  mine.apply(await vendorsActions.removeDocument(slot.requirementId))
}

function onRemoveError(error: unknown) {
  toast.error(errorMessage(error, 'The document could not be removed.'))
}
</script>

<template>
  <Card variant="outlined" class="p-4">
    <h2 class="mb-1 text-base font-semibold text-on-surface">{{ title }}</h2>
    <p class="mb-4 text-sm text-on-surface-variant">PDF only, maximum 16 MB. A missing file does not block submission; the reviewer sees it.</p>

    <ul class="flex flex-col gap-3">
      <li v-for="slot in slots" :key="slot.requirementId" class="flex flex-col gap-2 border-b border-outline-variant pb-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-medium text-on-surface">
            {{ slot.name }}
            <span v-if="slot.required" class="text-error" aria-hidden="true">*</span>
          </p>
          <p class="text-xs text-on-surface-variant">{{ slot.nameEn ?? '' }}</p>
          <p v-if="slot.file" class="mt-1 text-xs text-info">
            <a :href="slot.file.url" target="_blank" rel="noopener noreferrer" class="underline">{{ slot.file.name }}</a>
          </p>
          <p v-else class="mt-1 text-xs text-on-surface-variant">No file yet</p>
        </div>
        <div class="flex flex-row flex-wrap items-center gap-2">
          <DialogForm
            v-if="!locked"
            :key="`${slot.requirementId}:${slot.file?.id ?? 'empty'}`"
            :fields="vendorDocumentFields"
            :schema="vendorDocumentSchema"
            :submit="(input) => attach(slot, input as { file: StoredAsset })"
            :title="slot.file ? `Replace ${slot.name}` : `Upload ${slot.name}`"
          >
            <template #trigger>
              <Button :disabled="busy === slot.requirementId">{{ slot.file ? 'Replace' : 'Upload' }}</Button>
            </template>
          </DialogForm>
          <ConfirmationDialog
            v-if="!locked && slot.file"
            title="Remove document?"
            message="Remove this file from the slot. The stored file stays available."
            :on-confirm="() => remove(slot)"
            :on-error="onRemoveError"
          >
            <template #trigger>
              <Button variant="text" color="error">Remove</Button>
            </template>
          </ConfirmationDialog>
        </div>
      </li>
    </ul>
    <p v-if="!slots.length" class="text-sm text-on-surface-variant">No document slot applies to this vendor.</p>
  </Card>
</template>
