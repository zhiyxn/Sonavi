<script setup lang="ts">
import type { PaginationEllipsisProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { Ellipsis } from '@lucide/vue'
import { reactiveOmit } from "@vueuse/core"
import { PaginationEllipsis } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(
  defineProps<PaginationEllipsisProps & { class?: HTMLAttributes["class"] }>(),
  { asChild: false, as: 'span', class: undefined },
)

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <PaginationEllipsis
    data-slot="pagination-ellipsis"
    v-bind="delegatedProps"
    :class="cn('flex size-9 items-center justify-center', props.class)"
  >
    <slot>
      <Ellipsis class="size-4" />
      <span class="sr-only">更多页</span>
    </slot>
  </PaginationEllipsis>
</template>
