import { createEntity } from "@southneuhof/sprindle/entity";
import {
  boolean,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import {
  createInsertSchema,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/zod";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  statusCode: text("status_code").notNull().default("active"),
  createdAt: timestamp("created_at", { mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).notNull().defaultNow(),
});

export const user = createEntity({
  table: users,
  schemas: {
    create: createInsertSchema(users).omit({
      id: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    }),
    update: createUpdateSchema(users).omit({
      id: true,
      email: true,
      emailVerified: true,
      image: true,
      createdAt: true,
      updatedAt: true,
    }),
    select: createSelectSchema(users),
  },
});

export const userPublicSchema = user.schemas.select;
