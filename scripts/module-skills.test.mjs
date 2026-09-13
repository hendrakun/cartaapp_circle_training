import { strict as assert } from 'node:assert'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = join(root, '.agents/skills')
const active = ['carta-module-development', 'carta-module-design', 'carta-module-plan', 'verify-carta-module', 'api-conventions', 'build-resource-form', 'web-ui-surfaces', 'domain-modeling']
function markdownFiles(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? markdownFiles(join(path, entry.name)) : entry.name.endsWith('.md') ? [join(path, entry.name)] : [])
}
function prose(text) {
  let fence = null
  return text.split('\n').filter(line => {
    const opening = line.match(/^\s*(`{3,}|~{3,})/)
    if (opening) { if (!fence) fence = opening[1]; else if (opening[1][0] === fence[0] && opening[1].length >= fence.length) fence = null; return false }
    return fence === null
  }).join('\n')
}

test('active module skills have unique discoverable identities and real local reference targets', () => {
  const failures = []
  for (const name of active) {
    const skill = readFileSync(join(skillsRoot, name, 'SKILL.md'), 'utf8')
    assert.match(skill, new RegExp(`^---\\nname: ${name}\\ndescription: [^\\n]+\\n---`))
    for (const file of markdownFiles(join(skillsRoot, name))) {
      for (const [, target] of prose(readFileSync(file, 'utf8')).matchAll(/\[[^\]\n]+\]\(([^)\n]+)\)/g)) {
        if (/^(?:[a-z]+:|#|<)/i.test(target)) continue
        const path = decodeURIComponent(target.split('#')[0])
        if (path && !existsSync(resolve(dirname(file), path))) failures.push(`${file}: ${target}`)
      }
    }
  }
  assert.deepEqual(failures, [])
})

test('retired discovery skills and calls are absent from the active module workflow', () => {
  for (const name of ['brainstorming', 'grilling', 'grill-with-docs']) assert.equal(existsSync(join(skillsRoot, name)), false, name)
  const failures = []
  for (const name of active) for (const file of markdownFiles(join(skillsRoot, name))) {
    for (const [, invoked] of readFileSync(file, 'utf8').matchAll(/\$([a-z]+(?:-[a-z]+)+)/g)) {
      if (!existsSync(join(skillsRoot, invoked, 'SKILL.md')) || ['improve', 'brainstorming', 'grilling', 'grill-with-docs'].includes(invoked)) failures.push(`${file}: $${invoked}`)
    }
  }
  assert.deepEqual(failures, [])
})

test('root module command aliases resolve to actual local helper scripts', () => {
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts
  for (const name of ['scaffold:bounded-module', 'verify:module', 'module:evidence']) {
    assert.match(scripts[name], /^node scripts\/[\w-]+\.mjs$/)
    assert.ok(existsSync(join(root, scripts[name].slice(5))), name)
  }
  assert.ok(!Object.hasOwn(scripts, 'integrate:bounded-module'), 'integrate:bounded-module alias is removed')
})

test('API test entrypoints require the explicit test environment and migrations run the preflight first', () => {
  const scripts = JSON.parse(readFileSync(join(root, 'apps/api/package.json'), 'utf8')).scripts
  for (const name of ['test', 'test:focused', 'db:migrate:test', 'db:seed:test']) {
    assert.ok(scripts[name].includes('--env-file=.env.test'), name)
    assert.ok(!scripts[name].includes('--env-file-if-exists=.env.test'), name)
  }
  assert.ok(scripts['db:migrate:test'].indexOf('scripts/test-target.mjs &&') < scripts['db:migrate:test'].indexOf('drizzle-kit/bin.cjs migrate'))
  for (const name of ['test', 'test:focused', 'db:seed:test']) assert.ok(scripts[name].includes('pnpm run db:migrate:test &&'), name)
})
