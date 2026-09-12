import type {
  FieldDefinition,
  FieldDetailProjection,
  FieldDisplayProjection,
  FieldFormProjection,
  FieldRead,
  FieldTableProjection,
  FieldWrite,
  FieldValidate,
  FieldReference,
  WebResourceCreateOf,
  WebResourceRecordOf,
  WebResourceSchemaBoundary,
  WebResourceUpdateOf,
} from '../contracts'
import type { InputAssetValue } from '../components/inputs/assetValue'

type ObjectPart<T> = [T] extends [object] ? T : Record<string, never>
type RecordPart<TSchema> = ObjectPart<WebResourceRecordOf<TSchema>>
type CreatePart<TSchema> = ObjectPart<WebResourceCreateOf<TSchema>>
type UpdatePart<TSchema> = ObjectPart<WebResourceUpdateOf<TSchema>>
type RecordKeys<TSchema> = Extract<keyof RecordPart<TSchema>, string>
type CreateKeys<TSchema> = Extract<keyof CreatePart<TSchema>, string>
type UpdateKeys<TSchema> = Extract<keyof UpdatePart<TSchema>, string>
type SchemaFieldKey<TSchema> = RecordKeys<TSchema> | CreateKeys<TSchema> | UpdateKeys<TSchema>

type DraftForKey<TSchema, TKey extends string> =
  | (TKey extends CreateKeys<TSchema> ? CreatePart<TSchema> : never)
  | (TKey extends UpdateKeys<TSchema> ? UpdatePart<TSchema> : never)

type ValueOf<T, TKey extends string> = [T] extends [object]
  ? TKey extends keyof T ? T[TKey] : never
  : never

type ValueForKey<TSchema, TKey extends string> = [
  ValueOf<WebResourceRecordOf<TSchema>, TKey>
  | ValueOf<WebResourceCreateOf<TSchema>, TKey>
  | ValueOf<WebResourceUpdateOf<TSchema>, TKey>
] extends [never]
  ? unknown
  : ValueOf<WebResourceRecordOf<TSchema>, TKey>
    | ValueOf<WebResourceCreateOf<TSchema>, TKey>
    | ValueOf<WebResourceUpdateOf<TSchema>, TKey>

type FormProjectionBase<TDraft, TValue> = Omit<FieldFormProjection<TDraft, TValue>, 'renderer' | 'props' | 'validate' | 'write'>
  & {
    renderer?: string
    props?: Record<string, unknown>
    validate?: FieldValidate<TValue>
    write?: FieldWrite<TValue>
  }

type SelectionItem<TValue> = NonNullable<TValue> extends readonly (infer TItem)[]
  ? TItem extends object ? TItem : never
  : never
type SelectionKey<TValue> = Extract<keyof SelectionItem<TValue>, string>
type SelectionFormProjection<TDraft, TValue> = [SelectionItem<TValue>] extends [never] ? never :
  Omit<FormProjectionBase<TDraft, SelectionItem<TValue>[]>, 'write'> & {
    props: Record<string, unknown> & { multi: true; pick?: SelectionKey<TValue>; view?: SelectionKey<TValue> }
    validate?: FieldValidate<SelectionItem<TValue>[]>
  }

type NumberFormProjection<TDraft> = FormProjectionBase<TDraft, number> & {
  renderer: 'number'
}

type AssetFormProjection<TDraft> =
  | (Omit<FormProjectionBase<TDraft, InputAssetValue>, 'write'> & {
      renderer: 'file' | 'image'
      props?: Record<string, unknown> & { multi?: false | undefined }
      validate?: FieldValidate<InputAssetValue>
      write?: never
    })
  | (Omit<FormProjectionBase<TDraft, InputAssetValue[]>, 'write'> & {
      renderer: 'file' | 'image'
      props: Record<string, unknown> & { multi: true }
      validate?: FieldValidate<InputAssetValue[]>
      write?: never
    })

type LookupFormProjection<TDraft, TValue> =
  | (FormProjectionBase<TDraft, unknown> & { renderer: 'lookup'; props?: Record<string, unknown> & { multi?: false | undefined } })
  | (SelectionFormProjection<TDraft, TValue> & { renderer: 'lookup' })

type SelectFormProjection<TDraft, TValue> =
  | (FormProjectionBase<TDraft, unknown> & { renderer: 'select'; props?: Record<string, unknown> & { multi?: false | undefined } })
  | (SelectionFormProjection<TDraft, TValue> & { renderer: 'select' })

type KnownFormProjectionForKey<TDraft, TValue> =
  | NumberFormProjection<TDraft>
  | AssetFormProjection<TDraft>
  | LookupFormProjection<TDraft, TValue>
  | SelectFormProjection<TDraft, TValue>
  | {
      renderer?: never
      props?: Record<string, unknown>
      source?: unknown
      behavior?: FieldFormProjection<TDraft, TValue>['behavior']
      span?: number
      initialValue?: () => TValue
      validate?: FieldValidate<TValue>
      write?: FieldWrite<TValue>
    }

