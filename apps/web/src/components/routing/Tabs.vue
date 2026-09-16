<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
/**
 * Named route tabs owned explicitly by parent layouts.
 */
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter, type RouteRecordNormalized } from 'vue-router'
import { useResourceRuntime } from '@southneuhof/loom'
import Card from '@southneuhof/loom/components/base/Card.vue'
import type { RouteTab } from '@/router/tabs'

const props = defineProps<{
  items: readonly RouteTab[]
  label?: string
}>()

const route = useRoute()
const router = useRouter()

const resolvedTabs = computed(() => {
  return props.items.flatMap((item) => {
    let target
    const to = item.action.to
    if (!to) return []
    try {
      target = router.resolve({
        ...to,
        params: { ...route.params, ...to.params },
        query: { ...siblingQuery(), ...to.query },
      } as never)
    } catch {
      return []
    }
    if (target.name !== to.name || !target.matched.length) return []
    const access = useResourceRuntime().adapters.access
    if (item.action.permission !== null && !access.allows({ operation: 'detail', permission: item.action.permission })) return []
    return [{ ...item, to: target }]
  })
})

function componentRecord(records: readonly RouteRecordNormalized[]): RouteRecordNormalized | undefined {
  return [...records].reverse().find((record) => record.components?.default)
}

const owner = computed(() => {
  const owners = resolvedTabs.value.map((tab) => componentRecord(tab.to.matched.slice(0, -1)))
  if (!owners.length || owners.some((candidate) => !candidate) || owners.some((candidate) => candidate !== owners[0])) return undefined
  return owners[0]
})

const tabs = computed(() => {
  const owned = owner.value && route.matched.includes(owner.value)
  const sections = owned ? resolvedTabs.value.filter((tab) => route.path === tab.to.path || route.path.startsWith(`${tab.to.path}/`)) : []
  const activePath = sections.reduce<string | undefined>((longest, tab) => (!longest || tab.to.path.length > longest.length ? tab.to.path : longest), undefined)
  return resolvedTabs.value.map((tab) => ({ ...tab, active: tab.to.path === activePath }))
})

const currentOwner = computed(() => componentRecord(route.matched))

let warnedInvalidOwner = false
if (import.meta.env.DEV) {
  watchEffect(() => {
    if (warnedInvalidOwner || !tabs.value.length || owner.value) return
    warnedInvalidOwner = true
    const targets = tabs.value.map((tab) => tab.action.to?.name).join(', ')
    console.warn(`[Tabs] Tab route(s) ${targets} do not share a detail owner. Keep tab route files below the detail route folder.`)
  })
}

function siblingQuery() {
  return Object.fromEntries(Object.entries(route.query).filter(([key]) => key.includes('.')))
}

let pendingDestination: string | undefined
watchEffect(() => {
  const first = tabs.value[0]
  if (!first || !owner.value || currentOwner.value !== owner.value) return

  const destination = first.to
  if (destination.fullPath === route.fullPath || pendingDestination === destination.fullPath) return

  pendingDestination = destination.fullPath
  void router
    .replace(first.to)
    .catch(() => undefined)
    .finally(() => {
      if (pendingDestination === destination.fullPath) pendingDestination = undefined
    })
})
</script>

<template>
  <nav v-if="tabs.length" class="overflow-auto" :aria-label="props.label ?? 'Tab'">
    <div class="flex flex-row items-center gap-2">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.action.to?.name"
        :to="tab.to"
        class="min-w-max text-start focus-visible:outline-none"
        :data-tab="tab.action.to?.name"
        :aria-current="tab.active ? 'page' : undefined"
      >
        <Card :color="tab.active ? 'primaryContainer' : 'surfaceContainer'">
          <div>{{ tab.label }}</div>
        </Card>
      </RouterLink>
    </div>
  </nav>
</template>
