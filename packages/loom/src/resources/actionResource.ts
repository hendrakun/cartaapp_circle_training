import type {
  AccessAdapter,
  CollectionLoadContext,
  CollectionResult,
  DetailProps,
  FieldContext,
  FieldOverride,
  FieldReference,
  FieldsInput,
  FormProps,
  FormValidatorInput,
  LoadSignalContext,
  MaybePromise,
  QueryNamespace,
  RecordIdentity,
  RecordIdentityValue,
  RecordLoadContext,
  SchemaIdentityDeclaration,
  TableProps,
  WebResourceSchemaBoundary,
  WebResourceSchema,
  WebResourceCreateOf,
  WebResourceIdentityOf,
  WebResourceQueryOf,
  WebResourceRecordOf,
  WebResourceUpdateOf,
} from '../contracts'
import { readFieldReference } from '../fields/defineFields'
import { resolveFields } from '../fields/resolve'
import { invalidateResourceData } from '../query/client'
import { stableValue } from '../query/keys'
import { useResourceRuntime } from './runtime'
import type { RouteLocationRaw } from 'vue-router'
import { registerResourceAction } from './routeAccess'

type ResourceOperation = 'list' | 'detail' | 'create' | 'update' | 'delete'
type ActionParams = Record<string, string | number>

export type ResourceActionRoute<TIdentity extends RecordIdentity = RecordIdentity> = {
  name: string
  params?: ActionParams | ((id: TIdentity) => ActionParams)
}

export type ResourceFormDefaultTo<TRecord extends object> =
  | RouteLocationRaw
  | ((record: TRecord) => RouteLocationRaw | undefined)
  | false

type FieldReferenceList<
  TSchema extends WebResourceSchemaBoundary,
  TDraft extends object,
  TSurface extends 'table' | 'detail' | 'form',
> = readonly (
  | Extract<keyof TDraft, string>
  | FieldReference<TSchema, TSurface extends 'form' ? Extract<keyof TDraft, string> : string, any>
  | FieldOverride<TSchema, TSurface extends 'form' ? Extract<keyof TDraft, string> : string, any>
)[]

type ListRun<TRecord extends object, TQuery extends object> =
  (context: CollectionLoadContext<TQuery>) => MaybePromise<CollectionResult<TRecord>>
type DetailRun<TRecord extends object, TIdentity extends RecordIdentity> =
  (context: RecordLoadContext<TIdentity>) => MaybePromise<TRecord | undefined>
type CreateRun<TRecord extends object, TCreate extends object> =
  (input: TCreate) => MaybePromise<TRecord>
type UpdateRun<TRecord extends object, TUpdate extends object, TIdentity extends RecordIdentity> =
  (id: TIdentity, input: TUpdate) => MaybePromise<TRecord>
type DeleteRun<TIdentity extends RecordIdentity> = (id: TIdentity) => MaybePromise<unknown>

interface ActionVisibility {
  visible?: (context: { record?: Record<string, unknown>; access: AccessAdapter }) => boolean
}

export interface ListResourceAction<
  TRecord extends object,
  TQuery extends object,
  TIdentity extends RecordIdentity,
  TSchema extends WebResourceSchemaBoundary = WebResourceSchemaBoundary,
> extends ActionVisibility {
  run: ListRun<TRecord, TQuery>
  fields?: FieldReferenceList<TSchema, TRecord, 'table'>
  permission?: string | null
  route?: ResourceActionRoute<TIdentity>
  title?: string
  pagination?: TableProps<TRecord, TQuery>['pagination']
  pageSizeOptions?: readonly number[]
  defaultPageSize?: number
  minColumnWidth?: number
  reorderable?: boolean
}

export interface DetailResourceAction<
  TRecord extends object,
  TIdentity extends RecordIdentity,
  TSchema extends WebResourceSchemaBoundary = WebResourceSchemaBoundary,