type AnyFormProjectionForKey<TDraft, TValue> =
  | KnownFormProjectionForKey<TDraft, TValue>
  | (FormProjectionBase<TDraft, unknown> & {
      renderer: string
      props?: Record<string, unknown> & { multi?: false | undefined }
    })

type IsMultiProps<TProps> = TProps extends object
  ? TProps extends { multi: infer TMulti }
    ? true extends TMulti ? true : false
    : false
  : false

type IsSelectionRenderer<TRenderer> = TRenderer extends 'lookup' | 'select'
  ? true
  : string extends TRenderer ? true : false

type IsAssetRenderer<TRenderer> = TRenderer extends 'file' | 'image' ? true : false

type SelectionFormGuard<TForm> = TForm extends { renderer: infer TRenderer }
  ? IsAssetRenderer<TRenderer> extends true
    ? TForm extends { write: unknown }
      ? never
      : unknown
    : IsSelectionRenderer<TRenderer> extends true
      ? TForm extends { props: infer TProps }
        ? IsMultiProps<TProps> extends true
          ? TForm extends { write: unknown }
            ? never
            : unknown
          : unknown
        : unknown
      : unknown
  : unknown

type SelectionDefinitionGuard<TDefinition> = TDefinition extends { form?: infer TForm }
  ? SelectionFormGuard<TForm>
  : unknown

type InferredFormProjectionForKey<TDraft, TValue> = {
  renderer?: never
  props?: Record<string, unknown>
  source?: unknown
  behavior?: FieldFormProjection<TDraft, TValue>['behavior']
  span?: number
  initialValue?: () => TValue
  validate?: FieldValidate<TValue>
  write?: FieldWrite<TValue>
}

type DisplayProjections<TSchema> = {
  display?: FieldDisplayProjection<RecordPart<TSchema>, unknown>
  table?: FieldTableProjection<RecordPart<TSchema>, unknown> | false
  detail?: FieldDetailProjection<RecordPart<TSchema>, unknown> | false
}

type DefinitionForKey<TSchema, TKey extends string, TFormProjection> = Omit<
  FieldDefinition<RecordPart<TSchema>, DraftForKey<TSchema, TKey>, ValueForKey<TSchema, TKey>>,
  'display' | 'table' | 'detail' | 'form'
> & DisplayProjections<TSchema> & { form?: TFormProjection | false }

type ComputedDefinition<TSchema> = Omit<FieldDefinition<RecordPart<TSchema>, never, unknown>, 'display' | 'form'> & {
  display: FieldDefinition<RecordPart<TSchema>, never, unknown>['display'] & {
    read: FieldRead<RecordPart<TSchema>, unknown>
  }
  form: false
}

type FieldReferences<TSchema, TDefinitions> = {
  [TKey in keyof TDefinitions]: TKey extends string
    ? FieldReference<TSchema, TKey, TKey extends SchemaFieldKey<TSchema>
      ? DefinitionForKey<TSchema, TKey, AnyFormProjectionForKey<DraftForKey<TSchema, TKey>, ValueForKey<TSchema, TKey>>>
      : ComputedDefinition<TSchema>>
    : never
}

type AnyFieldDefinition = FieldDefinition<any, any, any>

interface FieldReferenceState {
  schema: unknown
  key: string
  definition: AnyFieldDefinition
}

const fieldReferenceState = Symbol('loom.field-reference')

type StoredFieldReference = {
  readonly key: string
  readonly [fieldReferenceState]: FieldReferenceState
  readonly override?: (partialDefinition: AnyFieldDefinition) => StoredFieldReference
}

export interface FieldReferenceData {
  readonly schema: unknown
  readonly key: string
  readonly definition: AnyFieldDefinition
}

function cloneProjection<T extends object>(projection: T): T {
  const clone = { ...projection } as T & { props?: Record<string, unknown>; behavior?: Record<string, unknown> }
  if (clone.props) clone.props = { ...clone.props }
  if (clone.behavior) clone.behavior = { ...clone.behavior }
  return clone
}

function cloneDefinition(definition: AnyFieldDefinition): AnyFieldDefinition {
  const cloneSurface = <T extends object>(projection: T | false | undefined): T | false | undefined =>
    projection === false || projection === undefined ? projection : cloneProjection(projection)

  return {
    ...definition,
    display: definition.display ? cloneProjection(definition.display) : definition.display,
    table: cloneSurface(definition.table),
    detail: cloneSurface(definition.detail),
    form: cloneSurface(definition.form),
  }
}

function mergeDefinedProperties(
  base: Record<string, unknown> | undefined,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...(base ?? {}) }
  for (const [key, value] of Object.entries(patch)) if (value !== undefined) result[key] = value
  return result
}

