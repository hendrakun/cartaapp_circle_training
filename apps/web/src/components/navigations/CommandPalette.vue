<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { visibleNavigation, type NavigationIcon } from '@/manifest'
import { allowsPermission } from '@/framework/adapters/bundle'
import { navigationAudience } from '@/framework/audience'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@southneuhof/loom/components/base/Dialog'

type PaletteRoute = {
  name: string
  to: unknown
  title: string
  icon: NavigationIcon
  moduleTitle: string
  aliases: readonly string[]
}

const router = useRouter()
const open = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const input = ref<HTMLInputElement>()
const trigger = ref<HTMLButtonElement>()

function routeCode(to: unknown, fallback: string) {
  return (
    router
      .resolve(to as never)
      .path.split('/')
      .filter(Boolean)
      .at(-1) ?? fallback
  )
}

const routes = computed<PaletteRoute[]>(() => {
  const entries: PaletteRoute[] = []
  for (const module of visibleNavigation(allowsPermission, navigationAudience())) {
    for (const entry of module.routes) {
      if ('separator' in entry) continue
      entries.push({ ...entry, aliases: [routeCode(entry.to, entry.name), ...(entry.aliases ?? [])], moduleTitle: module.title })
    }
  }
  return entries
})

const filteredRoutes = computed(() => {
  const value = query.value.trim().toLocaleLowerCase()
  if (!value) return routes.value
  return routes.value.filter((entry) => [entry.title, entry.moduleTitle, ...entry.aliases].join(' ').toLocaleLowerCase().includes(value))
})

const selectedRoute = computed(() => filteredRoutes.value[selectedIndex.value])

function optionId(entry: PaletteRoute) {
  return `command-palette-option-${entry.name}`
}

function focusInput() {
  void nextTick(() => input.value?.focus())
}

function focusTrigger() {
  void nextTick(() => trigger.value?.focus())
}

function setSelectedIndex(index: number) {
  const lastIndex = filteredRoutes.value.length - 1
  selectedIndex.value = lastIndex < 0 ? 0 : Math.min(Math.max(index, 0), lastIndex)
  void nextTick(() => {
    const entry = selectedRoute.value
    if (!entry) return
    document.getElementById(optionId(entry))?.scrollIntoView?.({ block: 'nearest' })
  })
}

function openPalette() {
  open.value = true
}

function selectRoute(entry: PaletteRoute) {
  open.value = false
  void router.push(entry.to as never)
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    setSelectedIndex(selectedIndex.value + 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    setSelectedIndex(selectedIndex.value - 1)
  } else if (event.key === 'Home') {
    event.preventDefault()
    setSelectedIndex(0)
  } else if (event.key === 'End') {
    event.preventDefault()
    setSelectedIndex(filteredRoutes.value.length - 1)
  } else if (event.key === 'Enter' && selectedRoute.value) {
    event.preventDefault()
    selectRoute(selectedRoute.value)
  }
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    open.value = !open.value
  }
}

watch(open, (value, previousValue) => {
  if (value) {
    query.value = ''
    selectedIndex.value = 0
    focusInput()
  } else if (previousValue) {
    query.value = ''
    selectedIndex.value = 0
    focusTrigger()
  }
})

watch(filteredRoutes, () => setSelectedIndex(selectedIndex.value))

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKeydown))
</script>

<template>
  <button
    ref="trigger"
    data-command-palette-trigger
    type="button"
    aria-label="Open navigation"
    aria-haspopup="dialog"
    :aria-expanded="open"
    class="overlay flex size-10 items-center justify-center rounded-lg text-on-surface-variant outline-none after:bg-on-surface-variant-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:after:bg-on-surface-variant-active active:after:bg-on-surface-variant-active"
    @click="openPalette"
  >
    <Icon name="search" size="lg" />
    <span class="sr-only">Open navigation</span>
  </button>

  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl overflow-hidden p-0">
      <DialogTitle class="sr-only">Navigate to a page</DialogTitle>
      <DialogDescription class="sr-only">Search the pages available in the navigation menu.</DialogDescription>

      <div class="flex items-center gap-3 border-b border-outline-variant px-4">
        <Icon name="search" size="lg" class="shrink-0 text-primary" />
        <input
          ref="input"
          v-model="query"
          data-command-palette-input
          type="search"
          autocomplete="off"
          placeholder="Search navigation..."
          aria-label="Search navigation"
          aria-controls="command-palette-list"
          :aria-activedescendant="selectedRoute ? optionId(selectedRoute) : undefined"
          class="min-h-14 min-w-0 flex-1 bg-transparent text-base text-on-surface outline-none placeholder:text-on-surface-variant"
          @keydown="onInputKeydown"
        />
        <kbd class="hidden shrink-0 rounded-md bg-surface-container-highest px-2 py-1 text-xs font-medium text-on-surface-variant sm:inline">Esc</kbd>
      </div>

      <div v-if="filteredRoutes.length" id="command-palette-list" role="listbox" aria-label="Navigation pages" class="max-h-[min(28rem,calc(100vh-12rem))] overflow-y-auto p-2">
        <template v-for="(entry, index) in filteredRoutes" :key="entry.name">
          <p v-if="index === 0 || filteredRoutes[index - 1]?.moduleTitle !== entry.moduleTitle" class="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-on-surface-variant first:pt-1">
            {{ entry.moduleTitle }}
          </p>
          <button
            :id="optionId(entry)"
            type="button"
            role="option"
            :aria-label="`${entry.title} — ${entry.moduleTitle}`"
            :aria-selected="selectedIndex === index"
            class="overlay flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none after:bg-on-surface-hover focus-visible:ring-2 focus-visible:ring-primary focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
            :class="
              selectedIndex === index
                ? 'bg-primary-container text-on-primary-container after:bg-on-primary-container-hover focus-visible:after:bg-on-primary-container-active active:after:bg-on-primary-container-active'
                : 'text-on-surface'
            "
            @click="selectRoute(entry)"
            @mouseenter="setSelectedIndex(index)"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest text-on-surface-variant"
              :class="selectedIndex === index ? 'bg-on-primary-container/[12%] text-on-primary-container' : ''"
            >
              <Icon :name="entry.icon" size="base" />
            </span>
            <span class="min-w-0 flex-1 truncate">{{ entry.title }}</span>
            <span class="max-w-[35%] truncate text-xs" :class="selectedIndex === index ? 'text-on-primary-container/[72%]' : 'text-on-surface-variant'">{{ entry.moduleTitle }}</span>
          </button>
        </template>
      </div>
      <div v-else class="flex min-h-32 items-center justify-center px-6 text-center text-sm text-on-surface-variant">No navigation results</div>

      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-outline-variant px-4 py-3 text-xs text-on-surface-variant">
        <span>Navigate to a page</span>
        <span class="flex flex-wrap items-center gap-2">
          <span
            ><kbd class="rounded-md bg-surface-container-highest px-1.5 py-0.5 font-medium">↑</kbd
            ><kbd class="ml-1 rounded-md bg-surface-container-highest px-1.5 py-0.5 font-medium">↓</kbd> Select</span
          >
          <span><kbd class="rounded-md bg-surface-container-highest px-1.5 py-0.5 font-medium">Enter</kbd> Open</span>
          <span><kbd class="rounded-md bg-surface-container-highest px-1.5 py-0.5 font-medium">Esc</kbd> Close</span>
        </span>
      </div>
    </DialogContent>
  </Dialog>
</template>
