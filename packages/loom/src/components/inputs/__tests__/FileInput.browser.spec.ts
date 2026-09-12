import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import Form from '../../core/Form.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'
import { createFrameworkQueryClient } from '../../../query'

type Asset = {
  kind: 'file'
  id: string
  url: string
  name: string
}

function asset(name: string): Asset {
  return {
    kind: 'file',
    id: `/uploads/${name}`,
    url: `https://files.test/${name}`,
    name,
  }
}

const apps: App[] = []

async function settle() {
  await Promise.resolve()
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

function selectFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer()
  transfer.items.add(file)
  Object.defineProperty(input, 'files', { configurable: true, value: transfer.files })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('FileInput browser behavior', () => {
  it('keeps the uploaded asset object visible through the canonical control value', async () => {
    const upload = async () => asset('first.pdf')
    const model = ref<Record<string, unknown>>({ file: null })
    const host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup: () => () => h(Form, {
        fields: {
          file: {
            label: 'File',
            form: {
              renderer: 'file',
              props: { upload },
            },
          },
        },
        modelValue: model.value,
        'onUpdate:modelValue': (value: Record<string, unknown>) => { model.value = value },
      }),
    })
    const app = createApp(Root)
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    selectFile(host.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['first'], 'first.pdf', { type: 'application/pdf' }))
    await settle()

    expect(model.value.file).toMatchObject({ kind: 'file', id: '/uploads/first.pdf' })
    expect(host.textContent).toContain('first.pdf')
  })

  it('blocks button and Enter submission during deferred upload and conversion, then submits once', async () => {
    let resolveUpload!: (value: Asset) => void
    let resolveModel!: (value: Asset) => void
    const upload = () => new Promise<Asset>((resolve) => { resolveUpload = resolve })
    const toModel = () => new Promise<Asset>((resolve) => { resolveModel = resolve })
    const submit = vi.fn(async () => undefined)
    const host = document.createElement('div')
    document.body.append(host)
    const Root = defineComponent({
      setup: () => () => h(Form, {
        fields: {
          file: {
            label: 'File',
            form: { renderer: 'file', props: { upload, toModel } },
          },
        },
        initialData: { file: null },
        submit,
      }),
    })
    const app = createApp(Root)
    app.use(FrameworkPlugin, { queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }) })
    app.mount(host)
    apps.push(app)
    await settle()

    selectFile(host.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['first'], 'first.pdf', { type: 'application/pdf' }))
    await settle()

    const form = host.querySelector('form')!
    const button = host.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(button.disabled).toBe(true)

    button.click()
    await settle()
    form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()
    expect(submit).not.toHaveBeenCalled()

    resolveUpload(asset('first.pdf'))
    await settle()
    expect(button.disabled).toBe(true)
    button.click()
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()
    expect(submit).not.toHaveBeenCalled()

    resolveModel(asset('first.pdf'))
    await settle()
    expect(button.disabled).toBe(false)

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await settle()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(submit).toHaveBeenCalledWith({ file: asset('first.pdf') })
  })
})