> extends ActionVisibility {
  run: DetailRun<TRecord, TIdentity>
  fields?: FieldReferenceList<TSchema, TRecord, 'detail'>
  permission?: string | null
  route?: ResourceActionRoute<TIdentity>
  title?: string
  /** Explicit back target; wins over the inferred sibling list route. */
  backTo?: RouteLocationRaw
}

export interface CreateResourceAction<
  TRecord extends object,
  TCreate extends object,
  TIdentity extends RecordIdentity,
  TSchema extends WebResourceSchemaBoundary = WebResourceSchemaBoundary,
> extends ActionVisibility {
  run: CreateRun<TRecord, TCreate>
  fields?: FieldReferenceList<TSchema, TCreate, 'form'>
  permission?: string | null
  route?: ResourceActionRoute<TIdentity>
  initialData?: Partial<TCreate>
  defaultTo?: ResourceFormDefaultTo<TRecord>
}

export interface UpdateResourceAction<
  TRecord extends object,
  TUpdate extends object,
  TIdentity extends RecordIdentity,
  TSchema extends WebResourceSchemaBoundary = WebResourceSchemaBoundary,
> extends ActionVisibility {
  run: UpdateRun<TRecord, TUpdate, TIdentity>
  fields?: FieldReferenceList<TSchema, TUpdate, 'form'>
  permission?: string | null
  route?: ResourceActionRoute<TIdentity>
  title?: string
  defaultTo?: ResourceFormDefaultTo<TRecord>
}

export interface DeleteResourceAction<TIdentity extends RecordIdentity> extends ActionVisibility {
  run: DeleteRun<TIdentity>
  /** Required: write the real permission code, or an explicit null to allow all. */
  permission: string | null
}

export type ResourceCustomAction = { run: (...args: any[]) => any }

export type ResourceActionDefinitions<
  TRecord extends object,
  TQuery extends object,
  TCreate extends object,
  TUpdate extends object,
  TIdentity extends RecordIdentity,
  TSchema extends WebResourceSchemaBoundary = WebResourceSchemaBoundary,
> = {
  list?: ListResourceAction<TRecord, TQuery, TIdentity, TSchema>
  detail?: DetailResourceAction<TRecord, TIdentity, TSchema>
  create?: CreateResourceAction<TRecord, TCreate, TIdentity, TSchema>
  update?: UpdateResourceAction<TRecord, TUpdate, TIdentity, TSchema>
  delete?: DeleteResourceAction<TIdentity>
} & Record<string, ResourceCustomAction>

export interface ActionResourceDefinition<TSchema extends WebResourceSchemaBoundary = WebResourceSchemaBoundary> {
  key: string
  actions: ResourceActionDefinitions<
    WebResourceRecordOf<TSchema>,
    WebResourceQueryOf<TSchema>,
    WebResourceCreateOf<TSchema>,
    WebResourceUpdateOf<TSchema>,
    WebResourceIdentityOf<TSchema>,
    TSchema
  >
}

export interface ListResourceActionProps<
  TRecord extends object,
  TQuery extends object,
  TIdentity extends RecordIdentity,
> {
  run: ListRun<TRecord, TQuery>
  fields: FieldsInput<TRecord>
  resource: string
  namespace: QueryNamespace
  searchParameters: Record<string, unknown>
  query?: TQuery
  schema?: NonNullable<WebResourceSchema['query']>['schema']
  pagination?: TableProps<TRecord, TQuery>['pagination']
  pageSizeOptions?: readonly number[]
  defaultPageSize?: number
  minColumnWidth?: number
  reorderable?: boolean
  createRoute?: RouteLocationRaw
  detailRoute?: (record: TRecord) => RouteLocationRaw | undefined
  updateRoute?: (record: TRecord) => RouteLocationRaw | undefined
  can?: (operation: ResourceOperation, record?: TRecord) => boolean
  deleteRecord?: (record: TRecord) => Promise<unknown>
  /** Route used by the shell after a successful form submission. */
  detailTarget?: (record: TRecord) => RouteLocationRaw | undefined
}

