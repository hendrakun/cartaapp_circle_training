import { defineComponent, h, nextTick } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  resolve: vi.fn((to: { name: string }) => ({ path: `/${to.name}` })),
}))

vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push, resolve: mocks.resolve }) }))
vi.mock('@/framework/adapters/bundle', () => ({ allowsPermission: () => true }))

import CommandPalette from './CommandPalette.vue'

const DialogStub = defineComponent({
  name: 'Dialog',
  props: { open: { type: Boolean, default: false } },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () => (props.open ? h('div', { 'data-dialog': true }, slots.default?.()) : null)
  },
})

const SurfaceStub = (name: string) =>
  defineComponent({
    name,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default?.())
    },
  })

const IconStub = defineComponent({ name: 'Icon', template: '<span aria-hidden="true" />' })

let wrapper: VueWrapper<InstanceType<typeof CommandPalette>>

beforeEach(() => mocks.push.mockReset())
afterEach(() => wrapper?.unmount())

function mountPalette() {
  wrapper = mount(CommandPalette, {
    global: {
      stubs: {
        Dialog: DialogStub,
        DialogContent: SurfaceStub('DialogContent'),
        DialogDescription: SurfaceStub('DialogDescription'),
        DialogTitle: SurfaceStub('DialogTitle'),
        Icon: IconStub,
      },
    },
  })
  return wrapper
}

describe('CommandPalette', () => {
  it('opens from the trigger and filters settings titles immediately', async () => {
    const view = mountPalette()

    await view.get('[data-command-palette-trigger]').trigger('click')
    expect(view.find('[data-command-palette-input]').exists()).toBe(true)
    expect(view.findAll('[role="option"]').map((option) => option.attributes('aria-label'))).toContain('Dashboard — Dashboard')

    await view.get('[data-command-palette-input]').setValue('Settings')

    // The palette lists every navigation entry whose title, module, or alias
    // matches: generated modules add entries, so assert membership of the
    // shipped entries instead of an exact list.
    const labels = view.findAll('[role="option"]').map((option) => option.attributes('aria-label'))
    expect(labels).toEqual(expect.arrayContaining(['Users — Settings', 'Roles — Settings', 'Permissions — Settings']))
    expect(labels.every((label) => label?.endsWith('— Settings'))).toBe(true)
  })

  it('shows an empty state for an unknown route', async () => {
    const view = mountPalette()

    await view.get('[data-command-palette-trigger]').trigger('click')
    await view.get('[data-command-palette-input]').setValue('not a page')

    expect(view.find('[role="option"]').exists()).toBe(false)
    expect(view.text()).toContain('No navigation results')
  })

  it('selects a route with the keyboard and closes the palette', async () => {
    const view = mountPalette()

    await view.get('[data-command-palette-trigger]').trigger('click')
    // Filter first: the full entry list depends on the navigation manifest, so
    // the keyboard check must not depend on module order.
    await view.get('[data-command-palette-input]').setValue('Settings')
    await view.get('[data-command-palette-input]').trigger('keydown', { key: 'ArrowDown' })
    await view.get('[data-command-palette-input]').trigger('keydown', { key: 'Enter' })

    expect(mocks.push).toHaveBeenCalledExactlyOnceWith({ name: 'settings-roles' })
    expect(view.find('[data-command-palette-input]').exists()).toBe(false)
  })

  it('opens from Control+K', async () => {
    const view = mountPalette()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    await nextTick()

    expect(view.get('[data-command-palette-trigger]').attributes('aria-expanded')).toBe('true')
  })
})
