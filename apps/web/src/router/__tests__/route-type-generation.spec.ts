import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'

const run = promisify(execFile)
const fixtures: string[] = []
const repoRoot = resolve(import.meta.dirname, '../../../../..')
const generator = join(repoRoot, 'apps/web/scripts/generate-route-types.mjs')

afterEach(async () => Promise.all(fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true, force: true }))))

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'carta-route-types-'))
  fixtures.push(root)
  for (const [relative, source] of Object.entries(files)) {
    const file = join(root, 'src/routes', relative)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, source)
  }
  return root
}

async function generate(root: string) {
  return run(process.execPath, [generator, root], { cwd: repoRoot, timeout: 10_000 })
}

async function names(root: string) {
  const source = await readFile(join(root, 'src/route-map.d.ts'), 'utf8')
  return [...source.matchAll(/'([^']+)': RouteRecordInfo</g)].map((match) => match[1])
}

describe('route type generation', () => {
  it('creates and refreshes route declarations for additions, renames, and deletions', async () => {
    const root = await fixture({ 'alpha.route.vue': '<template />' })
    await expect(generate(root)).resolves.toMatchObject({ stderr: '' })
    expect(await names(root)).toEqual(['alpha'])

    await writeFile(join(root, 'src/routes/beta.route.vue'), '<template />')
    await generate(root)
    expect(await names(root)).toEqual(['alpha', 'beta'])

    await rename(join(root, 'src/routes/alpha.route.vue'), join(root, 'src/routes/gamma.route.vue'))
    await generate(root)
    expect(await names(root)).toEqual(['beta', 'gamma'])

    await rm(join(root, 'src/routes/beta.route.vue'))
    await generate(root)
    expect(await names(root)).toEqual(['gamma'])

    await generate(root)
    expect(await names(root)).toEqual(['gamma'])
  })

  it('rejects duplicate generated names', async () => {
    const root = await fixture({
      'alpha.route.vue': '<template />',
      'group/alpha.route.vue': '<route>{ "name": "alpha" }</route><template />',
    })

    await expect(generate(root)).rejects.toMatchObject({ code: 1 })
  })

  it('makes a deleted route fail through the real resource contract', async () => {
    const root = await fixture({ 'alpha.route.vue': '<template />', 'keeper.route.vue': '<template />' })
    const consumer = join(root, 'consumer.ts')
    const tsconfig = join(root, 'tsconfig.json')
    const loom = join(repoRoot, 'packages/loom/src/resources/defineResource.ts')
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await symlink(join(repoRoot, 'apps/web/node_modules/vue-router'), join(root, 'node_modules/vue-router'))
    await writeFile(
      consumer,
      `import { defineResource } from '@southneuhof/loom'
const validate = (value: unknown) => ({ success: true as const, data: value as { id: string } })
const schema = { identity: 'id' as const, record: { schema: { validate } } }
defineResource(schema, { key: 'fixture', actions: { list: { run: async () => ({ data: [] }), route: { name: 'alpha' } } } })
`
    )
    await writeFile(
      tsconfig,
      JSON.stringify({
        compilerOptions: {
          strict: false,
          noEmit: true,
          skipLibCheck: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          target: 'es2022',
          paths: {
            '@southneuhof/loom': [loom],
          },
        },
        files: [join(root, 'src/route-map.d.ts'), consumer],
      })
    )
    const compile = () => run('pnpm', ['exec', 'tsc', '-p', tsconfig], { cwd: repoRoot, timeout: 20_000 })

    await generate(root)
    await expect(compile()).resolves.toMatchObject({ stderr: '' })
    await rm(join(root, 'src/routes/alpha.route.vue'))
    await generate(root)
    expect(await names(root)).toEqual(['keeper'])
    await expect(compile()).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringMatching(/consumer\.ts\(4,\d+\): error TS2322: Type '"alpha"' is not assignable/),
    })
    await writeFile(join(root, 'src/routes/alpha.route.vue'), '<template />')
    await generate(root)
    await expect(compile()).resolves.toMatchObject({ stderr: '' })
  })

  it('checks optional, repeatable, empty, and exact resource parameters', async () => {
    const root = await fixture({
      'empty.route.vue': '<template />',
      'docs/[[lang]]/[...path].route.vue': '<template />',
      'repeat/[tags]+.route.vue': '<template />',
      'optional/[[value]].route.vue': '<template />',
    })
    const consumer = join(root, 'consumer.ts')
    const tsconfig = join(root, 'tsconfig.json')
    const loom = join(repoRoot, 'packages/loom/src/resources/defineResource.ts')
    await mkdir(join(root, 'node_modules'), { recursive: true })
    await symlink(join(repoRoot, 'apps/web/node_modules/vue-router'), join(root, 'node_modules/vue-router'))
    await generate(root)
    await writeFile(
      consumer,
      `import { defineResource } from '@southneuhof/loom'
const validate = (value: unknown) => ({ success: true as const, data: value as { id: string } })
const schema = { identity: 'id' as const, record: { schema: { validate } } }
const extra = { path: ['one'], extra: 'no' }
const extraCallback = (_id: string) => extra
defineResource(schema, { key: 'valid-empty', actions: { list: { run: async () => ({ data: [] }), route: { name: 'empty' } } } })
defineResource(schema, { key: 'valid-docs', actions: { detail: { run: async ({ id }) => ({ id: String(id) }), route: { name: 'docs', params: (id) => { const identity: string = id; return { lang: identity, path: 'one' } } } } } })
defineResource(schema, { key: 'valid-repeat', actions: { create: { run: async (input: {}) => ({ id: '1', ...input }), route: { name: 'repeat', params: { tags: ['one', 'two'] } } } } })
defineResource(schema, { key: 'valid-optional', actions: { update: { run: async (id: string, input: {}) => ({ id, ...input }), route: { name: 'optional', params: {} } } } })
// @ts-expect-error a route without parameters rejects supplied keys.
defineResource(schema, { key: 'empty-extra', actions: { list: { run: async () => ({ data: [] }), route: { name: 'empty', params: { extra: 'no' } } } } })
// @ts-expect-error repeatable parameter elements use Vue Router raw values.
defineResource(schema, { key: 'bad-array', actions: { list: { run: async () => ({ data: [] }), route: { name: 'repeat', params: { tags: [true] } } } } })
// @ts-expect-error inferred parameter objects cannot add keys.
defineResource(schema, { key: 'exact-object', actions: { detail: { run: async () => undefined, route: { name: 'docs', params: extra } } } })
// @ts-expect-error predeclared callbacks cannot add keys.
defineResource(schema, { key: 'exact-callback', actions: { detail: { run: async () => undefined, route: { name: 'docs', params: extraCallback } } } })
`
    )
    await writeFile(
      tsconfig,
      JSON.stringify({
        compilerOptions: {
          strict: false,
          noEmit: true,
          skipLibCheck: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          target: 'es2022',
          paths: { '@southneuhof/loom': [loom] },
        },
        files: [join(root, 'src/route-map.d.ts'), consumer],
      })
    )

    await expect(run('pnpm', ['exec', 'tsc', '-p', tsconfig], { cwd: repoRoot, timeout: 20_000 })).resolves.toMatchObject({ stderr: '' })
  })
})