export interface DetailResourceActionProps<TRecord extends object, TIdentity extends RecordIdentity> {
  run: (context?: LoadSignalContext) => Promise<TRecord | undefined>
  fields: FieldsInput<TRecord>
  id: TIdentity
  resource: string
  namespace: QueryNamespace
  searchParameters: Record<string, unknown>
  detailTarget?: RouteLocationRaw
  /** Page heading for the detail shell when the route passes no explicit title. */
  title?: string
  /** Sibling list location for the detail shell's back control. */
  backTo?: RouteLocationRaw
  can?: (operation: ResourceOperation, record?: TRecord) => boolean
}

export interface CreateResourceActionProps<TRecord extends object, TCreate extends object, TIdentity extends RecordIdentity> {
  run: (input: TCreate) => Promise<TRecord>
  fields: FieldsInput<TCreate, TCreate>
  resource: string
  schema?: NonNullable<WebResourceSchema['create']>['schema']
  validators?: readonly FormValidatorInput<TCreate>[]
  initialData?: Partial<TCreate>
  searchParameters: Record<string, unknown>
  namespace: QueryNamespace
  defaultTo?: RouteLocationRaw | ((record: TRecord) => RouteLocationRaw | undefined)
  context?: FieldContext
}

export interface UpdateResourceActionProps<TRecord extends object, TUpdate extends object, TIdentity extends RecordIdentity> {
  run: (input: TUpdate) => Promise<TRecord>
  load?: (context: RecordLoadContext<TIdentity>) => Promise<Partial<TUpdate> | undefined>
  fields: FieldsInput<TUpdate, TUpdate>
  id: TIdentity
  resource: string
  schema?: NonNullable<WebResourceSchema['update']>['schema']
  validators?: readonly FormValidatorInput<TUpdate>[]
  searchParameters: Record<string, unknown>
  namespace: QueryNamespace
  defaultTo?: RouteLocationRaw | ((record: TRecord) => RouteLocationRaw | undefined)
  context?: FieldContext
}

export interface DeleteResourceActionProps<TIdentity extends RecordIdentity> {
  run: () => Promise<unknown>
}

type StandardActionNames = 'list' | 'detail' | 'create' | 'update' | 'delete'
type CustomActionKey<TActions> = Exclude<Extract<keyof TActions, string>, StandardActionNames>
type CustomActions<TActions> = {
  [TKey in CustomActionKey<TActions>]: TActions[TKey] extends { run: infer TRun } ? { run: TRun } : never
}

type ActionDefinition<TActions, TKey extends PropertyKey> = TActions extends Record<TKey, infer TValue> ? TValue : never
type HasAction<TActions, TKey extends StandardActionNames> = TActions extends Record<TKey, ResourceCustomAction> ? true : false

export type ActionResource<
  TSchema extends WebResourceSchemaBoundary,
  TActions extends ResourceActionDefinitions<
    WebResourceRecordOf<TSchema>,
    WebResourceQueryOf<TSchema>,
    WebResourceCreateOf<TSchema>,
    WebResourceUpdateOf<TSchema>,
    WebResourceIdentityOf<TSchema>,
    TSchema
  >,
