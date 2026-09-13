import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const ownerPaths = [
  'apps/api/src/domains.ts',
  'apps/api/src/authorization/catalog.ts',
  'apps/api/scripts/seed.ts',
  'apps/web/src/manifest/navigation.ts',
]
export function copyCurrentOwners(root) {
  for (const path of ownerPaths) {
    const destination = resolve(root, path)
    mkdirSync(dirname(destination), { recursive: true })
    writeFileSync(destination, readFileSync(resolve(sourceRoot, path)))
  }
}
export function boundedConfig() {
  return {
    kind: 'bounded-module', slug: 'test-catalog', table: 'test_catalog', symbol: 'TestCatalog', title: 'Test Catalog', singular: 'Test Catalog',
    fields: [
      { key: 'label', type: 'text', label: 'Label', required: true },
      { key: 'enabled', type: 'boolean', label: 'Enabled', default: true },
    ],
    actions: {
      list: { fields: ['label', 'enabled'], permission: 'list-test-catalog' },
      detail: { fields: ['label', 'enabled'], permission: 'detail-test-catalog' },
      create: { fields: ['label', 'enabled'], permission: 'create-test-catalog' },
      update: { fields: ['label', 'enabled'], permission: 'update-test-catalog' },
      delete: { permission: 'delete-test-catalog' },
    },
    permissions: Object.fromEntries(['list', 'detail', 'create', 'update', 'delete'].map(action => [`${action}-test-catalog`, { name: `${action} test catalog`, description: `${action} test catalog records.` }])),
    navigation: { group: 'settings', after: 'settings-roles', title: 'Test Catalog', icon: 'folder' },
    seed: {
      records: [{ id: 'test-catalog-1', label: 'One', enabled: true }],
      updateFields: ['label', 'enabled'],
    },
    test: {
      record: { label: 'One', enabled: true },
      update: { label: 'Two' },
    },
  }
}
