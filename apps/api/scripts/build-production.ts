import { mkdir, rm, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { compileRouteManifest } from '@southneuhof/sprindle/tooling'

const root = new URL('..', import.meta.url).pathname
const generatedName = `.sprindle-build-${process.pid}-${randomUUID()}`
const generated = new URL(`../${generatedName}/`, import.meta.url).pathname
const resolveFromApi = createRequire(new URL('../package.json', import.meta.url))
try {
  await rm(generated, { recursive: true, force: true })
  await mkdir(generated, { recursive: true })
  await compileRouteManifest(root, 'src/routes', `${generatedName}/routes.mjs`, false, { declarations: false })
  await writeFile(`${generated}application.ts`, `import manifest from './routes.mjs';import {createApp} from '../src/create-app';import {assertRouteEntitiesBound,bindRouteEntities} from '@southneuhof/sprindle/hono';import {getDb,getDomainSchema} from '../src/db';export {runWithAssetRequestUrl,storedAsset} from '../src/storage/assets';getDb();bindRouteEntities(manifest,getDomainSchema().entities);assertRouteEntitiesBound(manifest);export const routeManifest=manifest;export const app=createApp(manifest);`)
  await writeFile(`${generated}server.ts`, `import {serve} from '@hono/node-server';import {app} from './application';const port=Number(process.env.API_PORT);if(!port)throw new Error('API_PORT is not set');serve({fetch:app.fetch,port});console.log('Listening on port '+port);`)
  await rm(`${root}dist`, { recursive: true, force: true })
  await build({
    entryPoints: { application: `${generated}application.ts`, server: `${generated}server.ts` },
    outdir: `${root}dist`,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    packages: 'external',
    plugins: [{ name: 'bundle-sprindle', setup(context) { context.onResolve({ filter: /^@southneuhof\/sprindle(?:\/.*)?$/ }, (args) => ({ path: resolveFromApi.resolve(args.path) })) } }],
    sourcemap: true,
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    outExtension: { '.js': '.mjs' },
  })
} finally {
  await rm(generated, { recursive: true, force: true })
}
