import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import VueRouter from 'vue-router/vite'
import { fileRouteOptions } from './src/router/file-routing/options'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const rawPort = env.WEB_PORT
  const port = rawPort === undefined || rawPort === '' ? Number.NaN : Number(rawPort)
  if (command === 'serve' && !process.env.VITEST) {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('WEB_PORT is missing or invalid in apps/web/.env. Set WEB_PORT to a port 1-65535.')
    }
  }
  const validPort = Number.isInteger(port) && port >= 1 && port <= 65535 ? port : undefined
  return {
    envPrefix: ['VITE_'],
    server: {
      port: validPort,
      strictPort: true,
    },
    preview: {
      port: validPort,
      strictPort: true,
    },
    plugins: [
      VueRouter(fileRouteOptions),
      vue({
        script: {
          defineModel: true,
        },
      }),
    ],
    optimizeDeps: {
      include: ['@southneuhof/api > drizzle-orm', '@southneuhof/api > drizzle-orm/pg-core', '@southneuhof/api > drizzle-zod'],
    },
    resolve: {
      dedupe: ['vue', 'vue-router'],
      extensions: ['.web.ts', '.web.tsx', '.web.mts', '.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
      alias: [
        {
          find: '@',
          replacement: fileURLToPath(new URL('./src', import.meta.url)),
        },
        {
          find: /^@southneuhof\/loom$/,
          replacement: fileURLToPath(new URL('../../packages/loom/src/index.ts', import.meta.url)),
        },
        {
          find: '@southneuhof/loom/',
          replacement: fileURLToPath(new URL('../../packages/loom/src/', import.meta.url)),
        },
        {
          find: /^@southneuhof\/api$/,
          replacement: fileURLToPath(new URL('../api/src/index.ts', import.meta.url)),
        },
        {
          find: '@southneuhof/api/',
          replacement: fileURLToPath(new URL('../api/src/', import.meta.url)),
        },
        {
          find: /^@southneuhof\/sdk$/,
          replacement: fileURLToPath(new URL('../../packages/sdk/src/index.ts', import.meta.url)),
        },
        {
          find: '@southneuhof/sdk/',
          replacement: fileURLToPath(new URL('../../packages/sdk/src/', import.meta.url)),
        },
      ],
    },
    esbuild: {
      jsxFactory: 'h',
      jsxFragment: 'Fragment',
    },
    test: {
      environment: 'jsdom',
      testTimeout: 30000,
      hookTimeout: 30000,
      teardownTimeout: 10000,
      poolOptions: {
        forks: {
          maxWorkers: 2,
        },
      },
    },
  }
})
