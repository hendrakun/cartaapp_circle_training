import { defineRoute, notFound } from "@southneuhof/sprindle";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { getDb } from "../../../db";
import { publicRecord } from "../../../storage/assets";
import { users } from "../../(authenticated)/users/users.entity";
import { vendor, vendors } from "../vendors.entity";

const verifyQuery = z.object({
  id: z.string().trim().min(1),
  token: z.string().trim().min(1),
});

export const GET = defineRoute({
  action: async (args) => {
    const query = verifyQuery.parse(args.c.req.query());
    const db = getDb();
    const row = (
      await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.id, query.id), eq(vendors.verificationToken, query.token)))
        .limit(1)
    )[0];
    if (!row || row.emailVerifiedAt) throw notFound();
    const now = new Date().toISOString();
    await db.transaction(async (tx) => {
      await tx
        .update(vendors)
        .set({
          emailVerifiedAt: now,
          verificationToken: null,
          statusCode: row.statusCode === "registered" ? "email_verified" : row.statusCode,
          updatedAt: now,
          updatedByUserId: row.ownerUserId,
        })
        .where(and(eq(vendors.id, row.id), isNull(vendors.emailVerifiedAt)));
      await tx
        .update(users)
        .set({ emailVerified: true, statusCode: "active", updatedAt: now })
        .where(eq(users.id, row.ownerUserId));
    });
    const updated = (await db.select().from(vendors).where(eq(vendors.id, row.id)).limit(1))[0];
    return { data: { vendor: publicRecord(vendor.schemas.select, vendor.schemas.select.parse(updated)) } };
  },
});
