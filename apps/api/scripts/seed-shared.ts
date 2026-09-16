import { and, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '../src/db'
import { authorizationModules, type PermissionCode } from '../src/authorization/catalog'
import { createAuth } from '../src/routes/auth/auth'
import { accounts } from '../src/routes/auth/auth.entity'
import { permissions } from '../src/routes/(authenticated)/permissions/permissions.entity'
import { rolePermissions, roleAssignments, roles } from '../src/routes/(authenticated)/roles/roles.entity'
import { users } from '../src/routes/(authenticated)/users/users.entity'

const seedEmail = process.env.CARTA_ADMIN_EMAIL ?? 'admin@example.com'
const seedPassword = process.env.CARTA_ADMIN_PASSWORD ?? 'demo-password'

/** Stable non-login actor used by all public customer-feedback writes. */
const PUBLIC_INTAKE_USER_ID = 'public-intake-user'
type CatalogPermission = (typeof authorizationModules)[number]['permissions'][number]
const catalogPermissions = authorizationModules.flatMap((module) => [...module.permissions]) as CatalogPermission[]

export async function seedPublicIntakeUser(): Promise<string> {
  const db = getDb()
  await db.insert(users).values({
    id: PUBLIC_INTAKE_USER_ID,
    name: 'Public Intake',
    email: 'public-intake@system.invalid',
    statusCode: 'non_active',
  }).onConflictDoUpdate({
    target: users.id,
    set: { name: 'Public Intake', email: 'public-intake@system.invalid', statusCode: 'non_active' },
  })
  await db.delete(accounts).where(eq(accounts.userId, PUBLIC_INTAKE_USER_ID))
  await db.delete(roleAssignments).where(eq(roleAssignments.userId, PUBLIC_INTAKE_USER_ID))
  return PUBLIC_INTAKE_USER_ID
}

export async function seedRoleGroups() {
}

export async function seedAuthorization() {
  const db = getDb()
  await db
    .insert(permissions)
    .values(
      catalogPermissions.map((permission) => ({
        id: `permission-${permission.code}`,
        permissionCode: permission.code,
        name: permission.name,
        description: permission.description,
        active: permission.active,
      }))
    )
    .onConflictDoUpdate({
      target: permissions.permissionCode,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        active: true,
      },
    })
  await db
    .insert(roles)
    .values([
      {
        id: 'role-administrator',
        roleCode: 'administrator',
        name: 'Administrator',
        description: 'Full system administration.',
        active: true,
      },
    ])
    .onConflictDoUpdate({
      target: roles.roleCode,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        active: true,
      },
    })
  const catalogPermissionCodes = new Set<PermissionCode>(catalogPermissions.map((permission) => permission.code))
  const permissionRows = await db.select({ id: permissions.id, code: permissions.permissionCode }).from(permissions)
  const stalePermissionIds = permissionRows.filter((permission) => !catalogPermissionCodes.has(permission.code as PermissionCode)).map((permission) => permission.id)
  if (stalePermissionIds.length) await db.update(permissions).set({ active: false }).where(inArray(permissions.id, stalePermissionIds))
  const seededRoleIds = ['role-administrator'] as const
  await db
    .update(rolePermissions)
    .set({ active: false })
    .where(inArray(rolePermissions.roleId, [...seededRoleIds]))
  const rolePermissionRows = permissionRows
    .filter((permission) => catalogPermissionCodes.has(permission.code as PermissionCode))
    .map((permission) => ({
      roleId: 'role-administrator',
      permissionId: permission.id,
      active: true as const,
    }))
  await db
    .insert(rolePermissions)
    .values(rolePermissionRows)
    .onConflictDoUpdate({
      target: [rolePermissions.roleId, rolePermissions.permissionId],
      set: { active: true },
    })
}

export async function seedAdministrator(): Promise<string> {
  const db = getDb()
  let admin = (await db.select({ id: users.id }).from(users).where(eq(users.email, seedEmail)).limit(1))[0]
  if (!admin) {
    const result = await createAuth({ allowSignUp: true }).api.signUpEmail({
      body: {
        name: 'Carta Administrator',
        email: seedEmail,
        password: seedPassword,
      },
    })
    if (!result.user?.id) throw new Error('Administrator creation failed.')
    admin = { id: result.user.id }
  }
  await db
    .update(users)
    .set({
      name: 'Carta Administrator',
      statusCode: 'active',
    })
    .where(eq(users.id, admin.id))
  for (const [roleId, id] of [
    ['role-administrator', `system-role-assignment-${admin.id}`],
  ] as const) {
    const existing = (
      await db
        .select({ id: roleAssignments.id })
        .from(roleAssignments)
        .where(and(eq(roleAssignments.userId, admin.id), eq(roleAssignments.roleId, roleId)))
        .limit(1)
    )[0]
    if (existing) {
      await db.update(roleAssignments).set({ active: true, updatedAt: new Date().toISOString() }).where(eq(roleAssignments.id, existing.id))
    } else {
      await db
        .insert(roleAssignments)
        .values({
          id,
          userId: admin.id,
          roleId,
          active: true,
        })
        .onConflictDoUpdate({
          target: roleAssignments.id,
          set: {
            userId: admin.id,
            roleId,
            active: true,
            updatedAt: new Date().toISOString(),
          },
        })
    }
  }
  return admin.id
}
