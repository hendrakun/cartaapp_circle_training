import type { AppRouteName } from '@/router/route-names'

export type NavigationIcon = 'home' | 'inbox' | 'folder' | 'settings'
/**
 * Who sees an entry. `vendor` is an account that owns a vendor registration,
 * and `staff` is every other signed-in account. The permission check still
 * applies on top.
 */
export type NavigationAudience = 'all' | 'vendor' | 'staff'
export type NavigationSeparator = { separator: string }
type NavigationSearch = { aliases?: readonly string[]; audience?: NavigationAudience }
export type NavigationAction = NavigationSearch & { action: { permission: string | null; to?: { name: AppRouteName; params?: Record<string, string> } }; title: string; icon: NavigationIcon }
export type NavigationDirect = NavigationSearch & { to: { name: AppRouteName }; permission: string | null; title: string; icon: NavigationIcon }
export type NavigationEntry = NavigationSeparator | NavigationAction | NavigationDirect
export type NavigationModule = {
  name: string
  title: string
  icon: NavigationIcon
  description?: string
  routes: readonly NavigationEntry[]
}
export function defineNavigation<const TNavigation extends readonly NavigationModule[]>(navigation: TNavigation): TNavigation {
  return navigation
}
