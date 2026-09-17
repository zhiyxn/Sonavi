<script setup lang="ts">
import { SelectValue } from "reka-ui"

const props = withDefaults(defineProps<{ placeholder?: string }>(), { placeholder: '' })
</script>

<template>
  <SelectValue
    data-slot="select-value"
    v-bind="props"
  >
    <slot />
  </SelectValue>
</template>
