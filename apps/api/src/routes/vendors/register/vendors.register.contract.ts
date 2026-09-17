import { z } from 'zod/v4'
import { identityRuleIssues, normalizeNpwp, vendorUsernameSchema } from '../vendors.contract'
import {
  vendorBusinessFieldSchema,
  vendorCompanyTypeSchema,
} from '../vendors.entity'

export const vendorRegisterSchema = z
  .object({
    companyName: z.string().trim().min(1).max(255),
    companyType: vendorCompanyTypeSchema,
    email: z.string().trim().email().max(255),
    username: vendorUsernameSchema,
    npwp: z
      .string()
      .trim()
      .regex(/^[0-9.\- ]+$/, 'NPWP must use digits.')
      .optional(),
    taxId: z.string().trim().min(1).max(64).optional(),
    businessField: vendorBusinessFieldSchema,
    password: z.string().min(8).max(200),
    passwordConfirmation: z.string().min(8).max(200),
  })
  .superRefine((input, context) => {
    if (input.password !== input.passwordConfirmation) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["passwordConfirmation"], message: "Password confirmation must match." });
    }
    for (const issue of identityRuleIssues({
      companyType: input.companyType,
      npwp: normalizeNpwp(input.npwp),
      taxId: input.taxId ?? null,
    })) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field ?? 'npwp'], message: issue.message })
    }
  })
  .transform((input) => ({
    companyName: input.companyName,
    companyType: input.companyType,
    email: input.email,
    username: input.username,
    npwp: normalizeNpwp(input.npwp),
    taxId: input.taxId ?? null,
    businessField: input.businessField,
    password: input.password,
  }))

export type VendorRegisterInput = z.input<typeof vendorRegisterSchema>
