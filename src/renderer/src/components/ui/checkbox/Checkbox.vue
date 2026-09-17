<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { Check } from '@lucide/vue'
import { CheckboxIndicator, CheckboxRoot } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  id?: string
  name?: string
  disabled?: boolean
  required?: boolean
}>(), {
  class: undefined,
  id: '',
  name: '',
  disabled: false,
  required: false
})
const modelValue = defineModel<boolean | 'indeterminate'>({ default: false })
</script>

<template>
  <CheckboxRoot
    :id="props.id"
    v-slot="slotProps"
    v-model="modelValue"
    data-slot="checkbox"
    :name="props.name"
    :disabled="props.disabled"
    :required="props.required"
    :class="
      cn('peer border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50',
         props.class)"
  >
    <CheckboxIndicator
      data-slot="checkbox-indicator"
      class="grid place-content-center text-current transition-none"
    >
      <slot v-bind="slotProps">
        <Check class="size-3.5" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
