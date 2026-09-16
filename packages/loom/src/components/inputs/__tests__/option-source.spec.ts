import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import CheckboxGroupInput from '../CheckboxGroupInput.vue'
import { defineFields, defineResource, type CollectionLoadContext, type CollectionResult } from '../../..'
import { mountInput } from './harness'

const input = (name: string) => readFileSync(resolve(process.cwd(), 'src/components/inputs', name), 'utf8')

describe('explicit option sources', () => {
  it.each(['SelectInput.vue', 'RadioGroupInput.vue', 'CheckboxGroupInput.vue'])('%s has no wired runtime endpoint', (name) => {
    const source = input(name)
    expect(source).toContain('useOptionSource')
    expect(source).not.toMatch(/getAPI|defaultSelectGetData|useFrameworkRuntime/)
  })

  it('passes standard collection context to a resource list action', async () => {
    type Option = { id: number; name: string }
    const load = vi.fn(async (
      context: CollectionLoadContext<Record<string, never>>,
    ): Promise<CollectionResult<Option>> => ({
      data: [{ id: 1, name: 'A' }],
      meta: { total: 1, totalPage: 1 },
    }))
    const schema = { identity: 'id' as const }
    const fields = defineFields(schema, { name: {} })
    const resource = defineResource(schema, {
      key: 'test-options',
      actions: { list: { run: load, fields: [fields.name] } },
    })
    const list = resource.list()
    const searchParameters = { active: true }
    const mounted = mountInput(CheckboxGroupInput, {
      model: [],
      props: {
        load: list.run,
        searchParameters,
      },
    })

    await mounted.flush()

    expect(load).toHaveBeenCalledOnce()
    const context = load.mock.calls[0]?.[0]
    expect(context).toMatchObject({ query: {}, searchParameters })
    expect(context?.searchParameters).toStrictEqual(searchParameters)
    expect(context?.signal).toBeInstanceOf(AbortSignal)
    mounted.cleanup()
  })

  it('preserves controlled checkbox values across add, remove, and external replacement', async () => {
    const a = { id: 1, name: 'A' }
    const b = { id: 2, name: 'B' }
    const c = { id: 3, name: 'C' }
    const mounted = mountInput(CheckboxGroupInput, { model: [a, b], props: { data: [a, b, c] } })
    const inputs = mounted.host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')

    inputs[2].parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await mounted.flush()
    expect(mounted.model.value).toEqual([a, b, c])

    inputs[0].parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await mounted.flush()
    expect(mounted.model.value).toEqual([b, c])

    mounted.model.value = [a]
    await mounted.flush()
    inputs[2].parentElement!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await mounted.flush()
    expect(mounted.model.value).toEqual([a, c])
    mounted.cleanup()
  })

  it('maps new checkbox values through uniqueIDAs without changing existing fields', async () => {
    const existing = { choiceId: 1, note: 'keep' }
    const mounted = mountInput(CheckboxGroupInput, {
      model: [existing],
      props: { data: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }], uniqueIDAs: 'choiceId' },
    })
    mounted.host.querySelectorAll<HTMLInputElement>('input[type=checkbox]')[1].parentElement!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await mounted.flush()
    expect(mounted.model.value).toEqual([existing, { name: 'B', choiceId: 2 }])
    mounted.cleanup()
  })
})
