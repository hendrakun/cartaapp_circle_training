<script setup lang="ts">
/**
 * Draft core.
 *
 * Owns mutable draft state, field rendering, validation, optional initial-data
 * loading, and submission. It does not know whether the behavior it was given
 * creates, updates, or runs another workflow: there is no mode. The factory
 * that wired `submit` also wired the matching schema (plan 006).
 *
 * Field behavior is applied here as reactive wiring only: each declared
 * function is one computed over the draft, hidden fields contribute no value to
 * the submitted draft, and validation runs on the visibility-filtered draft.
 */
import { computed, getCurrentInstance, nextTick, onUnmounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import type { FormProps, FormValidationTrigger, RecordLoadContext, SubmitError, ValidationIssue } from '../../contracts'
import { createBehaviorRuntime, resolveFields, useFrameworkFieldDefaults } from '../../fields'
import { inferFieldLayers, validateDraftAsync, validatorDefinition, validatorsForTrigger } from '../../validation'
import { useLoader } from '../../query'
import { useFrameworkAdapters } from '../../adapters/projectAdapters'
import { useRendererRegistry } from '../../renderers/registry'
import { useInputPropsRegistry } from '../../renderers/inputProps'
import Button from '../base/Button.vue'
import { assertSingleDataSource, instanceIdentity, recordCacheKey } from './useCoreData'
import { getSchemaKind } from '../../fields/schemaMetadata'
import { useFrameworkUiDefaults } from '../views/uiDefaults'

const props = withDefaults(defineProps<FormProps>(), {
  searchParameters: () => ({}),
  disabled: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: Record<string, unknown>): void
  (event: 'submitted', result: unknown): void
  (event: 'error', error: SubmitError): void
  (event: 'reset'): void
}>()

const vnodeProps = getCurrentInstance()?.vnode.props ?? {}
const hasModelValue = 'modelValue' in vnodeProps
const hasModelListener = 'onUpdate:modelValue' in vnodeProps
/** Binding presence, rather than model value, selects model-bound operation. */
const isModelBound = hasModelValue || hasModelListener
const isDevelopment = (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV !== 'production'
if (isDevelopment && isModelBound && (!hasModelValue || !hasModelListener)) {
  console.warn('[loom] Form model-bound operation needs both modelValue and onUpdate:modelValue.')
}

const adapters = useFrameworkAdapters()
const renderers = useRendererRegistry('form')
const fieldDefaults = useFrameworkFieldDefaults()
const inputProps = useInputPropsRegistry()
const { submitLabel: defaultSubmitLabel } = useFrameworkUiDefaults()

const fields = computed(() => {
  const schema = props.schema as { source?: Parameters<typeof inferFieldLayers>[0] } | undefined
  return resolveFields({
    fields: props.fields,
    surface: 'form',
    defaults: fieldDefaults.form,
    defaultFields: fieldDefaults.fields,
    schema: schema?.source ? inferFieldLayers(schema.source) : undefined,
  })
})
const fallbackOwner = instanceIdentity('form')
const owner = computed(() => props.resource ?? props.namespace ?? fallbackOwner)
const formInitialValues: Record<string, unknown> = {}
for (const field of fields.value) {
  if (field.initialValue) formInitialValues[field.key] = field.initialValue()
}

function withInitialValues(value: Record<string, unknown>) {
  return { ...formInitialValues, ...value }
}

function hydrateValues(value: Record<string, unknown>) {
  const result = { ...value }
  for (const field of fields.value) {
    if (!field.renderer || !Object.prototype.hasOwnProperty.call(result, field.key)) continue
    result[field.key] = inputProps.hydrate(field.renderer, result[field.key])
  }
  return result
}

const loaded = useLoader<RecordLoadContext, Partial<Record<string, unknown>> | undefined>({
  key: computed(() => recordCacheKey(owner.value, props.id, 'form', props.namespace, props.searchParameters ?? {})),
  context: computed(() => ({ id: props.id, searchParameters: props.searchParameters ?? {} })),
  load: computed(() => (isModelBound ? undefined : props.load)),
})

const startingValues = isModelBound ? props.modelValue ?? {} : props.initialData ?? {}
const draft = reactive<Record<string, unknown>>(hydrateValues(withInitialValues(startingValues)))
const edited = reactive(new Set<string>())
const touched = reactive<Record<string, boolean>>({})
const issues = ref<ValidationIssue[]>([])
const submitting = ref(false)
const validating = ref(false)
const validatingPaths = ref(new Set<string>())
const submitAttempted = ref(false)
const modelBaseline = ref<Record<string, unknown>>(hydrateValues(withInitialValues(props.modelValue ?? {})))
const initial = ref<Record<string, unknown>>(hydrateValues(withInitialValues(isModelBound ? props.modelValue ?? {} : props.initialData ?? {})))
const lastEmittedModel = ref<Record<string, unknown>>()
let validationController: AbortController | undefined
let validationRun = 0

function shallowEqual(left: Record<string, unknown>, right: Record<string, unknown>) {
  const leftKeys = Object.keys(left)
  return leftKeys.length === Object.keys(right).length && leftKeys.every((key) => Object.is(left[key], right[key]))
}

function replaceDraft(value: Record<string, unknown>) {
  for (const key of Object.keys(draft)) delete draft[key]
  Object.assign(draft, value)
}

function emitModel() {
  if (!isModelBound) return
  const next = { ...draft }
  lastEmittedModel.value = next
  emit('update:modelValue', next)
}

watch(
  () => props.modelValue,
  (value) => {
    if (!isModelBound) return
    const next = hydrateValues(withInitialValues(value ?? {}))
    if (lastEmittedModel.value && shallowEqual(next, lastEmittedModel.value) && shallowEqual(next, draft)) return
    replaceDraft(next)
    modelBaseline.value = { ...next }
    initial.value = { ...next }
    edited.clear()
    issues.value = []
  },
  { immediate: true },
)

/** Loaded values override initial values; user edits override both. */
watch(
  () => loaded.data.value,
  (value) => {
    if (!value) return
    for (const [key, next] of Object.entries(hydrateValues(value))) {
      if (edited.has(key)) continue
      draft[key] = next
      initial.value[key] = next
    }
  },
  { immediate: true },
)

const behavior = createBehaviorRuntime({
  fields: fields.value,
  draft,
  context: props.context,
  resolveBaseProps: (field, renderer) => inputProps.resolve(renderer, {
    ...(field.source !== undefined ? { source: field.source } : {}),
    props: field.props,
    context: { field: { key: field.key, label: field.label } },
  }),
})
behavior.connect((key, value) => {
  draft[key] = value
  edited.delete(key)
  emitModel()
})

const hiddenKeys = computed(() => fields.value.map((field) => field.key).filter((key) => !behavior.visibleKeys.value.includes(key)))
const visibleFields = computed(() => fields.value.filter((field) => behavior.state(field.key).value.visible))
const dirty = computed(() => (isModelBound ? !shallowEqual(draft, modelBaseline.value) : edited.size > 0))
const displayedIssues = computed(() => issues.value.filter((issue) => issue.path.length === 0 || submitAttempted.value || touched[String(issue.path[0])]))
function issueFor(key: string) {
  return displayedIssues.value.find((issue) => issue.path[0] === key)?.message
}

function isRequired(key: string) {
  return behavior.state(key).value.props.required === true
}

function rendererFor(key: string, fallback?: string): string | undefined {
  const renderer = behavior.state(key).value.renderer
  return renderer === undefined ? fallback : renderer ?? undefined
}

function assertInputSchemaCompatibility(
  key: string,
  renderer: string,
  props: Record<string, unknown>,
  schemaKind: ReturnType<typeof getSchemaKind>,
  hasWriter: boolean,
) {
  const isMultiSelection = (renderer === 'lookup' || renderer === 'select') && props.multi === true
  if (isMultiSelection) {
    if (hasWriter || schemaKind !== 'selection[]') {
      throw new Error(`[loom] Multi ${renderer} field "${key}" requires selectionValues(itemSchema) and no form.write.`)
    }
    return
  }
  if (hasWriter || schemaKind === undefined || schemaKind === 'unknown') return
  const compatible = renderer === 'number'
    ? schemaKind === 'number'
    : renderer === 'image'
      ? props.multi === true ? schemaKind === 'object[]' || schemaKind === 'array' : schemaKind === 'object'
      : true
  if (compatible) return
  throw new Error(`[loom] Field "${key}" uses renderer "${renderer}" with schema kind "${schemaKind}". Add form.write for the submitted value conversion.`)
}

function inputContractFor(current: (typeof fields.value)[number]) {
  const resolvedProps = behavior.state(current.key).value.props
  const contract = current.renderer
    ? inputProps.contract(current.renderer)
    : undefined
  if (current.renderer) assertInputSchemaCompatibility(
    current.key,
    current.renderer,
    resolvedProps,
    getSchemaKind(current),
    current.write !== undefined,
  )
  return { resolvedProps, contract }
}

function setValue(key: string, value: unknown) {
  const field = fields.value.find((entry) => entry.key === key)
  if (field?.behavior?.derived) return
  edited.add(key)
  draft[key] = value
  emitModel()
}

async function validate(trigger: FormValidationTrigger = 'submit', field?: string) {
  validationController?.abort()
  const controller = new AbortController()
  validationController = controller
  const run = ++validationRun
  validating.value = true
  const paths = new Set<string>()
  for (const validator of validatorsForTrigger(props.validators ?? [], trigger)) {
    const path = validatorDefinition(validator).path?.[0]
    if (path !== undefined) paths.add(String(path))
  }
  validatingPaths.value = paths
  behavior.settle()
  const payload = behavior.visibleDraft.value as Record<string, unknown>
  try {
    const fieldIssues: ValidationIssue[] = []
    for (const current of visibleFields.value) {
      if (field !== undefined && current.key !== field) continue
      const value = payload[current.key]
      const { resolvedProps, contract } = inputContractFor(current)
      if (value === undefined || value === null || value === '') continue
      const validateValue = current.validate ?? contract?.validate
      if (!validateValue) continue
      const message = validateValue(value, { ...(props.context ?? {}), field: { key: current.key, label: current.label }, props: resolvedProps })
      if (message) fieldIssues.push({ path: [current.key], message })
    }
    if (fieldIssues.length) {
      const result = { success: false as const, issues: fieldIssues }
      if (run === validationRun && !controller.signal.aborted) issues.value = result.issues
      return result
    }

    const validatedDraft = { ...payload }
    for (const current of visibleFields.value) {
      const { resolvedProps } = inputContractFor(current)
      const writeValue = current.write
      const value = validatedDraft[current.key]
      if (writeValue && Object.prototype.hasOwnProperty.call(validatedDraft, current.key)) {
        validatedDraft[current.key] = writeValue(value, { ...(props.context ?? {}), field: { key: current.key, label: current.label }, props: resolvedProps })
      }
    }
    const validation = await validateDraftAsync({
      schema: props.schema,
      draft: payload,
      validatedDraft,
      hiddenKeys: hiddenKeys.value,
      validators: props.validators,
      trigger,
      initial: initial.value,
      context: props.context ?? {},
      field,
      signal: controller.signal,
      settle: behavior.settle,
    })
    if (run === validationRun && !controller.signal.aborted) issues.value = validation.success ? [] : validation.issues
    return validation
  } finally {
    if (run === validationRun) {
      validating.value = false
      validatingPaths.value = new Set()
    }
  }
}

function touch(key: string) {
  touched[key] = true
  void validate('blur', key)
}

watch(hiddenKeys, (keys) => {
  const hidden = new Set(keys)
  issues.value = issues.value.filter((issue) => !hidden.has(String(issue.path[0])))
  for (const key of hidden) delete touched[key]
})

async function focusFirstInvalid() {
  await nextTick()
  const key = displayedIssues.value.map((issue) => String(issue.path[0])).find((entry) => entry !== 'undefined' && !hiddenKeys.value.includes(entry))
  if (!key) return
  const element = document.getElementById(`field-${key}`)
  element?.scrollIntoView?.({ block: 'nearest' })
  element?.focus?.()
}

function reset() {
  if (isModelBound) {
    replaceDraft({ ...modelBaseline.value })
    emitModel()
  } else replaceDraft(hydrateValues({ ...formInitialValues, ...props.initialData, ...loaded.data.value }))
  edited.clear()
  issues.value = []
  submitAttempted.value = false
  emit('reset')
}

async function submit() {
  if (props.disabled || submitting.value || validating.value) return
  issues.value = []
  submitAttempted.value = true

  const validation = await validate('submit')
  if (!validation.success) {
    for (const issue of displayedIssues.value.filter((entry) => entry.path.length === 0)) toast.error(issue.message)
    await focusFirstInvalid()
    return
  }

  const submitTarget = props.submit
  if (!submitTarget) {
    throw new Error('[loom] Form needs submit unless it is bound with v-model.')
  }

  submitting.value = true
  try {
    const result = await (typeof submitTarget === 'function'
      ? submitTarget(validation.data as Record<string, unknown>)
      : submitTarget.run(validation.data as Record<string, unknown>))
    emit('submitted', result)
  } catch (error) {
    const normalized = (props.normalizeError ?? adapters.data.normalizeError)(error)
    if (normalized.issues) issues.value = normalized.issues
    toast.error(normalized.message)
    emit('error', normalized)
  } finally {
    submitting.value = false
  }
}

onUnmounted(() => validationController?.abort())

defineExpose({ draft, reset, submit, refresh: loaded.refresh, dirty, submitting, validating })
</script>

<template>
  <form novalidate class="flex flex-col gap-5" @submit.prevent="submit">
    <slot v-if="loaded.loading.value" name="loading">
      <div class="rounded-lg bg-surface-container px-4 py-3 text-sm text-on-surface">
        <p role="status" aria-live="polite">Loading…</p>
      </div>
    </slot>

    <template v-else-if="loaded.error.value">
      <slot name="load-error" :error="loaded.error.value" :refresh="loaded.refresh">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-error-container px-4 py-3 text-on-error-container">
          <p role="alert" class="text-sm leading-5">{{ loaded.error.value.message }}</p>
          <Button type="button" variant="text" class="min-w-0 px-4" @click="loaded.refresh">Retry</Button>
        </div>
      </slot>
    </template>

    <template v-else>
      <div class="grid grid-cols-12 gap-x-4 gap-y-5">
      <div
        v-for="field in visibleFields"
        :key="field.key"
        class="is-form-field flex min-w-0 flex-col gap-2"
        :style="{ gridColumn: `span ${Math.min(12, Math.max(1, (behavior.state(field.key).value.span === undefined ? field.span : behavior.state(field.key).value.span) ?? 12))} / span ${Math.min(12, Math.max(1, (behavior.state(field.key).value.span === undefined ? field.span : behavior.state(field.key).value.span) ?? 12))}` }"
      >
        <label :for="`field-${field.key}`" class="text-sm font-medium leading-5 text-on-surface">
          {{ behavior.state(field.key).value.label === undefined ? field.label : behavior.state(field.key).value.label ?? field.key }}
          <span v-if="isRequired(field.key)" class="text-error" aria-hidden="true">*</span>
        </label>

        <slot
          :name="`input:${field.key}`"
          :value="draft[field.key]"
          :draft="draft"
          :field="field"
          :set-value="(value: unknown) => setValue(field.key, value)"
          :error="issueFor(field.key)"
          :touched="touched[field.key] ?? false"
          :disabled="props.disabled || behavior.state(field.key).value.disabled"
          :validating="validatingPaths.has(field.key)"
          :form-validating="validating"
        >
          <component
            :is="renderers.require(rendererFor(field.key, field.renderer)!)"
            v-if="rendererFor(field.key, field.renderer)"
            :key="rendererFor(field.key, field.renderer)"
            :id="`field-${field.key}`"
            v-bind="behavior.state(field.key).value.props"
            :value="draft[field.key]"
            :draft="draft"
            :field="field"
            :set-value="(value: unknown) => setValue(field.key, value)"
            :error="issueFor(field.key)"
            :touched="touched[field.key] ?? false"
            :disabled="props.disabled || behavior.state(field.key).value.disabled"
            :validating="validatingPaths.has(field.key)"
            :form-validating="validating"
            :aria-invalid="issueFor(field.key) ? 'true' : undefined"
            :aria-required="isRequired(field.key) ? 'true' : undefined"
            :aria-describedby="issueFor(field.key) ? `error-${field.key}` : undefined"
            @validation:touch="touch(field.key)"
          />
          <input
            v-else
            :id="`field-${field.key}`"
            :value="draft[field.key] ?? ''"
            :disabled="props.disabled || behavior.state(field.key).value.disabled"
            :aria-invalid="issueFor(field.key) ? 'true' : undefined"
            :aria-required="isRequired(field.key) ? 'true' : undefined"
            :aria-describedby="issueFor(field.key) ? `error-${field.key}` : undefined"
            :class="[
              'min-h-12 w-full rounded-lg bg-transparent px-4 py-3 text-on-surface outline outline-1 outline-outline/[24%] transition-[outline-color,box-shadow] duration-150 ease-out focus:outline-secondary focus:ring-1 focus:ring-secondary/30',
              issueFor(field.key) ? 'outline-error focus:outline-error focus:ring-error/30' : '',
              props.disabled || behavior.state(field.key).value.disabled ? 'cursor-not-allowed text-on-surface-variant opacity-60' : '',
            ]"
            @input="setValue(field.key, ($event.target as HTMLInputElement).value)"
            @blur="touch(field.key)"
          />
        </slot>

        <p v-if="issueFor(field.key)" :id="`error-${field.key}`" role="alert" class="text-sm leading-5 text-error">{{ issueFor(field.key) }}</p>
      </div>
      </div>

      <slot name="actions" :submit="submit" :reset="reset" :submitting="submitting" :dirty="dirty">
        <Button v-if="!isModelBound" type="submit" :disabled="props.disabled || loaded.loading.value || validating || submitting">
          {{ submitting ? (props.submittingLabel ?? props.submitLabel ?? defaultSubmitLabel) : (props.submitLabel ?? defaultSubmitLabel) }}
        </Button>
      </slot>
    </template>
  </form>
</template>
