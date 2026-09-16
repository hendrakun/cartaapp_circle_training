#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { moduleMetadata, validateConfig } from './scaffold-bounded-module.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function count(source, value) {
  return source.split(value).length - 1
}

function quoted(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n').replaceAll('\r', '\\r')}'`
}

function replaceOnce(source, anchor, replacement, name) {
  if (count(source, anchor) !== 1) throw new Error(`${name} anchor is missing or ambiguous.`)
  return source.replace(anchor, replacement)
}

function insertBeforeArrayEnd(source, startMarker, lines, name) {
  const start = source.indexOf(startMarker)
  const arrayOpen = source.indexOf('[', start)
  if (start < 0 || arrayOpen < 0 || source.indexOf(startMarker, start + 1) >= 0) {
    throw new Error(`${name} section is missing or ambiguous.`)
  }
  let depth = 0
  let end = -1
  for (let index = arrayOpen; index < source.length; index += 1) {
    const character = source[index]
    if (character === '[') depth += 1
    else if (character === ']') {
      depth -= 1
      if (depth === 0) { end = index; break }
    }
  }
  if (end < 0) throw new Error(`${name} section is missing or ambiguous.`)
  const before = source.slice(0, end)
  const needsSeparator = /[^\s,\[]$/.test(before.replace(/\s+$/, ''))
  return `${before}${needsSeparator ? ',' : ''}${before.endsWith('\n') ? '' : '\n'}${lines}\n${source.slice(end)}`
}

function insertDomains(source, config) {
  const metadata = moduleMetadata(config)
  const importLine = `import { domain as ${metadata.plural} } from './routes/(authenticated)/${config.slug}/${config.slug}'`
  const domainLine = `  ${metadata.plural},`
  if (count(source, importLine) > 1 || count(source, domainLine) > 1) throw new Error(`domain registration for "${config.slug}" is duplicated.`)
  if (!source.includes(importLine)) source = replaceOnce(source, '\nexport const domains = [', `\n${importLine}\n\nexport const domains = [`, 'domain import')
  if (!source.includes(domainLine)) source = insertBeforeArrayEnd(source, 'export const domains = [', domainLine, 'domains')
  return source
}

function stringPattern(value) {
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `(?:${escape(quoted(value))}|${escape(JSON.stringify(value))})`
}

function insertCatalog(source, config) {
  const startMarker = 'export const authorizationModules = ['
  const start = source.indexOf(startMarker)
  const arrayOpen = source.indexOf('[', start)
  if (start < 0 || arrayOpen < 0 || source.indexOf(startMarker, start + 1) >= 0) {
    throw new Error('Current authorizationModules definitions are missing or ambiguous.')
  }
  let depth = 0
  let end = -1
  for (let index = arrayOpen; index < source.length; index += 1) {
    const character = source[index]
    if (character === '[') depth += 1
    else if (character === ']') {
      depth -= 1
      if (depth === 0) { end = index; break }
    }
  }
  if (end < 0) throw new Error('Current authorizationModules definitions are missing or ambiguous.')
  const codes = [...new Set(Object.values(config.actions).map((action) => action.permission))]
  const section = source.slice(start, end)
  const states = codes.map((code) => {
    const entry = config.permissions[code]
    const token = stringPattern(code)
    const count = [...section.matchAll(new RegExp(`code:\\s*${token}`, 'g'))].length
    const exact = new RegExp(`\\{\\s*code:\\s*${token},\\s*name:\\s*${stringPattern(entry.name)},\\s*description:\\s*${stringPattern(entry.description)},\\s*targetType:\\s*['"]global['"],\\s*active:\\s*true\\s*\\}`)
    if (count > 1) throw new Error(`permission "${code}" is duplicated.`)
    if (count && !exact.test(section)) throw new Error(`permission "${code}" has different metadata.`)
    return count
  })
  if (states.every(Boolean)) return source
  if (states.some(Boolean)) throw new Error(`permissions for "${config.slug}" are incomplete.`)
  const moduleCount = [...section.matchAll(new RegExp(`code:\\s*${stringPattern(config.slug)}`, 'g'))].length
  if (moduleCount) throw new Error(`authorization module "${config.slug}" has different metadata.`)
  const permissions = codes.map((code) => {
    const entry = config.permissions[code]
    return `      { code: ${quoted(code)}, name: ${quoted(entry.name)}, description: ${quoted(entry.description)}, targetType: 'global', active: true },`
  }).join('\n')
  const definition = `  {\n    code: ${quoted(config.slug)},\n    name: ${quoted(config.title)},\n    active: true,\n    permissions: [\n${permissions}\n    ],\n  },`
  return insertBeforeArrayEnd(source, startMarker, definition, 'authorization modules')
}

function insertSeed(source, config) {
  if (!config.seed) return source
  const importLine = `import { seed${config.symbol} } from '../src/routes/(authenticated)/${config.slug}/${config.slug}.seed'`
  const call = `  await seed${config.symbol}()`
  const owner = 'export async function seedDatabase() {'
  if (count(source, owner) !== 1) throw new Error('seedDatabase owner is missing or ambiguous.')
  if (count(source, importLine) > 1 || count(source, call) > 1) throw new Error(`seed registration for "${config.slug}" is duplicated.`)
  if (source.includes(importLine) !== source.includes(call)) throw new Error(`seed registration for "${config.slug}" is incomplete.`)
  if (source.includes(importLine)) return source
  source = `${importLine}\n${source}`
  const start = source.indexOf(owner)
  const end = source.indexOf('\n}', start)
  if (end < 0) throw new Error('seedDatabase closing boundary is missing.')
  return `${source.slice(0, end)}\n${call}${source.slice(end)}`
}

function insertNavigation(source, config) {
  const metadata = moduleMetadata(config)
  const groupMarker = `name: '${config.navigation.group}'`
  const groupStart = source.indexOf(groupMarker)
  const routesStart = source.indexOf('    routes: [', groupStart)
  const groupEnd = source.indexOf('    ],\n  },', routesStart)
  if (groupStart < 0 || routesStart < 0 || groupEnd < 0 || source.indexOf(groupMarker, groupStart + 1) >= 0) {
    throw new Error(`navigation group "${config.navigation.group}" is missing or ambiguous.`)
  }
  const group = source.slice(groupStart, groupEnd)
  const marker = `to: { name: '${metadata.routes.list}' }`
  const desired = `      { to: { name: '${metadata.routes.list}' }, permission: '${config.actions.list.permission}', title: ${quoted(config.navigation.title)}, icon: ${quoted(config.navigation.icon)} },`
  if (count(group, marker) > 1) throw new Error(`navigation route "${metadata.routes.list}" is duplicated.`)
  if (group.includes(marker)) {
    if (!group.includes(desired)) throw new Error(`navigation route "${metadata.routes.list}" has different metadata.`)
    return source
  }
  const anchorMarker = `to: { name: '${config.navigation.anchor}' }`
  if (count(group, anchorMarker) !== 1) throw new Error(`navigation anchor "${config.navigation.anchor}" is missing or ambiguous.`)
  const anchor = group.indexOf(anchorMarker)
  const lineEnd = group.indexOf('\n', anchor)
  const updated = `${group.slice(0, lineEnd + 1)}${desired}\n${group.slice(lineEnd + 1)}`
  return source.slice(0, groupStart) + updated + source.slice(groupEnd)
}

function filePlan(root, config) {
  const files = [
    ['apps/api/src/domains.ts', (source) => insertDomains(source, config)],
    ['apps/api/src/authorization/catalog.ts', (source) => insertCatalog(source, config)],
    ['apps/web/src/manifest/navigation.ts', (source) => insertNavigation(source, config)],
  ]
  if (config.seed) files.push(['apps/api/scripts/seed.ts', (source) => insertSeed(source, config)])
  return files.map(([path, edit]) => ({ path: resolve(root, path), edit }))
}

export function integrate(value, { root = repoRoot, apply = false } = {}) {
  const config = validateConfig(value)
  const changes = []
  for (const file of filePlan(resolve(root), config)) {
    if (!existsSync(file.path)) throw new Error(`Integration file does not exist: ${file.path}`)
    const before = readFileSync(file.path, 'utf8')
    const after = file.edit(before)
    if (after !== before) changes.push({ ...file, after })
  }
  if (apply) for (const change of changes) writeFileSync(change.path, change.after)
  return {
    status: changes.length ? (apply ? 'APPLIED' : 'PENDING') : (apply ? 'UP_TO_DATE' : 'READY'),
    changed: apply ? changes.map(({ path }) => path).sort() : [],
    pending: changes.map(({ path }) => path).sort(),
  }
}

function parseArgs(argv) {
  if (argv.includes('--check') && argv.includes('--apply')) throw new Error('--check and --apply are mutually exclusive.')
  let manifest
  let root
  let apply = false
  let json = false
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--') continue
    if (argument === '--manifest' || argument === '--root') {
      const value = argv[++index]
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a path.`)
      if (argument === '--manifest') manifest = value
      else root = value
    } else if (argument === '--apply') apply = true
    else if (argument === '--check') apply = false
    else if (argument === '--json') json = true
    else throw new Error(`Unknown argument: ${argument}`)
  }
  if (!manifest) throw new Error('Usage: node scripts/integrate-bounded-module.mjs --manifest <file.json> [--check|--apply] [--root <directory>] [--json]')
  return { manifest, root, apply, json }
}

export function execute(argv, { root = repoRoot, cwd = process.cwd() } = {}) {
  if (argv.includes('--help')) return 'Usage: node scripts/integrate-bounded-module.mjs --manifest <file.json> [--check|--apply] [--root <directory>] [--json]\nDefault is read-only check. --apply edits registration owners only; no database writes.'
  const args = parseArgs(argv)
  const manifest = JSON.parse(readFileSync(resolve(cwd, args.manifest), 'utf8'))
  const result = integrate(manifest, { root: args.root ? resolve(cwd, args.root) : root, apply: args.apply })
  return args.json ? JSON.stringify(result, null, 2) : `Status: ${result.status}`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(execute(process.argv.slice(2)))
  } catch (error) {
    console.error(`integrate-bounded-module: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
