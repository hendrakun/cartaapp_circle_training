<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch, type PropType } from 'vue'
import type { UploadOperation } from '../../contracts'
import { useFormInputPending } from '../core/useFormInputState'
import { toast } from 'vue-sonner'
import ImagePreview from '@southneuhof/loom/components/base/ImagePreview.vue'
import Draggable from 'vuedraggable'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Chip from '@southneuhof/loom/components/base/Chip.vue'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Spinner from '@southneuhof/loom/components/base/Spinner.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'
import { Dialog, DialogContent } from '@southneuhof/loom/components/base/Dialog/index'
import { isImageAssetValue, toInputAssetValue, type InputAssetValue } from './assetValue'
import { useOptionalAssetProvider, type ManagedAsset } from './optionalAssetProvider'
import { useUploadMutation } from './useUploadMutation'

const props = defineProps({
  modelValue: {
    type: Object,
    required: false,
  },
  maxSize: {
    type: Number,
    required: false,
    default: 5,
  },
  disableInformation: {
    type: Boolean,
    required: false,
    default: false,
  },
  multi: {
    type: Boolean,
    required: false,
    default: false,
  },
  limit: {
    type: Number,
    required: false,
    default: -1,
  },
  additionalInfo: {
    type: String,
    required: false,
    default: '',
  },
  uploadPath: {
    type: String,
    default: '',
  },
  upload: Function as PropType<UploadOperation<any>>,
  toModel: { type: Function as PropType<(result: any) => unknown | Promise<unknown>>, default: (result: unknown) => result },
  imageURLResolver: {
    type: Function as PropType<(payload: any) => { imageURL: string; thumbnailURL: string }>,
  },
  ...commonProps,
})
const fileManager = useOptionalAssetProvider()
const AssetPicker = defineAsyncComponent(() => import('../../file-manager/AssetPicker.vue'))
const mutation = useUploadMutation(() => props.upload)
const inputPending = useFormInputPending()
let disposed = false
const pendingOperations = new Set<{ release: () => void }>()
function releaseOperation(operation: { release: () => void }) {
  operation.release()
  pendingOperations.delete(operation)
}
onBeforeUnmount(() => {
  disposed = true
  for (const operation of [...pendingOperations]) releaseOperation(operation)
})
const imageURLResolver = props.imageURLResolver ?? ((payload: any) => ({ imageURL: payload?.url ?? '', thumbnailURL: payload?.url ?? '' }))

const modelValue = defineModel<InputAssetValue | Array<InputAssetValue>>()
const emit = defineEmits(['update:modelValue', 'update:uploadState', 'validation:touch'])

const uploadPercentage = computed(() => {
  const value = mutation.progress.value
  return value?.total ? Math.round((value.loaded / value.total) * 100) : undefined
})
const images = ref<Array<any>>([])
const isUploading = mutation.pending
const isDragActive = ref(false)
const isReplaceDragActive = ref(false)
const fileInput = ref<HTMLInputElement>()
const sourcePopoverOpen = ref(false)
const fileManagerOpen = ref(false)

syncImages(modelValue.value)

const emitData = () => {
  if (props.multi) {
    emit('update:modelValue', images.value)
  } else emit('update:modelValue', images.value[0])
}

const handleUpload = (file?: File, options: { replace?: boolean } = {}) => {
  if (!file) return
  if (file.size > props.maxSize * 1000000) {
    toast.error('Ukuran berkas terlalu besar')
    return
  }
  const operation = inputPending.begin()
  pendingOperations.add(operation)
  void (async () => {
    try {
      const uploaded = await mutation.execute(file, props.uploadPath)
      const model = await props.toModel(uploaded)
      if (disposed || operation.released()) return
      const normalized = normalizeImageAsset(model)
      if (!normalized) throw new Error('Invalid upload response')
      if (options.replace && !props.multi && images.value.length) {
        images.value.splice(0, 1, normalized)
      } else {
        images.value.push(normalized)
      }
      emitData()
      emit('validation:touch')
    } catch {
      if (disposed || operation.released()) return
      toast.error(mutation.error.value?.message ?? 'Gagal mengunggah gambar')
    } finally {
      releaseOperation(operation)
    }
  })()
}

const handleFileUpload = (e: Event) => {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  handleUpload(file)
  target.value = ''
}

function openDevicePicker() {
  if (!props.upload) return
  sourcePopoverOpen.value = false
  fileInput.value?.click()
}

function openFileManager() {
  if (!fileManager) return
  sourcePopoverOpen.value = false
  fileManagerOpen.value = true
}

const handleDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (isUploading.value) return
  isDragActive.value = true
}

const handleDragLeave = (event: DragEvent) => {
  event.preventDefault()
  isDragActive.value = false
}

const handleDrop = (event: DragEvent) => {
  event.preventDefault()
  isDragActive.value = false
  if (isUploading.value) return
  const file = event.dataTransfer?.files?.[0]
  handleUpload(file)
}

const handleReplaceDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (isUploading.value || props.multi || !images.value[0]) return
  isReplaceDragActive.value = true
}

const handleReplaceDragLeave = (event: DragEvent) => {
  event.preventDefault()
  isReplaceDragActive.value = false
}

const handleReplaceDrop = (event: DragEvent) => {
  event.preventDefault()
  isReplaceDragActive.value = false
  if (isUploading.value || props.multi || !images.value[0]) return
  const file = event.dataTransfer?.files?.[0]
  handleUpload(file, { replace: true })
}

const removeItem = (index: number) => {
  images.value.splice(index, 1)
  emitData()
  emit('validation:touch')
}

watch(modelValue, () => {
  syncImages(modelValue.value)
})

