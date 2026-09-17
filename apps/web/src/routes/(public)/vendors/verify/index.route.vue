<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Card from '@southneuhof/loom/components/base/Card.vue'
import { useRoute } from 'vue-router'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { rpc } from '@/framework/rpc'

type VerifyState = 'verifying' | 'verified' | 'invalid'

const route = useRoute()
const state = ref<VerifyState>('verifying')
const message = ref<string>()

onMounted(async () => {
  const id = String(route.query.id ?? '')
  const token = String(route.query.token ?? '')
  if (!id || !token) {
    state.value = 'invalid'
    message.value = 'The confirmation link is incomplete.'
    return
  }
  try {
    const response = await rpc.vendors.verify.$get({ query: { id, token } })
    if (!response.ok) {
      state.value = 'invalid'
      message.value = 'This confirmation link is invalid or already used.'
      return
    }
    state.value = 'verified'
  } catch (error) {
    state.value = 'invalid'
    message.value = errorMessage(error, 'The confirmation could not be completed. Try again later.')
  }
})
</script>

<template>
  <Card variant="outlined" class="p-6">
    <h1 class="text-xl font-semibold text-on-surface">Email confirmation</h1>
    <p v-if="state === 'verifying'" role="status" aria-live="polite" class="mt-4 text-sm text-on-surface">Memuat…</p>
    <template v-else-if="state === 'verified'">
      <p role="status" class="mt-4 text-sm text-on-surface">The email address is confirmed. The account is active.</p>
      <RouterLink class="mt-4 inline-block" :to="{ name: 'auth-login' }">
        <Button>Sign in</Button>
      </RouterLink>
    </template>
    <template v-else>
      <p role="alert" class="mt-4 text-sm text-error">{{ message }}</p>
      <RouterLink class="mt-4 inline-block text-sm text-info underline" :to="{ name: 'vendors-register' }"> Start a new registration </RouterLink>
    </template>
  </Card>
</template>
