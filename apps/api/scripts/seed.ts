import { closeDb } from '../src/db'
import { pathToFileURL } from 'node:url'
import { seedAuthorization, seedRoleGroups, seedAdministrator, seedPublicIntakeUser } from './seed-shared'
import { seedVendorMasters } from './seed-vendor-masters'

export async function seedDatabase() {
  await seedRoleGroups()
  await seedAuthorization()
  await seedPublicIntakeUser()
  await seedVendorMasters()
  await seedAdministrator()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDatabase()
    .then(closeDb)
    .catch(async (error: unknown) => {
      await closeDb()
      throw error
    })
}
