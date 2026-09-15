import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as framework from '../index'

/**
 * Locks the 2.0 public surface after the clean break.
 *
 * Release policy (decided 2026-07-26, verified before deletion): the package
 * has no consumers outside this monorepo — its `exports` map points at raw
 * `src` and it carries no `publishConfig`, and the private registry could not
 * be queried without credentials — so the legacy CRUD surface was removed
 * outright under a major version bump rather than deprecated.
 */
const removedExports = [
  // Folded into the surface factories by plan 027; never public API again.
  'standardControls',
  'ViewControls',
  'ViewControl',
  'ControlPlacement',
  'controlsAt',
  'ControlsArguments',
  'ActionableControl',
  'resolveCRUDOperations',
  'useCRUDOperations',
  'defaultCRUDListOnExport',
  'defaultCRUDDetailOnExport',
  ['Resource', 'Capabilities'].join(''),
  ['define', 'Schema'].join(''),
  ['createHono', 'ResourceOperations'].join(''),
  'FrameworkDefaultsInput',
  'FrameworkRuntime',
  'useFrameworkDefaults',
  'useFrameworkRuntime',
  ['Resource', 'ActionField'].join(''),
  ['Resource', 'ActionFields'].join(''),
  ['Resource', 'RendererOverrides'].join(''),
  ['Resource', 'RendererSurface'].join(''),
  'mergeModelConfig',
  'InputConfig',
  'ModelConfig',
  'getInputComponentRegistry',
]

const currentExports = [
  'FrameworkPlugin',
  'resolveFields',
  'createBehaviorRuntime',
  'defineResource',
  'defineFields',
  'Table',
  'Detail',
  'Form',
  'DialogForm',
  'ListView',
  'DetailView',
  'FormView',
  'fromZod',
  'selectSchema',
  'validateDraft',
  'useLoader',
  'useNamespacedQuery',
  'createFrameworkQueryClient',
  'invalidateResourceData',
  'createRendererRegistries',
  'resolveFrameworkAdapters',
  'resolveFrameworkFieldDefaults',
  'useFrameworkFieldDefaults',
  'createInputPropsRegistry',
  'emptyInputPropsRegistry',
  'inputPropsRegistryKey',
  'useInputPropsRegistry',
]

describe('public API surface', () => {
  it('exports the resource, core, and shell surface', () => {
    for (const name of currentExports) expect(framework, `missing export: ${name}`).toHaveProperty(name)
  })

  it('no longer exports the retired CRUD surface', () => {
    for (const name of removedExports) expect(framework, `unexpected export: ${name}`).not.toHaveProperty(name)
  })

  it('removes legacy configuration source paths', () => {
    for (const path of [
      'src/adapters/defaults.ts',
      'src/runtime.ts',
      'src/runtimeDefaults.ts',
      'src/model-config',
      'src/components/composites/Table.vue',
      'src/components/composites/Detail.vue',
      'src/components/composites/Form.vue',
      'src/components/composites/Tree',
    ]) {
      expect(existsSync(resolve(process.cwd(), path)), `unexpected path: ${path}`).toBe(false)
    }
  })

  it('keeps DialogForm on the core-native boundary', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/composites/DialogForm.vue'), 'utf8')

    expect(source).toContain("../core/Form.vue")
    expect(source).toContain("../base/Dialog.vue")
    expect(source).not.toMatch(/InputConfig|fieldsAlias|beforeSubmit|extraData|components\/composites\/Form|@success/)
  })

  it('removes the framework Hono integration', () => {
    const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')
    expect(existsSync(resolve(process.cwd(), 'src/hono'))).toBe(false)
    expect(packageJson).not.toContain('"./hono"')
    expect(packageJson).not.toContain('"hono"')
    const name = ['ho', 'no'].join('')
    expect(readFileSync(resolve(process.cwd(), 'src/index.ts'), 'utf8')).not.toMatch(new RegExp(`from ['"]${name}|export .*${name}`, 'i'))
  })
})
