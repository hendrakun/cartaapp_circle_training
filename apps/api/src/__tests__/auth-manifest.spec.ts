import { randomUUID } from 'node:crypto'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'

test.each([
  ['source', false],
  ['bundle', true],
] as const)('loads the %s manifest before application modules', (_name, bundle) => {
  const root = fileURLToPath(new URL('../..', import.meta.url))
  const directory = `.sprindle-auth-${randomUUID()}`
  const output = `${directory}/routes.mjs`
  try {
    const compile = bundle
      ? spawnSync(process.execPath, ['--import', 'tsx', '--eval', `import {compileRouteManifest} from '@southneuhof/sprindle/tooling';void (async()=>{await compileRouteManifest(${JSON.stringify(root)},'src/routes',${JSON.stringify(output)},true)})()`], { cwd: root, env: process.env, encoding: 'utf8', timeout: 30_000 })
      : spawnSync(process.execPath, ['--import', 'tsx', 'scripts/compile-routes.ts', output], { cwd: root, env: process.env, encoding: 'utf8', timeout: 30_000 })
    expect(compile.status, compile.stderr).toBe(0)
    const artifact = join(root, output)
    if (!bundle) expect(readFileSync(artifact, 'utf8')).toMatch(/^import /)
    const script = `void (async()=>{const manifest=(await import(${JSON.stringify(pathToFileURL(artifact).href)})).default;const generatedRoot=manifest.flatMap((route)=>route.scopes).find((scope)=>scope.config.identity);const identity=await generatedRoot.config.identity({c:{req:{raw:new Request('http://localhost/api/auth/get-session')}}});const rootScope=(await import('./src/routes/+scope.ts')).default;const {createApp}=await import('./src/create-app.ts');const closeDb=${bundle ? 'async()=>{}' : `(await import('./src/db.ts')).closeDb`};try{const shared=manifest.some((route)=>route.scopes.includes(rootScope));const response=await createApp(manifest).request('/api/auth/get-session');process.stdout.write(JSON.stringify({identity,shared,status:response.status,body:await response.json()}))}finally{await closeDb()}})()`
    const child = spawnSync(process.execPath, ['--import', 'tsx', '--eval', script], { cwd: root, env: process.env, encoding: 'utf8', timeout: 30_000 })
    expect(child.status, child.stderr).toBe(0)
    expect(JSON.parse(child.stdout)).toEqual({ identity: null, shared: !bundle, status: 200, body: null })
  } finally { rmSync(join(root, directory), { recursive: true, force: true }) }
})
