#!/usr/bin/env node
// Check declared Vue surfaces. Semantic acceptance remains with the reviewer.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../apps/web/package.json', import.meta.url))
const { parse, compileScript } = require('vue/compiler-sfc')
const ts = require('typescript')
const routeKinds = { 'detail.route.vue': 'detail', 'create.route.vue': 'create', 'edit.route.vue': 'update' }
const views = { list: 'ListView', detail: 'DetailView', create: 'FormView', update: 'FormView' }
// Native elements that can replace a shared control. Other native elements
// (layout, text, option) add no item.
const nativeControls = new Set(['button', 'input', 'select', 'textarea'])
const normalize = name => name.replace(/-/g, '').toLowerCase()
const builtins = new Set(['component', 'slot', 'template', 'transition', 'transitiongroup', 'keepalive', 'teleport', 'suspense', 'routerlink', 'routerview'])

// A literal type="hidden" input carries state, not an interaction, so it
// adds no item. Any other type source (absent, dynamic, spread) can render
// a visible control, so it needs review.
function hiddenInput(node) {
  const type = (node.props ?? []).find(prop =>
    (prop.type === 6 && prop.name?.toLowerCase() === 'type')
    || (prop.type === 7 && prop.name === 'bind' && prop.arg?.content === 'type'))
  if (!type) return false
  return type.type === 6
    && typeof type.value?.content === 'string'
    && type.value.content.toLowerCase() === 'hidden'
}

function walk(node, visit) {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function registered(source, tag) {
  const file = ts.createSourceFile('registration.ts', source, ts.ScriptTarget.Latest, true)
  let found = false
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
      && node.expression.name.text === 'component' && node.arguments.length === 2
      && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === tag) found = true
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

export function checkUiContract(contract, { root = process.cwd(), read = path => readFileSync(resolve(root, path), 'utf8') } = {}) {
  const errors = [], review = []
  if (!Array.isArray(contract.surfaces) || !contract.surfaces.length) return { errors: ['Declare at least one changed surface.'], review }
  const globals = new Set()
  for (const global of contract.globals ?? []) {
    if (!global.tag || !global.registration || !registered(read(global.registration), global.tag)) errors.push(`Global ${global.tag}: no literal component registration in ${global.registration}`)
    else { globals.add(normalize(global.tag)); review.push(`Confirm registration is installed: ${global.tag} in ${global.registration}`) }
  }
  const files = new Set()
  for (const surface of contract.surfaces) {
    const label = surface.file
    if (!label || files.has(label)) { errors.push(`Missing or duplicate surface: ${label}`); continue }
    files.add(label)
    const routeKind = routeKinds[basename(label)]
    if (routeKind && surface.kind !== routeKind) errors.push(`${label}: route convention requires kind ${routeKind}; record composition exceptions in gap`)
    if (!(surface.kind in views) && surface.kind !== 'custom') errors.push(`${label}: kind must be list, detail, create, update or custom`)
    if (surface.kind === 'custom' && !surface.gap?.trim()) errors.push(`${label}: custom surface needs a specific framework gap`)
    try {
      const { descriptor, errors: parseErrors } = parse(read(label), { filename: resolve(root, label) })
      if (parseErrors.length) throw new Error(parseErrors.map(String).join('; '))
      if (!descriptor.template?.ast) throw new Error('Missing template')
      const script = descriptor.script || descriptor.scriptSetup ? compileScript(descriptor, { id: label }) : { imports: {}, bindings: {} }
      const imports = script.imports ?? {}, bindings = script.bindings ?? {}
      const tags = new Set(), slots = new Set()
      walk(descriptor.template.ast, node => {
        if (node.type !== 1) return
        if (node.tagType === 0 && nativeControls.has(node.tag.toLowerCase())) {
          if (!(node.tag.toLowerCase() === 'input' && hiddenInput(node))) {
            review.push(`${label}:${node.loc.start.line}: native <${node.tag.toLowerCase()}> needs source review against the shared controls`)
          }
        }
        if (node.tagType === 1) {
          tags.add(node.tag)
          const name = normalize(node.tag)
          const bound = Object.keys(bindings).some(binding => normalize(binding) === name)
          const imported = Object.entries(imports).some(([local, item]) => !item.isType && item.isFromSetup && normalize(local) === name)
          if (!builtins.has(name) && !globals.has(name) && !bound && !imported) errors.push(`${label}:${node.loc.start.line}: unresolved component <${node.tag}>`)
        }
        for (const prop of node.props ?? []) if (prop.type === 7 && prop.name === 'slot' && prop.arg?.isStatic) slots.add(prop.arg.content)
      })
      if (!Array.isArray(surface.components) || !surface.components.length) errors.push(`${label}: declare the selected framework components`)
      const expectedView = views[surface.kind]
      const selected = surface.components ?? []
      const hasView = selected.some(component => (component.name === expectedView && component.from === '@southneuhof/loom')
        || (component.name === 'default' && component.from === `@southneuhof/loom/components/views/${expectedView}.vue`))
      if (expectedView && !hasView && !surface.gap?.trim()) errors.push(`${label}: ${surface.kind} requires ${expectedView}; a lower-level surface needs a reviewed gap`)
      if (surface.kind === 'detail' && !hasView && !selected.some(component =>
        (component.name === 'Detail' && component.from === '@southneuhof/loom')
        || (component.name === 'default' && component.from === '@southneuhof/loom/components/core/Detail.vue')))
        errors.push(`${label}: custom record composition still requires Detail`)
      for (const component of selected) {
        if (Object.keys(component).some(key => !['name', 'from'].includes(key))) errors.push(`${label}: component accepts only name/from; record a gap on the surface`)
        const used = Object.entries(imports).some(([local, item]) => !item.isType && item.source === component.from
          && item.imported === component.name && [...tags].some(tag => normalize(tag) === normalize(local)))
        if (!used) errors.push(`${label}: template must use ${component.name} from ${component.from}`)
      }
      const extensions = surface.extensions ?? []
      for (const extension of extensions) {
        if (!extension.slot || !extension.reason?.trim() || !slots.has(extension.slot)) errors.push(`${label}: invalid or unused slot exception ${extension.slot}`)
        else review.push(`${label}: ${extension.slot}: ${extension.reason}`)
      }
      if (slots.has('create-action') && !extensions.some(item => item.slot === 'create-action' && item.reason?.trim())) errors.push(`${label}: Create override needs a requested interaction in extensions`)
      if (surface.gap?.trim()) review.push(`${label}: component gap: ${surface.gap}`)
    } catch (error) { errors.push(`${label}: ${error.message}`) }
  }
  return { errors, review }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv[2] || process.argv[2] === '--help') {
    console.log('Usage: node scripts/module-ui-check.mjs <ui-contract.json> [repository-root]\nChecks declared surfaces only; review gaps, globals, dynamic components and omitted files.')
    process.exitCode = process.argv[2] ? 0 : 1
  } else {
    try {
      const result = checkUiContract(JSON.parse(readFileSync(process.argv[2], 'utf8')), { root: resolve(process.argv[3] ?? '.') })
      for (const error of result.errors) console.error(`FAIL: ${error}`)
      for (const item of result.review) console.log(`REVIEW: ${item}`)
      if (!result.errors.length) console.log(result.review.length ? 'REVIEW_REQUIRED: resolve each exception in the acceptance review' : 'PASS: declared template checks; runtime and acceptance NOT_REVIEWED')
      process.exitCode = result.errors.length ? 1 : result.review.length ? 2 : 0
    } catch (error) { console.error(`FAIL: ${error.message}`); process.exitCode = 1 }
  }
}
