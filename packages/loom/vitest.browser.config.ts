import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

const pointerStarts = new Map<string, { x: number; y: number; scaleX: number }>()

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@southneuhof/loom': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/components/core/__tests__/Table.browser.spec.ts', 'src/components/views/__tests__/ListView.browser.spec.ts', 'src/components/base/__tests__/primitives.browser.spec.ts', 'src/components/inputs/__tests__/FileInput.browser.spec.ts', 'src/components/inputs/__tests__/SelectInput.browser.spec.ts', 'src/components/composites/__tests__/LookupInput.browser.spec.ts', 'src/components/inputs/__tests__/DateInput.browser.spec.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      commands: {
        pointerAction: async ({ frame, page, sessionId }, action: 'down' | 'move' | 'up' | 'reset', deltaX = 0, steps = 1) => {
          if (action === 'down') {
            const testFrame = await frame()
            const locator = testFrame.locator('[role="separator"]').first()
            const box = await locator.boundingBox()
            if (!box) throw new Error('Resize handle is not visible.')
            const innerWidth = await locator.evaluate((element) => element.getBoundingClientRect().width)
            const start = {
              x: box.x + (box.width / 2),
              y: box.y + (box.height / 2),
              scaleX: box.width / innerWidth,
            }
            pointerStarts.set(sessionId, start)
            await page.mouse.move(start.x, start.y)
            await page.mouse.down()
          } else if (action === 'reset') {
            if (pointerStarts.has(sessionId)) await page.mouse.up().catch(() => undefined)
            pointerStarts.delete(sessionId)
          } else {
            const start = pointerStarts.get(sessionId)
            if (!start) throw new Error('Pointer gesture has not started.')
            await page.mouse.move(start.x + (deltaX * start.scaleX), start.y, action === 'move' ? { steps } : undefined)
            if (action === 'up') {
              await page.mouse.up()
              pointerStarts.delete(sessionId)
            }
          }
        },
      },
    },
  },
})
