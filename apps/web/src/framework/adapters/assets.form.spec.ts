import { describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { z } from 'zod/v4'
import { defineFields, defineResource, defineSchema, Form, FrameworkPlugin, createFrameworkQueryClient, fromZod } from '@southneuhof/loom'
import { storedAssetInput, storedAssetSchema } from '@southneuhof/api/schema'
import { assetAdapter } from './assets'
import { appInputProps } from '../inputs/registry'

const { uploadFile } = vi.hoisted(() => ({ uploadFile: vi.fn() }))
vi.mock('./storage', () => ({ uploadFile }))

function asset(name: string, extra: Record<string, unknown> = {}) {
  return {
    kind: 'file' as const,
    id: `uploads/${name}`,
    url: `https://api.test/files/object?key=uploads%2F${name}`,
    name,
    size: 4,
    mimeType: name.endsWith('.png') ? 'image/png' : 'text/plain',
    updatedAt: '2026-09-12T00:00:00.000Z',
    metadata: { source: 'upload' },
    ...extra,
  }
}

const assetA = asset('a.txt')
const assetB = asset('b.pdf')

const readSchema = z.object({
  document: storedAssetSchema.nullable(),
  attachments: storedAssetSchema.array(),
})
const writeSchema = z.object({
  document: storedAssetInput.nullable(),
  attachments: storedAssetInput.array(),
})
const patchSchema = z.object({
  document: storedAssetInput.nullable().optional(),
  attachments: storedAssetInput.array().optional(),
})

const formSchema = defineSchema({
  identity: 'id',
  record: { schema: fromZod(readSchema) },
  create: { schema: fromZod(readSchema) },
  update: { schema: fromZod(readSchema) },
})

const assetFields = defineFields(formSchema, {
  document: { label: 'Document', form: { renderer: 'file' } },
  attachments: { label: 'Attachments', form: { renderer: 'file', props: { multi: true } } },
})

const assets = defineResource(formSchema, {
  key: 'assets-form-proof',
  actions: {
    detail: {
      run: async () => ({ document: assetA, attachments: [assetA] }),
      fields: [assetFields.document, assetFields.attachments],
    },
    create: {
      run: async (input) => input,
      fields: [assetFields.document, assetFields.attachments],
    },
  },
})

async function flush(times = 8) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
  }
}

function apiResponse() {
  return { document: assetA, attachments: [assetA] }
}

async function mountAssetForm(options: { load?: () => Promise<Record<string, unknown> | undefined>; submit?: (value: Record<string, unknown>) => Promise<unknown> }) {
  const submitted: Record<string, unknown>[] = []
  const host = document.createElement('div')
  document.body.appendChild(host)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', name: 'test-route', component: { render: () => null } }],
  })
  const create = assets.create()
  const app = createApp(
    defineComponent({
      setup() {
        return () =>
          // @ts-expect-error jsdom test host passes Form props through h(); vue-tsc strict slots typing is covered by Loom type-check
          h(Form, {
            fields: create.fields,
            load: options.load ?? (async () => apiResponse()),
            schema: create.schema,
            submit: async (value: Record<string, unknown>) => {
              submitted.push(value)
              await options.submit?.(value)
              return value
            },
          })
      },
    })
  )
  app.use(router)
  app.use(FrameworkPlugin, {
    inputProps: appInputProps,
    queryClient: createFrameworkQueryClient({ retry: 0, staleTime: 0 }),
  })
  app.mount(host)
  await flush()
  await flush()
  return {
    host,
    submitted,
    unmount: () => {
      app.unmount()
      host.remove()
    },
  }
}

function submitForm(host: HTMLElement) {
  host.querySelector('form')!.dispatchEvent(new Event('submit'))
}

function fileInput(host: HTMLElement): HTMLInputElement {
  const inputs = [...host.querySelectorAll<HTMLInputElement>('input[type="file"]')]
  // A populated control hides its drop zone (FileInput canAddFile): only the
  // empty multi control keeps a file input, so selecting the last visible one
  // targets the attachments drop zone without naming either control.
  const input = inputs[inputs.length - 1]
  if (!input) {
    throw new Error(`File control is not available. Inputs: ${inputs.length}. Host HTML: ${host.innerHTML.slice(0, 800)}`)
  }
  return input
}

function attachmentsRemoveButtons(host: HTMLElement): HTMLButtonElement[] {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].filter((button) => button.textContent === 'Hapus')
}

function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  input.dispatchEvent(new Event('change'))
}

