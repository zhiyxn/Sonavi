<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { ChevronUp } from '@lucide/vue'
import { SelectScrollUpButton } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <SelectScrollUpButton
    data-slot="select-scroll-up-button"
    :class="cn('flex cursor-default items-center justify-center py-1', props.class)"
  >
    <slot>
      <ChevronUp class="size-4" />
    </slot>
  </SelectScrollUpButton>
</template>
