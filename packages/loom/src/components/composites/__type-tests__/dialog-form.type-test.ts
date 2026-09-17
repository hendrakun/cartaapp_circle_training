import type { DialogFormCloseContext, DialogFormProps, FormProps } from '../../../contracts'

type Row = {
  id: string
  name: string
}

const fields = {
  id: { label: 'ID', form: { renderer: 'text' } },
  name: { label: 'Name', form: { renderer: 'text' } },
}

// DialogForm must never abstract Form's props: its submit type stays identical.
type DialogSubmit = DialogFormProps<Row>['submit']
type CoreSubmit = FormProps<Row>['submit']
const sameSubmitShape: (a: DialogSubmit, b: CoreSubmit) => DialogSubmit = (a, _b) => a
void sameSubmitShape

// A structural action bag is a valid submit target on both surfaces.
const bag = { run: async (_draft: Row) => ({ id: '1' }) }
const submitBag: DialogFormProps<Row> = { fields, submit: bag }
void submitBag

type ComponentProps<TInput extends object = Record<string, unknown>, TResult = unknown> = DialogFormProps<TInput, TResult> & {
  open?: boolean
  'onUpdate:open'?: (open: boolean) => void
  'onUpdate:modelValue'?: (draft: Record<string, unknown>) => void
}

// Managed visibility needs no open prop or listener.
const managed = {
  fields,
  submit: async (draft: Row) => ({ id: draft.id }),
  beforeClose: async (context: DialogFormCloseContext) => !context.dirty,
} satisfies ComponentProps<Row, { id: string }>

// Coordinated visibility keeps the existing named model shape.
const openAndDraftBound: ComponentProps = {
  fields,
  open: true,
  'onUpdate:open': (_open: boolean) => undefined,
  modelValue: undefined,
  'onUpdate:modelValue': (_draft: Record<string, unknown>) => undefined,
}

void managed
void openAndDraftBound

// @ts-expect-error DialogForm requires canonical Form fields.
const missingFields: DialogFormProps<Row> = { submit: async () => undefined }
void missingFields

// @ts-expect-error Legacy model-config input is not part of DialogForm.
const legacyInputConfig: DialogFormProps<Row> = { fields, submit: async () => undefined, inputConfig: {} }
void legacyInputConfig

// @ts-expect-error Legacy field aliases are not part of DialogForm.
const legacyFieldsAlias: DialogFormProps<Row> = { fields, submit: async () => undefined, fieldsAlias: {} }
void legacyFieldsAlias
