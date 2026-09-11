import { spawn, type ChildProcess } from 'node:child_process'
import { watchRouteManifest } from '@southneuhof/sprindle/tooling'

const projectRoot = new URL('..', import.meta.url).pathname
const manifest = '.sprindle-dev/routes.mjs'
const bootStarted = Date.now()
const log = (message: string) => console.log(`[api:dev] ${message} (+${Date.now() - bootStarted}ms)`)
log('Compiling file routes and starting route watcher...')

let server: ChildProcess | undefined
let restarting = false
let stopping = false
let ready = false

function startServer() {
  log('Starting API server...')
  server = spawn('tsx', ['--env-file-if-exists=.env', 'src/server.ts'], { stdio: 'inherit', env: { ...process.env, SPRINDLE_ROUTE_MANIFEST: manifest } })
  server.on('exit', (code, signal) => {
    if (restarting) return
    void watcher?.close().finally(() => process.exit(signal ? 1 : code ?? 0))
  })
}

function restartServer() {
  if (!server || restarting) return
  restarting = true
  const previous = server
  previous.once('exit', () => {
    if (stopping) return
    restarting = false
    startServer()
  })
  previous.kill('SIGTERM')
}

const watcher = await watchRouteManifest(projectRoot, 'src/routes', (error) => {
  if (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`)
    return
  }
  if (ready) restartServer()
}, manifest, false, { declarations: false })
log('Route watcher ready.')
ready = true
startServer()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    if (stopping) return
    stopping = true
    restarting = true
    server?.kill(signal)
    void watcher.close()
    process.exit()
  })
}
