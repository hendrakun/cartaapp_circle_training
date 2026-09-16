import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Specs share one migrated test database. Keep shared fixture work serial.
    fileParallelism: false,
  },
})