describe('symmetric asset form boundary', () => {
  it('loads canonical objects through the form load path and saves them unchanged with all metadata', async () => {
    const refreshed = asset('a.txt', { size: 8, mimeType: 'text/plain', metadata: { source: 'server-refresh' } })
    const loaded: unknown[] = []
    const view = await mountAssetForm({
      load: async () => {
        const response = { document: assetA, attachments: [refreshed] }
        loaded.push(response)
        return response
      },
    })

    submitForm(view.host)
    await flush()

    expect(loaded).toHaveLength(1)
    expect(view.submitted).toHaveLength(1)
    expect(view.submitted[0]).toEqual({ document: assetA, attachments: [refreshed] })
    expect(writeSchema.parse(view.submitted[0])).toEqual({ document: assetA.id, attachments: [refreshed.id] })
    expect(view.submitted[0]).not.toHaveProperty('category')
    expect(JSON.stringify(view.submitted[0])).not.toContain('order_number')
    view.unmount()
  })

  it('adds one asset through the empty multi control and submits the complete collection', async () => {
    const uploaded = asset('c.pdf')
    uploadFile.mockResolvedValueOnce(uploaded)
    const view = await mountAssetForm({
      load: async () => ({ document: null, attachments: [] }),
    })

    selectFiles(fileInput(view.host), [new File(['c'], 'c.pdf', { type: 'application/pdf' })])
    await flush()
    await flush()

    submitForm(view.host)
    await flush()

    expect(view.submitted).toHaveLength(1)
    expect(view.submitted[0]).toEqual({ document: null, attachments: [uploaded] })
    expect(writeSchema.parse(view.submitted[0])).toEqual({
      document: null,
      attachments: [uploaded.id],
    })
    view.unmount()
  })

  it('removes one asset through the real control and clears through the real control', async () => {
    const removed = await mountAssetForm({
      load: async () => ({ document: assetA, attachments: [assetA, assetB] }),
    })
    // [A, B] renders document A plus attachments [A, B]: three Hapus buttons.
    // Removing the first attachments card keeps the document value unchanged.
    const firstAttachmentsRemove = attachmentsRemoveButtons(removed.host)[1]
    expect(firstAttachmentsRemove).toBeDefined()
    expect(removed.host.textContent).toContain('a.txt')
    expect(removed.host.textContent).toContain('b.pdf')
    firstAttachmentsRemove.click()
    await flush()

    submitForm(removed.host)
    await flush()
    expect(removed.submitted).toEqual([{ document: assetA, attachments: [assetB] }])
    expect(writeSchema.parse(removed.submitted[0])).toEqual({ document: assetA.id, attachments: [assetB.id] })
    removed.unmount()

    const cleared = await mountAssetForm({
      load: async () => ({ document: assetA, attachments: [assetB] }),
    })
    for (const button of attachmentsRemoveButtons(cleared.host)) button.click()
    await flush()

    submitForm(cleared.host)
    await flush()
    expect(cleared.submitted).toEqual([{ document: null, attachments: [] }])
    expect(writeSchema.parse(cleared.submitted[0])).toEqual({ document: null, attachments: [] })
    cleared.unmount()
  })

  it('rejects a reordered payload that carries a framework order property', async () => {
    const reordered = { ...assetB, order_number: 1 }
    expect(storedAssetSchema.safeParse(reordered).success).toBe(false)
    expect(writeSchema.safeParse({ document: assetA, attachments: [reordered] }).success).toBe(false)
    expect(assetAdapter.read(reordered)).toBeNull()
  })

  it('keeps an omitted patch collection omitted instead of defaulting to an empty array', async () => {
    expect(patchSchema.parse({ document: assetA })).not.toHaveProperty('attachments')
    expect(patchSchema.parse({})).toEqual({})
    expect(patchSchema.parse({ attachments: [] })).toEqual({ attachments: [] })
  })

  it('rejects raw keys, partial objects, and a client asset-to-ID transform', async () => {
    expect(assetAdapter.read('uploads/a.txt')).toBeNull()
    expect(assetAdapter.read({ ...assetA, name: undefined })).toBeNull()
    expect(writeSchema.safeParse({ document: assetA.id, attachments: [assetA.id] }).success).toBe(false)

    const clientTransform = (value: unknown) => (value && typeof value === 'object' && 'id' in value ? (value as { id: string }).id : value)
    expect(clientTransform(assetA)).toBe(assetA.id)
    expect(storedAssetSchema.safeParse(assetA.id).success).toBe(false)
    expect(storedAssetSchema.safeParse(assetA).success).toBe(true)
  })

  it('leaves denied or invalid writes to server authorization, not to client shape checks', async () => {
    const parsed = writeSchema.safeParse({ document: assetA, attachments: [assetA] })
    expect(parsed.success).toBe(true)
    expect(assetAdapter.read(assetA)).toEqual(assetA)
  })
})
