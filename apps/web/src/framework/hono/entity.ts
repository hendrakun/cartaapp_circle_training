import { defineSchema, fromZod } from '@southneuhof/loom'
import type { AppResourceContract, HonoCreateOf, HonoRecordOf, HonoUpdateOf } from './contracts'

type FromZodInput = Parameters<typeof fromZod>[0] & { _output: object }

type SchemaWithOutput<TOutput> = { _output: TOutput }
type SchemaWithInput<TInput> = { _input: TInput }

type EntitySchemasOf<TRoute> = {
  schemas: {
    select: Parameters<typeof fromZod>[0] & SchemaWithOutput<HonoRecordOf<TRoute>>
    create: Parameters<typeof fromZod>[0] & SchemaWithInput<unknown>
    update: Parameters<typeof fromZod>[0] & SchemaWithInput<unknown>
  }
}

type DirectSchemasOf<TRoute> = {
  select: Parameters<typeof fromZod>[0] & SchemaWithOutput<HonoRecordOf<TRoute>>
  create: Parameters<typeof fromZod>[0] & SchemaWithInput<unknown>
  update: Parameters<typeof fromZod>[0] & SchemaWithInput<unknown>
}

type SchemaOutput<TSchema> = TSchema extends SchemaWithOutput<infer TOutput> ? TOutput : never
type Exact<TActual, TExpected> = [TActual] extends [TExpected] ? ([TExpected] extends [TActual] ? true : false) : false

type ShapeOf<TSchema> = TSchema extends { shape: infer TShape } ? (TShape extends (...args: never[]) => infer TResult ? TResult : TShape) : never

type FieldInput<TField> = TField extends { _input: infer TInput } ? TInput : never

// Keys whose _input excludes undefined. A schema without an inspectable shape
// (top-level .refine() wrappers expose no .shape) resolves to never, which
// extends every keyof union and so accepts ("no opinion").
type RequiredKeys<TSchema> =
  ShapeOf<TSchema> extends infer TShape
    ? TShape extends Record<string, { _input: unknown }>
      ? { [TKey in keyof TShape]: undefined extends FieldInput<TShape[TKey]> ? never : TKey }[keyof TShape]
      : never
    : never

type CreateContract<TRoute, TFormSchema> =
  TFormSchema extends SchemaWithInput<infer TFormInput>
    ? [TFormInput] extends [HonoCreateOf<TRoute>]
      ? [RequiredKeys<TFormSchema>] extends [keyof HonoCreateOf<TRoute>]
        ? TFormSchema
        : never
      : never
    : never

type UpdateContract<TRoute, TFormSchema> =
  TFormSchema extends SchemaWithInput<infer TFormInput>
    ? [TFormInput] extends [HonoUpdateOf<TRoute>]
      ? [RequiredKeys<TFormSchema>] extends [keyof HonoUpdateOf<TRoute>]
        ? TFormSchema
        : never
      : never
    : never

type EntitySchemaContract<TRoute, TEntity extends EntitySchemasOf<TRoute>> = {
  schemas: {
    select: Exact<SchemaOutput<TEntity['schemas']['select']>, HonoRecordOf<TRoute>> extends true ? TEntity['schemas']['select'] : never
    create: CreateContract<TRoute, TEntity['schemas']['create']>
    update: UpdateContract<TRoute, TEntity['schemas']['update']>
  }
}

type DirectSchemaContract<TRoute, TEntity extends DirectSchemasOf<TRoute>> = {
  select: Exact<SchemaOutput<TEntity['select']>, HonoRecordOf<TRoute>> extends true ? TEntity['select'] : never
  create: CreateContract<TRoute, TEntity['create']>
  update: UpdateContract<TRoute, TEntity['update']>
}

function buildEntitySchema<TRoute>(route: TRoute, select: FromZodInput, create: FromZodInput, update: FromZodInput): ReturnType<typeof defineSchema> {
  void route
  return defineSchema({
    identity: 'id',
    record: { schema: fromZod(select) },
    create: { schema: fromZod(create) },
    update: { schema: fromZod(update) },
  })
}

export function defineEntitySchema<const TRoute, const TEntity extends EntitySchemasOf<TRoute>>(
  route: TRoute,
  entity: TEntity & EntitySchemaContract<TRoute, TEntity>
): ReturnType<typeof defineSchema<AppResourceContract<TRoute>>>
export function defineEntitySchema<const TRoute, const TEntity extends DirectSchemasOf<TRoute>>(
  route: TRoute,
  entity: TEntity & DirectSchemaContract<TRoute, TEntity>
): ReturnType<typeof defineSchema<AppResourceContract<TRoute>>>
export function defineEntitySchema<TRoute>(
  route: TRoute,
  entity: { schemas: { select: FromZodInput; create: FromZodInput; update: FromZodInput } } | { select: FromZodInput; create: FromZodInput; update: FromZodInput }
) {
  return 'schemas' in entity ? buildEntitySchema(route, entity.schemas.select, entity.schemas.create, entity.schemas.update) : buildEntitySchema(route, entity.select, entity.create, entity.update)
}
