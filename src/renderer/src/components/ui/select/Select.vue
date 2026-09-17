<script setup lang="ts">
import { computed } from 'vue'
import { SelectRoot } from "reka-ui"

const props = defineProps<{
  modelValue?: string | number
  disabled?: boolean
  name?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: string | number]
  'update:open': [open: boolean]
}>()
const forwarded = computed(() => ({
  ...(props.modelValue === undefined ? {} : { modelValue: props.modelValue }),
  ...(props.disabled === undefined ? {} : { disabled: props.disabled }),
  ...(props.name === undefined ? {} : { name: props.name })
}))

function updateValue(value: unknown): void {
  if (typeof value === 'string' || typeof value === 'number') emit('update:modelValue', value)
}
</script>

<template>
  <SelectRoot
    v-slot="slotProps"
    data-slot="select"
    v-bind="forwarded"
    @update:model-value="updateValue"
    @update:open="emit('update:open', $event)"
  >
    <slot v-bind="slotProps" />
  </SelectRoot>
</template>
