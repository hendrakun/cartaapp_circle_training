import { inject, type InjectionKey } from 'vue'
import { toInputAssetValue } from '../components/inputs/assetValue'

export interface InputPropsResolutionContext {
  field?: { key: string; label?: string }
  props?: Record<string, unknown>
}

export interface InputValueAdapter {
  /** Converts a loaded submitted value into the control value. */
  hydrate: (value: unknown) => unknown
}

export type InputValueValidator = (value: unknown, context: InputPropsResolutionContext) => string | undefined

export interface InputPropsAdapter<TSource = never, TProps extends Record<string, unknown> = Record<string, unknown>> {
  defaults?: Readonly<Partial<TProps>>
  normalize?: (source: TSource, context: InputPropsResolutionContext) => Readonly<Partial<TProps>>
  value?: InputValueAdapter
  validate?: InputValueValidator
}

type AdapterMap = Record<string, InputPropsAdapter<any, any>>

export interface InputPropsRegistry {
  resolve: (renderer: string, input: {
    source?: unknown
    props?: Record<string, unknown>
    context?: InputPropsResolutionContext
  }) => Record<string, unknown>
  hydrate: (renderer: string, value: unknown) => unknown
  contract: (renderer: string) => InputValueContract
}

export interface InputValueContract {
  validate?: InputValueValidator
}

function objectResult(value: unknown, renderer: string, field?: string): Record<string, unknown> {
  const suffix = field ? ` on field "${field}"` : ''
  const prototype = value && typeof value === 'object' ? Object.getPrototypeOf(value) : undefined
  if (
    !value
    || typeof value !== 'object'
    || Array.isArray(value)
    || typeof (value as { then?: unknown }).then === 'function'
    || (prototype !== Object.prototype && prototype !== null)
  ) {
    throw new Error(`[loom] Input props normalizer for "${renderer}"${suffix} must synchronously return a plain object.`)
  }
  return value as Record<string, unknown>
}

function empty(value: unknown): boolean {
  return value === undefined || value === null || value === ''
}

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function numberValidate(value: unknown): string | undefined {
  if (empty(value)) return undefined
  return typeof value === 'number' && Number.isFinite(value) ? undefined : 'Expected a finite number.'
}

function assetValidate(value: unknown, context: InputPropsResolutionContext): string | undefined {
  if (empty(value) || (context.props?.multi === true && Array.isArray(value) && value.length === 0)) return undefined
  const valid = context.props?.multi === true
    ? Array.isArray(value) && value.every((entry) => Boolean(toInputAssetValue(entry)))
    : Boolean(toInputAssetValue(value))
  return valid ? undefined : context.props?.multi === true ? 'Expected an array of uploaded assets.' : 'Expected an uploaded asset.'
}

function lookupValidate(value: unknown, context: InputPropsResolutionContext): string | undefined {
  if (context.props?.multi !== true || empty(value) || (Array.isArray(value) && value.length === 0)) return undefined
  return Array.isArray(value) && value.every(plainRecord) ? undefined : 'Expected an array of lookup records.'
}

const builtInAdapters: Record<string, InputPropsAdapter> = {
  number: { validate: numberValidate },
  file: {
    validate: assetValidate,
  },
  image: {
    validate: assetValidate,
  },
  lookup: {
    validate: lookupValidate,
  },
}

export function createInputPropsRegistry(adapters: AdapterMap): InputPropsRegistry {
  const copied = new Map<string, InputPropsAdapter>(Object.entries({ ...builtInAdapters, ...adapters }).map(([key, adapter]) => [key, {
    ...builtInAdapters[key],
    ...adapter,
    ...(adapter.defaults ? { defaults: { ...adapter.defaults } } : {}),
    ...(adapter.value ? { value: { ...adapter.value } } : {}),
  }]))
  const resolve: InputPropsRegistry['resolve'] = (renderer, input) => {
    const adapter = copied.get(renderer)
    const context = input.context ?? {}
    const field = context.field?.key
    const hasSource = Object.prototype.hasOwnProperty.call(input, 'source')
    if (!adapter) {
      if (hasSource) throw new Error(`[loom] Input props renderer "${renderer}"${field ? ` on field "${field}"` : ''} has no source normalizer.`)
      return { ...(input.props ?? {}) }
    }
    const defaults = adapter.defaults ? { ...adapter.defaults } : {}
    if (!hasSource) return { ...defaults, ...(input.props ?? {}) }
    if (!adapter.normalize) throw new Error(`[loom] Input props renderer "${renderer}"${field ? ` on field "${field}"` : ''} has no source normalizer.`)
    const normalized = objectResult((adapter.normalize as (source: unknown, context: InputPropsResolutionContext) => unknown)(input.source, context), renderer, field)
    return { ...defaults, ...normalized, ...(input.props ?? {}) }
  }
  const hydrate: InputPropsRegistry['hydrate'] = (renderer, value) => copied.get(renderer)?.value?.hydrate(value) ?? value
  const contract: InputPropsRegistry['contract'] = (renderer) => {
    const adapter = copied.get(renderer)
    return adapter?.validate ? { validate: adapter.validate } : {}
  }
  return { resolve, hydrate, contract }
}

export function emptyInputPropsRegistry(): InputPropsRegistry {
  return createInputPropsRegistry({})
}

export const inputPropsRegistryKey: InjectionKey<InputPropsRegistry> = Symbol.for('loom-input-props')

export function useInputPropsRegistry(): InputPropsRegistry {
  const registry = inject(inputPropsRegistryKey)
  if (!registry) throw new Error('[loom] FrameworkPlugin is not installed.')
  return registry
}
