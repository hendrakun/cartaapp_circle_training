import { computed, inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import { errorMessage } from '@/framework/adapters/data/normalize'
import { vendorsActions } from './vendors.actions'
import type { VendorDetail, VendorRecord } from './vendors.types'

export type DetailStatus = 'loading' | 'ready' | 'missing' | 'error'

export type VendorDetailContext = {
  status: Ref<DetailStatus>
  detail: Ref<VendorDetail | undefined>
  vendor: Ref<VendorRecord | undefined>
  error: Ref<string | undefined>
  load: () => Promise<void>
  refresh: () => Promise<void>
  apply: (detail: VendorDetail | undefined) => void
}

const detailKey: InjectionKey<VendorDetailContext> = Symbol('vendor-detail')
const defaultLoader = () => vendorsActions.mine()

/**
 * One payload load for one vendor area. The owner layout and the staff detail
 * page each provide it, and their child pages read the slice they show.
 */
export function provideVendorDetail(loader: () => Promise<VendorDetail> = defaultLoader): VendorDetailContext {
  const status = ref<DetailStatus>('loading')
  const detail = ref<VendorDetail>()
  const error = ref<string>()

  function apply(next: VendorDetail | undefined) {
    if (!next) return
    detail.value = next
    status.value = 'ready'
    error.value = undefined
  }

  async function load() {
    status.value = 'loading'
    error.value = undefined
    try {
      detail.value = await loader()
      status.value = 'ready'
    } catch (thrown) {
      if ((thrown as { error?: string } | undefined)?.error === 'not_found') {
        status.value = 'missing'
        return
      }
      error.value = errorMessage(thrown, 'The vendor registration could not be loaded.')
      status.value = 'error'
    }
  }

  const context: VendorDetailContext = {
    status,
    detail,
    vendor: computed(() => detail.value?.vendor),
    error,
    load,
    refresh: load,
    apply,
  }
  provide(detailKey, context)
  return context
}

export function useVendorDetail(): VendorDetailContext {
  const context = inject(detailKey)
  if (!context) throw new Error('[vendor] The vendor payload is only available inside a vendor surface.')
  return context
}
