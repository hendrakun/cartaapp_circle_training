import { fromZod } from '@southneuhof/loom'
import type {
  FormValidatorInput,
  RecordIdentity,
  SchemaIdentityDeclaration,
  WebResourceCreateOf,
  WebResourceQueryOf,
  WebResourceRecordOf,
  WebResourceSchema,
  WebResourceSchemaBoundary,
  WebResourceUpdateOf,
} from '@southneuhof/loom'
import type { AppResourceContract, HonoCreateOf, HonoQueryOf, HonoRecordOf, HonoUpdateOf } from './hono/contracts'

type SchemaSource = Parameters<typeof fromZod>[0] & { _input: unknown; _output: object }
type SchemaOutput<TSchema> = TSchema extends { _output: infer TOutput } ? TOutput : never
type Exact<TActual, TExpected> = [TActual] extends [TExpected] ? ([TExpected] extends [TActual] ? true : false) : false
type ShapeOf<TSchema> = TSchema extends { shape: infer TShape } ? (TShape extends (...args: never[]) => infer TResult ? TResult : TShape) : never
type FieldInput<TField> = TField extends { _input: infer TInput } ? TInput : never
type RequiredKeys<TSchema> =
  ShapeOf<TSchema> extends infer TShape
    ? TShape extends Record<string, { _input: unknown }>
      ? { [TKey in keyof TShape]: undefined extends FieldInput<TShape[TKey]> ? never : TKey }[keyof TShape]
      : never
    : never
type SourceAt<TDefinition, TKey extends PropertyKey> = TDefinition extends Record<TKey, infer TSchema> ? TSchema : never
type WriteContract<TWire extends object, TSchema> = TSchema extends SchemaSource
  ? [SchemaOutput<TSchema>] extends [TWire]
    ? [RequiredKeys<TSchema>] extends [keyof TWire]
      ? TSchema
      : never
    : never
  : never

type Definition<TRecord extends object, TQuery extends object, TCreate extends object, TUpdate extends object> = {
  identity?: SchemaIdentityDeclaration<TRecord>
  record?: SchemaSource
  query?: SchemaSource
  create?: SchemaSource
  update?: SchemaSource
  validators?: {
    create?: readonly FormValidatorInput<TCreate>[]
    update?: readonly FormValidatorInput<TUpdate>[]
  }
}
type RouteDefinitionShape<TRoute> = Omit<Definition<HonoRecordOf<TRoute>, HonoQueryOf<TRoute>, HonoCreateOf<TRoute>, HonoUpdateOf<TRoute>>, 'record' | 'create' | 'update' | 'validators'> & {
  validators?: ('create' extends keyof TRoute ? { create?: readonly FormValidatorInput<HonoCreateOf<TRoute>>[] } : { create?: never }) &
    ('update' extends keyof TRoute ? { update?: readonly FormValidatorInput<HonoUpdateOf<TRoute>>[] } : { update?: never })
} & ('create' extends keyof TRoute ? { create: SchemaSource } : { create?: never }) &
  ('update' extends keyof TRoute ? { update: SchemaSource } : { update?: never })
type RouteDefinitionContract<TRoute, TDefinition extends RouteDefinitionShape<TRoute>, TRecordSchema extends SchemaSource> = {
  record: Exact<SchemaOutput<TRecordSchema>, HonoRecordOf<TRoute>> extends true ? TRecordSchema : never
} & (TDefinition extends { query: infer TQuery } ? { query: Exact<SchemaOutput<TQuery>, HonoQueryOf<TRoute>> extends true ? TQuery : never } : object) &
  ('create' extends keyof TRoute ? { create: WriteContract<HonoCreateOf<TRoute>, SourceAt<TDefinition, 'create'>> } : object) &
  ('update' extends keyof TRoute ? { update: WriteContract<HonoUpdateOf<TRoute>, SourceAt<TDefinition, 'update'>> } : object)

type CustomDefinition<TContract extends WebResourceSchemaBoundary> = {
  identity?: SchemaIdentityDeclaration<WebResourceRecordOf<TContract>>
  record?: SchemaSource & { _output: WebResourceRecordOf<TContract> }
  query?: SchemaSource & { _output: WebResourceQueryOf<TContract> }
  create?: SchemaSource & { _output: WebResourceCreateOf<TContract> }
  update?: SchemaSource & { _output: WebResourceUpdateOf<TContract> }
  validators?: {
    create?: readonly FormValidatorInput<WebResourceCreateOf<TContract>>[]
    update?: readonly FormValidatorInput<WebResourceUpdateOf<TContract>>[]
  }
}
type RuntimeDefinition = Omit<Definition<object, object, object, object>, 'identity'> & {
  identity?: string | readonly string[] | ((record: never) => RecordIdentity)
}
type OutputAt<TDefinition, TKey extends PropertyKey> = SourceAt<TDefinition, TKey> extends SchemaSource ? SchemaOutput<SourceAt<TDefinition, TKey>> : object
type InferredContract<TDefinition> = WebResourceSchema<
  OutputAt<TDefinition, 'record'>,
  OutputAt<TDefinition, 'query'>,
  OutputAt<TDefinition, 'create'>,
  OutputAt<TDefinition, 'update'>,
  RecordIdentity
>

export function defineSchema<const TRoute, const TRecordSchema extends SchemaSource, const TDefinition extends RouteDefinitionShape<TRoute>>(
  route: TRoute,
  definition: TDefinition & { record: TRecordSchema } & RouteDefinitionContract<TRoute, TDefinition, TRecordSchema>
): AppResourceContract<TRoute>
export function defineSchema<const TDefinition extends RuntimeDefinition>(definition: TDefinition): InferredContract<TDefinition>
export function defineSchema<const TContract extends WebResourceSchemaBoundary>(definition: CustomDefinition<TContract>): TContract
export function defineSchema(routeOrDefinition: unknown, definition?: RuntimeDefinition): WebResourceSchemaBoundary {
  const source = definition ?? (routeOrDefinition as RuntimeDefinition)
  return {
    ...(source.identity === undefined ? {} : { identity: source.identity }),
    ...(source.record === undefined ? {} : { record: { schema: fromZod(source.record) } }),
    ...(source.query === undefined ? {} : { query: { schema: fromZod(source.query) } }),
    ...(source.create === undefined && source.validators?.create === undefined
      ? {}
      : {
          create: {
            ...(source.create === undefined ? {} : { schema: fromZod(source.create) }),
            ...(source.validators?.create === undefined ? {} : { validators: source.validators.create }),
          },
        }),
    ...(source.update === undefined && source.validators?.update === undefined
      ? {}
      : {
          update: {
            ...(source.update === undefined ? {} : { schema: fromZod(source.update) }),
            ...(source.validators?.update === undefined ? {} : { validators: source.validators.update }),
          },
        }),
  }
}
