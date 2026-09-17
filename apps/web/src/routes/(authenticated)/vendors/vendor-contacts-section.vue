<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue-sonner'
import { DialogForm, ListView } from '@southneuhof/loom'
import Button from '@southneuhof/loom/components/base/Button.vue'
import ConfirmationDialog from '@southneuhof/loom/components/composites/ConfirmationDialog.vue'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { vendorContacts } from './vendor-contacts.resource'
import type { VendorContactInput } from './vendor-contacts.schema'

const props = defineProps<{ vendorId: string; locked: boolean }>()

const list = computed(() => vendorContacts.list({ searchParameters: { vendor_id: props.vendorId } }))

/** Only writable keys reach the edit draft; the PATCH input schema is strict. */
function contactInitial(record: Record<string, unknown>): VendorContactInput {
  return {
    name: String(record.name ?? ''),
    role: record.role == null ? null : String(record.role),
    phone: record.phone == null ? null : String(record.phone),
    email: record.email == null ? null : String(record.email),
  }
}

function removeContact(record: Record<string, unknown>) {
  return vendorContacts.delete({ id: String(record.id) }).run()
}

function onRemoveError(error: unknown) {
  toast.error(errorMessage(error, 'The contact could not be removed.'))
}
</script>

<template>
  <ListView v-bind="list" title="Contacts" :export="false">
    <template #resource-action>
      <DialogForm v-if="!locked" v-bind="vendorContacts.create()" title="Add contact">
        <template #trigger>
          <Button>Add contact</Button>
        </template>
      </DialogForm>
    </template>
    <template #row-actions="{ record }">
      <div class="flex flex-row justify-end gap-1">
        <DialogForm
          v-if="!locked"
          :key="String(record.id)"
          v-bind="vendorContacts.update({ id: String(record.id), initialData: contactInitial(record as Record<string, unknown>) })"
          title="Edit contact"
        >
          <template #trigger>
            <Button variant="text">Edit</Button>
          </template>
        </DialogForm>
        <ConfirmationDialog
          v-if="!locked"
          title="Remove contact?"
          :message="`Remove ${String((record as Record<string, unknown>).name)} from this vendor.`"
          :on-confirm="() => removeContact(record as Record<string, unknown>)"
          :on-error="onRemoveError"
        >
          <template #trigger>
            <Button variant="text" color="error">Remove</Button>
          </template>
        </ConfirmationDialog>
      </div>
    </template>
  </ListView>
</template>
