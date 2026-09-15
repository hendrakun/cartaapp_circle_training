/**
 * PROOF ONLY: one app schema seam with Hono and hand-written contracts.
 * Remove this file after the decision moves into production code.
 */
import { fromZod } from '@southneuhof/loom'
import type { WebResourceCreateOf, WebResourceQueryOf, WebResourceRecordOf, WebResourceSchema, WebResourceSchemaBoundary, WebResourceUpdateOf } from '@southneuhof/loom'
import type { ClientResponse } from 'hono/client'
import { expect, test } from 'vitest'
import { z } from 'zod/v4'
import type { AppResourceContract, HonoCreateOf, HonoQueryOf, HonoRecordOf, HonoUpdateOf } from '../contracts'

type Endpoint<TInput, TOutput, TStatus extends number> = (args: TInput, options?: unknown) => Promise<ClientResponse<TOutput, TStatus, 'json'>>
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

type RouteDefinitionShape<TRoute> = {
  identity?: Extract<keyof HonoRecordOf<TRoute>, string>
  record: SchemaSource
  query?: SchemaSource
} & ('create' extends keyof TRoute ? { create: SchemaSource } : { create?: never }) &
  ('update' extends keyof TRoute ? { update: SchemaSource } : { update?: never })

type RouteDefinitionContract<TRoute, TDefinition extends RouteDefinitionShape<TRoute>> = {
  record: Exact<SchemaOutput<TDefinition['record']>, HonoRecordOf<TRoute>> extends true ? TDefinition['record'] : never
} & (TDefinition extends { query: infer TQuery } ? { query: Exact<SchemaOutput<TQuery>, HonoQueryOf<TRoute>> extends true ? TQuery : never } : object) &
  ('create' extends keyof TRoute ? { create: WriteContract<HonoCreateOf<TRoute>, SourceAt<TDefinition, 'create'>> } : object) &
  ('update' extends keyof TRoute ? { update: WriteContract<HonoUpdateOf<TRoute>, SourceAt<TDefinition, 'update'>> } : object)

type CustomDefinition<TContract extends WebResourceSchemaBoundary> = {
  identity?: Extract<keyof WebResourceRecordOf<TContract>, string>
  record?: SchemaSource & { _output: WebResourceRecordOf<TContract> }
  query?: SchemaSource & { _output: WebResourceQueryOf<TContract> }
  create?: SchemaSource & { _output: WebResourceCreateOf<TContract> }
  update?: SchemaSource & { _output: WebResourceUpdateOf<TContract> }
}

type RuntimeDefinition = {
  identity?: string | readonly string[]
  record?: SchemaSource
  query?: SchemaSource
  create?: SchemaSource
  update?: SchemaSource
}

function buildSchema(definition: RuntimeDefinition): WebResourceSchemaBoundary {
  return {
    ...(definition.identity === undefined ? {} : { identity: definition.identity }),
    ...(definition.record === undefined ? {} : { record: { schema: fromZod(definition.record) } }),
    ...(definition.query === undefined ? {} : { query: { schema: fromZod(definition.query) } }),
    ...(definition.create === undefined ? {} : { create: { schema: fromZod(definition.create) } }),
    ...(definition.update === undefined ? {} : { update: { schema: fromZod(definition.update) } }),
  }
}

function defineSchema<const TRoute, const TDefinition extends RouteDefinitionShape<TRoute>>(
  route: TRoute,
  definition: TDefinition & RouteDefinitionContract<TRoute, TDefinition>
): AppResourceContract<TRoute>
function defineSchema<const TContract extends WebResourceSchemaBoundary>(definition: CustomDefinition<TContract>): TContract
function defineSchema(routeOrDefinition: unknown, definition?: RuntimeDefinition): WebResourceSchemaBoundary {
  void routeOrDefinition
  return buildSchema(definition ?? (routeOrDefinition as RuntimeDefinition))
}

type CrudRoute = {
  list: { $get: Endpoint<{ query: { search?: string } }, { data: Array<{ id: string; name: string }>; page: number; limit: number; total: number }, 200> }
  detail: { ':id': { $get: Endpoint<{ param: { id: string } }, { data: { id: string; name: string } }, 200> } }
  create: { $post: Endpoint<{ json: { name: string; roleIds: string[] } }, { data: { id: string; name: string } }, 201> }
  update: { ':id': { $patch: Endpoint<{ param: { id: string }; json: { name?: string } }, { data: { id: string; name: string } }, 200> } }
}

