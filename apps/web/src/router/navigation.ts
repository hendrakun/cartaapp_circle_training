import type { RouteLocationRaw, Router } from 'vue-router'
import { visibleNavigation } from '@/manifest'
import { allowsPermission } from '@/framework/adapters/bundle'
import { navigationAudience } from '@/framework/audience'

export function getFirstAccessibleRouteName(): string | null {
  for (const module of visibleNavigation(allowsPermission, navigationAudience())) {
    const route = module.routes.find((entry) => !('separator' in entry))
    if (route && !('separator' in route)) return route.name
  }
  return null
}

export function getDefaultAuthenticatedRouteLocation(): RouteLocationRaw | null {
  const routeName = getFirstAccessibleRouteName()
  return routeName ? ({ name: routeName } as never) : null
}

export function resolvePostLoginRoute(router: Router, redirect: string | null): RouteLocationRaw | null {
  if (redirect) {
    const resolved = router.resolve(redirect)
    if (resolved.matched.length && resolved.name !== 'auth-login' && resolved.path !== '/') {
      return redirect
    }
  }

  return getDefaultAuthenticatedRouteLocation()
}
