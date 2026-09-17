import { fileURLToPath } from 'node:url'
import { compileRouteManifest } from '@southneuhof/sprindle/tooling'
const target = await compileRouteManifest(fileURLToPath(new URL('..', import.meta.url)), 'src/routes', process.argv[2] ?? '.sprindle-test/routes.mjs', false, { declarations: false })
process.stdout.write(`${target}\n`)
