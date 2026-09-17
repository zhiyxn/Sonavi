<script setup lang="ts">
import { computed } from 'vue'
import { AlertDialogRoot } from "reka-ui"

const props = defineProps<{ open?: boolean }>()
const emit = defineEmits<{ 'update:open': [open: boolean] }>()
const forwarded = computed(() => props.open === undefined ? {} : { open: props.open })
</script>

<template>
  <AlertDialogRoot
    v-slot="slotProps"
    data-slot="alert-dialog"
    v-bind="forwarded"
    @update:open="emit('update:open', $event)"
  >
    <slot v-bind="slotProps" />
  </AlertDialogRoot>
</template>
