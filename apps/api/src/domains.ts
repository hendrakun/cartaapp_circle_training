import { domain as auth } from './routes/auth/auth.domain'
import { domain as permissions } from './routes/(authenticated)/permissions/permissions'
import { domain as roles } from './routes/(authenticated)/roles/roles'
import { domain as users } from './routes/(authenticated)/users/users'
import { domain as vendors } from './routes/vendors/vendors'

export const domains = [auth, permissions, roles, users, vendors] as const
