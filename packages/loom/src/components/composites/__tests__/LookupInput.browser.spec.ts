import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import LookupInput from '../form-inputs/LookupInput.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'

const apps: App[] = []

const fields = { name: { label: 'Name' } }
const options = [{ id: 'one', name: 'Option one' }, { id: 'two', name: 'Option two' }]

async function frame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
}

function mountLookup(mountOptions: {
  model?: unknown
  loadDetail?: (context: { id: unknown; searchParameters: Record<string, unknown> }) => Promise<unknown>
}) {
  const model = ref(mountOptions.model ?? null)
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup: () => () => h(LookupInput, {
      fields,
      data: options,
      pick: 'id',
      view: 'name',
      loadDetail: mountOptions.loadDetail,
      modelValue: model.value,
      'onUpdate:modelValue': (value: unknown) => { model.value = value },
    }),
  }))
  app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] }))
  app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
  app.mount(host)
  apps.push(app)
  return { host, model }
}

function trigger(host: HTMLElement) {
  return host.querySelector<HTMLElement>('.overlay')!
}

function dialog() {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')!
}

function rowNamed(name: string) {
  return [...dialog().querySelectorAll<HTMLElement>('tbody tr')].find((row) => row.textContent?.includes(name))!
}

function saveButton() {
  return [...dialog().querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent?.includes('Simpan'))!
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('LookupInput real dialog', () => {
  it('selects a named record through the dialog and commits its scalar ID', async () => {
    const view = mountLookup({})
    await frame()
    expect(trigger(view.host).textContent).toBe('Pilih')

    trigger(view.host).click()
    await frame()
    expect(dialog().querySelector('table')).not.toBeNull()

    rowNamed('Option two').click()
    await frame()
    saveButton().click()
    await frame()

    expect(view.model.value).toBe('two')
    expect(trigger(view.host).textContent).toContain('Option two')
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })

  it('shows an initial scalar ID label after loadDetail hydration', async () => {
    const view = mountLookup({
      model: 'one',
      loadDetail: async ({ id }) => options.find((item) => item.id === id),
    })
    await frame()

    expect(trigger(view.host).textContent).toContain('Option one')
  })
})
