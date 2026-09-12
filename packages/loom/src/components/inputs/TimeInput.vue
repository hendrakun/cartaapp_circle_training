<script setup lang="ts">
import Datepicker from '@vuepic/vue-datepicker'
import BaseInput from './BaseInput.vue'
import { useFrameworkUi } from '../../adapters/projectAdapters'
import { commonProps } from './commonprops'
import { formatTimeValue, parseTimeValue, type TimeParts } from './timeInput.utils'
import { ref, watch } from 'vue'
import { datepickerPopupClass, datepickerPopupConfig, datepickerTeleportProp } from './datepickerPopup'

const props = defineProps({
  locale: {
    type: String,
    default: 'id-ID',
  },
  defaultToCurrent: {
    type: Boolean,
    default: false,
  },
  teleport: {
    ...datepickerTeleportProp,
  },
  ...commonProps,
})

const emit = defineEmits<{ (event: 'validation:touch'): void }>()
const modelValue = defineModel<string>()
// if (props.defaultToCurrent && !modelValue.value) modelValue.value = {hours: String(new Date().getHours()), minutes: String(new Date().getMinutes()), seconds: String(new Date().getSeconds())}

const internalValue = ref<TimeParts | null>()
const modelUpdated = ref(false)

if (props.defaultToCurrent) internalValue.value = { hours: new Date().getHours(), minutes: new Date().getMinutes(), seconds: new Date().getSeconds() }
else if (modelValue.value) internalValue.value = parseTimeValue(modelValue.value)

watch(
  internalValue,
  () => {
    if (!internalValue.value) {
      if (modelValue.value != null) modelValue.value = ''
      return
    }
    modelValue.value = formatTimeValue(internalValue.value)
  },
  { immediate: props.defaultToCurrent }
)

watch(
  () => modelValue.value,
  (newValue) => {
    if (!newValue) {
      if (internalValue.value != null) internalValue.value = null
      return
    }
    const { hours, minutes, seconds } = parseTimeValue(newValue)
    const currentHours = Number(internalValue.value?.hours)
    const currentMinutes = Number(internalValue.value?.minutes)
    const currentSeconds = Number(internalValue.value?.seconds)
    if (currentHours === hours && currentMinutes === minutes && currentSeconds === seconds) return
    internalValue.value = { hours, minutes, seconds }
  },
  { immediate: true }
)

function displayFormatter(value: Record<string, any>) {
  return modelValue.value ? modelValue.value : 'Masukkan Waktu'
}

function markModelUpdated() {
  modelUpdated.value = true
}

function handleBlur() {
  const wasUpdated = modelUpdated.value
  modelUpdated.value = false
  if (!wasUpdated) emit('validation:touch')
}
</script>

<template>
  <BaseInput v-bind="props">
    <Datepicker
      v-model="internalValue"
      :format="displayFormatter"
      time-picker
      auto-apply
      :dark="useFrameworkUi().colorPreference().value === 'dark'"
      :teleport="teleport"
      :config="datepickerPopupConfig"
      :class="datepickerPopupClass"
      @focusout.stop
      @update:model-value="markModelUpdated"
      @blur="handleBlur"
    />
  </BaseInput>
</template>