> = {
  key: string
  actions: CustomActions<TActions>
  /** Declared standard-action permissions, for capability checks outside view surfaces. */
  permissions: Partial<Record<ResourceOperation, string | null>>
  invalidate: (args?: { id?: WebResourceIdentityOf<TSchema> }) => Promise<void>
} & (HasAction<TActions, 'list'> extends true ? {
  list: (args?: ListResourceActionArguments<WebResourceQueryOf<TSchema>>) => ListResourceActionProps<WebResourceRecordOf<TSchema>, WebResourceQueryOf<TSchema>, WebResourceIdentityOf<TSchema>>
} : {})
  & (HasAction<TActions, 'detail'> extends true ? {
    detail: (args: { id: WebResourceIdentityOf<TSchema>; searchParameters?: Record<string, unknown> }) => DetailResourceActionProps<WebResourceRecordOf<TSchema>, WebResourceIdentityOf<TSchema>>
  } : {})
  & (HasAction<TActions, 'create'> extends true ? {
    create: (args?: CreateResourceActionArguments<WebResourceCreateOf<TSchema>>) => CreateResourceActionProps<WebResourceRecordOf<TSchema>, WebResourceCreateOf<TSchema>, WebResourceIdentityOf<TSchema>>
  } : {})
  & (HasAction<TActions, 'update'> extends true ? {
    update: (args: { id: WebResourceIdentityOf<TSchema>; initialData?: Partial<WebResourceUpdateOf<TSchema>>; searchParameters?: Record<string, unknown>; context?: FieldContext }) => UpdateResourceActionProps<WebResourceRecordOf<TSchema>, WebResourceUpdateOf<TSchema>, WebResourceIdentityOf<TSchema>>
  } : {})
  & (HasAction<TActions, 'delete'> extends true ? {
    delete: (args: { id: WebResourceIdentityOf<TSchema> }) => DeleteResourceActionProps<WebResourceIdentityOf<TSchema>>
  } : {})

export interface ListResourceActionArguments<TQuery extends object> {
  searchParameters?: Record<string, unknown>
  namespace?: QueryNamespace
  query?: TQuery
}

export interface CreateResourceActionArguments<TCreate extends object> {
  initialData?: Partial<TCreate>
  searchParameters?: Record<string, unknown>
  context?: FieldContext
}

/**
 * Memoizes action-bag creation for referential stability across renders.
 * The FIFO bound caps memory (per-id detail/update bags) and the staleness
 * window of permission closures captured inside bags; eviction only costs a
 * recompute of a pure factory.
 */
const PROPS_CACHE_LIMIT = 200

function memoize<TArgs, TResult>(create: (args: TArgs) => TResult) {
  const cache = new Map<string, TResult>()
  return (args: TArgs): TResult => {
    const key = JSON.stringify(stableValue(args as unknown) ?? null)
    const cached = cache.get(key)
    if (cached) return cached
    const result = create(args)
    if (cache.size >= PROPS_CACHE_LIMIT) cache.delete(cache.keys().next().value!)
    cache.set(key, result)
    return result
  }
}

function toRoute<TIdentity extends RecordIdentity>(route: ResourceActionRoute<TIdentity> | undefined, id?: TIdentity): RouteLocationRaw | undefined {
  if (!route) return undefined
  if (typeof route.params === 'function') {
    if (id === undefined) return undefined
    return { name: route.name, params: route.params(id) } as RouteLocationRaw
  }
  return (route.params ? { name: route.name, params: route.params } : { name: route.name }) as RouteLocationRaw
}

function formDefaultTo<TRecord extends object, TIdentity extends RecordIdentity>(
  declared: ResourceFormDefaultTo<TRecord> | undefined,
  detailRoute: ResourceActionRoute<TIdentity> | undefined,
  identityOf: (record: TRecord) => TIdentity,
): ((record: TRecord) => RouteLocationRaw | undefined) | undefined {
  if (declared === false) return undefined
  if (declared !== undefined) return typeof declared === 'function' ? declared : () => declared
  return detailRoute ? (record) => toRoute(detailRoute, identityOf(record)) : undefined
}

function identityToken(id: RecordIdentity): string {
  return typeof id === 'object' ? JSON.stringify(stableValue(id)) : String(id)
}

type ResourceSurface = 'table' | 'detail' | 'form'

/**
 * Renderer keys depend only on fields, field defaults, and the input-props
 * registry — never on a record. Fields references are stable (memoized action
 * bags), so one map per fields reference serves every row and detail load.
 */
const EMPTY_RENDERER_MAP: ReadonlyMap<string, string> = new Map()
const rendererMapCache = new WeakMap<object, Map<string, string>>()

