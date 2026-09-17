import { identity } from '@/framework/identity'

/**
 * Who the current session is: an account that owns a vendor registration, or
 * any other signed-in account. The sidebar and the router read it to keep the
 * vendor menu and the staff menu apart.
 */
export type NavigationAudience = 'vendor' | 'staff'

export function navigationAudience(): NavigationAudience {
  return identity.value?.vendor ? 'vendor' : 'staff'
}
