import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, rm, writeFile, rename } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const routeRoot = join(root, 'src/routes/(dev-proof)')
const port = 41000 + Math.floor(Math.random() * 1000)
const base = `http://127.0.0.1:${port}`

async function eventually(path, status, body) {
  const deadline = Date.now() + 20_000
  let last = 'no response'
  do {
    try {
      const response = await fetch(base + path)
      last = `${response.status} ${await response.clone().text()}`
      if (response.status === status) {
        if (body) assert.deepEqual(await response.json(), body)
        return
      }
    } catch { /* The server can be between valid manifest revisions. */ }
    await new Promise((resolve) => setTimeout(resolve, 100))
  } while (Date.now() < deadline)
  assert.fail(`development server did not return ${status} for ${path}; last response: ${last}`)
}

async function stop(child) {
  const started = Date.now()
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL') } catch {}
      reject(new Error('development server did not stop after SIGINT'))
    }, 3_000)
    child.once('exit', () => { clearTimeout(timeout); resolve() })
    process.kill(-child.pid, 'SIGINT')
  })
  assert.ok(Date.now() - started < 3_000, 'development server shutdown took too long')
}

test('cold dev starts after compilation and reloads add, invalid recovery, move, and delete', { timeout: 60_000 }, async () => {
  await rm(join(root, '.sprindle-dev'), { recursive: true, force: true })
  await rm(routeRoot, { recursive: true, force: true })
  const asset = join(routeRoot, 'asset')
  await mkdir(asset, { recursive: true })
  await writeFile(join(asset, '+server.ts'), `import {defineRoute} from '@southneuhof/sprindle';import {storedAsset} from '../../../storage/assets';export const GET=defineRoute({action:()=>storedAsset('uploads/file.pdf')})`)
  const child = spawn('pnpm', ['run', 'dev'], { cwd: root, env: { ...process.env, API_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  try {
    await eventually('/health', 200, { ok: true })
    await eventually('/asset', 200, { kind: 'file', id: 'uploads/file.pdf', url: `${base}/files/object?key=uploads%2Ffile.pdf`, name: 'file.pdf', mimeType: 'application/pdf' })
    const added = join(routeRoot, 'added')
    await mkdir(added, { recursive: true })
    await writeFile(join(added, '+server.ts'), `import {defineRoute} from '@southneuhof/sprindle';export const GET=defineRoute({action:()=>({version:1})})`)
    await eventually('/added', 200, { version: 1 })
    await writeFile(join(added, '+server.ts'), `import {defineRoute} from '@southneuhof/sprindle';export const GET=defineRoute({action:()=>({version:)})`)
    await new Promise((resolve) => setTimeout(resolve, 300))
    await eventually('/health', 200, { ok: true })
    await writeFile(join(added, '+server.ts'), `import {defineRoute} from '@southneuhof/sprindle';export const GET=defineRoute({action:()=>({version:2})})`)
    await eventually('/added', 200, { version: 2 })
    await rename(added, join(routeRoot, 'moved'))
    await eventually('/moved', 200, { version: 2 })
    await eventually('/added', 404)
    await rm(join(routeRoot, 'moved'), { recursive: true })
    await eventually('/moved', 404)
  } finally {
    await stop(child)
    await rm(routeRoot, { recursive: true, force: true })
  }
  assert.match(output, /Listening on port/)
})
