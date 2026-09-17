import { created, defineRoute, HttpError, isHttpError } from "@southneuhof/sprindle";
import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { readJsonBody } from "../../../request-body";
import { publicRecord } from "../../../storage/assets";
import { users } from "../../(authenticated)/users/users.entity";
import { createAuth } from "../../auth/auth";
import { vendor, vendors } from "../vendors.entity";
import { vendorRegisterSchema } from "./vendors.register.contract";

export const POST = defineRoute({
  openapi: { requestBody: vendorRegisterSchema },
  action: async (args) => {
    const input = vendorRegisterSchema.parse(await readJsonBody(args.c));
    const db = getDb();
    const existingEmail = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.email, input.email)).limit(1);
    if (existingEmail[0]) return args.c.json({ error: "email_exists" }, 409);
    const existingUsername = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.username, input.username)).limit(1);
    if (existingUsername[0]) throw new HttpError(422, "username_exists", undefined, [{ field: "username", message: "Username is already registered." }]);
    if (input.npwp) {
      const existingNpwp = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.npwp, input.npwp)).limit(1);
      if (existingNpwp[0]) throw new HttpError(422, "npwp_exists", undefined, [{ field: "npwp", message: "NPWP is already registered." }]);
    }

    let userId: string | undefined;
    try {
      const result = await createAuth({ allowSignUp: true }).api.signUpEmail({
        body: { name: input.username, email: input.email, password: input.password },
      });
      userId = result.user?.id;
      if (!userId) return args.c.json({ error: "user_create_failed" }, 422);
      await db.update(users).set({ statusCode: "non_active" }).where(eq(users.id, userId));
      const verificationToken = crypto.randomUUID();
      const inserted = await db
        .insert(vendors)
        .values({
          ownerUserId: userId,
          companyName: input.companyName,
          companyType: input.companyType,
          email: input.email,
          username: input.username,
          npwp: input.npwp,
          taxId: input.taxId,
          businessField: input.businessField,
          statusCode: "registered",
          verificationToken,
          createdByUserId: userId,
          updatedByUserId: userId,
        })
        .returning();
      const createdVendor = vendor.schemas.select.parse(inserted[0]);
      return created(args.c, {
        vendor: publicRecord(vendor.schemas.select, createdVendor),
        verificationLink: `/vendors/verify?id=${createdVendor.id}&token=${verificationToken}`,
      });
    } catch (error) {
      if (userId) {
        // Remove the vendor row first; the owner reference is RESTRICT.
        await getDb().delete(vendors).where(eq(vendors.ownerUserId, userId));
        await getDb().delete(users).where(eq(users.id, userId));
      }
      if (isHttpError(error)) return args.c.json({ error: error.code, ...(error.message ? { message: error.message } : {}), ...(error.issues ? { issues: error.issues } : {}) }, error.status as 400);
      return args.c.json({ error: "user_create_failed" }, 409);
    }
  },
});
