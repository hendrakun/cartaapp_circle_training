import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { FrameworkPlugin } from '../../../adapters/plugin'
import type { FrameworkPluginOptions } from '../../../adapters/plugin'
import type { WebResourceSchema } from '../../../contracts'
import { defineFields } from '../../../fields'
import { createFrameworkQueryClient } from '../../../query'
import { defineResource, defineSchema, resetResourceRuntimeForTests } from '../../../resources'
import { createInputPropsRegistry } from '../../../renderers/inputProps'
import DetailView from '../DetailView.vue'
import FormView from '../FormView.vue'
import ListView from '../ListView.vue'

type RecordRow = { id: number; name: string }
type Draft = { name: string }
type Schema = WebResourceSchema<RecordRow, Record<string, never>, Draft, Draft, number>

const schema = defineSchema<Schema>({ identity: 'id' })
const fields = defineFields(schema, { name: { label: 'Name', form: { renderer: 'text' } } })

afterEach(() => resetResourceRuntimeForTests())

async function flush() {
  for (let count = 0; count < 8; count += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

function mount(render: () => ReturnType<typeof h>, options: FrameworkPluginOptions = {}) {
  const queryClient = createFrameworkQueryClient({ retry: 0, staleTime: Infinity })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(defineComponent({ setup: () => render }))
  app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/', name: 'dashboard', component: { render: () => null } }] }))
  app.use(FrameworkPlugin, { ...options, queryClient })
  app.mount(host)
  return { host, queryClient, unmount: () => { app.unmount(); host.remove(); queryClient.clear() } }
}

function typeName(host: HTMLElement, value: string) {
  const input = host.querySelector<HTMLInputElement>('input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
}

describe('resource cache ownership', () => {
  it('refetches a mounted detail after a standard update', async () => {
    let name = 'Tax ID'
    const read = vi.fn(async () => ({ id: 1, name }))
    const records = defineResource(schema, {
      key: 'document-types',
      actions: {
        detail: { run: async () => read(), fields: [fields.name] },
        update: {
          run: async (id, draft) => ({ id, ...draft }),
          fields: [fields.name],
        },
      },
    })
    const view = mount(() => h(DetailView, records.detail({ id: 1 })))

    await vi.waitFor(() => expect(view.host.textContent).toContain('Tax ID'))
    name = 'Tax ID Card'
    await records.update({ id: 1 }).run({ name })
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(2)
      expect(view.host.textContent).toContain('Tax ID Card')
    })
    view.unmount()
  })

  it('refreshes inactive detail and reopened form data while preserving a mounted draft', async () => {
    let name = 'Tax ID'
    const read = vi.fn(async () => ({ id: 1, name }))
    const records = defineResource(schema, {
      key: 'documents',
      actions: {
        detail: { run: read, fields: [fields.name] },
        update: { run: async (id, draft) => { name = draft.name; return { id, name } }, fields: [fields.name] },
      },
    })
    const surface = ref<'detail' | 'form' | 'empty'>('detail')
    const component = () => surface.value === 'detail'
      ? h(DetailView, records.detail({ id: 1 }))
      : surface.value === 'form' ? h(FormView, records.update({ id: 1 })) : h('div')
    const view = mount(component)

    await vi.waitFor(() => expect(view.host.textContent).toContain('Tax ID'))
    surface.value = 'form'
    await vi.waitFor(() => expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('Tax ID'))
    typeName(view.host, 'Tax ID Card')
    view.host.querySelector('form')!.dispatchEvent(new Event('submit'))
    await vi.waitFor(() => expect(name).toBe('Tax ID Card'))
    surface.value = 'detail'
    await vi.waitFor(() => expect(view.host.textContent).toContain('Tax ID Card'))
    expect(read).toHaveBeenCalledTimes(4)

    surface.value = 'form'
    await vi.waitFor(() => expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('Tax ID Card'))
    surface.value = 'empty'
    await flush()
    await records.update({ id: 1 }).run({ name: 'Tax ID Document' })
    surface.value = 'form'
    await vi.waitFor(() => expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('Tax ID Document'))
    typeName(view.host, 'Unsaved name')
    await records.update({ id: 1 }).run({ name: 'Server name' })
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(6))
    expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('Unsaved name')
    view.unmount()
  })

  it('refetches two custom lists and keeps their query values separate', async () => {
    const calls: number[] = []
    const records = defineResource(schema, {
      key: 'list-records',
      actions: {
        list: { run: async ({ query }) => { calls.push(Number(query.page)); return { data: [{ id: 1, name: `Page ${query.page}` }] } }, fields: [fields.name] },
        update: { run: async (id, draft) => ({ id, ...draft }), fields: [fields.name] },
      },
    })
    const view = mount(() => h('div', [
      h(ListView as Component, { ...records.list({ namespace: 'first', query: { page: 1 } }), key: 'first' }),
      h(ListView as Component, { ...records.list({ namespace: 'second', query: { page: 2 } }), key: 'second' }),
    ]))
    await vi.waitFor(() => {
      expect(calls).toEqual([1, 2])
      expect(view.host.textContent).toContain('Page 1')
      expect(view.host.textContent).toContain('Page 2')
    })
    expect(view.queryClient.getQueryCache().getAll().every((query) => query.isActive())).toBe(true)
    await records.update({ id: 1 }).run({ name: 'Changed' })
    await vi.waitFor(() => expect(calls).toEqual([1, 2, 1, 2]))
    view.unmount()
  })

  it('isolates record and resource invalidation', async () => {
    const first = vi.fn(async ({ id }: { id: number }) => ({ id, name: `First ${id}` }))
    const second = vi.fn(async ({ id }: { id: number }) => ({ id, name: `Second ${id}` }))
    const resource = defineResource(schema, { key: 'first', actions: {
      detail: { run: first, fields: [fields.name] },
      update: { run: async (id, draft) => ({ id, ...draft }), fields: [fields.name] },
    } })
    const other = defineResource(schema, { key: 'second', actions: { detail: { run: second, fields: [fields.name] } } })
    const view = mount(() => h('div', [
      h(DetailView, { ...resource.detail({ id: 1 }), key: 'first-1' }),
      h(DetailView, { ...resource.detail({ id: 2 }), key: 'first-2' }),
      h(DetailView, { ...other.detail({ id: 1 }), key: 'second-1' }),
    ]))
    await vi.waitFor(() => {
      expect(first).toHaveBeenCalledTimes(2)
      expect(second).toHaveBeenCalledTimes(1)
      expect(view.host.textContent).toContain('First 1')
      expect(view.host.textContent).toContain('First 2')
      expect(view.host.textContent).toContain('Second 1')
    })
    expect(view.queryClient.getQueryCache().getAll().every((query) => query.isActive())).toBe(true)
    await resource.update({ id: 1 }).run({ name: 'Changed' })
    await vi.waitFor(() => expect(first).toHaveBeenCalledTimes(3))
    expect(second).toHaveBeenCalledTimes(1)
    expect(first.mock.calls.filter(([context]) => context.id === 2)).toHaveLength(1)
    view.unmount()
  })

  it('keeps display and form variants separate and applies write invalidation rules', async () => {
    let reject = false
    const read = vi.fn(async () => ({ id: 1, name: 'Value' }))
    const detailField = fields.name.override({ detail: { renderer: 'detail-token' }, form: false })
    const formField = fields.name.override({ detail: false, form: { renderer: 'text' } })
    const records = defineResource(schema, { key: 'variants', actions: {
      detail: { run: read, fields: [detailField] },
      update: { run: async (id, draft) => { if (reject) throw new Error('No'); return { id, ...draft } }, fields: [formField] },
      delete: { run: async () => undefined, permission: null },
    } })
    const Token = defineComponent({ props: { value: null }, setup: (props) => () => h('span', { 'data-token': '' }, String(props.value)) })
    const view = mount(
      () => h('div', [h(DetailView, records.detail({ id: 1 })), h(FormView, records.update({ id: 1 }))]),
      {
        renderers: { detail: { 'detail-token': Token } },
        inputProps: createInputPropsRegistry({
          'detail-token': { value: { hydrate: (value) => `display:${value}` } },
          text: { value: { hydrate: (value) => `form:${value}` } },
        }),
      },
    )
    await vi.waitFor(() => {
      expect(read).toHaveBeenCalledTimes(2)
      expect(view.host.querySelector('[data-token]')?.textContent).toBe('display:Value')
      expect(view.host.querySelector<HTMLInputElement>('input')?.value).toBe('form:form:Value')
    })
    reject = true
    await expect(records.update({ id: 1 }).run({ name: 'Rejected' })).rejects.toThrow('No')
    await flush()
    expect(read).toHaveBeenCalledTimes(2)
    reject = false
    await records.delete({ id: 1 }).run()
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(4))
    await records.invalidate()
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(6))
    view.unmount()
  })
})
