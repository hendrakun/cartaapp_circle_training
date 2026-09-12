import { computed, inject, ref, type ComputedRef, type InjectionKey, type Ref } from 'vue'

export interface FormInputPendingOperation {
  /** Idempotent release. The first call ends the operation; later calls do nothing. */
  release: () => void
  readonly released: () => boolean
}

export interface FormInputPendingRegistry {
  track: <T>(operation: () => Promise<T>) => Promise<T>
  /** Starts one operation and returns its release. Disposal must call release. */
  begin: () => FormInputPendingOperation
  pending: ComputedRef<boolean>
}

const formInputPendingKey: InjectionKey<FormInputPendingRegistry> = Symbol.for('loom-form-input-pending')

const standalonePending: FormInputPendingRegistry = {
  track: (operation) => operation(),
  begin: () => {
    let done = false
    return {
      release: () => { done = true },
      released: () => done,
    }
  },
  pending: computed(() => false),
}

export function provideFormInputPending(count: Ref<number> = ref(0)): FormInputPendingRegistry {
  const pending = computed(() => count.value > 0)
  const begin = (): FormInputPendingOperation => {
    count.value += 1
    let done = false
    return {
      release: () => {
        if (done) return
        done = true
        count.value -= 1
      },
      released: () => done,
    }
  }
  const registry: FormInputPendingRegistry = {
    pending,
    begin,
    track: async <T>(operation: () => Promise<T>): Promise<T> => {
      const current = begin()
      try {
        return await operation()
      } finally {
        current.release()
      }
    },
  }
  return registry
}

export function useFormInputPending(): FormInputPendingRegistry {
  return inject(formInputPendingKey, standalonePending)
}

export function formInputPendingKeyOf(): InjectionKey<FormInputPendingRegistry> {
  return formInputPendingKey
}
