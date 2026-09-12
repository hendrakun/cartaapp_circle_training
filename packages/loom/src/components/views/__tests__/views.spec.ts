import { describe, expect, it, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createApp, defineComponent, h, ref } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import { FrameworkPlugin } from '../../../adapters/plugin'
import ListView from '../ListView.vue'
import DetailView from '../DetailView.vue'
import FormView from '../FormView.vue'
import { deferred, flush, mountCore } from '../../core/__tests__/harness'

const viewsRoot = join(__dirname, '..')

const tableProps = { fields: { name: { label: 'Nama' } }, data: [{ name: 'Admin' }] }
const detailProps = { fields: { name: { label: 'Nama' } }, data: { name: 'Admin' } }

function installStorage() {
  const values = new Map<string, string>()
  const setItem = vi.fn((key: string, value: string) => values.set(key, value))
  const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem,
      removeItem: (key: string) => values.delete(key),
      get length() { return values.size },
    },
  })
  return {
    values,
    setItem,
    restore: () => {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
      else delete (window as { localStorage?: Storage }).localStorage
    },
  }
}

describe('ListView', () => {
  it('renders toolbar and table in separate outlined cards', async () => {
    const view = mountCore(ListView, { title: 'Role', description: 'Manage roles.', table: tableProps })
    await flush()

    expect(view.find('h1')?.textContent).toBe('Role')
    expect(view.text()).toContain('Manage roles.')
    expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama'])
    expect(view.text()).toContain('Admin')
    const cards = view.all('.is-list-view > div')
    expect(cards).toHaveLength(2)
    expect(cards.every((card) => card.classList.contains('bg-surface-container'))).toBe(true)
    expect(cards[0].contains(view.find('header')!)).toBe(true)
    expect(cards[1].contains(view.find('table')!)).toBe(true)
    view.unmount()
  })

  it('renders resource actions and footer only from named slots', async () => {
    const view = mountCore(ListView, { table: tableProps }, {
      slots: {
        'resource-action': () => h('button', { 'data-resource-action-slot': '' }, 'Tambah'),
        footer: () => h('button', { 'data-footer-slot': '' }, 'Kembali'),
      },
    })
    await flush()

    expect(view.find('[data-resource-action-slot]')).not.toBeNull()
    expect(view.find('[data-footer-slot]')).not.toBeNull()
    view.unmount()
  })

  it('keeps standard Create before a resource action in one adjacent action row', async () => {
    const view = mountCore(ListView, {
      run: async () => ({ data: [{ name: 'Admin' }] }),
      fields: { name: { label: 'Name' } },
      createRoute: { name: 'test-route' },
    }, {
      slots: {
        'resource-action': () => h('button', { 'data-resource-action-slot': '' }, 'Public link'),
      },
    })
    await flush()

    const actionRow = view.find('[data-resource-action-slot]')?.parentElement
    expect(actionRow?.classList.contains('flex')).toBe(true)
    expect(actionRow?.classList.contains('flex-row')).toBe(true)
    expect(actionRow?.classList.contains('justify-end')).toBe(true)
    expect(actionRow?.classList.contains('gap-2')).toBe(true)
    expect(actionRow?.textContent?.indexOf('Create')).toBeLessThan(actionRow?.textContent?.indexOf('Public link') ?? -1)
    view.unmount()
  })

  it('lets create-action replace only the standard Create content', async () => {
    const view = mountCore(ListView, {
      run: async () => ({ data: [] }),
      fields: { name: { label: 'Name' } },
      createRoute: { name: 'test-route' },
    }, {
      slots: {
        'create-action': () => h('button', { 'data-custom-create': '' }, 'New role'),
        'resource-action': () => h('button', { 'data-resource-action-slot': '' }, 'Public link'),
      },
    })
    await flush()

    expect(view.find('[data-custom-create]')).not.toBeNull()
    expect(view.text()).not.toContain('Create')
    expect(view.find('[data-resource-action-slot]')).not.toBeNull()
    view.unmount()
  })

  it('omits page action regions without slots', async () => {
    const view = mountCore(ListView, { table: tableProps })
    await flush()

    expect(view.find('footer')).toBeNull()
    view.unmount()
  })

  it('keeps raw table surfaces free of resource row controls', async () => {
    const view = mountCore(ListView, { table: tableProps })
    await flush()

    expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama'])
    expect(view.find('[aria-label="Aksi baris"]')).toBeNull()
    view.unmount()
  })

  it('defaults list pagination to always', async () => {
    const view = mountCore(ListView, {
      table: {
        fields: { name: { label: 'Nama' } },
        load: () => ({ data: [{ name: 'Admin' }], meta: { total: 1, totalPage: 1 } }),
      },
    })
    await flush()

    expect(view.find('nav[aria-label="Pagination"]')).not.toBeNull()
    view.unmount()
  })

  it('updates visible columns immediately, coalesces persistence, and reset cancels pending visibility', async () => {
    vi.useFakeTimers()
    const storage = installStorage()
    let view: ReturnType<typeof mountCore> | undefined
    try {
      view = mountCore(ListView, {
        table: {
          namespace: 'roles',
          fields: { name: { label: 'Nama' }, status: { label: 'Status' } },
          data: [{ name: 'Admin', status: 'active' }],
        },
      })
      await flush()

      view.find<HTMLButtonElement>('[aria-label="Columns"]')!.click()
      await flush()
      const statusSwitch = [...document.querySelectorAll<HTMLButtonElement>('label button')][1]
      statusSwitch.click()
      await flush()
      expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama'])
      statusSwitch.click()
      await flush()
      expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama', 'Status'])
      statusSwitch.click()
      await flush()
      expect(view.all('th').map((cell) => cell.textContent)).toEqual(['Nama'])
      expect(storage.setItem).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(200)
      expect(storage.setItem).toHaveBeenCalledTimes(1)
      expect(storage.setItem).toHaveBeenCalledWith(
        'is-framework:roles:table:visible-columns',
        JSON.stringify({ known: ['name', 'status'], visible: ['name'] }),
      )

      storage.setItem.mockClear()
      statusSwitch.click()
      await flush()
      ;[...document.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Reset columns')!.click()
      await flush()
      await vi.advanceTimersByTimeAsync(200)
      expect(storage.setItem).not.toHaveBeenCalled()
      expect(storage.values.has('is-framework:roles:table:visible-columns')).toBe(false)
    } finally {
      view?.unmount()
      storage.restore()
      vi.useRealTimers()
    }
  })

  it('flushes final column visibility when unmounted before debounce expiry', async () => {
    vi.useFakeTimers()
    const storage = installStorage()
    let view: ReturnType<typeof mountCore> | undefined
    try {
      view = mountCore(ListView, {
        table: {
          namespace: 'roles',
          fields: { name: { label: 'Nama' }, status: { label: 'Status' } },
          data: [{ name: 'Admin', status: 'active' }],
        },
      })
      await flush()
      view.find<HTMLButtonElement>('[aria-label="Columns"]')!.click()
      await flush()
      ;[...document.querySelectorAll<HTMLButtonElement>('label button')][1].click()
      await flush()

      view.unmount()
      view = undefined
      expect(storage.setItem).toHaveBeenCalledTimes(1)
      expect(storage.setItem).toHaveBeenCalledWith(
        'is-framework:roles:table:visible-columns',
        JSON.stringify({ known: ['name', 'status'], visible: ['name'] }),
      )
      await vi.advanceTimersByTimeAsync(200)
      expect(storage.setItem).toHaveBeenCalledTimes(1)
    } finally {
      view?.unmount()
      storage.restore()
      vi.useRealTimers()
    }
  })

  it('lets slots replace the header and the body entirely', async () => {
    const view = mountCore(
      ListView,
      { title: 'Role', table: tableProps },
      {
        slots: {
          header: () => h('h2', 'Judul khusus'),
          body: () => h('p', 'Badan khusus'),
        },
      },
    )
    await flush()

    expect(view.find('h1')).toBeNull()
    expect(view.text()).toContain('Judul khusus')
    expect(view.text()).toContain('Badan khusus')
    expect(view.find('table')).toBeNull()
    view.unmount()
  })

  it('passes cell slots through to the table', async () => {
    const view = mountCore(
      ListView,
      { table: tableProps },
      { slots: { 'cell:name': (scope) => h('strong', String((scope as { value: unknown }).value)) } },
    )
    await flush()

    expect(view.find('strong')?.textContent).toBe('Admin')
    view.unmount()
  })

  it('passes the loaded collection to the collection slot without a second loader', async () => {
    let calls = 0
    let slotState: Record<string, unknown> | undefined
    const view = mountCore(
      ListView,
      {
        table: {
          namespace: 'custom-list',
          fields: { name: { label: 'Name' } },
          load: () => {
            calls += 1
            return { data: [{ name: 'Admin' }], meta: { total: 1, totalPage: 1 } }
          },
        },
      },
      {
        slots: {
          collection: (state) => {
            slotState = state
            return h('p', { class: 'custom-record' }, String((state.records as Array<{ name: string }>)[0]?.name))
          },
        },
      },
    )
    await flush()

    expect(calls).toBe(1)
    expect(view.find('.custom-record')?.textContent).toBe('Admin')
    expect(slotState).not.toHaveProperty('load')
    expect(slotState).not.toHaveProperty('data')
    view.unmount()
  })

  it('forwards the standard action surface to the collection slot', async () => {
    let actions: Record<string, unknown> | undefined
    let collectionKeys: string[] = []
    const view = mountCore(
      ListView,
      {
        run: () => ({ data: [{ id: '1', name: 'Admin' }], meta: { total: 1, totalPage: 1 } }),
        fields: { name: { label: 'Name' } },
        namespace: 'custom-actions',
        createRoute: { name: 'test-route' },
        detailRoute: (record) => ({ name: 'test-route', params: { id: String(record.id) } }),
        updateRoute: (record) => ({ name: 'test-route', params: { id: String(record.id) } }),
        can: (operation, record) => operation === 'delete' && record?.id === '1',
        deleteRecord: async () => undefined,
      },
      {
        slots: {
          collection: (state) => {
            actions = (state as { actions?: Record<string, unknown> }).actions
            collectionKeys = Object.keys(state)
            return h('p', 'custom')
          },
        },
      },
    )
    await flush()

    expect(actions?.createRoute).toEqual({ name: 'test-route' })
    expect((actions!.detailRoute as (record: Record<string, unknown>) => unknown)({ id: '1' })).toEqual({ name: 'test-route', params: { id: '1' } })
    expect((actions!.updateRoute as (record: Record<string, unknown>) => unknown)({ id: '1' })).toEqual({ name: 'test-route', params: { id: '1' } })
    expect((actions!.can as (operation: string, record?: Record<string, unknown>) => boolean)('delete', { id: '1' })).toBe(true)
    expect((actions!.can as (operation: string, record?: Record<string, unknown>) => boolean)('delete', { id: '2' })).toBe(false)
    expect(typeof actions!.deleteRecord).toBe('function')
    expect(collectionKeys).not.toContain('load')
    expect(collectionKeys).not.toContain('data')
    expect(Object.keys(actions!)).toEqual(['createRoute', 'detailRoute', 'updateRoute', 'can', 'deleteRecord'])
    view.unmount()
  })

  it('renders the table by default and flips live when a conditional collection slot toggles', async () => {
    const ToggleHost = defineComponent({
      setup() {
        const grid = ref(false)
        return () => [
          h('button', { 'data-toggle': '', onClick: () => { grid.value = !grid.value } }, 'toggle'),
          h(ListView, {
            table: {
              namespace: 'slot-toggle-live',
              fields: { name: { label: 'Nama' } },
              data: [{ name: 'Admin' }],
            },
          }, grid.value
            ? { collection: () => [h('p', { class: 'collection-body' }, 'grid body')] }
            : {}),
        ]
      },
    })
    const view = mountCore(ToggleHost, {})
    await flush()
    expect(view.find('table')).not.toBeNull()
    expect(view.find('.collection-body')).toBeNull()

    view.find<HTMLButtonElement>('[data-toggle]')!.click()
    await flush()
    expect(view.find('.collection-body')?.textContent).toBe('grid body')
    expect(view.find('table')).toBeNull()

    view.find<HTMLButtonElement>('[data-toggle]')!.click()
    await flush()
    expect(view.find('table')).not.toBeNull()
    expect(view.find('.collection-body')).toBeNull()
    view.unmount()
  })

  it('sends debounced search through the table query and resets page', async () => {
    vi.useFakeTimers()
    const contexts: Record<string, unknown>[] = []
    const view = mountCore(ListView, {
      table: {
        fields: { name: { label: 'Nama' } },
        load: ({ query }: { query: Record<string, unknown> }) => {
          contexts.push({ ...query })
          return { data: [{ name: 'Admin' }] }
        },
      },
      query: { page: 4, limit: 10 },
    })
    await flush()

    const search = view.find<HTMLInputElement>('header input')!
    search.value = 'admin'
    search.dispatchEvent(new Event('input'))
    await vi.advanceTimersByTimeAsync(300)
    await flush()

    expect(contexts.at(-1)).toMatchObject({ search: 'admin', page: 1, limit: 10 })
    view.unmount()
    vi.useRealTimers()
  })

  it('renders model-bound filter Form and resets filters without clearing search or limit', async () => {
    const contexts: Record<string, unknown>[] = []
    const view = mountCore(ListView, {
      table: {
        fields: { name: { label: 'Nama' } },
        load: ({ query }: { query: Record<string, unknown> }) => {
          contexts.push({ ...query })
          return { data: [{ name: 'Admin' }] }
        },
      },
      query: { search: 'admin', limit: 25, page: 3 },
      filters: { fields: { active: { label: 'Aktif' } }, defaults: { active: 'yes' } },
    })
    await flush()

    view.find<HTMLButtonElement>('[aria-label="Filter"]')!.click()
    await flush()
    const filter = document.querySelector<HTMLInputElement>('#field-active')!
    filter.value = 'no'
    filter.dispatchEvent(new Event('input'))
    await flush()
    expect(contexts.at(-1)).toMatchObject({ active: 'no', search: 'admin', limit: 25, page: 1 })

    ;[...document.querySelectorAll('button')].find((button) => button.textContent === 'Reset filter')!.dispatchEvent(new MouseEvent('click'))
    await flush()
    expect(contexts.at(-1)).toMatchObject({ active: 'yes', search: 'admin', limit: 25, page: 1 })
    view.unmount()
  })
})

describe('DetailView', () => {
  it('renders chrome around the detail and forwards its props unchanged', async () => {
    const view = mountCore(DetailView, { title: 'Role', backTo: { name: 'test-route' }, detail: detailProps })
    await flush()

    expect(view.find('h1')?.textContent).toBe('Role')
    expect(view.all('th[scope="row"]').map((node) => node.textContent)).toEqual(['Nama'])
    expect(view.text()).toContain('Admin')
    expect(view.all('.is-detail-view > div').every((card) => card.classList.contains('bg-surface-container'))).toBe(true)
    view.unmount()
  })

  it('renders required navigation chrome and controls without a footer', async () => {
    const view = mountCore(DetailView, { title: 'Role', backTo: { name: 'test-route' }, detail: detailProps }, {
      uiDefaults: { backLabel: 'Kembali' },
      slots: {
        controls: () => h('button', { 'data-controls-slot': '' }, 'Ubah'),
      },
    })
    await flush()

    expect(view.all('h1')).toHaveLength(1)
    expect(view.find('h1')?.textContent).toBe('Role')
    const back = view.find<HTMLAnchorElement>('a[aria-label="Kembali"]')
    expect(back).not.toBeNull()
    expect(back?.getAttribute('href')).toBe(view.router.resolve({ name: 'test-route' }).href)
    expect(view.find('[data-controls-slot]')).not.toBeNull()
    expect(view.find('header > div [data-controls-slot]')).not.toBeNull()
    expect(view.find('footer')).toBeNull()
    view.unmount()
  })

  it('resolves header title and back target from the action bag when no explicit prop is set', async () => {
    const view = mountCore(DetailView, {
      run: async () => ({ name: 'Admin' }),
      fields: { name: { label: 'Nama' } },
      id: '1',
      title: 'Detail Role',
      backTo: { name: 'test-route' },
    }, { uiDefaults: { backLabel: 'Kembali' } })
    await flush()

    expect(view.find('h1')?.textContent).toBe('Detail Role')
    expect(view.find<HTMLAnchorElement>('a[aria-label="Kembali"]')).not.toBeNull()
    view.unmount()
  })

  it('forwards value slots', async () => {
    const view = mountCore(
      DetailView,
      { title: 'Role', backTo: { name: 'test-route' }, detail: detailProps },
      {
        slots: {
          'value:name': (scope) => h('em', String((scope as { value: unknown }).value)),
        },
      },
    )
    await flush()

    expect(view.find('em')?.textContent).toBe('Admin')
    view.unmount()
  })

  it('contains no removed regions or router history logic', () => {
    const source = readFileSync(join(viewsRoot, 'DetailView.vue'), 'utf8')

    for (const forbidden of ['name="header"', 'name="body"', 'name="print"', 'name="footer"', 'description', 'router.back', 'useRouter']) {
      expect(source).not.toContain(forbidden)
    }
  })
})

describe('FormView', () => {
  const formProps = (submit: () => Promise<unknown>) => ({
    fields: { name: { label: 'Nama' } },
    initialData: { name: 'Admin' },
    submit,
  })

  it('runs the same chrome for create-like and update-like props, with no mode anywhere', async () => {
    const createSubmit = vi.fn(async () => undefined)
    const create = mountCore(FormView, { title: 'Create Role', formProps: formProps(createSubmit) })
    await flush()
    create.find('form')!.dispatchEvent(new Event('submit'))
    await flush()

    const updateSubmit = vi.fn(async () => undefined)
    const update = mountCore(FormView, {
      title: 'Edit Role',
      formProps: { ...formProps(updateSubmit), load: async () => ({ name: 'Editor' }) },
    })
    await flush()
    update.find('form')!.dispatchEvent(new Event('submit'))
    await flush()

    expect(createSubmit).toHaveBeenCalledWith({ name: 'Admin' })
    expect(updateSubmit).toHaveBeenCalledWith({ name: 'Editor' })
    expect(create.find('h1')?.textContent).toBe('Create Role')
    expect(update.find('h1')?.textContent).toBe('Edit Role')
    create.unmount()
    update.unmount()
  })

  it('uses DetailView-style navigation and body cards', async () => {
    const view = mountCore(FormView, {
      title: 'Create Role',
      description: 'Set user access.',
      formProps: formProps(async () => undefined),
    })
    await flush()

    const cards = view.all('.is-form-view > div')
    expect(cards).toHaveLength(2)
    expect(cards.every((card) => card.classList.contains('bg-surface-container'))).toBe(true)
    expect(cards.every((card) => card.classList.contains('border-outline-variant'))).toBe(true)
    expect(view.find('h1')?.classList.contains('text-lg')).toBe(true)
    expect(view.text()).toContain('Set user access.')
    expect(cards[1].contains(view.find('form')!)).toBe(true)
    expect(view.find<HTMLButtonElement>('button[aria-label="Back"]')).not.toBeNull()
    view.unmount()
  })

  it('renders page action slots without generic fallbacks', async () => {
    const view = mountCore(FormView, { formProps: formProps(async () => undefined) }, {
      slots: {
        controls: () => h('button', { 'data-controls-slot': '' }, 'Bantuan'),
        footer: () => h('button', { 'data-footer-slot': '' }, 'Kembali'),
      },
    })
    await flush()

    expect(view.find('[data-controls-slot]')).not.toBeNull()
    expect(view.find('header [data-controls-slot]')).not.toBeNull()
    expect(view.find('[data-footer-slot]')).not.toBeNull()
    view.unmount()
  })

  it('renders submit and cancel chrome and re-emits form events', async () => {
    const onSubmitted = vi.fn()
    const view = mountCore(FormView, {
      formProps: formProps(async () => ({ id: 1 })),
      submitLabel: 'Kirim',
      onSubmitted,
    })
    await flush()

    expect(view.text()).toContain('Kirim')
    view.find('form')!.dispatchEvent(new Event('submit'))
    await flush()

    expect(onSubmitted).toHaveBeenCalledWith({ id: 1 })
    view.unmount()
  })

  it('uses responsive text and filled form actions while submitting', async () => {
    const pending = deferred<{ id: number }>()
    const view = mountCore(FormView, { formProps: formProps(async () => pending.promise) })
    await flush()

    const actions = view.find('.is-form-view-controls')!
    const cancel = actions.querySelector<HTMLButtonElement>('button[type="button"]')!
    const submit = actions.querySelector<HTMLButtonElement>('button[type="submit"]')!
    expect(actions.classList.contains('border-t')).toBe(true)
    expect(actions.classList.contains('sm:flex-row')).toBe(true)
    expect(cancel.classList.contains('bg-transparent')).toBe(true)
    expect(submit.classList.contains('bg-primary')).toBe(true)
    expect(cancel.classList.contains('w-full')).toBe(true)
    view.find('form')!.dispatchEvent(new Event('submit'))
    await flush()
    expect(view.text()).toContain('Submit')
    expect(cancel.disabled).toBe(true)
    expect(submit.disabled).toBe(true)
    pending.resolve({ id: 1 })
    await flush()
    view.unmount()
  })

  it('disables FormView submit while an input operation is pending and keeps cancel enabled', async () => {
    const first = deferred<{ kind: 'file'; id: string; url: string; name: string }>()
    const upload = () => first.promise
    const view = mountCore(FormView, {
      formProps: {
        fields: { files: { label: 'Files', form: { renderer: 'file', props: { multi: true, upload } } } },
        initialData: { files: [] },
        submit: async () => undefined,
      },
    })
    await flush()

    const input = view.find<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['first'], 'first.pdf', { type: 'application/pdf' })] })
    input.dispatchEvent(new Event('change'))
    await flush()

    const actions = view.find('.is-form-view-controls')!
    const submit = actions.querySelector<HTMLButtonElement>('button[type="submit"]')!
    const cancel = [...actions.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Cancel')!
    expect(submit.disabled).toBe(true)
    expect(cancel.disabled).toBe(false)

    first.resolve({ kind: 'file', id: '/uploads/first.pdf', url: 'https://files.test/first.pdf', name: 'first.pdf' })
    await flush()
    expect(submit.disabled).toBe(false)
    expect(cancel.disabled).toBe(false)
    view.unmount()
  })

  it('uses browser history through Cancel without resetting the draft', async () => {
    const view = mountCore(FormView, { formProps: formProps(async () => undefined) })
    await flush()

    const input = view.find<HTMLInputElement>('input')!
    input.value = 'Diubah'
    input.dispatchEvent(new Event('input'))
    await flush()

    const back = vi.spyOn(view.router, 'back')
    view.all<HTMLButtonElement>('button').find((button) => button.textContent === 'Cancel')!.click()
    await flush()

    expect(view.find<HTMLInputElement>('input')!.value).toBe('Diubah')
    expect(back).toHaveBeenCalledOnce()
    view.unmount()
  })

  it('lets body, header, and form actions slots replace their defaults', async () => {
    const view = mountCore(FormView, { title: 'Create Role', formProps: formProps(async () => undefined) }, {
      slots: {
        header: () => h('h2', { 'data-header-slot': '' }, 'Header khusus'),
        body: () => h('p', { 'data-body-slot': '' }, 'Badan khusus'),
        'form-actions': () => h('button', { 'data-form-actions-slot': '' }, 'Custom action'),
      },
    })
    await flush()

    expect(view.find('[data-header-slot]')).not.toBeNull()
    expect(view.find('[data-body-slot]')).not.toBeNull()
    expect(view.find('[data-form-actions-slot]')).toBeNull()
    expect(view.find('h1')).toBeNull()
    expect(view.find('form')).toBeNull()
    view.unmount()

    const formActions = mountCore(FormView, { formProps: formProps(async () => undefined) }, {
      slots: { 'form-actions': () => h('button', { 'data-form-actions-slot': '' }, 'Custom action') },
    })
    await flush()
    expect(formActions.find('[data-form-actions-slot]')).not.toBeNull()
    expect(formActions.find('.is-form-view-controls')).toBeNull()
    formActions.unmount()
  })

  function actionForm(options: {
    detail?: (id: string) => string
    list?: string
    afterSubmit?: (context: { navigate: (to: string) => Promise<void>; preventDefaultNavigation: () => void }) => Promise<void | string> | void | string
    submit?: () => Promise<{ id: string; name: string }>
  } = {}) {
    return {
      fields: { name: { label: 'Nama' } },
      initialData: { name: 'Admin' },
      run: options.submit ?? (async () => ({ id: '1', name: 'Admin' })),
      defaultTo: options.detail ? (record: Record<string, unknown>) => options.detail!(String(record.id)) : options.list,
      afterSubmit: options.afterSubmit,
    }
  }

  async function mountRoutedFormView() {
    const host = document.createElement('div')
    document.body.append(host)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/form',
          name: 'form',
          component: FormView,
          props: {
            title: 'Edit Role',
            formProps: formProps(async () => undefined),
          },
        },
        { path: '/other', name: 'other', component: defineComponent({ setup: () => () => h('p', 'Other page') }) },
      ],
    })
    const app = createApp(defineComponent({ setup: () => () => h(RouterView) }))
    app.use(router)
    app.use(FrameworkPlugin )
    await router.push({ name: 'form' })
    await router.isReady()
    app.mount(host)
    await flush()

    return { host, router, unmount: () => { app.unmount(); host.remove() } }
  }

  it('guards dirty route exits, preserves drafts when staying, and registers native unload protection', async () => {
    const view = await mountRoutedFormView()
    const input = view.host.querySelector<HTMLInputElement>('input')!
    const cleanUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(cleanUnload)
    expect(cleanUnload.defaultPrevented).toBe(false)

    input.value = 'Editor'
    input.dispatchEvent(new Event('input'))
    await flush()

    const dirtyUnload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirtyUnload)
    expect(dirtyUnload.defaultPrevented).toBe(true)

    const navigation = view.router.push({ name: 'other' })
    await flush()
    expect(document.body.textContent).toContain('Discard unsaved changes?')
    ;[...document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Stay')!.click()
    await navigation
    await flush()
    expect(view.router.currentRoute.value.name).toBe('form')
    expect(view.host.querySelector<HTMLInputElement>('input')!.value).toBe('Editor')

    const discardNavigation = view.router.push({ name: 'other' })
    await flush()
    ;[...document.body.querySelectorAll<HTMLButtonElement>('button')].find((button) => button.textContent === 'Discard changes')!.click()
    await discardNavigation
    expect(view.router.currentRoute.value.name).toBe('other')
    view.unmount()
  })

  it('derives detail navigation, then list fallback, and stays without either target', async () => {
    const detail = mountCore(FormView, { ...actionForm({ detail: (id) => `/records/${id}`, list: '/records' }) })
    const detailReplace = vi.spyOn(detail.router, 'replace')
    detail.find('form')!.dispatchEvent(new Event('submit'))
    await flush()
    expect(detailReplace).toHaveBeenCalledWith('/records/1')
    detail.unmount()

    const list = mountCore(FormView, { ...actionForm({ list: '/records' }) })
    const listReplace = vi.spyOn(list.router, 'replace')
    list.find('form')!.dispatchEvent(new Event('submit'))
    await flush()
    expect(listReplace).toHaveBeenCalledWith('/records')
    list.unmount()

    const stay = mountCore(FormView, { ...actionForm() })
    const stayReplace = vi.spyOn(stay.router, 'replace')
    stay.find('form')!.dispatchEvent(new Event('submit'))
    await flush()
    expect(stayReplace).not.toHaveBeenCalled()
    stay.unmount()
  })

  it('runs effects before default navigation and only controller calls suppress it', async () => {
    const order: string[] = []
    const effect = mountCore(FormView, {
      ...actionForm({
        detail: () => '/default',
        afterSubmit: async () => { order.push('effect') },
      }),
    })
    const effectReplace = vi.spyOn(effect.router, 'replace')
    effect.find('form')!.dispatchEvent(new Event('submit'))
    await flush()
    expect(order).toEqual(['effect'])
    expect(effectReplace).toHaveBeenCalledWith('/default')
    effect.unmount()

    const ignoredReturn = mountCore(FormView, {
      ...actionForm({ detail: () => '/default', afterSubmit: () => '/ignored' }),
    })
    const ignoredReplace = vi.spyOn(ignoredReturn.router, 'replace')
    ignoredReturn.find('form')!.dispatchEvent(new Event('submit'))
    await flush()
    expect(ignoredReplace).toHaveBeenCalledWith('/default')
    ignoredReturn.unmount()

    const controlled = mountCore(FormView, {
      ...actionForm({ detail: () => '/default', afterSubmit: async ({ navigate }) => navigate('/custom') }),
    })
    const controlledReplace = vi.spyOn(controlled.router, 'replace')
    controlled.find('form')!.dispatchEvent(new Event('submit'))
    await flush()
    expect(controlledReplace).toHaveBeenCalledTimes(1)
    expect(controlledReplace).toHaveBeenCalledWith('/custom')
    controlled.unmount()

    const prevented = mountCore(FormView, {
      ...actionForm({ detail: () => '/default', afterSubmit: ({ preventDefaultNavigation }) => preventDefaultNavigation() }),
    })
    const preventedReplace = vi.spyOn(prevented.router, 'replace')
    prevented.find('form')!.dispatchEvent(new Event('submit'))
    await flush()
    expect(preventedReplace).not.toHaveBeenCalled()
    prevented.unmount()
  })

  it('keeps persisted form mounted when follow-up effect fails', async () => {
    const view = mountCore(FormView, {
      ...actionForm({ detail: () => '/default', afterSubmit: async () => { throw new Error('follow-up') } }),
    })
    const replace = vi.spyOn(view.router, 'replace')
    view.find('form')!.dispatchEvent(new Event('submit'))
    await flush()

    expect(view.find('form')).not.toBeNull()
    expect(replace).not.toHaveBeenCalled()
    view.unmount()
  })
})