function rendererMapOf(
  fields: FieldsInput<any, any> | undefined,
  runtime: ReturnType<typeof useResourceRuntime>,
): ReadonlyMap<string, string> {
  if (!fields || !runtime.inputProps) return EMPTY_RENDERER_MAP
  const cached = rendererMapCache.get(fields)
  if (cached) return cached
  const renderers = new Map<string, string>()
  for (const currentSurface of ['table', 'detail', 'form'] as const) {
    const resolved = resolveFields({
      fields,
      surface: currentSurface,
      defaults: runtime.fieldDefaults[currentSurface],
      defaultFields: runtime.fieldDefaults.fields,
    })
    for (const field of resolved) {
      if (field.renderer && !renderers.has(field.key)) renderers.set(field.key, field.renderer)
    }
  }
  rendererMapCache.set(fields, renderers)
  return renderers
}

function readResourceRecord<TRecord extends object>(
  record: TRecord | undefined,
  renderers: ReadonlyMap<string, string>,
  runtime: ReturnType<typeof useResourceRuntime>,
): TRecord | undefined {
  if (!record || !runtime.inputProps || renderers.size === 0) return record
  const next = { ...record } as Record<string, unknown>
  for (const [key, renderer] of renderers) {
    if (!Object.prototype.hasOwnProperty.call(next, key)) continue
    next[key] = runtime.inputProps.hydrate(renderer, next[key])
  }
  return next as TRecord
}

function readCollectionRecords<TRecord extends object>(
  result: CollectionResult<TRecord>,
  fields: FieldsInput<any, any> | undefined,
  runtime: ReturnType<typeof useResourceRuntime>,
): CollectionResult<TRecord> {
  const renderers = rendererMapOf(fields, runtime)
  return {
    ...result,
    data: result.data.map((record) => readResourceRecord(record, renderers, runtime) as TRecord),
  }
}

function resolveIdentity<TRecord extends object, TIdentity extends RecordIdentity>(declaration: SchemaIdentityDeclaration<TRecord, TIdentity> | undefined): (record: TRecord) => TIdentity {
  if (typeof declaration === 'function') return declaration as (record: TRecord) => TIdentity
  if (Array.isArray(declaration)) {
    return (record) => Object.fromEntries(declaration.map((key) => [key, record[key]])) as TIdentity
  }
  if (typeof declaration === 'string') return (record) => record[declaration] as TIdentity
  return (record) => (record as { id: TIdentity }).id
}

function resolveFieldReferences<
  TSchema extends WebResourceSchemaBoundary,
  TRecord extends object,
  TDraft extends object,
  TSurface extends 'table' | 'detail' | 'form',
>(
  fields: FieldReferenceList<TSchema, TDraft, TSurface> | undefined,
  schema: TSchema,
  resourceKey: string,
  actionName: string,
): FieldsInput<TRecord, TDraft> {
  if (!fields) return {}
  const keys = new Set<string>()
  const result: Array<{ key: string } & Record<string, unknown>> = []
  for (const field of fields) {
    const data = typeof field === 'string' ? { schema, key: field, definition: {} } : readFieldReference(field)
    if (!data || data.schema !== schema) {
      throw new Error(`[loom] Resource "${resourceKey}" action "${actionName}" received a field from a different schema.`)
    }
    if (keys.has(data.key)) {
      throw new Error(`[loom] Resource "${resourceKey}" action "${actionName}" contains duplicate field "${data.key}".`)
    }
    keys.add(data.key)
    result.push({ key: data.key, ...data.definition })
  }
  return result as FieldsInput<TRecord, TDraft>
}

function permissionAllows(
  operation: ResourceOperation,
  declaration: ActionVisibility & { permission?: string | null },
  access: AccessAdapter,
  record?: Record<string, unknown>,
): boolean {
  const permission = declaration.permission ?? null
  return (permission === null || access.allows({ operation, permission, record })) && (!declaration.visible || declaration.visible({ record, access }))
}

/**
 * Answers one operation check through the access seam. A declared action gates
 * with its own permission and visibility; an undeclared operation is asked
 * directly so custom-action surfaces can query records without a standard
 * declaration.
 */
