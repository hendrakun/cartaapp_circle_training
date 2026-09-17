import { list, validationError } from '@southneuhof/sprindle'
import { and, asc, count, desc, eq, getTableColumns, ilike, or, type SQL } from 'drizzle-orm'
import { getDb } from '../../../../db'
import { requirePermission } from '../../../../identity'
import { vendor, vendors } from '../../../vendors/vendors.entity'

const vendorColumns = getTableColumns(vendors) as Record<string, unknown>
const searchable = ['companyName', 'email', 'npwp', 'city'] as const
const reservedQueryKeys = new Set(['page', 'limit', 'search', 'sort', 'order'])

function filters(query: Record<string, unknown>): SQL[] {
  const conditions: SQL[] = []
  for (const [key, value] of Object.entries(query)) {
    if (reservedQueryKeys.has(key) || value === undefined || value === '') continue
    const column = vendorColumns[key]
    if (!column) throw validationError(`Unknown query parameter "${key}".`)
    conditions.push(eq(column as never, value as never))
  }
  const search = typeof query.search === 'string' && query.search ? `%${query.search}%` : undefined
  if (search) conditions.push(or(...searchable.map((field) => ilike(vendorColumns[field] as never, search))) as SQL)
  return conditions
}

function order(query: Record<string, unknown>): SQL[] {
  if (query.sort) {
    const column = vendorColumns[String(query.sort)]
    if (!column) throw validationError(`Unknown sort column "${String(query.sort)}".`)
    return [query.order === 'desc' ? desc(column as never) : asc(column as never)]
  }
  return [desc(vendors.createdAt)]
}

export const GET = list({
  authorize: requirePermission('list-vendors'),
  run: async (args) => {
    const query = args.state.query
    const conditions = filters(query)
    const where = conditions.length ? and(...conditions) : undefined
    const page = Number(query.page)
    const limit = Number(query.limit)
    const db = getDb()
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(vendors)
        .where(where)
        .orderBy(...order(query))
        .limit(limit)
        .offset((page - 1) * limit),
      db.select({ value: count() }).from(vendors).where(where),
    ])
    return {
      data: rows.map((row) => vendor.schemas.select.parse(row)),
      total: Number(totalRows[0]?.value ?? 0),
    }
  },
})
