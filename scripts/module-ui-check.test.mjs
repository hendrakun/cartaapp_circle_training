import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { checkUiContract } from './module-ui-check.mjs'

const contract = { surfaces: [{ file: 'page.vue', kind: 'detail', components: [{ name: 'DetailView', from: '@southneuhof/loom' }] }] }
const page = '<script setup lang="ts">import { DetailView as RecordView, Button } from "@southneuhof/loom"</script><template><RecordView><template #controls><Button>Close</Button></template></RecordView></template>'
const check = (source, selected = contract) => checkUiContract(selected, { read: () => source })

test('requires rendered framework imports and resolves capitalized native names', () => {
  assert.deepEqual(check(page).errors, [])
  assert.deepEqual(check(page).review, [])
  for (const source of [
    page.replace(', Button', ''),
    page.replaceAll('<RecordView>', '<section>').replaceAll('</RecordView>', '</section>'),
    page.replace('@southneuhof/loom', './local-copy'),
    page.replace('import {', 'import type {'),
  ]) assert.ok(check(source).errors.length, source)
  assert.deepEqual(check(page.replace('<Button>Close</Button>', '<button>Close</button>')).errors, [])
  assert.deepEqual(check(page.replaceAll('RecordView>', 'record-view>')).errors, [])
})

