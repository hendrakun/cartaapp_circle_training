import { validateDraftAsync } from '@southneuhof/loom'
import type { WebResourceSchema } from '@southneuhof/loom'
import type { ClientResponse } from 'hono/client'
import { expect, test } from 'vitest'
import { z } from 'zod/v4'
import { defineSchema } from '../schema'

type Endpoint<TInput, TOutput, TStatus extends number> = (args: TInput, options?: unknown) => Promise<ClientResponse<TOutput, TStatus, 'json'>>
type Route = {
  list: { $get: Endpoint<{ query: { search?: string } }, { data: Array<{ id: string; name: string }>; page: number; limit: number; total: number }, 200> }
  detail: { ':id': { $get: Endpoint<{ param: { id: string } }, { data: { id: string; name: string } }, 200> } }
  create: { $post: Endpoint<{ json: { name: string; roleIds: string[] } }, { data: { id: string; name: string } }, 201> }
  update: { ':id': { $patch: Endpoint<{ param: { id: string }; json: { name?: string } }, { data: { id: string; name: string } }, 200> } }
}
type CustomContract = WebResourceSchema<{ id: string; event: string }, { search?: string }, { event: string }, { event?: string }, string>

const record = z.object({ id: z.string(), name: z.string() })
const role = z.union([z.string().trim().min(1), z.object({ id: z.string().trim().min(1) }).transform(({ id }) => id)])
const create = z.object({ name: z.string(), roleIds: z.array(role) })
const update = z.object({ name: z.string().optional() })
const validator = ({ data }: { data: { name?: string } }) => (data.name ? undefined : { path: ['name'], message: 'Name is required' })

test('one app builder makes Hono and custom resource parts', async () => {
  const crud = defineSchema({} as Route, { identity: 'id', record, create, update })
  const withValidators = defineSchema({} as Route, { identity: 'id', record, create, update, validators: { create: [validator], update: [validator] } })
  const readOnly = defineSchema({} as Pick<Route, 'list' | 'detail'>, { identity: 'id', record })
  const custom = defineSchema<CustomContract>({
    identity: 'id',
    record: z.object({ id: z.string(), event: z.string() }),
    query: z.object({ search: z.string().optional() }),
    create: z.object({ event: z.string() }),
    update: z.object({ event: z.string().optional() }),
  })
  const typeOnly = defineSchema<CustomContract>({ identity: 'id' })

  expect(Object.keys(crud)).toEqual(['identity', 'record', 'create', 'update'])
  expect(Object.keys(readOnly)).toEqual(['identity', 'record'])
  expect(Object.keys(custom)).toEqual(['identity', 'record', 'query', 'create', 'update'])
  expect(typeOnly).toEqual({ identity: 'id' })
  expect(crud.create?.schema?.validate({ name: 'Ada', roleIds: [{ id: ' admin ', label: 'Admin' }] })).toEqual({
    success: true,
    data: { name: 'Ada', roleIds: ['admin'] },
  })
  expect(withValidators.create?.validators).toEqual([validator])
  expect(withValidators.update?.validators).toEqual([validator])
  const result = await validateDraftAsync({
    schema: withValidators.create?.schema,
    draft: { name: '', roleIds: ['admin'] },
    validators: withValidators.create?.validators,
    trigger: 'submit',
    initial: {},
    context: {},
    signal: new AbortController().signal,
  })
  expect(result).toEqual({ success: false, issues: [{ path: ['name'], message: 'Name is required' }] })
})