type ReadOnlyRoute = Pick<CrudRoute, 'list' | 'detail'>
type CustomContract = WebResourceSchema<{ id: string; event: string }, { search?: string }, { event: string }, { event?: string }, string>

const recordSchema = z.object({ id: z.string(), name: z.string() })
const roleSelection = z.union([z.string().trim().min(1), z.object({ id: z.string().trim().min(1) }).transform(({ id }) => id)])
const createSchema = z.object({ name: z.string(), roleIds: z.array(roleSelection) })
const updateSchema = z.object({ name: z.string().optional() })
const customRecordSchema = z.object({ id: z.string(), event: z.string() })
const customQuerySchema = z.object({ search: z.string().optional() })
const customCreateSchema = z.object({ event: z.string() })
const customUpdateSchema = customCreateSchema.partial()

const roleObject: z.input<typeof roleSelection> = { id: 'role-1' }
const rawFormInputIsWireInput: [z.input<typeof createSchema>] extends [HonoCreateOf<CrudRoute>] ? true : false = false
const parsedFormOutputIsWireInput: [z.output<typeof createSchema>] extends [HonoCreateOf<CrudRoute>] ? true : false = true
void [roleObject, rawFormInputIsWireInput, parsedFormOutputIsWireInput]

const crudSchema = defineSchema({} as CrudRoute, {
  identity: 'id',
  record: recordSchema,
  create: createSchema,
  update: updateSchema,
})
const readOnlySchema = defineSchema({} as ReadOnlyRoute, { identity: 'id', record: recordSchema })
const customSchema = defineSchema<CustomContract>({
  identity: 'id',
  record: customRecordSchema,
  query: customQuerySchema,
  create: customCreateSchema,
  update: customUpdateSchema,
})
const customTypeOnlySchema = defineSchema<CustomContract>({ identity: 'id' })

function rejectedCalls() {
  // @ts-expect-error A create route requires its create schema.
  defineSchema({} as CrudRoute, { identity: 'id', record: recordSchema, update: updateSchema })

  // @ts-expect-error An update route requires its update schema.
  defineSchema({} as CrudRoute, { identity: 'id', record: recordSchema, create: createSchema })

  // @ts-expect-error A read-only route cannot declare a create schema.
  defineSchema({} as ReadOnlyRoute, { identity: 'id', record: recordSchema, create: createSchema })

  const wrongRecordSchema = z.object({ id: z.string(), name: z.string(), extra: z.string() })
  // @ts-expect-error The record output must exactly match the Hono record.
  defineSchema({} as ReadOnlyRoute, { identity: 'id', record: wrongRecordSchema })

  const createWithUnsupportedKey = z.object({ name: z.string(), roleIds: z.array(z.string()), createdByUserId: z.string() })
  // @ts-expect-error A form cannot require a key that the Hono input does not accept.
  defineSchema({} as CrudRoute, { identity: 'id', record: recordSchema, create: createWithUnsupportedKey, update: updateSchema })

  const wrongCustomCreateSchema = z.object({ event: z.number() })
  // @ts-expect-error A hand-written runtime schema must match its custom contract.
  defineSchema<CustomContract>({ identity: 'id', create: wrongCustomCreateSchema })
}
void rejectedCalls

test('builds Hono and custom Loom schemas through one implementation', () => {
  expect(Object.keys(crudSchema)).toEqual(['identity', 'record', 'create', 'update'])
  expect(Object.keys(readOnlySchema)).toEqual(['identity', 'record'])
  expect(Object.keys(customSchema)).toEqual(['identity', 'record', 'query', 'create', 'update'])
  expect(customTypeOnlySchema).toEqual({ identity: 'id' })

  expect(crudSchema.create?.schema?.validate({ name: 'Ada', roleIds: [{ id: ' admin ', label: 'Admin' }] })).toEqual({
    success: true,
    data: { name: 'Ada', roleIds: ['admin'] },
  })
})
