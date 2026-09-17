<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { SelectSeparator } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <SelectSeparator
    data-slot="select-separator"
    :class="cn('bg-border pointer-events-none -mx-1 my-1 h-px', props.class)"
  />
</template>
