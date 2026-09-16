<script setup lang="ts">
import { Check, ChevronDown } from '@lucide/vue'
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport
} from 'reka-ui'
import { computed } from 'vue'

export interface SelectOption {
  value: string | number
  label: string
}

const props = defineProps<{
  modelValue: string | number
  options: readonly SelectOption[]
  label: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const stringValue = computed(() => String(props.modelValue))

function updateValue(value: unknown): void {
  const option = props.options.find((candidate) => String(candidate.value) === String(value))
  if (option) emit('update:modelValue', option.value)
}
</script>

<template>
  <SelectRoot :model-value="stringValue" @update:model-value="updateValue">
    <SelectTrigger class="sonavi-select-trigger" :aria-label="label">
      <SelectValue />
      <SelectIcon class="sonavi-select-icon">
        <ChevronDown :size="16" aria-hidden="true" />
      </SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="sonavi-select-content" position="popper" :side-offset="5">
        <SelectViewport class="sonavi-select-viewport">
          <SelectItem
            v-for="option in options"
            :key="String(option.value)"
            class="sonavi-select-item"
            :value="String(option.value)"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
            <SelectItemIndicator class="sonavi-select-indicator">
              <Check :size="15" aria-hidden="true" />
            </SelectItemIndicator>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
