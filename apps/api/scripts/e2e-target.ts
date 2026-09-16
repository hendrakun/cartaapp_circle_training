import { sql } from 'drizzle-orm'
import { getDb } from '../src/db'

export const E2E_DATABASE_PURPOSE = 'e2e'

function requiredE2eValue(name: 'CARTA_DATABASE_PURPOSE' | 'CARTA_E2E_DATABASE_NAME' | 'S3_BUCKET') {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`E2E config requires ${name}. Set it in apps/api/.env.e2e.`)
  return value
}

type E2eTarget = {
  databaseName: string | undefined
  bucket: string | undefined
  purpose: string | undefined
}

export function assertE2eStorageTarget(bucket: string | undefined = process.env.S3_BUCKET): asserts bucket is string {
  const required = requiredE2eValue('S3_BUCKET')
  if (bucket !== required) throw new Error('E2E storage guard refused the configured bucket.')
}

export function assertE2eTarget(target: E2eTarget) {
  requiredE2eValue('CARTA_DATABASE_PURPOSE')
  requiredE2eValue('CARTA_E2E_DATABASE_NAME')
  requiredE2eValue('S3_BUCKET')
  if (target.purpose !== E2E_DATABASE_PURPOSE) throw new Error('E2E database guard requires CARTA_DATABASE_PURPOSE=e2e.')
  if (target.databaseName !== requiredE2eValue('CARTA_E2E_DATABASE_NAME')) throw new Error('E2E database guard refused the connected database.')
  assertE2eStorageTarget(target.bucket)
}

export async function connectedDatabaseName() {
  const result = await getDb().execute(sql`select current_database() as database_name`)
  const databaseName = (result.rows[0] as { database_name?: unknown } | undefined)?.database_name
  if (typeof databaseName !== 'string' || !databaseName) throw new Error('Could not read the connected database name.')
  return databaseName
}

export async function assertConnectedE2eTarget() {
  assertE2eTarget({
    databaseName: await connectedDatabaseName(),
    bucket: process.env.S3_BUCKET,
    purpose: process.env.CARTA_DATABASE_PURPOSE,
  })
}
