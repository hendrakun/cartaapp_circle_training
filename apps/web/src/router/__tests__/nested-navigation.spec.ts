import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { createApp, defineComponent, h, nextTick, onMounted } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter, RouterView, type RouteRecordRaw } from 'vue-router'
import { createRoutesContext, resolveOptions, type EditableTreeNode } from 'vue-router/unplugin'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createFrameworkQueryClient,
  defineResource,
  registerResourceRuntime,
  resetResourceActionRegistry,
  resetResourceRuntimeForTests,
  resolveFrameworkAdapters,
  resolveFrameworkFieldDefaults,
} from '@southneuhof/loom'
import type { WebResourceSchema } from '@southneuhof/loom'
import NavigationHeader from '@southneuhof/loom/components/views/NavigationHeader.vue'
import AppRouterView from '@/components/routing/AppRouterView.vue'
import { defineSchema } from '@/framework/schema'
import { applyFileRouteConventions } from '../file-routing/layout-groups'
import { staticRouteName } from '../file-routing/names'
import { createPermissionGuard } from '../guards'

const cleanup: (() => void | Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((run) => run()))
  resetResourceActionRegistry()
  resetResourceRuntimeForTests()
})

type Row = { id: string }
const schema = defineSchema<WebResourceSchema<Row, Record<string, never>, Record<string, never>, Record<string, never>, string>>({ identity: 'id' })

async function fixture() {
  registerResourceRuntime({ queryClient: createFrameworkQueryClient(), adapters: resolveFrameworkAdapters(), fieldDefaults: resolveFrameworkFieldDefaults() })
  const roles = defineResource(schema, {
    key: 'fixture-roles',
    actions: {
      list: { run: async () => ({ data: [] }), route: { name: 'settings-users-detail-role-assignments', params: { userId: 'u1' } } },
      detail: {
        run: async ({ id }) => ({ id: String(typeof id === 'object' ? id.id : id) }),
        route: { name: 'settings-users-detail', params: () => ({ userId: 'u1' }) },
      },
    },
  })
  const backTo = roles.detail({ id: 'r1' }).backTo!
  const deniedMount = vi.fn()
  const components: Record<string, ReturnType<typeof defineComponent>> = {
    'authenticated.layout.vue': defineComponent(() => () => h('div', ['shell', h(AppRouterView)])),
    'detail.route.vue': defineComponent(() => () => h('div', ['user-detail', h(AppRouterView)])),
    'index.route.vue': defineComponent(() => () => h('div', 'role-list')),
    'detail.roles.[roleId].detail.route.vue': defineComponent(() => () => h('div', ['role-detail', h(NavigationHeader, { title: 'Role', backTo })])),
    'detail.denied.route.vue': defineComponent({ setup: () => (onMounted(deniedMount), () => h('div', 'denied-body')) }),
    'dashboard.route.vue': defineComponent(() => () => h('div', 'dashboard')),
  }
  const root = await mkdtemp(join(tmpdir(), 'nested-navigation-'))
  cleanup.push(() => rm(root, { recursive: true, force: true }))
  const files: Record<string, string> = {
    '(authenticated)/authenticated.layout.vue': '<template><RouterView /></template>',
    '(authenticated)/dashboard.route.vue': '<template><div /></template>',
    '(authenticated)/users/[userId]/detail.route.vue': '<template><RouterView /></template>',
    '(authenticated)/users/[userId]/detail/roles/index.route.vue': '<route>{ "name": "settings-users-detail-role-assignments" }</route><template><div /></template>',
    '(authenticated)/users/[userId]/detail.roles.[roleId].detail.route.vue': '<route>{ "name": "settings-users-detail" }</route><template><div /></template>',
    '(authenticated)/users/[userId]/detail.denied.route.vue': '<route>{ "meta": { "permission": "denied" } }</route><template><div /></template>',
  }
  for (const [relative, value] of Object.entries(files)) {
    const file = join(root, relative)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, value)
  }
  let routes: RouteRecordRaw[] = []
  const context = createRoutesContext(
    resolveOptions({
      root,
      routesFolder: '.',
      extensions: ['.route.vue', '.layout.vue'],
      dts: false,
      watch: false,
      getRouteName: staticRouteName,
      beforeWriteFiles(tree) {
        applyFileRouteConventions(tree)
        const record = (node: EditableTreeNode): RouteRecordRaw => ({
          path: node.path,
          ...(node.name ? { name: node.name } : {}),
          ...(node.component ? { component: components[node.component.split('/').at(-1)!] } : {}),
          meta: { ...node.meta } as RouteRecordRaw['meta'],
          children: node.children.map(record),
        })
        routes = tree.children.map(record)
      },
    })
  )
  await context.scanPages(false)
  context.stopWatcher()
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeResolve(createPermissionGuard({ allows: ({ permission }) => permission !== 'denied' }))
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(defineComponent(() => () => h(RouterView)))
  app.component(
    'Transition',
    defineComponent({
      setup:
        (_, { slots }) =>
        () =>
          slots.default?.(),
    })
  )
  app.use(createPinia()).use(router).mount(host)
  cleanup.push(() => (app.unmount(), host.remove()))
  return { router, host, deniedMount }
}