function handleChange() {
  if (!props.multi) return
  emitData()
}

function resolvePreviewURLs(payload: InputAssetValue) {
  return imageURLResolver(payload)
}

function resolveDragKey(item: InputAssetValue, index: number): string {
  return item?.id || item?.url || `image-${index}`
}

function normalizeImageAsset(payload: unknown): InputAssetValue | null {
  return toInputAssetValue(payload)
}

function syncImages(value: unknown) {
  const values = Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value])
  for (const item of values) {
    if (item !== null && typeof item === 'object' && toInputAssetValue(item) === null) {
      throw new Error('[loom] ImageInput received a malformed asset value.')
    }
  }
  images.value = values
    .map((item) => toInputAssetValue(item))
    .filter((item): item is InputAssetValue => Boolean(item))
}

async function selectFileManagerAsset(payload: ManagedAsset) {
  if (!fileManager || payload.kind !== 'file' || !payload.mimeType?.startsWith('image/')) {
    toast.error('Berkas yang dipilih bukan gambar')
    return
  }

  const normalized = normalizeImageAsset(await fileManager.values.toModel(payload))
  if (!normalized) return

  if (!props.multi) images.value = [normalized]
  else if (props.limit === -1 || images.value.length < props.limit) images.value.push(normalized)

  emitData()
  emit('validation:touch')
  fileManagerOpen.value = false
}
</script>

<template>
  <BaseInput v-bind="props">
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-2">
        <div class="flex flex-col gap-2">
          <div v-if="!props.disableInformation" class="flex flex-col gap-2">
            <div v-if="props.multi || (!props.multi && !images[0])">
              <div class="font-bold text-tertiary">Unggah gambar yang akan digunakan</div>
              <div v-if="props.maxSize != 1000000" class="text-sm text-muted">Ukuran berkas maksimal {{ props.maxSize }} MB</div>
              <div v-if="!(props.limit == 1 || props.limit == -1)" class="text-sm text-muted">Maksimal {{ props.limit }} gambar</div>
              <div v-if="props.additionalInfo" class="mt-2">
                <Chip color="info">{{ props.additionalInfo }}</Chip>
              </div>
            </div>
            <div v-else class="font-semibold text-tertiary">{{ images.length }} gambar diunggah</div>
          </div>
          <div class="flex flex-row items-center gap-4">
            <Draggable v-if="images.length" v-model="images" :item-key="resolveDragKey" class="flex flex-row items-center gap-4" @change="handleChange">
              <template #item="{ element, index }">
                <div
                  class="overlay w-fit cursor-move rounded-xl after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
                  :class="{ 'after:bg-tertiary-drag after:opacity-100 outline outline-1 outline-primary/[33%]': isReplaceDragActive && !props.multi && index === 0 }"
                  @dragover="handleReplaceDragOver"
                  @dragleave="handleReplaceDragLeave"
                  @drop="handleReplaceDrop"
                >
                  <ImagePreview v-if="element" :imageURL="resolvePreviewURLs(element).imageURL" :thumbnailURL="resolvePreviewURLs(element).thumbnailURL">
                    <template #actions>
                      <Button color="error" kind="icon" @click="removeItem(index)" type="button">
                        <template #icon>
                          <Icon name="delete-bin"></Icon>
                        </template>
                      </Button>
                    </template>
                  </ImagePreview>
                </div>
              </template>
            </Draggable>
            <template v-if="!isUploading">
              <Popover v-if="(props.multi && images.length != (props.limit == -1 ? 99999 : props.limit)) || (!props.multi && !images[0])" v-model="sourcePopoverOpen" contentClass="p-0">
                <template #trigger>
                  <button
                    type="button"
                    class="overlay relative flex h-40 w-40 items-center justify-center rounded-xl outline-dashed outline-2 outline-outline-variant after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active"
                    :class="{ 'after:bg-primary-drag after:opacity-100 outline-primary/[33%]': isDragActive }"
                    @dragover="handleDragOver"
                    @dragleave="handleDragLeave"
                    @drop="handleDrop"
                  >
                    <Icon name="image-add" size="2xl" class="text-on-surface"></Icon>
                    <div class="absolute left-0 top-0 h-full w-full">
                      <div v-if="uploadPercentage != 0 && uploadPercentage != 100" class="absolute h-40 w-40 rounded-xl" :style="{ width: uploadPercentage + '%' }"></div>
                    </div>
                  </button>
                </template>
                <template #content>
                  <div class="flex flex-col">
                    <button v-if="props.upload" type="button" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openDevicePicker">
                      <Icon name="upload-cloud" size="sm" />
                      <span>Upload from device</span>
                    </button>
                    <button v-if="fileManager" type="button" class="overlay flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" @click="openFileManager">
                      <Icon name="folder-2" size="sm" />
                      <span>Choose from file manager</span>
                    </button>
                  </div>
                </template>
              </Popover>
              <input ref="fileInput" type="file" hidden :accept="'image/*'" class="rounded-md p-2" @change="handleFileUpload($event)" />
            </template>
            <div v-else class="relative flex h-40 w-40 flex-col items-center justify-center rounded-xl outline-dashed outline-2 outline-outline">
              <Spinner />
              <p class="text-xs">Uploading...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseInput>
  <Dialog v-model:open="fileManagerOpen">
    <DialogContent class="flex h-[60vh] max-w-[60vw] flex-col">
      <AssetPicker :accept="(asset) => asset.kind === 'file' && !!asset.mimeType?.startsWith('image/')" @select="selectFileManagerAsset" @cancel="fileManagerOpen = false" />
    </DialogContent>
  </Dialog>
</template>
