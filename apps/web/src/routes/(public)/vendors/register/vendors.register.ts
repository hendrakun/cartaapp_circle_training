import { vendorBusinessFieldSchema, vendorCompanyTypeSchema } from '@southneuhof/api/routes/vendors/vendors.entity'
import { fromZod, type FieldsInput } from '@southneuhof/loom'
import { z } from 'zod/v4'
import { vendorIdentityIssues } from '@/routes/(authenticated)/vendors/vendors.identity'
import { isForeignCompanyType, vendorBusinessFieldOptions, vendorCompanyTypeOptions } from '@/routes/(authenticated)/vendors/vendors.options'

/**
 * A direct `Form` receives plain field definitions. `defineFields` returns
 * references for `defineResource`, which resolves them itself.
 */
const required = { required: true }

export const vendorRegisterFields = {
  companyName: { label: 'Company name', form: { renderer: 'text', props: required } },
  companyType: { label: 'Company type', form: { renderer: 'select', source: vendorCompanyTypeOptions, props: required } },
  email: { label: 'Email', form: { renderer: 'text', props: { type: 'email', ...required } } },
  username: { label: 'Username', form: { renderer: 'text', props: required } },
  npwp: {
    label: 'NPWP',
    form: {
      renderer: 'text',
      behavior: { visible: ({ draft }) => !isForeignCompanyType(draft.companyType), resetWhen: ({ draft }) => draft.companyType },
    },
  },
  taxId: {
    label: 'Tax ID',
    form: {
      renderer: 'text',
      behavior: { visible: ({ draft }) => isForeignCompanyType(draft.companyType), resetWhen: ({ draft }) => draft.companyType },
    },
  },
  businessField: { label: 'Business field', form: { renderer: 'select', source: vendorBusinessFieldOptions, props: required } },
  password: { label: 'Password', form: { renderer: 'password', props: required } },
  passwordConfirmation: { label: 'Confirm password', form: { renderer: 'password', props: required } },
} satisfies FieldsInput<Record<string, unknown>, Record<string, unknown>>

const registerObjectSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required.').max(255),
  companyType: vendorCompanyTypeSchema,
  email: z.string().trim().email('Enter a valid email address.'),
  username: z
    .string()
    .trim()
    .min(3, 'Username must have at least 3 characters.')
    .max(160, 'Username must have at most 160 characters.')
    .regex(/^[A-Za-z0-9._-]+$/, 'Use letters, digits, dot, underscore or hyphen only.'),
  npwp: z.string().trim().optional(),
  taxId: z.string().trim().optional(),
  businessField: vendorBusinessFieldSchema,
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
  passwordConfirmation: z.string().min(8, 'Use at least 8 characters.').max(200),
})

export type VendorRegisterFormInput = z.output<typeof registerObjectSchema>

export const vendorRegisterFormValidation = fromZod(
  registerObjectSchema.superRefine((input, context) => {
    if (input.password !== input.passwordConfirmation) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['passwordConfirmation'], message: 'Passwords must match.' })
    }
    for (const issue of vendorIdentityIssues(input)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [issue.field], message: issue.message })
    }
  })
)
