import { fromZod } from '@southneuhof/loom'
import { optionalText } from '@southneuhof/api/schema'
import type { ClientResponse } from 'hono/client'
import { z } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import type { SchemaIdentityDeclaration, WebResourceCreateOf, WebResourceQueryOf, WebResourceRecordOf, WebResourceSchema, WebResourceUpdateOf } from '@southneuhof/loom'
import { defineSchema } from '../../schema'
import type { HonoCreateOf, HonoQueryOf } from '../contracts'

type Endpoint<TInput, TOutput, TStatus extends number> = (args: TInput, options?: unknown) => Promise<ClientResponse<TOutput, TStatus, 'json'>>

type Route = {
  list: {
    $get: Endpoint<{ query: { page?: string; limit?: string; search?: string; moduleCode?: string } }, { data: Array<{ id: string; name: string }>; page: number; limit: number; total: number }, 200>
  }
  detail: { ':id': { $get: Endpoint<{ param: { id: string } }, { data: { id: string; name: string } }, 200> } }
  create: { $post: Endpoint<{ json: { name: string; active?: boolean } }, { data: { id: string; name: string } }, 201> }
  update: {
    ':id': {
      $patch: Endpoint<{ param: { id: string }; json: { name?: string; active?: boolean } }, { data: { id: string; name: string } }, 200>
    }
  }
}

const selectSchema = z.object({ id: z.string(), name: z.string() })
const createSchema = z.object({ name: z.string().transform((value) => value.trim()), active: z.boolean().default(false) })
const updateSchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim())
    .optional(),
  active: z.boolean().optional(),
})
defineSchema({} as Route, { record: selectSchema, create: createSchema, update: updateSchema })

const query = {} as HonoQueryOf<Route>
query.page = 1
query.limit = '20'
query.search = 'active'
query.moduleCode = 'number-configs'
// @ts-expect-error Non-pagination query keys keep their wire string type.
query.moduleCode = 1

const badSelectSchema = z.object({ id: z.string(), name: z.string(), extra: z.string() })
// @ts-expect-error Select output must equal the Hono record in both directions.
defineSchema({} as Route, { record: badSelectSchema, create: createSchema, update: updateSchema })

const badCreateSchema = z.object({
  name: z.string().transform((value) => value.length),
  extraRequired: z.string(),
})
// @ts-expect-error Form creates must not require keys the wire input does not accept.
defineSchema({} as Route, { record: selectSchema, create: badCreateSchema, update: updateSchema })

type AdapterRoute = {
  list: Route['list']
  detail: Route['detail']
  create: {
    $post: Endpoint<{ json: { name: string; note: unknown; count: number } }, { data: { id: string; name: string } }, 201>
  }
  update: {
    ':id': {
      $patch: Endpoint<{ param: { id: string }; json: { name?: string; note: unknown; count?: number } }, { data: { id: string; name: string } }, 200>
    }
  }
}

const adapterCreateSchema = z4.object({ name: z4.string(), note: optionalText(), count: z4.number() })
const adapterUpdateSchema = z4.object({ name: z4.string().optional(), note: optionalText(), count: z4.number().optional() })
defineSchema({} as AdapterRoute, { record: selectSchema, create: adapterCreateSchema, update: adapterUpdateSchema })

type AdapterCreate = HonoCreateOf<AdapterRoute>
const omittedOptionalText: AdapterCreate = { name: 'Item', count: 1 }
const presentOptionalText: AdapterCreate = { name: 'Item', note: { raw: true }, count: 1 }
void omittedOptionalText
void presentOptionalText
// @ts-expect-error Known required fields remain required.
const missingKnownRequired: AdapterCreate = { count: 1 }
// @ts-expect-error Known value types remain exact.
const wrongKnownType: AdapterCreate = { name: 'Item', count: '1' }

