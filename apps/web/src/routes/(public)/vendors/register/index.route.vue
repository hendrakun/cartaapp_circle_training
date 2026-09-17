<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { Form } from '@southneuhof/loom'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { parseHonoResponse } from '@/framework/hono'
import { rpc } from '@/framework/rpc'
import { vendorRegisterFields, vendorRegisterFormValidation, type VendorRegisterFormInput } from './vendors.register'

const verificationLink = ref<string>()
const failure = ref<string>()

async function register(input: VendorRegisterFormInput) {
  failure.value = undefined
  try {
    const payload = await parseHonoResponse<(typeof rpc.vendors)['register']['$post']>(await rpc.vendors.register.$post({ json: input }))
    verificationLink.value = (payload as { data: { verificationLink: string } }).data.verificationLink
  } catch (error) {
    failure.value = errorMessage(error, 'The registration could not be saved.')
    toast.error(failure.value)
    throw error
  }
}
</script>

<template>
  <Card variant="outlined" class="p-6">
    <h1 class="text-xl font-semibold text-on-surface">Vendor registration</h1>

    <div v-if="verificationLink" class="mt-4 flex flex-col gap-2">
      <p role="status" class="text-sm text-on-surface">Registration saved. Confirm the email address to activate the account.</p>
      <p class="text-sm text-on-surface-variant">Email delivery is not configured yet, so use the confirmation link below.</p>
      <a class="text-sm text-info underline" :href="verificationLink">Confirm email address</a>
    </div>

    <div v-else class="mt-4 flex flex-col gap-4">
      <p class="text-sm text-on-surface-variant">Register the company, then confirm the email address.</p>
      <Form :fields="vendorRegisterFields" :schema="vendorRegisterFormValidation" :submit="{ run: register }" submit-label="Register" />
      <p v-if="failure" role="alert" class="text-sm text-error">{{ failure }}</p>
      <p class="text-sm text-on-surface-variant">
        Already registered?
        <RouterLink class="text-info underline" :to="{ name: 'auth-login' }">Sign in</RouterLink>
      </p>
    </div>
  </Card>
</template>
