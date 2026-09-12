<script setup lang="ts">
import { defineAsyncComponent, ref, watch, computed, onBeforeUnmount, type PropType } from 'vue'
import type { UploadOperation, UploadProgress } from '../../contracts'
import { useFormInputPending } from '../core/useFormInputState'
import FileComponent from '@southneuhof/loom/components/utils/FileComponent.vue'
import { toast } from 'vue-sonner'
import BaseInput from './BaseInput.vue'
import { commonProps } from './commonprops'
import { MIME_TYPE_NAMES } from '@southneuhof/utilities/object'
import Icon from '@southneuhof/loom/components/base/Icon.vue'
import Tooltip from '@southneuhof/loom/components/base/Tooltip.vue'
import Button from '@southneuhof/loom/components/base/Button.vue'
import Popover from '@southneuhof/loom/components/base/Popover.vue'
import { Dialog, DialogContent } from '@southneuhof/loom/components/base/Dialog/index'
import { toInputAssetValue, type InputAssetValue } from './assetValue'
import { useDropZone } from '@vueuse/core'
import { useOptionalAssetProvider, type ManagedAsset } from './optionalAssetProvider'
import { useUploadMutation } from './useUploadMutation'

const props = defineProps({
  accept: {
    type: Array<string>,
    required: false,
    default: undefined,
  },
  maxSize: {
    type: Number,
    required: false,
    default: undefined,
  },
  multi: {
    type: Boolean,
    required: false,
    default: false,
  },
  uploadPath: {
    type: String,
    default: '',
  },
  upload: Function as PropType<UploadOperation<any>>,
  toModel: { type: Function as PropType<(result: any) => unknown | Promise<unknown>>, default: (result: unknown) => result },
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
const emit = defineEmits<{
  (event: 'validation:touch'): void
}>()

const acceptTypes = computed(() => props.accept ?? [])
const maxFileSize = computed(() => props.maxSize ?? 10)
const acceptTypesPretty = computed(() => acceptTypes.value.map((type: string) => MIME_TYPE_NAMES[type] ?? type))

type PersistedFileRow = {
  id: string
  kind: 'persisted'
  item: InputAssetValue
}

type PendingFileRow = {
  id: string
  kind: 'pending'
  file: File
  progress?: UploadProgress
}

type FileRow = PersistedFileRow | PendingFileRow

const rows = ref<FileRow[]>([])
let rowSequence = 0
const sourcePopoverOpen = ref(false)
const fileManagerOpen = ref(false)
const fileInput = ref<HTMLInputElement>()
const dropZoneRef = ref<HTMLDivElement>()

const modelValue = defineModel<any>()
if (modelValue.value) {
  if (Array.isArray(modelValue.value)) {
    rows.value = modelValue.value
      .map((item) => toInputAssetValue(item))
      .filter((item): item is InputAssetValue => Boolean(item))
      .map((item) => persistedRow(item))
  } else {
    const normalized = toInputAssetValue(modelValue.value)
    if (normalized) rows.value.push(persistedRow(normalized))
  }
}

function nextRowID() {
  rowSequence += 1
  return `file-upload-${rowSequence}`
}

function persistedRow(item: InputAssetValue): PersistedFileRow {
  return { id: nextRowID(), kind: 'persisted', item }
}

function persistedItems() {
  return rows.value.flatMap((row) => row.kind === 'persisted' ? [row.item] : [])
}

function emitChanges() {
  const items = persistedItems()
  if (props.multi) modelValue.value = items
  else modelValue.value = items[0] || null
}

function progressPercentage(progress?: UploadProgress) {
  if (!progress?.total || progress.total <= 0) return undefined
  return Math.min(100, Math.max(0, Math.round((progress.loaded / progress.total) * 100)))
}

function sameAsset(left: InputAssetValue, right: InputAssetValue) {
  return left.id === right.id
    && left.kind === right.kind
    && left.url === right.url
    && left.name === right.name
    && left.size === right.size
    && left.mimeType === right.mimeType
    && left.updatedAt === right.updatedAt
    && JSON.stringify(left.metadata ?? null) === JSON.stringify(right.metadata ?? null)
}

function syncPersistedRows(value: unknown) {
  const values = Array.isArray(value) ? value : (value === undefined || value === null ? [] : [value])
  for (const item of values) {
    if (item !== null && typeof item === 'object' && toInputAssetValue(item) === null) {
      throw new Error('[loom] FileInput received a malformed asset value.')
    }
  }
  const current = persistedItems()
  const normalized = values
    .map((item) => toInputAssetValue(item))
    .filter((item): item is InputAssetValue => Boolean(item))
  if (current.length === normalized.length && current.every((item, index) => sameAsset(item, normalized[index]))) return

  const pending = rows.value.filter((row): row is PendingFileRow => row.kind === 'pending')
  rows.value = [...normalized.map((item) => persistedRow(item)), ...pending]
}

function startFileUpload(file: File) {
  const row: PendingFileRow = { id: nextRowID(), kind: 'pending', file }
  rows.value.push(row)
  const operation = inputPending.begin()
  pendingOperations.add(operation)

  void (async () => {
    try {
      const uploaded = await mutation.execute(file, props.uploadPath, (progress) => {
        const current = rows.value.find(
          (candidate): candidate is PendingFileRow => candidate.id === row.id && candidate.kind === 'pending',
        )
        if (current) current.progress = progress
      })
      const model = await props.toModel(uploaded)
      if (disposed || operation.released()) return
      const normalized = toInputAssetValue(model)
      if (!normalized) throw new Error('Invalid upload response')
      const index = rows.value.findIndex((candidate) => candidate.id === row.id && candidate.kind === 'pending')
      if (index === -1) return
      rows.value.splice(index, 1, { id: row.id, kind: 'persisted', item: normalized })
      emitChanges()
      emit('validation:touch')
    } catch (err) {
      if (disposed || operation.released()) return
      const index = rows.value.findIndex((candidate) => candidate.id === row.id && candidate.kind === 'pending')
      if (index !== -1) rows.value.splice(index, 1)
      toast.error(`Gagal mengunggah berkas: ${mutation.error.value?.message ?? String(err)}`)
    } finally {
      releaseOperation(operation)
    }
  })()
}

const handleFileUpload = (files: File | File[]) => {
  const incomingFiles = Array.isArray(files) ? files : [files]
  const fileArray = props.multi ? incomingFiles : incomingFiles.slice(0, 1)

  fileArray.forEach((file) => {
    if (!props.multi && rows.value.length > 0) return
    if (!validateFileLike(file.type, file.size)) return
    startFileUpload(file)
  })
}

function handleInputChange(event: Event) {
  const target = event.target as HTMLInputElement
  handleFileUpload(Array.from(target.files ?? []))
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

function validateFileLike(contentType?: string, size?: number): boolean {
  if (acceptTypes.value.length > 0 && contentType && !acceptTypes.value.includes(contentType)) {
    toast.error(`Tipe berkas tidak didukung. Tipe berkas yang diterima adalah ${acceptTypes.value.join(', ')}`)
    return false
  }
  if (typeof size === 'number' && size > maxFileSize.value * 1024 * 1024) {
    toast.error(`Ukuran berkas terlalu besar. Maksimal ${maxFileSize.value}MB`)
    return false
  }
  return true
}

async function selectFileManagerAsset(payload: ManagedAsset) {
  if (!fileManager || payload.kind === 'folder') return
  const normalized = toInputAssetValue(await fileManager.values.toModel(payload))
  if (!normalized) return
  if (!validateFileLike(normalized.mimeType, normalized.size)) return

  if (props.multi) rows.value.push(persistedRow(normalized))
  else rows.value = [persistedRow(normalized)]

  emitChanges()
  emit('validation:touch')
  fileManagerOpen.value = false
}

function handleFileDelete(id: string) {
  const index = rows.value.findIndex((row) => row.id === id && row.kind === 'persisted')
  if (index === -1) return
  rows.value.splice(index, 1)
  emitChanges()
  emit('validation:touch')
}

watch(modelValue, syncPersistedRows)

function onDrop(files?: File[] | null) {
  if (files?.length) handleFileUpload(files)
}

const { isOverDropZone } = useDropZone(dropZoneRef as any, onDrop)
const canAddFile = computed(() => props.multi || rows.value.length === 0)
</script>

<template>
  <BaseInput v-bind="props">
    <div class="flex flex-col gap-4">
      <div v-if="rows.length > 0" class="flex flex-row flex-wrap items-center gap-4">
        <template v-for="row in rows" :key="row.id">
          <FileComponent
            v-if="row.kind === 'persisted'"
            :filename="row.item.name"
            :url="row.item.url"
            :ext="row.item.url?.split('.')[1]"
            :action="{
              label: 'Hapus',
              action: () => handleFileDelete(row.id),
            }"
          />
          <div
            v-else
            :data-upload-id="row.id"
            data-testid="file-upload-progress"
            class="relative flex max-w-max overflow-hidden rounded-md bg-surface-container p-4"
          >
            <div
              class="absolute inset-y-0 left-0 bg-surface-container-high transition-[width] duration-200"
              :class="progressPercentage(row.progress) == null ? 'w-2/5 animate-pulse' : ''"
              :style="progressPercentage(row.progress) == null ? undefined : { width: `${progressPercentage(row.progress)}%` }"
            />
            <div class="relative flex items-center gap-4">
              <Icon name="file" />
              <div class="flex flex-col gap-1">
                <div class="text-sm">{{ row.file.name }}</div>
                <p role="status" aria-live="polite" class="text-sm text-on-surface-variant">
                  Mengunggah<span v-if="progressPercentage(row.progress) != null"> {{ progressPercentage(row.progress) }}%</span>
                </p>
              </div>
            </div>
          </div>
        </template>
      </div>
      <template v-else>
        <div v-if="canAddFile" class="flex flex-col gap-2">
          <div ref="dropZoneRef" class="overlay flex w-full flex-col items-center justify-center gap-4 rounded-md py-8 outline-dashed outline-2 outline-outline-variant after:bg-on-surface-hover focus-visible:after:bg-on-surface-active active:after:bg-on-surface-active" :class="{ 'after:bg-primary-drag after:opacity-100 outline-primary/[33%]': isOverDropZone }">
            <div v-if="!isOverDropZone" class="flex flex-row items-center gap-4">
              <div class="text-black-light font-bold">Letakkan file anda di sini</div>
              <div class="text-black-light">/</div>
              <Popover v-model="sourcePopoverOpen" contentClass="p-0">
                <template #trigger>
                  <Button type="button">
                    <template #icon>
                      <Icon name="add-circle"></Icon>
                    </template>
                    <div>Pilih sumber file</div>
                  </Button>
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
              <input ref="fileInput" type="file" hidden :multiple="props.multi" :accept="acceptTypes.join(',') || undefined" class="rounded-md p-2" @change="handleInputChange" />
            </div>
            <div v-else>
              <div class="flex flex-col items-center justify-center gap-4">
                <div><Icon name="upload-cloud"></Icon></div>
                <div class="text-black-light font-bold">Lepaskan kursor untuk mengunggah</div>
              </div>
            </div>
          </div>
          <div v-if="acceptTypes.length > 0 || maxSize" class="flex flex-row gap-4">
            <div class="flex flex-row items-center gap-2">
              <Tooltip v-if="acceptTypes.length > 0 || maxSize">
                <template #trigger>
                  <div class="flex flex-row items-center gap-1 text-muted">
                    <Icon name="information" size="xs" :fill="true"></Icon>
                    <p class="text-sm">File yang diterima</p>
                  </div>
                </template>
                <template #content>
                  <div class="flex flex-col gap-2">
                    <div v-if="acceptTypes.length > 0" class="flex flex-col">
                      <p class="text-sm uppercase text-white/[67%]">Tipe File</p>
                      <p class="text-sm">{{ acceptTypesPretty.join(', ') }}</p>
                    </div>
                    <div v-if="maxFileSize" class="flex flex-col">
                      <p class="text-sm uppercase text-white/[67%]">Maksimal Ukuran File</p>
                      <p class="text-sm">{{ maxFileSize }}MB</p>
                    </div>
                  </div>
                </template>
              </Tooltip>
            </div>
          </div>
        </div>
      </template>
    </div>
  </BaseInput>
  <Dialog v-model:open="fileManagerOpen">
    <DialogContent class="flex h-[60vh] max-w-[60vw] flex-col">
      <AssetPicker @select="selectFileManagerAsset" @cancel="fileManagerOpen = false" />
    </DialogContent>
  </Dialog>
</template>