type UnionAdapterRoute = {
  create: {
    $post: Endpoint<{ json: { manualId: string; scheduleId?: never; targetDate: string } | { scheduleId: string; manualId?: never; targetDate: string } }, { data: { id: string } }, 201>
  }
}
type UnionAdapterCreate = HonoCreateOf<UnionAdapterRoute>
const manualUnionInput: UnionAdapterCreate = { manualId: 'manual-1', targetDate: '2026-08-24' }
const scheduledUnionInput: UnionAdapterCreate = { scheduleId: 'schedule-1', targetDate: '2026-08-24' }
void manualUnionInput
void scheduledUnionInput
// @ts-expect-error The common required key remains required after union normalization.
const missingUnionRequired: UnionAdapterCreate = { manualId: 'manual-1' }
// @ts-expect-error Known union value types remain exact.
const wrongUnionType: UnionAdapterCreate = { scheduleId: 1, targetDate: '2026-08-24' }

const badAdapterCreateSchema = z4.object({
  name: z4.string(),
  note: optionalText(),
  count: z4.number().transform(String),
  extraRequired: z4.string(),
})
// @ts-expect-error A form that requires a key the wire input does not accept is rejected.
defineSchema({} as AdapterRoute, { record: selectSchema, create: badAdapterCreateSchema, update: adapterUpdateSchema })

