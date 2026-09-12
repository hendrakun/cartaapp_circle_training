import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ImageInput from '../ImageInput.vue'
import { flush, mountCore } from '../../core/__tests__/harness'

function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change'))
}

describe('ImageInput upload surface', () => {
  it('keeps the uploaded asset object and preview through the control value', async () => {
    const uploaded = {
      kind: 'file' as const,
      id: '/uploads/first.png',
      url: 'https://files.test/first.png',
      name: 'first.png',
    }
    const upload = vi.fn(async () => uploaded)
    const model = ref<unknown[]>([])
    const host = defineComponent({
      setup: () => () => h(ImageInput, {
        modelValue: model.value,
        multi: true,
        limit: 4,
        upload,
        'onUpdate:modelValue': (value: unknown) => {
          model.value = value as unknown[]
        },
      }),
    })
    const view = mountCore(host, {})
    await flush()

    selectFile(view.find<HTMLInputElement>('input[type="file"]')!, new File(['first'], 'first.png', { type: 'image/png' }))
    await flush()

    expect(model.value).toEqual([uploaded])
    expect(view.find<HTMLImageElement>('img')?.getAttribute('src')).toBe('https://files.test/first.png')
    view.unmount()
  })

  it('reorders multi-image objects without adding framework properties', async () => {
    const first = { kind: 'file' as const, id: '/uploads/first.png', url: 'https://files.test/first.png', name: 'first.png' }
    const second = { kind: 'file' as const, id: '/uploads/second.png', url: 'https://files.test/second.png', name: 'second.png' }
    const model = ref<unknown[]>([first, second])
    const host = defineComponent({
      setup: () => () => h(ImageInput, {
        modelValue: model.value,
        multi: true,
        upload: async () => first,
        'onUpdate:modelValue': (value: unknown) => {
          model.value = value as unknown[]
        },
      }),
    })
    const view = mountCore(host, {})
    await flush()

    model.value = [second, first]
    await flush()

    expect(model.value).toEqual([second, first])
    expect(model.value).not.toContainEqual(expect.objectContaining({ order_number: expect.anything() }))
    view.unmount()
  })
})
