<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from './ui/alert-dialog'

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  busy?: boolean
}>(), {
  confirmLabel: '确认',
  busy: false
})

const emit = defineEmits<{
  'update:open': [open: boolean]
  confirm: []
}>()

function updateOpen(open: boolean): void {
  if (!props.busy) emit('update:open', open)
}
</script>

<template>
  <AlertDialog :open="open" @update:open="updateOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel :disabled="busy">取消</AlertDialogCancel>
        <AlertDialogAction
          class="bg-[var(--sonavi-danger)] text-white hover:bg-[color-mix(in_srgb,var(--sonavi-danger)_86%,black)]"
          :disabled="busy"
          @click.capture="emit('confirm')"
        >
          {{ busy ? '正在处理…' : confirmLabel }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
