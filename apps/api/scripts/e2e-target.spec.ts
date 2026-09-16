import { beforeEach, describe, expect, it } from 'vitest'
import { assertE2eStorageTarget, assertE2eTarget, E2E_DATABASE_PURPOSE } from './e2e-target'

const configuredDatabase = 'configured-e2e-database'
const configuredBucket = 'configured-e2e-bucket'

beforeEach(() => {
  process.env.CARTA_DATABASE_PURPOSE = 'e2e'
  process.env.CARTA_E2E_DATABASE_NAME = configuredDatabase
  process.env.S3_BUCKET = configuredBucket
})

describe('E2E target guards', () => {
  it.each([
    ['development database', 'qhsse_hk3', configuredBucket, 'e2e'],
    ['Vitest database', 'qhsse_hk_test', configuredBucket, 'e2e'],
    ['wrong purpose', configuredDatabase, configuredBucket, 'development'],
    ['wrong bucket', configuredDatabase, 'qhsse-hk', 'e2e'],
  ])('rejects %s', (_label, databaseName, bucket, purpose) => {
    expect(() => assertE2eTarget({ databaseName, bucket, purpose })).toThrow()
  })

  it.each([
    ['purpose', 'CARTA_DATABASE_PURPOSE'],
    ['database name', 'CARTA_E2E_DATABASE_NAME'],
    ['bucket', 'S3_BUCKET'],
  ])('requires the configured %s', (_label, name) => {
    delete process.env[name]
    expect(() => assertE2eTarget({ databaseName: configuredDatabase, bucket: configuredBucket, purpose: 'e2e' })).toThrow(name)
  })

  it('accepts the exact configured database and bucket', () => {
    expect(() =>
      assertE2eTarget({
        databaseName: configuredDatabase,
        bucket: configuredBucket,
        purpose: E2E_DATABASE_PURPOSE,
      })
    ).not.toThrow()
  })

  it('tracks the configured database name instead of a product constant', () => {
    const previous = process.env.CARTA_E2E_DATABASE_NAME
    process.env.CARTA_E2E_DATABASE_NAME = 'next-e2e-database'
    try {
      expect(() =>
        assertE2eTarget({
          databaseName: 'next-e2e-database',
          bucket: configuredBucket,
          purpose: E2E_DATABASE_PURPOSE,
        })
      ).not.toThrow()
      expect(() =>
        assertE2eTarget({
          databaseName: configuredDatabase,
          bucket: configuredBucket,
          purpose: E2E_DATABASE_PURPOSE,
        })
      ).toThrow()
    } finally {
      if (previous === undefined) delete process.env.CARTA_E2E_DATABASE_NAME
      else process.env.CARTA_E2E_DATABASE_NAME = previous
    }
  })

  it('rejects every bucket except the configured bucket', () => {
    expect(() => assertE2eStorageTarget('qhsse-hk')).toThrow()
    expect(() => assertE2eStorageTarget(configuredBucket)).not.toThrow()
  })
})