function operationAllowed(
  actions: Record<string, unknown>,
  access: AccessAdapter,
  operation: ResourceOperation,
  record?: Record<string, unknown>,
): boolean {
  const declaration = actions[operation] as ActionVisibility & { permission?: string | null } | undefined
  if (!declaration) return access.allows({ operation, record })
  return permissionAllows(operation, declaration, access, record)
}

export function defineActionResource<
  const TSchema extends WebResourceSchemaBoundary,
  const TActions extends ResourceActionDefinitions<
    WebResourceRecordOf<TSchema>,
    WebResourceQueryOf<TSchema>,
    WebResourceCreateOf<TSchema>,
    WebResourceUpdateOf<TSchema>,
    WebResourceIdentityOf<TSchema>,
    TSchema
  >,
>(
  schema: TSchema,
  definition: { key: string; actions: TActions },
): ActionResource<TSchema, TActions> {
  type TRecord = WebResourceRecordOf<TSchema>
  type TQuery = WebResourceQueryOf<TSchema>
  type TCreate = WebResourceCreateOf<TSchema>
  type TUpdate = WebResourceUpdateOf<TSchema>
  type TIdentity = WebResourceIdentityOf<TSchema>
  const actions = definition.actions
  for (const [action, declaration] of Object.entries(actions) as [string, ResourceCustomAction & { route?: ResourceActionRoute<TIdentity>; permission?: string | null }][]) {
    if (action === 'delete' && (declaration as { permission?: string | null }).permission === undefined) {
      throw new Error(`[loom] Resource "${definition.key}" action "delete" needs an explicit permission (string or null).`)
    }
    if (!['list', 'detail', 'create', 'update', 'delete'].includes(action)) continue
    if (!('route' in declaration) || !declaration.route) continue
    registerResourceAction(declaration.route.name, {
      resourceKey: definition.key,
      action,
      permission: declaration.permission ?? null,
    })
  }
  const identity = resolveIdentity<TRecord, TIdentity>(schema.identity as never)
  const runtime = () => useResourceRuntime()

  const invalidate = async (args?: { id?: TIdentity }) => {
    await invalidateResourceData(runtime().queryClient, { resource: definition.key, id: args?.id })
  }

  const standard = {
    list: 'list' in actions ? memoize((args: ListResourceActionArguments<TQuery> | undefined) => {
      const declaration = actions.list as ListResourceAction<TRecord, TQuery, TIdentity>
      const searchParameters = args?.searchParameters ?? {}
      const namespace = args?.namespace ?? definition.key
      const listFields = resolveFieldReferences(declaration.fields, schema, definition.key, 'list') as FieldsInput<TRecord>
      const detailDeclaration = actions.detail as DetailResourceAction<TRecord, TIdentity> | undefined
      const updateDeclaration = actions.update as UpdateResourceAction<TRecord, TUpdate, TIdentity> | undefined
      const deleteDeclaration = actions.delete as DeleteResourceAction<TIdentity> | undefined
      const access = runtime().adapters.access
      const routeFor = (action: ResourceActionRoute<TIdentity> | undefined, record: TRecord) => toRoute(action, identity(record))
      const can = (operation: ResourceOperation, record?: TRecord, action?: ActionVisibility & { permission?: string | null }) => Boolean(action && permissionAllows(operation, action, access, record as Record<string, unknown> | undefined))
      const deleteRecord = deleteDeclaration && can('delete', undefined, deleteDeclaration)
        ? async (record: TRecord) => {
            if (!permissionAllows('delete', deleteDeclaration, runtime().adapters.access, record as Record<string, unknown>)) throw new Error(`[loom] Resource "${definition.key}" action "delete" is not allowed.`)
            const result = await deleteDeclaration.run(identity(record))
            await invalidate({ id: identity(record) })
            return result
          }
        : undefined
      const detailTarget = detailDeclaration?.route ? (record: TRecord) => can('detail', record, detailDeclaration) ? routeFor(detailDeclaration.route, record) : undefined : undefined
      const updateTarget = updateDeclaration?.route ? (record: TRecord) => can('update', record, updateDeclaration) ? routeFor(updateDeclaration.route, record) : undefined : undefined
      return {
        run: async (context) => readCollectionRecords(await declaration.run(context), listFields, runtime()),
        fields: listFields,
        resource: definition.key,
        namespace,
        searchParameters,
        ...(args?.query === undefined ? {} : { query: args.query }),
        ...(schema.query?.schema ? { schema: schema.query.schema } : {}),
        ...(declaration.pagination === undefined ? {} : { pagination: declaration.pagination }),
        ...(declaration.pageSizeOptions === undefined ? {} : { pageSizeOptions: declaration.pageSizeOptions }),
        ...(declaration.defaultPageSize === undefined ? {} : { defaultPageSize: declaration.defaultPageSize }),
        ...(declaration.minColumnWidth === undefined ? {} : { minColumnWidth: declaration.minColumnWidth }),
        ...(declaration.reorderable === undefined ? {} : { reorderable: declaration.reorderable }),
        ...(actions.create && permissionAllows('create', actions.create, access) && actions.create.route ? { createRoute: toRoute(actions.create.route) } : {}),
        ...(detailTarget ? { detailRoute: detailTarget } : {}),
        ...(updateTarget ? { updateRoute: updateTarget } : {}),
        ...(deleteRecord ? { deleteRecord } : {}),
        can: (operation: ResourceOperation, record?: TRecord) => operationAllowed(actions as Record<string, unknown>, access, operation, record as Record<string, unknown> | undefined),
        ...(detailTarget ? { detailTarget } : {}),
      } as ListResourceActionProps<TRecord, TQuery, TIdentity>
    }) : undefined,
    detail: 'detail' in actions ? memoize((args: { id: TIdentity; searchParameters?: Record<string, unknown> }) => {
      const declaration = actions.detail as DetailResourceAction<TRecord, TIdentity>
      const listDeclaration = actions.list as ListResourceAction<TRecord, TQuery, TIdentity> | undefined
      // A declared backTo wins; otherwise the sibling list route is used in
      // full so closure-bound params (nested factories) survive. Function
      // params take the record id and would be wrong for a back target, so
      // they degrade to name-only.
      const listRoute = listDeclaration?.route
      const inferredBackTo =
        !listRoute ? undefined : typeof listRoute.params === 'function' ? { name: listRoute.name } : toRoute(listRoute)
      const searchParameters = args.searchParameters ?? {}
      const detailFields = resolveFieldReferences(declaration.fields, schema, definition.key, 'detail') as FieldsInput<TRecord>
      const run = async (context: LoadSignalContext = {}) => readResourceRecord(
        await declaration.run({ id: args.id, searchParameters, ...context }),
        rendererMapOf(detailFields, runtime()),
        runtime(),
      )
      return {
        run,
        fields: detailFields,
        id: args.id,
        resource: definition.key,
        namespace: `${definition.key}.detail.${identityToken(args.id)}`,
        searchParameters,
        ...(declaration.backTo ? { backTo: declaration.backTo } : inferredBackTo ? { backTo: inferredBackTo } : {}),
        ...(declaration.title === undefined ? {} : { title: declaration.title }),
        can: (operation: ResourceOperation, record?: TRecord) =>
          operationAllowed(actions as Record<string, unknown>, runtime().adapters.access, operation, record as Record<string, unknown> | undefined),
      } as DetailResourceActionProps<TRecord, TIdentity>
    }) : undefined,
    create: 'create' in actions ? memoize((args: CreateResourceActionArguments<TCreate> | undefined) => {
      const declaration = actions.create as CreateResourceAction<TRecord, TCreate, TIdentity>
      const detailDeclaration = actions.detail as DetailResourceAction<TRecord, TIdentity> | undefined
      const defaultTo = formDefaultTo(declaration.defaultTo, detailDeclaration?.route, identity)
      const createFields = resolveFieldReferences(declaration.fields, schema, definition.key, 'create') as FieldsInput<TCreate, TCreate>
      const run = async (input: TCreate) => {
        const result = await declaration.run(input)
        await invalidate()
        return readResourceRecord(result, rendererMapOf(createFields, runtime()), runtime()) as TRecord
      }
      const context: FieldContext = {
        ...(args?.context ?? {}),
        operation: 'create',
        permission: declaration.permission ?? null,
      }
      return {
        run,
        fields: createFields,
        resource: definition.key,
        ...(schema.create?.schema ? { schema: schema.create.schema } : {}),
        ...(schema.create?.validators ? { validators: schema.create.validators } : {}),
        ...(args?.initialData ?? declaration.initialData ? { initialData: args?.initialData ?? declaration.initialData } : {}),
        searchParameters: args?.searchParameters ?? {},
        namespace: `${definition.key}.create`,
        context,
        ...(defaultTo ? { defaultTo } : {}),
      } as CreateResourceActionProps<TRecord, TCreate, TIdentity>
    }) : undefined,
    update: 'update' in actions ? memoize((args: { id: TIdentity; initialData?: Partial<TUpdate>; searchParameters?: Record<string, unknown>; context?: FieldContext }) => {
      const declaration = actions.update as UpdateResourceAction<TRecord, TUpdate, TIdentity>
      const detailDeclaration = actions.detail as DetailResourceAction<TRecord, TIdentity> | undefined
      const searchParameters = args.searchParameters ?? {}
      const updateFields = resolveFieldReferences(declaration.fields, schema, definition.key, 'update') as FieldsInput<TUpdate, TUpdate>
      const run = async (input: TUpdate) => {
        const result = await declaration.run(args.id, input)
        await invalidate({ id: args.id })
        return readResourceRecord(result, rendererMapOf(updateFields, runtime()), runtime()) as TRecord
      }
      const load = detailDeclaration ? async (context: RecordLoadContext<TIdentity>) => {
        const result = await detailDeclaration.run({ ...context, id: args.id, searchParameters })
        return readResourceRecord(result, rendererMapOf(updateFields, runtime()), runtime()) as Partial<TUpdate> | undefined
      } : undefined
      const defaultTo = formDefaultTo(declaration.defaultTo, detailDeclaration?.route, identity)
      const context: FieldContext = {
        ...(args.context ?? {}),
        operation: 'update',
        permission: declaration.permission ?? null,
      }
      return {
        run,
        ...(load ? { load } : {}),
        fields: updateFields,
        id: args.id,
        resource: definition.key,
        ...(schema.update?.schema ? { schema: schema.update.schema } : {}),
        ...(schema.update?.validators ? { validators: schema.update.validators } : {}),
        ...(args.initialData ? { initialData: args.initialData } : {}),
        searchParameters,
        namespace: `${definition.key}.update.${identityToken(args.id)}`,
        context,
        ...(defaultTo ? { defaultTo } : {}),
      } as UpdateResourceActionProps<TRecord, TUpdate, TIdentity>
    }) : undefined,
    delete: 'delete' in actions ? (args: { id: TIdentity }) => {
      const declaration = actions.delete as DeleteResourceAction<TIdentity>
      return {
        run: async () => {
          const result = await declaration.run(args.id)
          await invalidate({ id: args.id })
          return result
        },
      } as DeleteResourceActionProps<TIdentity>
    } : undefined,
  }

  const custom = Object.fromEntries(Object.entries(actions).filter(([key]) => !['list', 'detail', 'create', 'update', 'delete'].includes(key)).map(([key, action]) => [key, { run: (action as ResourceCustomAction).run }])) as CustomActions<TActions>

  const permissions: Partial<Record<ResourceOperation, string | null>> = {}
  for (const operation of ['list', 'detail', 'create', 'update', 'delete'] as const) {
    if (!(operation in actions)) continue
    permissions[operation] = (actions[operation] as { permission?: string | null }).permission ?? null
  }

  return { key: definition.key, actions: custom, permissions, invalidate, ...standard } as ActionResource<TSchema, TActions>
}
