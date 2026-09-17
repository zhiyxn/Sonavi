<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<{
  class?: HTMLAttributes["class"]
  modelValue?: number[]
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  ariaLabel?: string
}>(), {
  class: undefined,
  modelValue: () => [0],
  disabled: false,
  min: 0,
  max: 100,
  step: 1,
  ariaLabel: '滑块'
})
const emit = defineEmits<{
  'update:modelValue': [value: number[] | undefined]
  valueCommit: [value: number[]]
}>()
</script>

<template>
  <SliderRoot
    v-slot="{ modelValue: values }"
    data-slot="slider"
    :class="cn(
      'relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
      props.class,
    )"
    :model-value="props.modelValue"
    :disabled="props.disabled"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    @update:model-value="emit('update:modelValue', $event)"
    @value-commit="emit('valueCommit', $event)"
  >
    <SliderTrack
      data-slot="slider-track"
      class="bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
    >
      <SliderRange
        data-slot="slider-range"
        class="bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
      />
    </SliderTrack>

    <SliderThumb
      v-for="(_, key) in values"
      :key="key"
      data-slot="slider-thumb"
      :aria-label="props.ariaLabel"
      class="bg-white border-primary ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
    />
  </SliderRoot>
</template>
