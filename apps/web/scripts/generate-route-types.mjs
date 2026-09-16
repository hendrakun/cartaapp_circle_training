import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import process from 'node:process'
import { runnerImport } from 'vite'
import { createRoutesContext, resolveOptions } from 'vue-router/unplugin'

const appRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const root = resolve(process.argv[2] ?? appRoot)
const optionsPath = fileURLToPath(new URL('../src/router/file-routing/options.ts', import.meta.url))
const { module } = await runnerImport(optionsPath, { root: appRoot, configFile: false, envDir: false })
const options = module.fileRouteOptions
const context = createRoutesContext(resolveOptions({ ...options, root, watch: false }))

try {
  await context.scanPages(false)
  await context.writeConfigFiles()
} finally {
  context.stopWatcher()
}