describe('shell boundaries', () => {
  const shellFiles = readdirSync(viewsRoot).filter((entry) => entry.endsWith('.vue') || entry.endsWith('.ts'))

  it('imports no store or RPC dependency', () => {
    const forbidden = ['pinia', '../../runtime', '../../adapters', '@southneuhof/sdk']
    const offenders = shellFiles.flatMap((file) => {
      const source = readFileSync(join(viewsRoot, file), 'utf8')
      return forbidden.filter((specifier) => source.includes(`'${specifier}`)).map((specifier) => `${file}: ${specifier}`)
    })

    expect(offenders).toEqual([])
  })

  it('forwards core props with v-bind instead of translating them', () => {
    for (const [file, binding] of [
      ['DetailView.vue', 'v-bind="surface.detail"'],
      ['FormView.vue', 'v-bind="surface"'],
    ]) {
      expect(readFileSync(join(viewsRoot, file), 'utf8')).toContain(binding)
    }
  })

  it('keeps one heading per shell for a predictable document outline', async () => {
    const view = mountCore(ListView, { title: 'Role', table: tableProps })
    await flush()

    expect(view.all('h1')).toHaveLength(1)
    view.unmount()
  })
})

describe('ListView row delete control', () => {
  const baseProps = {
    fields: { name: { label: 'Name' } },
    namespace: 'delete-slot',
  }

  function mountRows(slots: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    return mountCore(
      ListView,
      {
        ...baseProps,
        run: () => ({ data: [{ id: '1', name: 'Admin' }], meta: { total: 1, totalPage: 1 } }),
        can: (operation: string, record?: Record<string, unknown>) =>
          operation === 'delete' && record?.id === '1',
        ...extra,
      },
      { slots },
    )
  }

  it('renders the native delete only when a delete action is runnable and permitted', async () => {
    const view = mountRows({}, { deleteRecord: async () => undefined })
    await flush()
    expect(view.find('button[aria-label="Delete"]')).not.toBeNull()
    view.unmount()
  })

  it('renders nothing when the capability exists but no delete action backs it', async () => {
    const view = mountRows({})
    await flush()
    expect(view.text()).not.toContain('Delete')
    expect(view.find('button[aria-label="Delete"]')).toBeNull()
    view.unmount()
  })

  it('lets a #delete slot replace the native control', async () => {
    const view = mountRows(
      { 'row-actions-delete': ({ record }: { record: { id: string } }) => h('span', { class: 'custom-delete' }, `custom-${record.id}`) },
      { deleteRecord: async () => undefined },
    )
    await flush()
    expect(view.find('.custom-delete')).not.toBeNull()
    expect(view.find('button[aria-label="Delete"]')).toBeNull()
    view.unmount()
  })

  it('hides custom delete content too when permission is missing', async () => {
    const view = mountCore(
      ListView,
      {
        ...baseProps,
        run: () => ({ data: [{ id: '2', name: 'Other' }], meta: { total: 1, totalPage: 1 } }),
        can: (operation: string, record?: Record<string, unknown>) =>
          operation === 'delete' && record?.id === '1',
        deleteRecord: async () => undefined,
      },
      {
        slots: {
          'row-actions-delete': () => h('span', { class: 'custom-delete' }, 'should-not-render'),
        },
      },
    )
    await flush()
    expect(view.find('.custom-delete')).toBeNull()
    expect(view.text()).not.toContain('should-not-render')
    view.unmount()
  })
})

