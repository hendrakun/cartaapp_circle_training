<script setup lang="ts">
import { computed, ref } from 'vue'
import services from '@/utils/services'
import { useColorPreference } from '@/stores/colorpreference'
import { identity } from '@/framework/identity'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'

const profileData = computed(() => identity.value?.user)
/** Shows which side of the application this account belongs to. */
const accountKind = computed(() => (identity.value?.vendor ? 'Vendor' : 'HK staff'))
const open = ref(false)
const signingOut = ref(false)
const colorPreference = useColorPreference()

async function signOut() {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await services.signOut()
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <Popover v-model="open" side="top" :side-offset="12" :align-offset="-8" content-class="w-[var(--reka-popover-trigger-width)] gap-2 rounded-xl p-3 shadow-xl">
    <template #trigger>
      <button
        type="button"
        class="overlay flex w-full items-center gap-3 rounded-2xl bg-surface-container-highest p-2.5 text-left shadow-[0_18px_50px_-24px_rgb(var(--md-sys-color-shadow)/0.42)] outline-none after:bg-on-surface-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
        aria-label="Open account menu"
      >
        <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-container text-on-primary-container">
          <Icon name="user" size="lg" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-medium">{{ profileData?.name || 'Account' }}</span>
          <span class="block truncate text-xs text-on-surface-variant">{{ accountKind }} · {{ profileData?.email || '' }}</span>
        </span>
        <Icon name="arrow-up-s" size="base" class="shrink-0 text-on-surface-variant" />
      </button>
    </template>
    <template #content>
      <div class="border-b border-outline-variant px-2 pb-2">
        <p class="font-semibold">{{ profileData?.name || 'Account' }}</p>
        <p class="text-sm text-on-surface">{{ profileData?.email || '' }}</p>
        <p class="text-xs text-on-surface-variant">{{ accountKind }} account</p>
      </div>
      <div class="flex flex-col gap-1">
        <button
          type="button"
          class="overlay flex w-full items-center justify-between rounded-lg px-2 py-2 text-left after:bg-on-surface-hover active:after:bg-on-surface-active"
          @click="colorPreference.toggle()"
        >
          <span>Mode Tampilan</span>
          <Icon :name="colorPreference.value === 'dark' ? 'sun' : 'moon'" />
        </button>
        <button
          type="button"
          class="overlay flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-error after:bg-error-hover active:after:bg-error-active"
          :disabled="signingOut"
          @click="signOut"
        >
          <Icon name="logout-box" />
          {{ signingOut ? 'Keluar…' : 'Keluar' }}
        </button>
      </div>
    </template>
  </Popover>
</template>
