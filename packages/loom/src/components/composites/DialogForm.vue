<script setup lang="ts">
import { computed, getCurrentInstance, ref, useAttrs, useSlots } from 'vue'
import type { DialogFormCloseReason, DialogFormProps, SubmitError } from '../../contracts'
import Button from '../base/Button.vue'
import Dialog from '../base/Dialog.vue'
import Form from '../core/Form.vue'
import { useFrameworkUiDefaults } from '../views/uiDefaults'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<DialogFormProps>(), {
  closeOnSubmitted: true,
  cancelLabel: 'Cancel',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: Record<string, unknown>): void
  (event: 'submitted', result: unknown): void
  (event: 'error', error: SubmitError): void
  (event: 'reset'): void
  (event: 'open'): void
  (event: 'close'): void
}>()

const open = defineModel<boolean>('open', { default: false })
const attrs = useAttrs()
const slots = useSlots()
const instance = getCurrentInstance()
interface CoreFormExposed {
  draft: Record<string, unknown>
  dirty: boolean
  submitting: boolean
  validating: boolean
  inputPending: boolean
  submit: () => unknown
  reset: () => unknown
  refresh: () => unknown
}
const form = ref<CoreFormExposed>()
const checkingClose = ref(false)
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()
const resolvedSubmitLabel = computed(() => props.submitLabel ?? defaultSubmitLabel)
const resolvedSubmittingLabel = computed(() => props.submittingLabel ?? resolvedSubmitLabel.value)

const vnodeProps = instance?.vnode.props ?? {}
const hasDraftModelValue = 'modelValue' in vnodeProps
const hasDraftModelListener = 'onUpdate:modelValue' in vnodeProps

const formBindings = computed<Record<string, unknown>>(() => {
  const {
    title: _title,
    description: _description,
    closeOnSubmitted: _closeOnSubmitted,
    beforeClose: _beforeClose,
    cancelLabel: _cancelLabel,
    submitLabel: _submitLabel,
    submittingLabel: _submittingLabel,
    modelValue: _modelValue,
    run,
    ...formProps
  } = props

  const bindings: Record<string, unknown> = { ...formProps }
  if (!bindings.submit && run) bindings.submit = run
  if (hasDraftModelValue) bindings.modelValue = props.modelValue
  if (hasDraftModelListener) {
    bindings['onUpdate:modelValue'] = (value: Record<string, unknown>) => emit('update:modelValue', value)
  }
  return bindings
})
const hasSubmit = computed(() => Boolean(props.submit || props.run))

const forwardedFormSlots = computed(() =>
  Object.keys(slots).filter((name) => name === 'loading' || name === 'load-error' || name.startsWith('input:')),
)

const dirty = computed(() => Boolean(form.value?.dirty))
const submitting = computed(() => Boolean(form.value?.submitting))
const validating = computed(() => Boolean(form.value?.validating))
const inputPending = computed(() => Boolean(form.value?.inputPending))
const submitDisabled = computed(() => Boolean(props.disabled || submitting.value || validating.value || inputPending.value))
const cancelDisabled = computed(() => Boolean(props.disabled || submitting.value || validating.value || checkingClose.value))

async function requestClose(reason: DialogFormCloseReason): Promise<boolean> {
  if (submitting.value || validating.value || checkingClose.value) return false

  checkingClose.value = true
  try {
    const approved = props.beforeClose
      ? await props.beforeClose({
          reason,
          dirty: dirty.value,
          submitting: submitting.value,
          validating: validating.value,
        })
      : true
    if (!approved) return false
    open.value = false
    return true
  } catch {
    return false
  } finally {
    checkingClose.value = false
  }
}

function setOpen(value: boolean) {
  if (value) open.value = true
  else void requestClose('dismiss')
}

function handleDialogModel(value: boolean) {
  setOpen(value)
}

function handleSubmitted(result: unknown) {
  emit('submitted', result)
  if (props.closeOnSubmitted) open.value = false
}

function submit() {
  return form.value?.submit()
}

function reset() {
  return form.value?.reset()
}

function refresh() {
  return form.value?.refresh()
}

const draft = computed(() => form.value?.draft)

defineExpose({
  form,
  draft,
  dirty,
  submitting,
  validating,
  inputPending,
  checkingClose,
  submit,
  reset,
  refresh,
  requestClose,
})
</script>

<template>
  <Dialog
    :model-value="open"
    :disabled="disabled"
    :class="attrs.class"
    @update:model-value="handleDialogModel"
    @open="emit('open')"
    @close="emit('close')"
  >
    <template #trigger="triggerProps">
      <slot name="trigger" v-bind="triggerProps" :set-open="setOpen" />
    </template>

    <template v-if="title || $slots.title" #title>
      <slot name="title" :request-close="requestClose">{{ title }}</slot>
    </template>

    <template v-if="description || $slots.description" #description>
      <slot name="description" :request-close="requestClose">{{ description }}</slot>
    </template>

    <template #content>
      <div class="flex flex-col gap-5">
        <slot name="header" :request-close="requestClose" />

        <Form
          ref="form"
          v-bind="formBindings"
          @submitted="handleSubmitted"
          @error="emit('error', $event)"
          @reset="emit('reset')"
        >
          <template v-for="name in forwardedFormSlots" :key="name" #[name]="slotProps">
            <slot :name="name" v-bind="slotProps ?? {}" />
          </template>

          <template #actions="{ submit: submitForm, reset: resetForm, submitting: formSubmitting, dirty: formDirty, inputPending: formInputPending }">
            <slot
              name="actions"
              :submit="submitForm"
              :reset="resetForm"
              :submitting="formSubmitting"
              :validating="validating"
              :dirty="formDirty"
              :input-pending="formInputPending"
              :request-close="requestClose"
            >
              <div class="flex flex-col gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="text"
                  class="w-full sm:w-auto"
                  :disabled="cancelDisabled"
                  @click="requestClose('cancel')"
                >
                  {{ cancelLabel }}
                </Button>
                <Button
                  v-if="hasSubmit"
                  type="submit"
                  class="w-full sm:w-auto"
                  :disabled="submitDisabled"
                >
                  {{ formSubmitting ? resolvedSubmittingLabel : resolvedSubmitLabel }}
                </Button>
              </div>
            </slot>
          </template>
        </Form>

        <slot name="footer" :request-close="requestClose" />
      </div>
    </template>
  </Dialog>
</template>
