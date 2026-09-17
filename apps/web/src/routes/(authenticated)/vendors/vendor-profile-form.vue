<script setup lang="ts">
import { Form } from '@southneuhof/loom'
import { vendors } from './vendors.resource'
import { vendorProfileFields, vendorProfileInitial, vendorProfileSchema } from './vendors.profile'

const props = defineProps<{ vendor: Record<string, unknown>; locked: boolean }>()
const emit = defineEmits<{ saved: [result: unknown] }>()

const submit = { run: (input: Record<string, unknown>) => vendors.actions.saveMine.run(input) }
</script>

<template>
  <!-- A fresh key reloads the draft after each successful save. -->
  <Form
    :key="String(vendor.updatedAt ?? '')"
    :fields="vendorProfileFields"
    :schema="vendorProfileSchema"
    :initial-data="vendorProfileInitial(vendor)"
    :submit="submit"
    :disabled="locked"
    submit-label="Save profile"
    @submitted="(result) => emit('saved', result)"
  />
</template>
