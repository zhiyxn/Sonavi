<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { ChevronDown } from '@lucide/vue'
import { SelectScrollDownButton } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <SelectScrollDownButton
    data-slot="select-scroll-down-button"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <slot>
      <ChevronDown class="size-4" />
    </slot>
  </SelectScrollDownButton>
</template>
