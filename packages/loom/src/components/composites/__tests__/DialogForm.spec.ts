import { defineComponent, h, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import DialogForm from '../DialogForm.vue'
import { deferred, flush, mountCore } from '../../core/__tests__/harness'

const mocks = vi.hoisted(() => ({ toastError: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: { error: mocks.toastError } }))

vi.mock('../../base/Dialog.vue', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    default: defineComponent({
      props: {
        modelValue: Boolean,
        disabled: Boolean,
      },
      emits: ['update:modelValue', 'open', 'close'],
      setup(props, { emit, slots }) {
        const setOpen = (value: boolean) => emit('update:modelValue', value)
        return () =>
          h('section', { class: 'dialog-mock' }, [
            h('div', { class: 'dialog-trigger' }, slots.trigger?.({ setOpen, disabled: props.disabled, 'data-trigger-binding': '' })),
            slots.title ? h('h2', { class: 'dialog-title' }, slots.title({ setOpen })) : null,
            slots.description ? h('p', { class: 'dialog-description' }, slots.description({ setOpen })) : null,
            props.modelValue
              ? h('div', { class: 'dialog-content' }, [
                  slots.content?.({ setOpen }),
                  h('button', { type: 'button', class: 'dialog-dismiss', onClick: () => setOpen(false) }, 'Dismiss'),
                ])
              : null,
          ])
      },
    }),
  }
})

const fields = {
  name: { label: 'Name', form: { renderer: undefined } },
}

interface MountOptions {
  props?: Record<string, unknown>
  slots?: Record<string, (scope: Record<string, any>) => unknown>
  modelBound?: boolean
  modelValue?: Record<string, unknown>
  open?: boolean
}

function mountDialogForm(options: MountOptions = {}) {
  const submitted: unknown[] = []
  const errors: unknown[] = []
  const resets: unknown[] = []
  const openUpdates: boolean[] = []
  const draftUpdates: Record<string, unknown>[] = []

  const Host = defineComponent({
    setup(_, { expose }) {
      const open = ref(options.open ?? true)
      const draft = ref<Record<string, unknown> | undefined>(options.modelValue)
      const dialog = ref()
      expose({ open, draft, dialog })

      return () =>
        h(
          DialogForm,
          {
            fields,
            initialData: { name: '' },
            submit: async () => undefined,
            ...options.props,
            ref: dialog,
            open: open.value,
            'onUpdate:open': (value: boolean) => {
              openUpdates.push(value)
              open.value = value
            },
            ...(options.modelBound
              ? {
                  modelValue: draft.value,
                  'onUpdate:modelValue': (value: Record<string, unknown>) => {
                    draftUpdates.push(value)
                    draft.value = value
                  },
                }
              : {}),
            onSubmitted: (result: unknown) => submitted.push(result),
            onError: (error: unknown) => errors.push(error),
            onReset: () => resets.push(true),
          },
          options.slots,
        )
    },
  })

  const view = mountCore(Host, {})
  return { view, submitted, errors, resets, openUpdates, draftUpdates }
}

function button(view: ReturnType<typeof mountCore>, label: string) {
  return view.all('button').find((entry) => entry.textContent?.trim() === label) as HTMLButtonElement | undefined
}

function typeName(view: ReturnType<typeof mountCore>, value: string) {
  const input = view.find<HTMLInputElement>('input')!
  input.value = value
  input.dispatchEvent(new Event('input'))
}

