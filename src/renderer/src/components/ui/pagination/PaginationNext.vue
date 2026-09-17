<script setup lang="ts">
import type { PaginationNextProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from '@/components/ui/button'
import { ChevronRight } from '@lucide/vue'
import { reactiveOmit } from "@vueuse/core"
import { PaginationNext, useForwardProps } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from '@/components/ui/button'

const props = withDefaults(defineProps<PaginationNextProps & {
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
}>(), {
  size: "default",
  asChild: false,
  as: 'button',
  class: undefined,
})

const delegatedProps = reactiveOmit(props, "class", "size")
const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <PaginationNext
    data-slot="pagination-next"
    :class="cn(buttonVariants({ variant: 'ghost', size }), 'gap-1 px-2.5 sm:pr-2.5', props.class)"
    v-bind="forwarded"
  >
    <slot>
      <span class="hidden sm:block">下一页</span>
      <ChevronRight />
    </slot>
  </PaginationNext>
</template>
