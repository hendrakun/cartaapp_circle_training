import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  remove: vi.fn(),
  replace: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { roleId: 'role-1' } }),
  useRouter: () => ({ replace: mocks.replace }),
}))
vi.mock('vue-sonner', () => ({ toast: mocks.toast }))
vi.mock('@southneuhof/loom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@southneuhof/loom')>()
  return {
    ...actual,
    DetailView: {
      setup(_props: unknown, context: { slots: { controls?: () => unknown } }) {
        return () => context.slots.controls?.()
      },
    },
  }
})
vi.mock('@southneuhof/loom/components/composites/ConfirmationDialog.vue', () => ({
  default: {
    props: { title: String, message: String, onConfirm: Function },
    template: '<div><slot name="trigger" /><button class="confirm-delete" @click="onConfirm && onConfirm()" /></div>',
  },
}))
vi.mock('@/components/routing/AppRouterView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('./detail/permissions/index.route.vue', () => ({ default: { template: '<div data-permission-list />' } }))
vi.mock('@/framework/access', () => ({ resourceCan: () => () => true }))
vi.mock('../roles.resource', () => ({
  roles: {
    detail: vi.fn(() => ({ run: vi.fn(), fields: [], id: 'role-1', can: () => true })),
    list: () => ({ updateRoute: () => ({ name: 'settings-roles-edit', params: { roleId: 'role-1' } }) }),
    delete: vi.fn(() => ({ run: mocks.remove })),
  },
}))
import { roles } from '../roles.resource'
const Route = (await import('./detail.route.vue')).default

function mountRoute() {
  return mount(Route, { global: { components: { Button: { template: '<button><slot /></button>' } } } })
}

async function confirmDelete(wrapper: ReturnType<typeof mountRoute>) {
  await wrapper.find('button[color="error"]').trigger('click')
  await wrapper.find('.confirm-delete').trigger('click')
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.remove.mockResolvedValue({ ok: true })
})

afterEach(() => {
  mocks.remove.mockReset()
})

describe('role detail delete control', () => {
  it('hides delete when the permission check fails', () => {
    vi.mocked(roles.detail).mockReturnValueOnce({ run: vi.fn(), fields: [], id: 'role-1', can: () => false } as never)
    const wrapper = mountRoute()
    expect(wrapper.find('button[color="error"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('deletes only after confirmation and returns to the role list', async () => {
    const wrapper = mountRoute()
    await wrapper.find('button[color="error"]').trigger('click')
    expect(mocks.remove).not.toHaveBeenCalled()
    await wrapper.find('.confirm-delete').trigger('click')
    expect(mocks.remove).toHaveBeenCalledWith()
    expect(mocks.toast.success).toHaveBeenCalled()
    expect(mocks.replace).toHaveBeenCalledWith({ name: 'settings-roles' })
    wrapper.unmount()
  })

  it('shows the server-owned message when the delete payload carries one', async () => {
    mocks.remove.mockRejectedValue({ error: 'role_in_use', message: 'Role is still assigned to 2 system and 3 project users.', systemAssignmentCount: 2, projectAssignmentCount: 3 })
    const wrapper = mountRoute()
    await confirmDelete(wrapper)
    expect(mocks.toast.error).toHaveBeenCalledWith('Role is still assigned to 2 system and 3 project users.')
    expect(mocks.replace).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('falls back to the generic text when the 409 payload has no message', async () => {
    mocks.remove.mockRejectedValue({ error: 'role_in_use', systemAssignmentCount: 2, projectAssignmentCount: 3 })
    const wrapper = mountRoute()
    await confirmDelete(wrapper)
    expect(mocks.toast.error).toHaveBeenCalledWith('Role could not be deleted.')
    expect(mocks.replace).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