describe('DialogForm', () => {
  it('derives submit from a resource action bag run when submit is absent', async () => {
    const run = vi.fn(async (draft: Record<string, unknown>) => ({ id: 'one', ...draft }))
    const view = mountDialogForm({ props: { run, title: 'Create record', submit: undefined } })
    await flush()
    const submit = button(view.view, 'Submit')
    expect(submit).toBeDefined()
    typeName(view.view, 'Ada')
    submit!.click()
    await flush()
    await flush()
    expect(run).toHaveBeenCalledWith({ name: 'Ada' })
  })

  it('prefers an explicit submit over the bag run', async () => {
    const run = vi.fn(async () => undefined)
    const submit = vi.fn(async (draft: Record<string, unknown>) => ({ id: 'one', ...draft }))
    const view = mountDialogForm({ props: { run, submit, title: 'Create record' } })
    await flush()
    typeName(view.view, 'Ada')
    button(view.view, 'Submit')!.click()
    await flush()
    await flush()
    expect(submit).toHaveBeenCalledWith({ name: 'Ada' })
    expect(run).not.toHaveBeenCalled()
  })

  it('forwards dialog, content, and field slots with default and custom labels', async () => {
    const triggerScopes: Record<string, unknown>[] = []
    const view = mountDialogForm({
      props: {
        title: 'Create record',
        description: 'Required fields',
        cancelLabel: 'Back',
        submitLabel: 'Create',
      },
      slots: {
        trigger: (scope) => {
          triggerScopes.push(scope)
          return h('button', { type: 'button', class: 'custom-trigger', onClick: () => scope.setOpen(true) }, 'Open')
        },
        header: () => h('p', { class: 'custom-header' }, 'Header'),
        footer: () => h('p', { class: 'custom-footer' }, 'Footer'),
        'input:name': ({ value, setValue }) =>
          h('input', {
            class: 'custom-name',
            value,
            onInput: (event: Event) => setValue((event.target as HTMLInputElement).value),
          }),
      },
    })
    await flush()

    expect(triggerScopes.at(-1)).toHaveProperty('data-trigger-binding')
    expect(view.view.find('.dialog-title')?.textContent).toBe('Create record')
    expect(view.view.find('.dialog-description')?.textContent).toBe('Required fields')
    expect(view.view.find('.custom-header')?.textContent).toBe('Header')
    expect(view.view.find('.custom-footer')?.textContent).toBe('Footer')
    expect(view.view.find('.custom-name')).not.toBeNull()
    expect(button(view.view, 'Back')).toBeDefined()
    expect(button(view.view, 'Create')).toBeDefined()
    view.view.unmount()
  })

  it('closes only after a successful validated submission', async () => {
    const submit = vi.fn(async (draft: Record<string, unknown>) => ({ id: 'one', ...draft }))
    const view = mountDialogForm({ props: { submit } })
    await flush()

    typeName(view.view, 'Ada')
    button(view.view, 'Submit')!.click()
    await flush()

    expect(submit).toHaveBeenCalledWith({ name: 'Ada' })
    expect(view.submitted).toEqual([{ id: 'one', name: 'Ada' }])
    expect(view.openUpdates).toEqual([false])
    expect(view.view.exposed().open).toBe(false)
    view.view.unmount()
  })

  it('keeps open for validation and submission failures', async () => {
    mocks.toastError.mockClear()
    const invalidSubmit = vi.fn(async () => undefined)
    const invalid = mountDialogForm({
      props: {
        submit: invalidSubmit,
        schema: {
          validate: () => ({ success: false as const, issues: [{ path: ['name'], message: 'Name required' }] }),
        },
      },
    })
    await flush()
    button(invalid.view, 'Submit')!.click()
    await flush()

    expect(invalidSubmit).not.toHaveBeenCalled()
    expect(invalid.view.exposed().open).toBe(true)
    expect(invalid.view.text()).toContain('Name required')
    invalid.view.unmount()

    const failing = mountDialogForm({
      props: {
        submit: async () => {
          throw new Error('Rejected')
        },
      },
    })
    await flush()
    button(failing.view, 'Submit')!.click()
    await flush()

    expect(failing.errors).toEqual([{ message: 'Rejected' }])
    expect(failing.view.exposed().open).toBe(true)
    expect(mocks.toastError).toHaveBeenCalledWith('Rejected')
    failing.view.unmount()
  })

  it('can preserve open state after success', async () => {
    const view = mountDialogForm({
      props: {
        closeOnSubmitted: false,
        submit: async () => 'saved',
      },
    })
    await flush()
    button(view.view, 'Submit')!.click()
    await flush()

    expect(view.submitted).toEqual(['saved'])
    expect(view.openUpdates).toEqual([])
    expect(view.view.exposed().open).toBe(true)
    view.view.unmount()
  })

  it('guards Cancel and dismiss requests with live dirty state', async () => {
    const contexts: unknown[] = []
    let approved = false
    const beforeClose = vi.fn(async (context) => {
      contexts.push(context)
      return approved
    })
    const view = mountDialogForm({ props: { beforeClose } })
    await flush()

    typeName(view.view, 'Changed')
    await flush()
    button(view.view, 'Cancel')!.click()
    await flush()
    expect(view.view.exposed().open).toBe(true)
    expect(contexts).toEqual([{ reason: 'cancel', dirty: true, submitting: false, validating: false }])

    approved = true
    view.view.find<HTMLButtonElement>('.dialog-dismiss')!.click()
    await flush()
    expect(view.view.exposed().open).toBe(false)
    expect(contexts).toEqual([
      { reason: 'cancel', dirty: true, submitting: false, validating: false },
      { reason: 'dismiss', dirty: true, submitting: false, validating: false },
    ])
    view.view.unmount()
  })

  it('serializes async close checks and treats rejection as refusal', async () => {
    const closeCheck = deferred<boolean>()
    const beforeClose = vi.fn(() => closeCheck.promise)
    const view = mountDialogForm({ props: { beforeClose } })
    await flush()

    const dialog = view.view.exposed().dialog
    const first = dialog.requestClose('cancel')
    const second = dialog.requestClose('dismiss')
    expect(beforeClose).toHaveBeenCalledOnce()
    expect(await second).toBe(false)

    closeCheck.resolve(false)
    expect(await first).toBe(false)
    expect(view.view.exposed().open).toBe(true)

    beforeClose.mockImplementationOnce(async () => {
      throw new Error('No close')
    })
    expect(await dialog.requestClose('cancel')).toBe(false)
    expect(view.view.exposed().open).toBe(true)
    view.view.unmount()
  })

  it('disables actions and refuses dismissal while submitting', async () => {
    const submission = deferred<string>()
    const view = mountDialogForm({ props: { submit: () => submission.promise } })
    await flush()

    button(view.view, 'Submit')!.click()
    await flush()
    expect(button(view.view, 'Submit')?.disabled).toBe(true)
    expect(button(view.view, 'Cancel')?.disabled).toBe(true)

    view.view.find<HTMLButtonElement>('.dialog-dismiss')!.click()
    await flush()
    expect(view.view.exposed().open).toBe(true)

    submission.resolve('saved')
    await flush()
    expect(view.view.exposed().open).toBe(false)
    view.view.unmount()
  })

  it('disables DialogForm submit while an input operation is pending and keeps cancel enabled', async () => {
    const pendingUpload = deferred<{ kind: 'file'; id: string; url: string; name: string }>()
    const view = mountDialogForm({
      props: {
        fields: { files: { label: 'Files', form: { renderer: 'file', props: { multi: true, upload: () => pendingUpload.promise } } } },
        initialData: { files: [] },
      },
    })
    await flush()

    const input = view.view.find<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { configurable: true, value: [new File(['first'], 'first.pdf', { type: 'application/pdf' })] })
    input.dispatchEvent(new Event('change'))
    await flush()

    expect(button(view.view, 'Submit')?.disabled).toBe(true)
    expect(button(view.view, 'Cancel')?.disabled).toBe(false)

    button(view.view, 'Cancel')!.click()
    await flush()
    expect(view.view.exposed().open).toBe(false)

    pendingUpload.resolve({ kind: 'file', id: '/uploads/first.pdf', url: 'https://files.test/first.pdf', name: 'first.pdf' })
    await flush()
    view.view.unmount()
  })

  it('keeps draft v-model independent from named open model', async () => {
    const submitBound = mountDialogForm()
    await flush()
    expect(button(submitBound.view, 'Submit')).toBeDefined()
    submitBound.view.unmount()

    const modelBound = mountDialogForm({
      modelBound: true,
      modelValue: undefined,
      props: { submit: undefined },
    })
    await flush()
    expect(button(modelBound.view, 'Submit')).toBeUndefined()

    typeName(modelBound.view, 'Filter')
    await flush()
    expect(modelBound.draftUpdates).toEqual([{ name: 'Filter' }])
    expect(modelBound.view.exposed().draft).toEqual({ name: 'Filter' })
    expect(modelBound.view.exposed().open).toBe(true)
    modelBound.view.unmount()
  })

  it('forwards custom action state and exposes core Form controls', async () => {
    const actionScopes: Record<string, any>[] = []
    const view = mountDialogForm({
      slots: {
        actions: (scope) => {
          actionScopes.push(scope)
          return h('button', { type: 'button', class: 'custom-reset', onClick: scope.reset }, 'Reset draft')
        },
      },
    })
    await flush()

    typeName(view.view, 'Changed')
    await flush()
    expect(view.view.exposed().dialog.dirty).toBe(true)
    expect(actionScopes.at(-1)).toMatchObject({
      dirty: true,
      submitting: false,
      validating: false,
    })
    expect(typeof actionScopes.at(-1)?.submit).toBe('function')
    expect(typeof actionScopes.at(-1)?.requestClose).toBe('function')

    view.view.find<HTMLButtonElement>('.custom-reset')!.click()
    await flush()
    expect(view.resets).toEqual([true])
    expect(view.view.find<HTMLInputElement>('input')?.value).toBe('')
    expect(view.view.exposed().dialog.dirty).toBe(false)
    view.view.unmount()
  })
})