const formWithAuditKeys = z.object({
  name: z.string(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
})
// @ts-expect-error Form creates must not require keys the wire does not accept.
defineSchema({} as Route, { record: selectSchema, create: formWithAuditKeys, update: updateSchema })

const formWithAuditUpdateKeys = z.object({
  name: z.string().optional(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
})
// @ts-expect-error Form updates must not require keys the wire does not accept.
defineSchema({} as Route, { record: selectSchema, create: createSchema, update: formWithAuditUpdateKeys })

const uiRefined = adapterCreateSchema.extend({ note: optionalText() })
defineSchema({} as AdapterRoute, { record: selectSchema, create: uiRefined, update: adapterUpdateSchema })

const partialUpdate = adapterCreateSchema.partial()
defineSchema({} as AdapterRoute, { record: selectSchema, create: adapterCreateSchema, update: partialUpdate })

const refinedValidCreate = z4.object({ name: z4.string() }).refine(() => true)
defineSchema({} as Route, { record: selectSchema, create: refinedValidCreate, update: updateSchema })

// @ts-expect-error fromZod infers its output from the schema and accepts no caller output type.
fromZod<{ name: string }>(createSchema)

type ReadOnlyRoute = Pick<Route, 'list' | 'detail'>
defineSchema({} as ReadOnlyRoute, { record: selectSchema })
defineSchema({} as ReadOnlyRoute, { identity: ['id', 'name'], record: selectSchema })
defineSchema({} as ReadOnlyRoute, { identity: (record) => record.id, record: selectSchema })
// @ts-expect-error Identity keys must exist in the route record.
defineSchema({} as ReadOnlyRoute, { identity: 'missing', record: selectSchema })
// @ts-expect-error A read-only route has no create schema.
defineSchema({} as ReadOnlyRoute, { record: selectSchema, create: createSchema })
// @ts-expect-error A read-only route has no update schema.
defineSchema({} as ReadOnlyRoute, { record: selectSchema, update: updateSchema })
// @ts-expect-error A read-only route has no create validators.
defineSchema({} as ReadOnlyRoute, { record: selectSchema, validators: { create: [() => undefined] } })
// @ts-expect-error A read-only route has no update validators.
defineSchema({} as ReadOnlyRoute, { record: selectSchema, validators: { update: [() => undefined] } })
// @ts-expect-error A create route requires a create schema.
defineSchema({} as Route, { record: selectSchema, update: updateSchema })
// @ts-expect-error An update route requires an update schema.
defineSchema({} as Route, { record: selectSchema, create: createSchema })

const matchingQuery = z.object({
  page: z.union([z.string(), z.number()]).optional(),
  limit: z.union([z.string(), z.number()]).optional(),
  search: z.string().optional(),
  moduleCode: z.string().optional(),
  sort: z.string().optional(),
  order: z.string().optional(),
})
defineSchema({} as Route, { record: selectSchema, query: matchingQuery, create: createSchema, update: updateSchema })
const wrongQuery = z.object({ page: z.boolean().optional() })
// @ts-expect-error Query output must match the route query in both directions.
defineSchema({} as Route, { record: selectSchema, query: wrongQuery, create: createSchema, update: updateSchema })
const missingRecordField = z.object({ id: z.string() })
// @ts-expect-error Record output must match the route record in both directions.
defineSchema({} as ReadOnlyRoute, { record: missingRecordField })
const wrongUpdateOutput = z.object({
  name: z
    .string()
    .transform((value) => value.length)
    .optional(),
})
// @ts-expect-error Parsed update output must fit the wire update value.
defineSchema({} as Route, { record: selectSchema, create: createSchema, update: wrongUpdateOutput })
const wrongCreateValidator = ({ data }: { data: { event: number } }) => (data.event ? undefined : { path: [], message: 'Bad event' })
// @ts-expect-error Create validators must use the resolved create value.
defineSchema({} as Route, { record: selectSchema, create: createSchema, update: updateSchema, validators: { create: [wrongCreateValidator] } })

type CrudRoute = {
  list: { $get: Endpoint<{ query: { search?: string } }, { data: Array<{ id: string; name: string }>; page: number; limit: number; total: number }, 200> }
  detail: Route['detail']
  create: { $post: Endpoint<{ json: { name: string; roleIds: string[] } }, { data: { id: string; name: string } }, 201> }
  update: { ':id': { $patch: Endpoint<{ param: { id: string }; json: { name?: string } }, { data: { id: string; name: string } }, 200> } }
}
const roleSelection = z4.union([z4.string().trim().min(1), z4.object({ id: z4.string().trim().min(1) }).transform(({ id }) => id)])
const transformedCreate = z4.object({ name: z4.string(), roleIds: z4.array(roleSelection) })
const roleObject: z4.input<typeof roleSelection> = { id: 'role-1' }
const rawFormInputIsWireInput: [z4.input<typeof transformedCreate>] extends [HonoCreateOf<CrudRoute>] ? true : false = false
const parsedFormOutputIsWireInput: [z4.output<typeof transformedCreate>] extends [HonoCreateOf<CrudRoute>] ? true : false = true
void [roleObject, rawFormInputIsWireInput, parsedFormOutputIsWireInput]
defineSchema({} as CrudRoute, { identity: 'id', record: selectSchema, create: transformedCreate, update: z4.object({ name: z4.string().optional() }) })

type CustomContract = WebResourceSchema<{ id: string; event: string }, { search?: string }, { event: string }, { event?: string }, string>
const customRecord = z4.object({ id: z4.string(), event: z4.string() })
const customQuery = z4.object({ search: z4.string().optional() })
const customCreate = z4.object({ event: z4.string() })
const customUpdate = customCreate.partial()
defineSchema<CustomContract>({ identity: 'id', record: customRecord, query: customQuery, create: customCreate, update: customUpdate })
defineSchema<CustomContract>({ identity: 'id' })
// @ts-expect-error A custom runtime create schema must match its contract.
defineSchema<CustomContract>({ identity: 'id', create: z4.object({ event: z4.number() }) })
const inferred = defineSchema({ identity: 'id', record: customRecord, query: customQuery, create: customCreate, update: customUpdate })
const inferredRecord: WebResourceRecordOf<typeof inferred> = { id: '1', event: 'login' }
const inferredQuery: WebResourceQueryOf<typeof inferred> = { search: 'login' }
const inferredCreate: WebResourceCreateOf<typeof inferred> = { event: 'login' }
const inferredUpdate: WebResourceUpdateOf<typeof inferred> = { event: 'login' }
void [inferredRecord, inferredQuery, inferredCreate, inferredUpdate]
// @ts-expect-error Inferred record values keep the supplied schema fields.
const incompleteInferredRecord: WebResourceRecordOf<typeof inferred> = { id: '1' }
void incompleteInferredRecord