describe('generated nested navigation', () => {
  it('inherits omitted resource parameters, accepts an override, and rejects missing context', async () => {
    registerResourceRuntime({ queryClient: createFrameworkQueryClient(), adapters: resolveFrameworkAdapters(), fieldDefaults: resolveFrameworkFieldDefaults() })
    const inherited = defineResource(schema, {
      key: 'inherited-child-route',
      actions: {
        list: { run: async () => ({ data: [] }), route: { name: 'settings-users-detail-role-assignments' } },
        detail: { run: async () => undefined },
      },
    })
    const overridden = defineResource(schema, {
      key: 'overridden-child-route',
      actions: {
        list: { run: async () => ({ data: [] }), route: { name: 'settings-users-detail-role-assignments', params: { userId: 'u2' } } },
        detail: { run: async () => undefined },
      },
    })
    const routes: RouteRecordRaw[] = [
      { path: '/users/:userId/detail', name: 'settings-users-detail', component: { template: '<div />' } },
      { path: '/users/:userId/detail/roles', name: 'settings-users-detail-role-assignments', component: { template: '<div />' } },
      { path: '/outside', name: 'dashboard', component: { template: '<div />' } },
    ]
    const router = createRouter({ history: createMemoryHistory(), routes })

    await router.push('/users/u1/detail')
    expect(router.resolve(inherited.detail({ id: 'r1' }).backTo!).fullPath).toBe('/users/u1/detail/roles')
    expect(router.resolve(overridden.detail({ id: 'r1' }).backTo!).fullPath).toBe('/users/u2/detail/roles')

    await router.push('/outside')
    expect(() => router.resolve(inherited.detail({ id: 'r1' }).backTo!)).toThrow(/Missing required param "userId"/)
  })

  it('uses scoped page Back on fresh direct entry', async () => {
    const { router, host } = await fixture()
    await router.push('/users/u1/detail/roles/r1/detail')
    await vi.waitFor(() => expect(host.querySelector('a[aria-label="Back"]')).not.toBeNull())
    expect(host.textContent).not.toContain('user-detail')
    host.querySelector<HTMLAnchorElement>('a[aria-label="Back"]')!.click()
    await vi.waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/users/u1/detail/roles'))
    expect(host.textContent).toContain('user-detailrole-list')
  })

  it('keeps browser Back tied to actual history', async () => {
    const { router, host } = await fixture()
    await router.push('/dashboard')
    await router.push('/users/u1/detail/roles/r1/detail')
    await vi.waitFor(() => expect(host.querySelector('a[aria-label="Back"]')).not.toBeNull())
    expect(host.querySelector<HTMLAnchorElement>('a[aria-label="Back"]')!.getAttribute('href')).toBe('/users/u1/detail/roles')
    router.back()
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/dashboard'))
  })

  it('blocks a denied dotted destination before its body mounts', async () => {
    const view = await fixture()
    await view.router.push('/dashboard')
    await view.router.push('/users/u1/detail/denied')
    await nextTick()
    expect(view.router.currentRoute.value.path).toBe('/dashboard')
    expect(view.deniedMount).not.toHaveBeenCalled()
  })
})
