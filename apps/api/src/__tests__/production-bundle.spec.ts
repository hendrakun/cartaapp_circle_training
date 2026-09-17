import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'

test('plain Node runs the source-free application with one request asset module', () => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const source = readFileSync(join(root, 'dist', 'application.mjs'), 'utf8')
  const chunks = readdirSync(join(root, 'dist', 'chunks')).filter((name) => name.endsWith('.mjs')).map((name) => readFileSync(join(root, 'dist', 'chunks', name), 'utf8')).join('\n')
  expect(source + chunks).not.toMatch(/(?:from|import)\s*["']@southneuhof\/sprindle|typescript\/|from ["'][^"']*src\//)
  const maps = [join(root, 'dist', 'application.mjs.map'), ...readdirSync(join(root, 'dist', 'chunks')).filter((name) => name.endsWith('.map')).map((name) => join(root, 'dist', 'chunks', name))]
  const assetSources = maps.flatMap((file) => (JSON.parse(readFileSync(file, 'utf8')) as { sources: string[] }).sources.filter((name) => name.endsWith('/src/storage/assets.ts')))
  expect(assetSources).toHaveLength(1)

  const fixture = mkdtempSync(join(tmpdir(), 'carta-api-bundle-'))
  try {
    cpSync(join(root, 'dist'), join(fixture, 'dist'), { recursive: true })
    mkdirSync(join(fixture, 'node_modules'))
    for (const entry of readdirSync(join(root, 'node_modules'), { withFileTypes: true })) {
      if (entry.name === '@southneuhof') continue
      symlinkSync(join(root, 'node_modules', entry.name), join(fixture, 'node_modules', entry.name), entry.isDirectory() ? 'dir' : 'file')
    }
    const script = `const m=await import('./dist/application.mjs');const response=await m.app.request('/health');const session=await m.app.request('/api/auth/get-session');const asset=m.runWithAssetRequestUrl('https://api.example.test/request',()=>m.storedAsset('uploads/file.pdf'));process.stdout.write(JSON.stringify({status:response.status,body:await response.json(),sessionStatus:session.status,session:await session.json(),url:asset.url}))`
    const environment = { ...process.env }
    delete environment.NODE_OPTIONS
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', script], { cwd: fixture, env: environment, encoding: 'utf8' })
    expect(child.status, child.stderr).toBe(0)
    expect(JSON.parse(child.stdout)).toEqual({ status: 200, body: { ok: true }, sessionStatus: 200, session: null, url: 'https://api.example.test/files/object?key=uploads%2Ffile.pdf' })
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})
