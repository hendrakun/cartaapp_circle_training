/**
 * Schema selection and draft validation.
 *
 * Precedence, highest first:
 *
 *   explicit component schema > resource operation schema > RPC-derived schema
 *   > manually composed catalog schema
 *
 * The resource prop factory that wired a create or update submit attaches the
 * matching operation schema (plan 006). Form never selects between create and
 * update schemas and has no mode.
 *
 * Behavior decides presence, schemas decide validity: validation always runs on
 * the visibility-filtered draft.
 */
import type { SchemaAdapter } from '../adapters/projectAdapters'
import type { FieldContext, FormValidationTrigger, FormValidatorDefinition, FormValidatorInput, ResourceOperation, ValidationIssue, ValidationResult, ValidationSchema } from '../contracts'
import { fromZod } from './zod'

export interface SchemaSelection {
  /** Passed directly to the component; always wins. */
  explicit?: ValidationSchema
  /** Declared on the resource for this operation. */
  resource?: ValidationSchema
  /** Looked up through the project schema adapter. */
  adapter?: { adapter?: SchemaAdapter; resourceKey: string; operation: Extract<ResourceOperation, 'create' | 'update'> | 'record' | 'query' }
  /** Composed by hand from the field catalog for offline resources. */
  manual?: ValidationSchema
}

export function selectSchema(selection: SchemaSelection): ValidationSchema | undefined {
  if (selection.explicit) return selection.explicit
  if (selection.resource) return selection.resource

  const lookup = selection.adapter
  if (lookup?.adapter) {
    const found = lookup.adapter.find(lookup.resourceKey, lookup.operation)
    if (found) return found
  }

  return selection.manual
}

export interface DraftValidationOptions<TDraft extends object> {
  schema?: ValidationSchema<TDraft>
  /** The visibility-filtered draft — hidden fields contribute no value. */
  draft: Partial<TDraft>
  /** Optional value prepared for schema validation; draft stays the form value. */
  validatedDraft?: Partial<TDraft>
  /** Field keys currently hidden by behavior, used for the diagnostic below. */
  hiddenKeys?: readonly string[]
}

/**
 * A schema-required field that behavior hides can never be satisfied by the
 * user. That is a contradictory definition, so it throws for the developer
 * rather than surfacing an unresolvable error to the user.
 */
export function assertNoHiddenRequiredFields(schema: ValidationSchema | undefined, hiddenKeys: readonly string[]): void {
  if (!schema || hiddenKeys.length === 0) return
  const required = (schema as { requiredKeys?: string[] }).requiredKeys
  if (!required) return

  const conflicting = hiddenKeys.filter((key) => required.includes(key))
  if (conflicting.length === 0) return
  throw new Error(
    `[loom] Field(s) ${conflicting.join(', ')} are required by the schema but hidden by behavior. Make requiredness conditional in the schema (refine or a discriminated union) instead.`,
  )
}

export function validateDraft<TDraft extends object>(
  options: DraftValidationOptions<TDraft>,
): ValidationResult<TDraft> {
  const { schema, draft: formDraft } = options
  const draft = options.validatedDraft ?? formDraft
  assertNoHiddenRequiredFields(schema, options.hiddenKeys ?? [])
  if (!schema) return { success: true, data: draft as TDraft }
  return schema.validate(draft)
}

export function validatorDefinition<TData extends object>(validator: FormValidatorInput<TData>): FormValidatorDefinition<TData> {
  return typeof validator === 'function' ? { validate: validator } : validator
}

export function validatorsForTrigger<TData extends object>(validators: readonly FormValidatorInput<TData>[], trigger: FormValidationTrigger) {
  return validators.map(validatorDefinition).filter((validator) => (validator.triggers ?? ['blur', 'submit']).includes(trigger))
}

export interface AsyncDraftValidationOptions<TData extends object> extends DraftValidationOptions<TData> {
  validators?: readonly FormValidatorInput<TData>[]
  trigger: FormValidationTrigger
  initial: Partial<TData>
  context: FieldContext
  field?: string
  signal: AbortSignal
  settle?: () => void
  /**
   * Field keys with a visible input on the calling surface. Form passes its
   * visible keys so a failed schema issue with no visible input can surface
   * instead of blocking submit in silence. Omitted callers get no orphan
   * detection. Required for form surfaces.
   */
  visibleKeys?: readonly string[]
}

export type AsyncDraftValidationResult<TData> = ValidationResult<TData> & { operationalIssues?: ValidationIssue[]; orphanIssues?: ValidationIssue[] }

/**
 * A failed validation issue whose first path segment names no visible input.
 * Such an issue can never render on a field, so callers surface it as a
 * form-level failure instead of leaving submit blocked in silence.
 */
export function orphanValidationIssues(
  issues: readonly ValidationIssue[],
  visibleKeys: readonly string[],
): ValidationIssue[] {
  const visible = new Set(visibleKeys)
  return issues.filter((issue) => issue.path.length > 0 && !visible.has(String(issue.path[0])))
}

export function orphanIssueMessage(issue: ValidationIssue): string {
  return `${issue.path.join('.')}: ${issue.message}`
}

/** Zod stays sync; custom rules make orchestration async after parsed data exists. */
export async function validateDraftAsync<TData extends object>(options: AsyncDraftValidationOptions<TData>): Promise<AsyncDraftValidationResult<TData>> {
  options.settle?.()
  const schemaResult = validateDraft(options)
  if (!schemaResult.success) {
    if (options.visibleKeys === undefined || options.signal.aborted) return schemaResult
    const orphans = orphanValidationIssues(schemaResult.issues, options.visibleKeys)
    if (orphans.length === 0) return schemaResult
    if (process.env.NODE_ENV !== 'production') {
      const keys = orphans.map((issue) => orphanIssueMessage(issue)).join('; ')
      throw new Error(
        `[loom] Form validation failed for fields with no visible input: ${keys}. Add the field, supply the value with initialData/load, or remove the key from the form schema.`,
      )
    }
    return { ...schemaResult, orphanIssues: orphans }
  }
  if (options.signal.aborted) return schemaResult
  const matching = validatorsForTrigger(options.validators ?? [], options.trigger)
  const results = await Promise.all(matching.map(async (validator) => {
    try {
      const result = await validator.validate({ data: schemaResult.data, draft: options.draft, initial: options.initial, context: options.context, field: options.field, signal: options.signal })
      if (!result) return []
      return Array.isArray(result) ? [...result] : [result]
    } catch (error) {
      if (options.signal.aborted) return []
      return [{ path: [], message: error instanceof Error ? error.message : 'Validation failed unexpectedly.', kind: 'operational' as const }]
    }
  }))
  if (options.signal.aborted) return { success: true, data: schemaResult.data }
  const issues = results.flat()
  if (!issues.length) return schemaResult
  const operationalIssues = issues.filter((issue) => issue.kind === 'operational')
  return { success: false, issues, ...(operationalIssues.length ? { operationalIssues } : {}) }
}

export { fromZod }
