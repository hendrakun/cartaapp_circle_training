<script setup lang="ts">
/**
 * Draft surface shell.
 *
 * Owns the Card, title, and submit/cancel chrome, wiring them through Form's
 * exposed contract. Like Form itself, it never learns whether the submission
 * creates or updates.
 */
import { computed, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { onBeforeRouteLeave, useRouter, type RouteLocationRaw } from 'vue-router'
import { toast } from 'vue-sonner'
import type { FieldContext, FieldsInput, FormProps, MaybePromise, RecordIdentity, RecordLoadContext, SubmitError } from '../../contracts'
import type { FormSubmissionContext } from './FormView.types'
import Form from '../core/Form.vue'
import Button from '../base/Button.vue'
import Card from '../base/Card.vue'
import Dialog from '../base/Dialog.vue'
import NavigationHeader from './NavigationHeader.vue'
import { useFrameworkUiDefaults } from './uiDefaults'

type BivariantMethod<TArgument, TResult> = { method(argument: TArgument): TResult }['method']

type ActionFormProps = {
  run: BivariantMethod<object, MaybePromise<unknown>>
  fields: FieldsInput
  id?: RecordIdentity
  resource?: string
  initialData?: Partial<Record<string, unknown>>
  load?: BivariantMethod<RecordLoadContext, MaybePromise<Partial<Record<string, unknown>> | undefined>>
  searchParameters?: Record<string, unknown>
  schema?: unknown
  validators?: readonly unknown[]
  context?: FieldContext
  namespace?: string
  defaultTo?: RouteLocationRaw | ((record: Record<string, unknown>) => RouteLocationRaw | undefined)
  afterSubmit?: BivariantMethod<FormSubmissionContext<Record<string, unknown>, RecordIdentity>, MaybePromise<void>>
  successMessage?: string | false
  formProps?: never
}

type FormViewProps = ({
  formProps: FormProps
  id?: never
  afterSubmit?: never
  successMessage?: never
} | ActionFormProps) & {
  title?: string
  description?: string
  submitLabel?: string
  submittingLabel?: string
}

const props = defineProps<FormViewProps>()
const router = useRouter()
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()
const resolvedSubmitLabel = computed(() => (props as { submitLabel?: string }).submitLabel ?? defaultSubmitLabel)
const resolvedSubmittingLabel = computed(() => (props as { submittingLabel?: string }).submittingLabel ?? resolvedSubmitLabel.value)

const action = computed<ActionFormProps | undefined>(() => {
  const candidate = props as Partial<ActionFormProps>
  return typeof candidate.run === 'function' ? candidate as ActionFormProps : undefined
})

const surface = computed<FormProps>(() => {
  if ('formProps' in props && props.formProps)
    // @ts-ignore -- vue-tsc TS2590: union too complex under unbound generics in the
    // app program only; remove when vue-tsc materializes this. plans/11
    return props.formProps
  const current = action.value!
  return {
    fields: current.fields,
    initialData: current.initialData,
    load: current.load,
    id: current.id,
    resource: current.resource,
    searchParameters: current.searchParameters,
    schema: toRaw(current.schema as object) as FormProps['schema'],
    validators: toRaw(current.validators as object) as FormProps['validators'],
    context: current.context,
    namespace: current.namespace,
    submit: current.run,
  } as FormProps
})

const emit = defineEmits<{
  (event: 'submitted', result: unknown): void
  (event: 'error', error: SubmitError): void
}>()

async function submitted(result: unknown) {
  if (!result || typeof result !== 'object') return
  const record = result as Record<string, unknown>
  emit('submitted', record)
  const current = action.value
  if (!current) return

  const successMessage = current.successMessage === undefined ? 'Changes saved.' : current.successMessage
  if (successMessage) toast.success(successMessage)
  let handled = false
  const navigate = async (to: RouteLocationRaw) => {
    handled = true
    allowNextLeave.value = true
    try {
      const navigation = await router.replace(to)
      if (navigation) allowNextLeave.value = false
    } catch (error) {
      allowNextLeave.value = false
      throw error
    }
  }
  const actionTarget = current.defaultTo
  const defaultTo = typeof actionTarget === 'function' ? actionTarget(record) : actionTarget
  const hasId = 'id' in props && props.id !== undefined
  const context: FormSubmissionContext<Record<string, unknown>, RecordIdentity> = {
    record,
    id: (hasId ? props.id : record.id) as RecordIdentity,
    operation: hasId ? 'update' : 'create',
    defaultTo,
    navigate,
    preventDefaultNavigation: () => { handled = true },
  }
  try {
    await current.afterSubmit?.(context)
    if (!handled && context.defaultTo) await navigate(context.defaultTo)
  } catch {
    toast.error('Changes saved, but the next action could not be completed.')
  }
}

const instance = ref<{ submit: () => Promise<void>; reset: () => void; submitting: boolean; validating: boolean; dirty: boolean; inputPending: boolean } | null>(null)
const discardDialogOpen = ref(false)
const allowNextLeave = ref(false)
let resolvePendingLeave: ((allow: boolean) => void) | undefined

function settlePendingLeave(allow: boolean) {
  const resolve = resolvePendingLeave
  resolvePendingLeave = undefined
  discardDialogOpen.value = false
  resolve?.(allow)
}

onBeforeRouteLeave(() => {
  if (allowNextLeave.value) {
    allowNextLeave.value = false
    return true
  }
  if (!instance.value?.dirty) return true

  discardDialogOpen.value = true
  return new Promise<boolean>((resolve) => {
    resolvePendingLeave = resolve
  })
})

function beforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  watch(
    () => instance.value?.dirty ?? false,
    (dirty) => {
      if (dirty) window.addEventListener('beforeunload', beforeUnload)
      else window.removeEventListener('beforeunload', beforeUnload)
    },
    { immediate: true },
  )
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  settlePendingLeave(false)
})
</script>

