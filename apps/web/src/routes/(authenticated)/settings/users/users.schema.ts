import { createUserSchema } from '@southneuhof/api/routes/(authenticated)/users/users.create.contract'
import { user } from '@southneuhof/api/routes/(authenticated)/users/users.entity'
import { z } from 'zod/v4'
import { rpc } from '@/framework/rpc'
import { defineSchema } from '@/framework/schema'

const roleSelection = z.union([z.string().trim().min(1), z.object({ id: z.string().trim().min(1) }).transform(({ id }) => id)])

export const createUserFormSchema = createUserSchema.extend({
  roleIds: z
    .array(roleSelection)
    .min(1)
    .superRefine((ids, context) => {
      if (new Set(ids).size !== ids.length) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Roles must be unique.' })
    }),
})

export const usersSchema = defineSchema(rpc.users, {
  identity: 'id',
  record: user.schemas.select,
  create: createUserFormSchema,
  update: user.schemas.update,
})
