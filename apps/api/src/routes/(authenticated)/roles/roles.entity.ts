import { createEntity } from '@southneuhof/sprindle/entity'
import { boolean, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-orm/zod'
import { permissions } from '../permissions/permissions.entity'
import { users } from '../users/users.entity'

export const auditFields = {
  createdByUserId: text('created_by_user_id').references(() => users.id),
  updatedByUserId: text('updated_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).notNull().defaultNow(),
}

export const roles = pgTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  roleCode: text('role_code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').notNull().default(true),
  ...auditFields,
})

export const rolePermissions = pgTable('role_permissions', {
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: text('permission_id').notNull().references(() => permissions.id, { onDelete: 'restrict' }),
  active: boolean('active').notNull().default(true),
  ...auditFields,
}, (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })])

export const roleAssignments = pgTable('role_assignments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: text('role_id').notNull().references(() => roles.id, { onDelete: 'restrict' }),
  active: boolean('active').notNull().default(true),
  ...auditFields,
}, (table) => [
  uniqueIndex('role_assignments_user_role_idx').on(table.userId, table.roleId),
])

const write = { id: true, createdByUserId: true, updatedByUserId: true, createdAt: true, updatedAt: true } as const

export const role = createEntity({
  table: roles,
  schemas: {
    create: createInsertSchema(roles).omit(write),
    update: createUpdateSchema(roles).omit(write),
    select: createSelectSchema(roles),
  },
})
