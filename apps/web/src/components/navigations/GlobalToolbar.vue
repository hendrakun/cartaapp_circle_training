<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { visibleNavigation } from '@/manifest'
import { allowsPermission } from '@/framework/adapters/bundle'
import { navigationAudience } from '@/framework/audience'
import Logo from '@/assets/corporate/common/Logo.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import CommandPalette from './CommandPalette.vue'
import { routeBreadcrumbs } from './breadcrumbs'

defineEmits<{ openNavigation: [] }>()
const route = useRoute()
const router = useRouter()
const breadcrumbs = computed(() => routeBreadcrumbs(route, router, visibleNavigation(allowsPermission, navigationAudience())))
</script>

<template>
  <header
    class="sticky top-0 grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center border-b border-outline-variant bg-surface-container-low px-4 text-on-surface lg:relative lg:z-[2] lg:h-full lg:border-b-0 lg:pl-8 lg:pr-11"
  >
    <div class="flex min-w-0 items-center gap-3">
      <button data-mobile-menu-trigger type="button" aria-label="Open menu" class="flex size-11 shrink-0 items-center justify-center lg:hidden" @click="$emit('openNavigation')">
        <Icon name="menu" />
      </button>
      <Logo class="w-9 shrink-0 lg:hidden" />
      <nav aria-label="Breadcrumb" class="min-w-0 overflow-hidden">
        <ol class="flex min-w-0 items-center gap-2 whitespace-nowrap text-sm">
          <li v-for="(item, index) in breadcrumbs" :key="`${item.label}-${index}`" class="flex min-w-0 items-center gap-2">
            <span v-if="index" aria-hidden="true" class="text-on-surface-variant">/</span>
            <RouterLink v-if="item.to" :to="item.to" class="truncate text-on-surface-variant hover:text-on-surface">{{ item.label }}</RouterLink>
            <span v-else class="truncate font-semibold tracking-[-0.01em]" :aria-current="index === breadcrumbs.length - 1 ? 'page' : undefined">{{ item.label }}</span>
          </li>
        </ol>
      </nav>
    </div>
    <div class="ml-3 flex items-center justify-end gap-1" aria-label="Global actions">
      <CommandPalette />
    </div>
  </header>
</template>
