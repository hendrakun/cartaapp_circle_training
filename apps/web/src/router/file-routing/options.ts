import type { Options } from 'vue-router/unplugin'
import { applyFileRouteConventions } from './layout-groups'
import { staticRouteName } from './names'

export const fileRouteOptions = {
  routesFolder: 'src/routes',
  extensions: ['.route.vue', '.layout.vue'],
  dts: 'src/route-map.d.ts',
  getRouteName: staticRouteName,
  beforeWriteFiles: applyFileRouteConventions,
} satisfies Options
