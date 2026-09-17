<script lang="ts" setup>
import type { ToasterProps } from "vue-sonner"
import { CircleCheck, CircleX, Info, LoaderCircle, TriangleAlert, X } from '@lucide/vue'
import { computed } from 'vue'
import { Toaster as Sonner } from "vue-sonner"
import { cn } from "@/lib/utils"

const props = defineProps<ToasterProps>()
const forwarded = computed<ToasterProps>(() => Object.fromEntries(
  Object.entries(props).filter(([, value]) => value !== undefined)
) as ToasterProps)
</script>

<template>
  <Sonner
    :class="cn('toaster group', props.class)"
    :style="{
      '--normal-bg': 'var(--sonavi-raised)',
      '--normal-text': 'var(--sonavi-ink)',
      '--normal-border': 'var(--sonavi-border)',
      '--border-radius': 'var(--sonavi-control-radius)',
    }"
    v-bind="forwarded"
  >
    <template #success-icon>
      <CircleCheck class="size-4" />
    </template>
    <template #info-icon>
      <Info class="size-4" />
    </template>
    <template #warning-icon>
      <TriangleAlert class="size-4" />
    </template>
    <template #error-icon>
      <CircleX class="size-4" />
    </template>
    <template #loading-icon>
      <div>
        <LoaderCircle class="size-4 animate-spin" />
      </div>
    </template>
    <template #close-icon>
      <X class="size-4" />
    </template>
  </Sonner>
</template>
