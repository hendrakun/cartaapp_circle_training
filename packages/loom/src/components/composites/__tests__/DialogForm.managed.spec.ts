import { defineComponent, h, nextTick, ref, type Component } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DialogForm from '../DialogForm.vue'
import { flush, mountCore } from '../../core/__tests__/harness'

const fields = {
  name: { label: 'Name', form: { renderer: 'text' } },
}

const mounted: Array<ReturnType<typeof mountCore>> = []

function mount(component: Component, props: Record<string, unknown> = {}) {
  const view = mountCore(component, props)
  mounted.push(view)
  return view
}

function trigger(view: ReturnType<typeof mountCore>, label: string) {
  return [...view.host.querySelectorAll<HTMLButtonElement>('button')].find((entry) => entry.textContent?.trim() === label)!
}

function dialog() {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')
}

function input() {
  return dialog()!.querySelector<HTMLInputElement>('input')!
}

function enterName(value: string) {
  input().value = value
  input().dispatchEvent(new Event('input'))
}

function submit() {
  dialog()!.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
}

async function open(view: ReturnType<typeof mountCore>, label: string) {
  trigger(view, label).click()
  await flush()
  expect(dialog()).not.toBeNull()
}

afterEach(() => {
  for (const view of mounted.splice(0)) view.unmount()
  document.body.innerHTML = ''
})

describe('DialogForm managed visibility', () => {
  it('opens from its trigger and closes before successful completion is observed', async () => {
    const submitForm = vi.fn(async (draft: Record<string, unknown>) => ({ id: 'one', ...draft }))
    let submittedState: string | null | undefined
    const submitted = vi.fn(async () => {
      await nextTick()
      submittedState = dialog()?.getAttribute('data-state')
    })
    const Host = defineComponent({
      setup: () => () => h(DialogForm, {
        fields,
        initialData: { name: '' },
        title: 'Create record',
        submit: submitForm,
        onSubmitted: submitted,
      }, {
        trigger: () => h('button', { type: 'button' }, 'Create'),
      }),
    })
    const view = mount(Host)

    expect(dialog()).toBeNull()
    await open(view, 'Create')
    enterName('Ada')
    submit()
    await flush()

    expect(submitForm).toHaveBeenCalledOnce()
    expect(submitForm).toHaveBeenCalledWith({ name: 'Ada' })
    expect(submitted).toHaveBeenCalledOnce()
    expect(submittedState).toBe('closed')
    expect(dialog()).toBeNull()
  })

  it('keeps one draft through validation and write failures so it can be corrected', async () => {
    const submitForm = vi.fn()
      .mockRejectedValueOnce(new Error('Save rejected'))
      .mockResolvedValueOnce({ id: 'one' })
    const Host = defineComponent({
      setup: () => () => h(DialogForm, {
        fields,
        initialData: { name: '' },
        title: 'Create record',
        schema: {
          validate: (draft: Record<string, unknown>) => draft.name === 'Bad'
            ? { success: false as const, issues: [{ path: ['name'], message: 'Use another name' }] }
            : { success: true as const, data: draft },
        },
        submit: submitForm,
      }, {
        trigger: () => h('button', { type: 'button' }, 'Create'),
      }),
    })
    const view = mount(Host)
    await open(view, 'Create')

    enterName('Bad')
    submit()
    await flush()
    expect(submitForm).not.toHaveBeenCalled()
    expect(input().value).toBe('Bad')
    expect(dialog()!.textContent).toContain('Use another name')

    enterName('Ada')
    submit()
    await flush()
    expect(submitForm).toHaveBeenCalledOnce()
    expect(input().value).toBe('Ada')
    expect(dialog()).not.toBeNull()

    enterName('Grace')
    submit()
    await flush()
    expect(submitForm).toHaveBeenCalledTimes(2)
    expect(submitForm).toHaveBeenLastCalledWith({ name: 'Grace' })
    expect(dialog()).toBeNull()
  })

  it('keeps keyed row forms independent and submits to the matching record', async () => {
    const saved: Array<{ id: string; name: unknown }> = []
    const records = [{ id: 'one', name: 'First' }, { id: 'two', name: 'Second' }]
    const Host = defineComponent({
      setup: () => () => h('div', records.map((record) => h(DialogForm, {
        key: record.id,
        fields,
        initialData: { name: record.name },
        title: `Edit ${record.name}`,
        submit: async (draft: Record<string, unknown>) => {
          saved.push({ id: record.id, name: draft.name })
          return record.id
        },
      }, {
        trigger: () => h('button', { type: 'button' }, `Edit ${record.name}`),
      }))),
    })
    const view = mount(Host)

    await open(view, 'Edit First')
    expect(input().value).toBe('First')
    enterName('First changed')
    submit()
    await flush()

    await open(view, 'Edit Second')
    expect(input().value).toBe('Second')
    enterName('Second changed')
    submit()
    await flush()

    expect(saved).toEqual([
      { id: 'one', name: 'First changed' },
      { id: 'two', name: 'Second changed' },
    ])
  })

  it('starts closed when a managed dialog is removed and recreated', async () => {
    const show = ref(true)
    const Host = defineComponent({
      setup: () => () => h('div', [
        h('button', { type: 'button', onClick: () => { show.value = !show.value } }, 'Toggle form'),
        show.value
          ? h(DialogForm, {
              fields,
              initialData: { name: '' },
              title: 'Create record',
              submit: async () => undefined,
            }, {
              trigger: () => h('button', { type: 'button' }, 'Create'),
            })
          : null,
      ]),
    })
    const view = mount(Host)

    await open(view, 'Create')
    trigger(view, 'Toggle form').click()
    await flush()
    expect(dialog()).toBeNull()

    trigger(view, 'Toggle form').click()
    await flush()
    expect(dialog()).toBeNull()
    await open(view, 'Create')
  })

  it('keeps refresh failure separate after a successful write', async () => {
    const submitForm = vi.fn(async () => ({ id: 'one' }))
    const refresh = vi.fn(async () => { throw new Error('Data is stale') })
    const writeErrors: unknown[] = []
    const refreshError = ref<string>()
    const Host = defineComponent({
      setup: () => () => h('div', [
        refreshError.value ? h('p', { role: 'alert' }, refreshError.value) : null,
        h(DialogForm, {
          fields,
          initialData: { name: '' },
          title: 'Create record',
          submit: submitForm,
          onError: (error: unknown) => writeErrors.push(error),
          onSubmitted: async () => {
            await nextTick()
            try {
              await refresh()
            } catch (error) {
              refreshError.value = (error as Error).message
            }
          },
        }, {
          trigger: () => h('button', { type: 'button' }, 'Create'),
        }),
      ]),
    })
    const view = mount(Host)

    await open(view, 'Create')
    enterName('Ada')
    submit()
    await flush()

    expect(submitForm).toHaveBeenCalledOnce()
    expect(refresh).toHaveBeenCalledOnce()
    expect(writeErrors).toEqual([])
    expect(dialog()).toBeNull()
    expect(view.find('[role="alert"]')?.textContent).toBe('Data is stale')
  })
})
