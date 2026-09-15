import type {
  WebResourceCreateOf,
  WebResourceIdentityOf,
  WebResourceQueryOf,
  WebResourceRecordOf,
  WebResourceUpdateOf,
  ValidationResult,
  WebResourceSchema,
} from '../../contracts'

type RecordValue = { id: string; name: string }
type QueryValue = { search?: string }
type CreateValue = { name: string }
type UpdateValue = { name?: string }
const querySchema = { validate: (value: unknown): ValidationResult<QueryValue> => ({ success: true, data: value as QueryValue }) }

const recordSchema = { validate: (value: unknown): ValidationResult<RecordValue> => ({ success: true, data: value as RecordValue }) }
const createSchema = { validate: (value: unknown): ValidationResult<CreateValue> => ({ success: true, data: value as CreateValue }) }
const updateSchema = { validate: (value: unknown): ValidationResult<UpdateValue> => ({ success: true, data: value as UpdateValue }) }

const schema = {
  identity: 'id' as const,
  record: { schema: recordSchema },
  query: { schema: querySchema },
  create: { schema: createSchema },
  update: { schema: updateSchema },
}

const record: WebResourceRecordOf<typeof schema> = { id: '1', name: 'One' }
const query: WebResourceQueryOf<typeof schema> = { search: 'one' }
const create: WebResourceCreateOf<typeof schema> = { name: 'One' }
const update: WebResourceUpdateOf<typeof schema> = { name: 'Updated' }
const identity: WebResourceIdentityOf<typeof schema> = '1'
void [record, query, create, update, identity]

const explicit: WebResourceSchema<RecordValue, QueryValue, CreateValue, UpdateValue> = {
  identity: 'id',
  record: { schema: recordSchema },
  query: { schema: querySchema },
  create: { schema: createSchema },
  update: { schema: updateSchema },
}
void explicit

const schemaWithoutRuntimeValidation = { identity: 'id' as const, record: {}, query: { schema: querySchema } }
void schemaWithoutRuntimeValidation