test('source CLI checks nested pages without a contract and detects missing imports', t => {
  const root = mkdtempSync(join(tmpdir(), 'carta-ui-sources-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'detail'))
  writeFileSync(join(root, 'detail.route.vue'), page)
  const child = join(root, 'detail', 'index.route.vue')
  const run = (...paths) => spawnSync(process.execPath,
    [fileURLToPath(new URL('./module-ui-check.mjs', import.meta.url)), '--sources', ...paths], { encoding: 'utf8' })
  writeFileSync(child, page)
  assert.equal(run(root).status, 0)
  writeFileSync(child, page.replace(', Button', ''))
  const broken = run(root)
  assert.equal(broken.status, 1)
  assert.match(broken.stderr, /detail\/index\.route\.vue:1: unresolved component <Button>/)
  writeFileSync(child, page.replace('<Button>Close</Button>', '<input type="file">'))
  const raw = run(root)
  assert.equal(raw.status, 2)
  assert.match(raw.stdout, /native <input>/)
  assert.equal(run(child).status, 2)
  assert.equal(run().status, 1)
  assert.equal(run(join(root, 'missing.vue')).status, 1)
})

test('native interactive controls need source review with file and line', () => {
  const raw = {
    button: page.replace('<Button>Close</Button>', '<button>Close</button>'),
    input: page.replace('<Button>Close</Button>', '<input type="text" value="Close">'),
    select: page.replace('<Button>Close</Button>', '<select><option>Close</option></select>'),
    textarea: page.replace('<Button>Close</Button>', '<textarea>Close</textarea>'),
  }
  for (const [tag, source] of Object.entries(raw)) {
    const result = check(source)
    assert.deepEqual(result.errors, [], tag)
    assert.equal(result.review.length, 1, tag)
    assert.match(result.review[0], new RegExp(`^page\\.vue:1: native <${tag}> needs source review`))
  }
  // A gap explains the requirement but the reviewer still resolves the item.
  const selected = structuredClone(contract)
  selected.surfaces[0].gap = 'A requirement for review'
  const gapped = check(raw.button, selected)
  assert.deepEqual(gapped.errors, [])
  assert.equal(gapped.review.length, 2)
  assert.ok(gapped.review.some(item => item.includes('native <button> needs source review')))
})

test('hidden inputs and layout elements stay silent', () => {
  const silent = [
    page,
    page.replace('<Button>Close</Button>', '<input type="hidden" value="token">'),
    page.replace('<Button>Close</Button>', '<INPUT TYPE="HIDDEN" value="token">'),
    page.replace('<Button>Close</Button>', '<section><div><span>Close</span></div></section>'),
  ]
  for (const source of silent) assert.deepEqual(check(source).review, [], source)
  const needsReview = [
    page.replace('<Button>Close</Button>', '<input value="Close">'),
    page.replace('<Button>Close</Button>', '<input :type="kind" value="Close">'),
    page.replace('<Button>Close</Button>', '<input v-bind="fields" value="Close">'),
  ]
  for (const source of needsReview) {
    const result = check(source)
    assert.deepEqual(result.errors, [], source)
    assert.equal(result.review.length, 1, source)
    assert.match(result.review[0], /^page\.vue:1: native <input> needs source review/)
  }
})

test('requires a concrete Create override and rejects unused exceptions', () => {
  const source = page.replace('#controls', '#create-action')
  assert.ok(check(source).errors.some(error => error.includes('Create override')))
  const selected = structuredClone(contract)
  selected.surfaces[0].extensions = [{ slot: 'create-action', reason: 'Requested split Create menu' }]
  assert.deepEqual(check(source, selected).errors, [])
  assert.equal(check(source, selected).review.length, 1)
  assert.ok(check(page, selected).errors.length)
})

test('global declarations require source registration, not a type or stub', () => {
  const selected = { ...contract, globals: [{ tag: 'SharedWidget', registration: 'main.ts' }] }
  const source = page.replace('<Button>', '<SharedWidget>').replace('</Button>', '</SharedWidget>')
  for (const registration of ['app.component("SharedWidget", Widget)', 'interface GlobalComponents { SharedWidget: Widget }']) {
    const result = checkUiContract(selected, { read: file => file === 'main.ts' ? registration : source })
    assert.equal(result.errors.length === 0, registration.startsWith('app.component'))
  }
})


test('surface kind prevents declaring only the hand-written replacement', () => {
  const source = '<script setup>import { NavigationHeader } from "@southneuhof/loom"</script><template><NavigationHeader/><dl>Fields</dl></template>'
  const selected = { surfaces: [{ file: 'page.vue', kind: 'detail', components: [{ name: 'NavigationHeader', from: '@southneuhof/loom' }] }] }
  assert.ok(check(source, selected).errors.some(error => error.includes('requires DetailView')))
  selected.surfaces[0].gap = 'A requirement for review'
  assert.ok(check(source, selected).errors.some(error => error.includes('still requires Detail')))
  assert.equal(check(source, selected).review.length, 1)
  selected.surfaces[0].components[0].gap = 'A misplaced exception'
  assert.ok(check(source, selected).errors.length)
})


test('CLI keeps an exception separate from a passing check', t => {
  const root = mkdtempSync(join(tmpdir(), 'carta-ui-check-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const manifest = join(root, 'ui-contract.json')
  const selected = structuredClone(contract)
  writeFileSync(join(root, 'page.vue'), page)
  const run = () => {
    writeFileSync(manifest, JSON.stringify(selected))
    return spawnSync(process.execPath, [fileURLToPath(new URL('./module-ui-check.mjs', import.meta.url)), manifest, root], { encoding: 'utf8' })
  }
  assert.equal(run().status, 0)
  selected.surfaces[0].gap = 'A requirement for independent review'
  assert.equal(run().status, 2)
  selected.surfaces[0].components[0].name = 'MissingView'
  assert.equal(run().status, 1)
})

test('CLI reports exit 2 for a raw control and keeps 0/1 meanings', t => {
  const root = mkdtempSync(join(tmpdir(), 'carta-ui-check-cli-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const manifest = join(root, 'ui-contract.json')
  writeFileSync(manifest, JSON.stringify(contract))
  const run = (source) => {
    writeFileSync(join(root, 'page.vue'), source)
    return spawnSync(process.execPath, [fileURLToPath(new URL('./module-ui-check.mjs', import.meta.url)), manifest, root], { encoding: 'utf8' })
  }
  const clean = run(page)
  assert.equal(clean.status, 0)
  assert.match(clean.stdout, /PASS/)
  const raw = run(page.replace('<Button>Close</Button>', '<button>Close</button>'))
  assert.equal(raw.status, 2)
  assert.match(raw.stdout, /REVIEW: page\.vue:1: native <button> needs source review/)
  const broken = run(page.replace(', Button', ''))
  assert.equal(broken.status, 1)
  assert.match(broken.stderr, /FAIL/)
})


test('record routes cannot bypass the View check by declaring a custom kind', () => {
  const selected = structuredClone(contract)
  selected.surfaces[0].file = 'detail.route.vue'
  selected.surfaces[0].kind = 'custom'
  selected.surfaces[0].gap = 'Several record sections'
  assert.ok(check(page, selected).errors.some(error => error.includes('requires kind detail')))
})


test('accepts the public default View import', () => {
  const source = '<script setup>import RecordView from "@southneuhof/loom/components/views/DetailView.vue"</script><template><RecordView/></template>'
  const selected = structuredClone(contract)
  selected.surfaces[0].components = [{ name: 'default', from: '@southneuhof/loom/components/views/DetailView.vue' }]
  assert.deepEqual(check(source, selected).errors, [])
})


test('a justified record layout retains the Detail primitive and requires review', () => {
  const source = '<script setup>import { Detail } from "@southneuhof/loom"</script><template><Detail/></template>'
  const selected = { surfaces: [{ file: 'detail.route.vue', kind: 'detail', gap: 'A requirement for review', components: [{ name: 'Detail', from: '@southneuhof/loom' }] }] }
  const result = check(source, selected)
  assert.deepEqual(result.errors, [])
  assert.equal(result.review.length, 1)
})
