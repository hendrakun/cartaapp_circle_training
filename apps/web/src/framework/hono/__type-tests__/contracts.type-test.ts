import { fromZod } from '@southneuhof/loom'
import { optionalText } from '@southneuhof/api/schema'
import type { ClientResponse } from 'hono/client'
import { z } from 'zod/v3'
import { z as z4 } from 'zod/v4'
import { defineEntitySchema } from '../entity'
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
const exactEntity = { schemas: { select: selectSchema, create: createSchema, update: updateSchema } }

defineEntitySchema({} as Route, exactEntity)

const query = {} as HonoQueryOf<Route>
query.page = 1
query.limit = '20'
query.search = 'active'
query.moduleCode = 'number-configs'
// @ts-expect-error Non-pagination query keys keep their wire string type.
query.moduleCode = 1

const badSelectSchema = z.object({ id: z.string(), name: z.string(), extra: z.string() })
// @ts-expect-error Select output must equal the Hono record in both directions.
defineEntitySchema({} as Route, { schemas: { select: badSelectSchema, create: createSchema, update: updateSchema } })

const badCreateSchema = z.object({
  name: z.string().transform((value) => value.length),
  extraRequired: z.string(),
})
// @ts-expect-error Form creates must not require keys the wire input does not accept.
defineEntitySchema({} as Route, { schemas: { select: selectSchema, create: badCreateSchema, update: updateSchema } })

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
defineEntitySchema({} as AdapterRoute, { schemas: { select: selectSchema, create: adapterCreateSchema, update: adapterUpdateSchema } })

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
defineEntitySchema({} as AdapterRoute, { schemas: { select: selectSchema, create: badAdapterCreateSchema, update: adapterUpdateSchema } })

const formWithAuditKeys = z.object({
  name: z.string(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
})
// @ts-expect-error Form creates must not require keys the wire does not accept.
defineEntitySchema({} as Route, { schemas: { select: selectSchema, create: formWithAuditKeys, update: updateSchema } })

const formWithAuditUpdateKeys = z.object({
  name: z.string().optional(),
  createdByUserId: z.string(),
  updatedByUserId: z.string(),
})
// @ts-expect-error Form updates must not require keys the wire does not accept.
defineEntitySchema({} as Route, { schemas: { select: selectSchema, create: createSchema, update: formWithAuditUpdateKeys } })

const uiRefined = adapterCreateSchema.extend({ note: optionalText() })
defineEntitySchema({} as AdapterRoute, { schemas: { select: selectSchema, create: uiRefined, update: adapterUpdateSchema } })

const partialUpdate = adapterCreateSchema.partial()
defineEntitySchema({} as AdapterRoute, { schemas: { select: selectSchema, create: adapterCreateSchema, update: partialUpdate } })

const refinedValidCreate = z4.object({ name: z4.string() }).refine(() => true)
defineEntitySchema({} as Route, { schemas: { select: selectSchema, create: refinedValidCreate, update: updateSchema } })

// @ts-expect-error Form creates must not require keys the wire does not accept (direct shape).
defineEntitySchema({} as Route, { select: selectSchema, create: formWithAuditKeys, update: updateSchema })

// @ts-expect-error Form updates must not require keys the wire does not accept (direct shape).
defineEntitySchema({} as Route, { select: selectSchema, create: createSchema, update: formWithAuditUpdateKeys })

const directUiRefined = adapterCreateSchema.extend({ note: optionalText() })
defineEntitySchema({} as AdapterRoute, { select: selectSchema, create: directUiRefined, update: adapterUpdateSchema })

const directPartialUpdate = adapterCreateSchema.partial()
defineEntitySchema({} as AdapterRoute, { select: selectSchema, create: adapterCreateSchema, update: directPartialUpdate })

// @ts-expect-error fromZod infers its output from the schema and accepts no caller output type.
fromZod<{ name: string }>(createSchema)
