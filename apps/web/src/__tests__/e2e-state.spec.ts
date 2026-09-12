import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const execFileSync = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({ default: { execFileSync }, execFileSync }))

async function state() {
  return import('../../e2e/state')
}

beforeEach(() => {
  vi.stubEnv('CI', undefined)
  vi.stubEnv('E2E_ITERATION', undefined)
  vi.stubEnv('SKIP_E2E_PREPARE', undefined)
})

afterEach(() => {
  vi.resetModules()
  execFileSync.mockReset()
  vi.unstubAllEnvs()
})

describe('prepareForTest', () => {
  it('prepares for each test by default', async () => {
    const { prepareForTest } = await state()
    prepareForTest()
    prepareForTest()
    expect(execFileSync).toHaveBeenCalledTimes(2)
  })

  it('prepares once in iteration mode', async () => {
    process.env.E2E_ITERATION = '1'
    const { prepareForTest } = await state()
    prepareForTest()
    prepareForTest()
    expect(execFileSync).toHaveBeenCalledOnce()
  })

  it('skips an explicit iteration prepare', async () => {
    process.env.E2E_ITERATION = '1'
    process.env.SKIP_E2E_PREPARE = '1'
    const { prepareForTest } = await state()
    prepareForTest()
    expect(execFileSync).not.toHaveBeenCalled()
  })

  it('retries after a failed prepare', async () => {
    process.env.E2E_ITERATION = '1'
    execFileSync.mockImplementationOnce(() => {
      throw new Error('prepare failed')
    })
    const { prepareForTest } = await state()
    expect(() => prepareForTest()).toThrow('prepare failed')
    prepareForTest()
    expect(execFileSync).toHaveBeenCalledTimes(2)
  })

  it('prepares again in a fresh module', async () => {
    process.env.E2E_ITERATION = '1'
    ;(await state()).prepareForTest()
    vi.resetModules()
    ;(await state()).prepareForTest()
    expect(execFileSync).toHaveBeenCalledTimes(2)
  })

  it.each(['yes', '0'])('rejects invalid iteration value %s', async (value) => {
    process.env.E2E_ITERATION = value
    expect((await state()).prepareForTest).toThrow('E2E_ITERATION must be 1 when set.')
  })

  it('rejects skip outside iteration mode', async () => {
    process.env.SKIP_E2E_PREPARE = '1'
    expect((await state()).prepareForTest).toThrow('SKIP_E2E_PREPARE requires E2E_ITERATION=1.')
  })

  it('rejects iteration flags in CI', async () => {
    process.env.CI = '1'
    process.env.E2E_ITERATION = '1'
    expect((await state()).prepareForTest).toThrow('E2E iteration flags are not allowed in CI.')
  })
})
