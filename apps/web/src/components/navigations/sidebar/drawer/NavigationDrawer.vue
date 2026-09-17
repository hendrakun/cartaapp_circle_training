<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { onClickOutside } from '@vueuse/core'
import { visibleNavigation } from '@/manifest'
import { allowsPermission } from '@/framework/adapters/bundle'
import { navigationAudience } from '@/framework/audience'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import ProfileSegment from '../../layouts/ProfileSegment.vue'

const route = useRoute()
const navigation = computed(() => visibleNavigation(allowsPermission, navigationAudience()))
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const drawer = ref<HTMLElement>()

function close() {
  if (!props.open) return
  emit('close')
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}
onClickOutside(drawer, () => close(), { ignore: ['[data-mobile-menu-trigger]'] })
watch(
  () => route.fullPath,
  () => close()
)
document.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-40 bg-black/40 lg:hidden" aria-hidden="true" @click="close()" />
  <aside
    ref="drawer"
    class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface-container shadow-xl transition-transform lg:hidden"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
    :aria-hidden="!open"
  >
    <div class="flex h-16 items-center justify-between border-b border-outline-variant px-4">
      <span class="font-semibold">Navigation</span>
      <button type="button" aria-label="Close menu" @click="close()"><Icon name="close" /></button>
    </div>
    <nav aria-label="Mobile navigation" class="flex-1 overflow-y-auto p-3">
      <section v-for="module in navigation" :key="module.name" class="mb-4">
        <h2 class="px-3 pb-2 text-xs font-semibold uppercase text-on-surface-variant">{{ module.title }}</h2>
        <template v-for="entry in module.routes" :key="entry.name">
          <p v-if="'separator' in entry" class="px-3 pb-1 pt-3 text-xs text-on-surface-variant">{{ entry.name }}</p>
          <RouterLink
            v-else
            :to="entry.to as never"
            class="overlay flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 focus-visible:ring-2 focus-visible:ring-primary"
            :class="
              entry.name === String(route.name)
                ? 'bg-primary-container text-on-primary-container after:bg-on-primary-container-hover focus-visible:after:bg-on-primary-container-active active:after:bg-on-primary-container-active'
                : 'after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active'
            "
          >
            <Icon :name="entry.icon" /><span>{{ entry.title }}</span>
          </RouterLink>
        </template>
      </section>
    </nav>
    <div class="border-t border-outline-variant p-3"><ProfileSegment /></div>
  </aside>
</template>