describe('ListView standard action overrides', () => {
  const baseProps = {
    fields: { name: { label: 'Name' } },
    namespace: 'action-overrides',
  }

  function mountWith(slots: Record<string, unknown>) {
    return mountCore(
      ListView,
      {
        ...baseProps,
        run: () => ({ data: [{ id: '1', name: 'Admin' }], meta: { total: 1, totalPage: 1 } }),
        createRoute: { name: 'test-route' },
        detailRoute: (record: Record<string, unknown>) => ({ name: 'test-route', params: { id: String(record.id) } }),
        updateRoute: (record: Record<string, unknown>) => ({ name: 'test-route', params: { id: String(record.id) } }),
        can: (operation: string, record?: Record<string, unknown>) =>
          operation === 'delete' ? record?.id === '1' : operation === 'create',
        deleteRecord: async () => undefined,
      },
      { slots },
    )
  }

  it('renders native controls when no overrides are given', async () => {
    const view = mountWith({})
    await flush()
    expect(view.find('a[aria-label="View"]')).not.toBeNull()
    expect(view.find('a[aria-label="Edit"]')).not.toBeNull()
    expect(view.find('button[aria-label="Delete"]')).not.toBeNull()
    expect(view.text()).toContain('Create')
    view.unmount()
  })

  it('replaces view, edit and delete with slot content while natives stay hidden', async () => {
    let viewCan: unknown
    const view = mountWith({
      'row-actions-view': (props: { can?: unknown }) => { viewCan = props.can; return h('span', { class: 'ov-view' }, 'V') },
      'row-actions-edit': () => h('span', { class: 'ov-edit' }, 'E'),
      'row-actions-delete': () => h('span', { class: 'ov-del' }, 'D'),
    })
    await flush()
    expect(typeof viewCan).toBe('function')
    expect( (viewCan as (operation: string, record?: Record<string, unknown>) => boolean)('delete', { id: '1' })).toBe(true)
    expect(view.find('.ov-view')).not.toBeNull()
    expect(view.find('.ov-edit')).not.toBeNull()
    expect(view.find('.ov-del')).not.toBeNull()
    expect(view.find('a[aria-label="View"]')).toBeNull()
    expect(view.find('a[aria-label="Edit"]')).toBeNull()
    expect(view.find('button[aria-label="Delete"]')).toBeNull()
    view.unmount()
  })

  it('replaces the toolbar Create button via #create-action', async () => {
    let createCan: unknown
    const view = mountWith({
      'create-action': (props: { target: unknown; can?: unknown }) => {
        createCan = props.can
        return h('span', { class: 'ov-create' }, JSON.stringify(props.target))
      },
    })
    await flush()
    expect(view.find('.ov-create')?.textContent).toContain('test-route')
    expect(typeof createCan).toBe('function')
    expect((createCan as (operation: string) => boolean)('create')).toBe(true)
    expect(view.text()).not.toContain('Create')
    view.unmount()
  })

  it('hides create override content when no create route is permitted', async () => {
    const view = mountCore(
      ListView,
      {
        ...baseProps,
        run: () => ({ data: [{ id: '1' }], meta: { totalPage: 1 } }),
      },
      {
        slots: {
          'create-action': () => h('span', { class: 'ov-create' }, 'should-not-render'),
        },
      },
    )
    await flush()
    expect(view.find('.ov-create')).toBeNull()
    expect(view.text()).not.toContain('should-not-render')
    view.unmount()
  })
})
