/**
 * Core component prop contracts.
 *
 * `Table`, `Detail`, and `Form` are resource-agnostic: they own data and field
 * orchestration only. Cards, headings, toolbars, and page actions belong
 * to the view shells (plan 005). Form owns draft state, rendering, validation,
 * and submission — it never learns whether it creates or updates.
 *
 * Plan 004 implements the components against exactly these props.
 *
 * `data` and `load` are alternatives: `data` means the caller controls the
 * data, `load` means the component owns loading. Supplying both is a
 * development error reported at runtime.
 */

import type { CollectionLoadContext, Load, RecordIdentity, RecordLoadContext, MaybePromise } from './load'
import type { FieldContext, FieldsInput } from './fields'
import type { CollectionMeta, CollectionResult, RecordResult } from './results'
import type { QueryNamespace, QueryValues } from './query'
import type { FormValidatorInput, SubmitError, ValidationSchema } from './validation'

export interface CollectionProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> {
  data?: TRecord[]
  load?: Load<CollectionLoadContext<TQuery>, CollectionResult<TRecord>>
  searchParameters?: Record<string, unknown>
  resource?: string
  namespace?: QueryNamespace
  query?: TQuery
  pagination?: 'auto' | 'always' | false
  pageSizeOptions?: readonly number[]
  defaultPageSize?: number
  reorderable?: boolean
}

export interface CollectionSlotProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> {
  records: TRecord[]
  meta?: CollectionMeta
  loading: boolean
  error?: SubmitError
  empty: boolean
  query: TQuery
  refresh: () => Promise<void>
  updateQuery: (patch: QueryValues) => void
}

export interface TableProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> extends CollectionProps<TRecord, TQuery> {
  fields: FieldsInput<TRecord>
  /** Minimum resizable width in pixels. */
  minColumnWidth?: number
  /** Controlled visible data-column keys. */
  visibleColumns?: readonly string[]
  /** Controlled data-column widths in pixels. */
  columnSizing?: Readonly<Record<string, number>>
  rowKey?: string | ((record: TRecord) => string | number)
  schema?: ValidationSchema<TQuery>
}

export interface TreeTableProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> extends Omit<TableProps<TRecord, TQuery>, 'reorderable'> {
  children: (record: TRecord) => readonly TRecord[]
  treeColumn: string
}

export interface TableContentProps<
  TRecord extends object = Record<string, unknown>,
  TQuery extends object = Record<string, unknown>,
> extends Omit<TableProps<TRecord, TQuery>, 'data' | 'load' | 'query'> {
  records: TRecord[]
  meta?: CollectionMeta
  loading: boolean
  error?: SubmitError
  empty: boolean
  query: TQuery
  /** Collection refresh action exposed to a ready custom collection slot. */
  refresh?: () => Promise<void>
  /** Collection query action exposed to a ready custom collection slot. */
  updateQuery?: (patch: QueryValues) => void
}

export interface RowReorderPayload<TRecord extends object = Record<string, unknown>> {
  rows: TRecord[]
  oldIndex: number
  newIndex: number
  moved: TRecord
  query: QueryValues
}

export interface DetailProps<TRecord extends object = Record<string, unknown>> {
  fields: FieldsInput<TRecord>
  id?: RecordIdentity
  data?: TRecord
  load?: Load<RecordLoadContext, RecordResult<TRecord>>
  searchParameters?: Record<string, unknown>
  resource?: string
  /** View identity below the resource and record cache owner. */
  namespace?: QueryNamespace
}

export type FormSubmitHandler<TInput extends object = Record<string, unknown>, TResult = unknown> = (
  draft: TInput,
) => MaybePromise<TResult>

/**
 * Structural submit target: any object exposing `run(draft)` — e.g. a resource
 * action bag — is accepted without importing resources here.
 */
export interface FormSubmitAction<TInput extends object = Record<string, unknown>> {
  run(input: TInput): MaybePromise<unknown>
}

export interface FormPropsBase<TInput extends object = Record<string, unknown>, TResult = unknown> {
  fields: FieldsInput<TInput, TInput>
  /** Prefilled values; loaded values override these, and user edits override both. */
  initialData?: Partial<TInput>
  load?: Load<RecordLoadContext, Partial<TInput> | undefined>
  id?: RecordIdentity
  searchParameters?: Record<string, unknown>
  resource?: string
  /** Validates the visibility-filtered draft before submission. */
  schema?: ValidationSchema<TInput>
  /** Sync or async rules composed after successful schema validation. */
  validators?: readonly FormValidatorInput<TInput>[]
  /** Stable caller-owned information made available to behavior and validators. */
  context?: FieldContext
  /** Normalizes a rejected submission into field-level issues. */
  normalizeError?: (error: unknown) => SubmitError
  /** View identity for the optional initial-data load. */
  namespace?: QueryNamespace
  /** Renders every input read-only. */
  disabled?: boolean
  /** Local submit label override for the default action. */
  submitLabel?: string
  /** Optional label shown while the default action runs. */
  submittingLabel?: string
}

/** Normal Form operation. Submission is supplied by its resource or caller. */
export interface FormSubmitProps<TInput extends object = Record<string, unknown>, TResult = unknown>
  extends FormPropsBase<TInput, TResult> {
  /** A plain draft handler or a structural `{ run(draft) }` action bag. */
  submit: FormSubmitHandler<TInput, TResult> | FormSubmitAction<TInput>
  modelValue?: never
}

/**
 * A present `v-model` puts Form in model-bound operation. No separate mode
 * flag is needed; its value may still be `undefined` during initialization.
 */
export interface FormModelProps<TInput extends object = Record<string, unknown>, TResult = unknown>
  extends FormPropsBase<TInput, TResult> {
  modelValue: Partial<TInput> | undefined
  /** A plain draft handler or a structural `{ run(draft) }` action bag. */
  submit?: FormSubmitHandler<TInput, TResult> | FormSubmitAction<TInput>
}

export type FormProps<TInput extends object = Record<string, unknown>, TResult = unknown> =
  | FormSubmitProps<TInput, TResult>
  | FormModelProps<TInput, TResult>

export type DialogFormCloseReason = 'cancel' | 'dismiss'

export interface DialogFormCloseContext {
  reason: DialogFormCloseReason
  dirty: boolean
  submitting: boolean
  validating: boolean
}

/**
 * Core Form props plus dialog lifecycle and presentation policy.
 *
 * The default `v-model` remains Form draft data. Dialog visibility uses the
 * separate named `v-model:open` declared by DialogForm.
 */
export type DialogFormProps<
  TInput extends object = Record<string, unknown>,
  TResult = unknown,
> = FormProps<TInput, TResult> & {
  title?: string
  description?: string
  closeOnSubmitted?: boolean
  beforeClose?: (context: DialogFormCloseContext) => MaybePromise<boolean>
  cancelLabel?: string
  submitLabel?: string
  submittingLabel?: string
  /**
   * Resource action bags bind directly (`v-bind="resource.create()"`); when
   * `submit` is absent, `run` is forwarded to Form as the submit target.
   */
  run?: FormSubmitHandler<TInput, TResult> | FormSubmitAction<TInput>
}