function mergeProjection<T extends object>(
  base: T | false | undefined,
  patch: T | false | undefined,
): T | false | undefined {
  if (patch === undefined) return cloneSurface(base)
  if (patch === false) return false
  if (base === false || base === undefined) return cloneProjection(patch)

  const baseWithOptions = base as T & { props?: Record<string, unknown>; behavior?: Record<string, unknown> }
  const patchWithOptions = patch as T & { props?: Record<string, unknown>; behavior?: Record<string, unknown> }
  const result = { ...baseWithOptions } as T & { props?: Record<string, unknown>; behavior?: Record<string, unknown> }
  for (const [key, value] of Object.entries(patchWithOptions)) {
    if (value !== undefined && key !== 'props' && key !== 'behavior') {
      ;(result as Record<string, unknown>)[key] = value
    }
  }
  if (patchWithOptions.props !== undefined) result.props = mergeDefinedProperties(baseWithOptions.props, patchWithOptions.props)
  if (patchWithOptions.behavior !== undefined) result.behavior = mergeDefinedProperties(baseWithOptions.behavior, patchWithOptions.behavior)
  return result
}

function cloneSurface<T extends object>(projection: T | false | undefined): T | false | undefined {
  return projection === false || projection === undefined ? projection : cloneProjection(projection)
}

function mergeDefinition(base: AnyFieldDefinition, patch: AnyFieldDefinition): AnyFieldDefinition {
  const result = cloneDefinition(base)
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    if (key === 'display' || key === 'table' || key === 'detail' || key === 'form') continue
    ;(result as Record<string, unknown>)[key] = value
  }
  result.display = mergeProjection(base.display, patch.display) as AnyFieldDefinition['display']
  result.table = mergeProjection(base.table, patch.table)
  result.detail = mergeProjection(base.detail, patch.detail)
  result.form = mergeProjection(base.form, patch.form)
  return result
}

function createReference(
  schema: unknown,
  key: string,
  definition: AnyFieldDefinition,
  terminal: boolean,
): StoredFieldReference {
  const state: FieldReferenceState = { schema, key, definition: cloneDefinition(definition) }
  const reference: StoredFieldReference = {
    key,
    [fieldReferenceState]: state,
  }
  const value = terminal
    ? reference
    : { ...reference, override: (patch: AnyFieldDefinition) => createReference(schema, key, mergeDefinition(state.definition, patch), true) }
  return Object.freeze(value) as StoredFieldReference
}

/** Returns internal field data for resource resolution without making it public API. */
export function readFieldReference(value: unknown): FieldReferenceData | undefined {
  if (!value || typeof value !== 'object') return undefined
  const state = (value as Partial<StoredFieldReference>)[fieldReferenceState]
  return state ? state : undefined
}

type KnownDefinitions<TSchema extends WebResourceSchemaBoundary, TDefinitions extends object> = TDefinitions & {
  [TKey in keyof TDefinitions]: TKey extends string
    ? TKey extends SchemaFieldKey<TSchema>
      ? DefinitionForKey<TSchema, TKey, KnownFormProjectionForKey<DraftForKey<TSchema, TKey>, ValueForKey<TSchema, TKey>>>
        & SelectionDefinitionGuard<TDefinitions[TKey]>
      : ComputedDefinition<TSchema>
    : never
}

type InferredDefinitions<TSchema extends WebResourceSchemaBoundary, TDefinitions extends object> = TDefinitions & {
  [TKey in keyof TDefinitions]: TKey extends string
    ? TKey extends SchemaFieldKey<TSchema>
      ? DefinitionForKey<TSchema, TKey, InferredFormProjectionForKey<DraftForKey<TSchema, TKey>, ValueForKey<TSchema, TKey>>>
        & SelectionDefinitionGuard<TDefinitions[TKey]>
      : ComputedDefinition<TSchema>
    : never
}

type AnyDefinitions<TSchema extends WebResourceSchemaBoundary, TDefinitions extends object> = TDefinitions & {
  [TKey in keyof TDefinitions]: TKey extends string
    ? TKey extends SchemaFieldKey<TSchema>
      ? DefinitionForKey<TSchema, TKey, AnyFormProjectionForKey<DraftForKey<TSchema, TKey>, ValueForKey<TSchema, TKey>>> & SelectionDefinitionGuard<TDefinitions[TKey]>
      : ComputedDefinition<TSchema>
    : never
}

export function defineFields<
  const TSchema extends WebResourceSchemaBoundary,
  const TDefinitions extends object,
>(
  schema: TSchema,
  definitions: InferredDefinitions<TSchema, TDefinitions>,
): FieldReferences<TSchema, TDefinitions>

export function defineFields<
  const TSchema extends WebResourceSchemaBoundary,
  const TDefinitions extends object,
>(
  schema: TSchema,
  definitions: KnownDefinitions<TSchema, TDefinitions>,
): FieldReferences<TSchema, TDefinitions>

export function defineFields<
  const TSchema extends WebResourceSchemaBoundary,
  const TDefinitions extends object,
>(
  schema: TSchema,
  definitions: AnyDefinitions<TSchema, TDefinitions>,
): FieldReferences<TSchema, TDefinitions>

export function defineFields(
  schema: WebResourceSchemaBoundary,
  definitions: Record<string, unknown>,
): Record<string, FieldReference> {
  return Object.fromEntries(
    Object.entries(definitions).map(([key, definition]) => [key, createReference(schema, key, definition as AnyFieldDefinition, false)]),
  ) as unknown as Record<string, FieldReference>
}
