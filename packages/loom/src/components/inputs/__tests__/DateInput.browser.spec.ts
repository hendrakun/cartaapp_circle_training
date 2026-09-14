import { afterEach, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, type App } from 'vue'
import DateInput from '../DateInput.vue'
import { FrameworkPlugin } from '../../../adapters/plugin'

const apps: App[] = []

async function frame(times = 4) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await Promise.resolve()
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await nextTick()
  }
}

function mountDate(initial: string | null) {
  const model = ref<string | null>(initial)
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(defineComponent({
    setup: () => () => h(DateInput, {
      inline: true,
      teleport: false,
      modelValue: model.value,
      'onUpdate:modelValue': (value: string | null) => { model.value = value },
    }),
  }))
  app.use(FrameworkPlugin)
  app.mount(host)
  apps.push(app)
  return { host, model }
}

afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount())
  document.body.innerHTML = ''
})

describe('DateInput real calendar', () => {
  it('shows an initial edit value and commits a picked day', async () => {
    const view = mountDate('2026-02-15')
    await frame(6)

    expect(view.host.querySelector('.dp__menu, .dp__calendar')).not.toBeNull()
    expect(view.host.querySelector('.dp__active_date')?.textContent?.trim()).toBe('15')

    const day = [...view.host.querySelectorAll<HTMLElement>('.dp__cell_inner:not(.dp__cell_offset):not(.dp__cell_disabled)')]
      .find((cell) => cell.textContent?.trim() === '20')!
    expect(day).not.toBeUndefined()
    day.click()
    await frame()

    expect(view.model.value).toBe('2026-02-20')
    expect(view.host.querySelector('.dp__active_date')?.textContent?.trim()).toBe('20')
  })

  it('keeps an empty model empty until a calendar day commits', async () => {
    const view = mountDate(null)
    await frame(6)

    expect(view.model.value).toBeNull()

    const header = [...view.host.querySelectorAll<HTMLElement>('.dp__month_year_row, .dp__month_year_row *, .dp__inner_nav')]
    expect(header.length).toBeGreaterThan(0)
    const day = [...view.host.querySelectorAll<HTMLElement>('.dp__cell_inner:not(.dp__cell_offset):not(.dp__cell_disabled)')]
      .find((cell) => cell.textContent?.trim() === '20')
    day?.click()
    await frame()

    expect(view.model.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
