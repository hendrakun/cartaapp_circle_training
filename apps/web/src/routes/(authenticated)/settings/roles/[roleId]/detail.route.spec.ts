import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { roleId: 'role-1' } }),
}))
vi.mock('@southneuhof/loom', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@southneuhof/loom')>()),
  DetailView: { template: '<div data-detail-view />' },
}))
vi.mock('@/components/routing/AppRouterView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('./detail/permissions/index.route.vue', () => ({ default: { template: '<div data-permission-list />' } }))
vi.mock('@/framework/access', () => ({ resourceCan: () => () => true }))
vi.mock('../roles.resource', () => ({
  roles: {
    detail: vi.fn(() => ({ run: vi.fn(), fields: [], id: 'role-1', can: () => true })),
  },
}))
import { roles } from '../roles.resource'
const Route = (await import('./detail.route.vue')).default

function mountRoute() {
  return mount(Route)
}

describe('role detail controls', () => {
  it('does not render edit or delete controls', () => {
    const wrapper = mountRoute()
    expect(wrapper.text()).not.toContain('Ubah')
    expect(wrapper.text()).not.toContain('Hapus')
    expect(wrapper.find('button').exists()).toBe(false)
    wrapper.unmount()
  })
})
