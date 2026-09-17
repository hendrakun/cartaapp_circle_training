import { defineRoute, notFound } from "@southneuhof/sprindle";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { z } from "zod/v4";
import { getDb } from "../../../db";
import { readJsonBody } from "../../../request-body";
import { vendors } from "../vendors.entity";

const resendInput = z.object({ email: z.string().trim().email().max(255) });

export const POST = defineRoute({
  openapi: { requestBody: resendInput },
  action: async (args) => {
    const input = resendInput.parse(await readJsonBody(args.c));
    const db = getDb();
    const row = (
      await db
        .select({ id: vendors.id, ownerUserId: vendors.ownerUserId })
        .from(vendors)
        .where(and(eq(vendors.email, input.email), isNull(vendors.emailVerifiedAt)))
        .limit(1)
    )[0];
    if (!row) {
      const used = (
        await db.select({ id: vendors.id }).from(vendors).where(and(eq(vendors.email, input.email), isNotNull(vendors.emailVerifiedAt))).limit(1)
      )[0];
      if (used) throw notFound("This email is already verified.");
      throw notFound();
    }
    const verificationToken = crypto.randomUUID();
    await db
      .update(vendors)
      .set({ verificationToken, updatedAt: new Date().toISOString(), updatedByUserId: row.ownerUserId })
      .where(eq(vendors.id, row.id));
    return { data: { verificationLink: `/vendors/verify?id=${row.id}&token=${verificationToken}` } };
  },
});
