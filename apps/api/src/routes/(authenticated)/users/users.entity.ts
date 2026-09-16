import { createEntity } from "@southneuhof/sprindle/entity";
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/zod";
import { z } from 'zod/v4'

export const userStatusCodeSchema = z.enum(['active', 'non_active', 'expired', 'expiring_soon'])
export type UserStatusCode = z.infer<typeof userStatusCodeSchema>

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  statusCode: text("status_code").notNull().default("active").$type<UserStatusCode>(),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
}, (table) => [check('users_status_code_check', sql`${table.statusCode} in ('active', 'non_active', 'expired', 'expiring_soon')`)]);

export const user = createEntity({
  table: users,
  schemas: {
    create: createInsertSchema(users).omit({
      id: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    }).extend({ statusCode: userStatusCodeSchema.optional() }),
    update: createUpdateSchema(users).omit({
      id: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    }).extend({ statusCode: userStatusCodeSchema.optional() }),
    select: createSelectSchema(users).extend({ statusCode: userStatusCodeSchema }),
  },
});

export const userPublicSchema = user.schemas.select;