<template>
  <section class="is-form-view flex flex-col gap-2">
    <NavigationHeader :title="title" :description="description">
      <template v-if="$slots.header" #header><slot name="header" /></template>
      <template v-if="$slots.controls" #controls><slot name="controls" /></template>
    </NavigationHeader>

    <Card variant="outlined" color="surfaceContainer" class="p-0">
      <div class="p-5 sm:p-6">
        <slot name="body" v-bind="{ form: surface }">
          <Form
            ref="instance"
            v-bind="surface"
            @submitted="submitted"
            @error="emit('error', $event)"
          >
            <template v-for="(_, name) in $slots" #[name]="slotProps" :key="name">
              <slot :name="name" v-bind="slotProps ?? {}" />
            </template>
            <template #actions="actions">
              <slot
                name="form-actions"
                :submit="() => instance?.submit()"
                :reset="() => instance?.reset()"
                :input-pending="actions.inputPending"
              >
                <div class="is-form-view-controls flex flex-col gap-2 border-t border-outline-variant pt-5 sm:flex-row sm:justify-end">
                  <Button type="button" variant="text" class="w-full sm:w-auto" :disabled="instance?.submitting || instance?.validating" @click="router.back()">Cancel</Button>
                  <Button type="submit" class="w-full sm:w-auto" :disabled="instance?.submitting || instance?.validating || actions.inputPending">{{ instance?.submitting ? resolvedSubmittingLabel : resolvedSubmitLabel }}</Button>
                </div>
              </slot>
            </template>
          </Form>
        </slot>
      </div>
    </Card>

    <Dialog v-model="discardDialogOpen" @close="settlePendingLeave(false)">
      <template #trigger><button type="button" class="sr-only" aria-hidden="true" tabindex="-1">Open discard changes dialog</button></template>
      <template #title>Discard unsaved changes?</template>
      <template #description>You have unsaved changes. If you leave now, they will be lost.</template>
      <template #footer>
        <Button type="button" variant="text" @click="settlePendingLeave(false)">Stay</Button>
        <Button type="button" color="error" @click="settlePendingLeave(true)">Discard changes</Button>
      </template>
    </Dialog>

    <footer>
      <slot name="footer" />
    </footer>
  </section>
</template>
