<script setup lang="ts">
import type { PaginationRootEmits, PaginationRootProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { computed } from "vue"
import { PaginationRoot } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<PaginationRootProps & {
  class?: HTMLAttributes["class"]
}>(), {
  total: 0,
  siblingCount: 2,
  disabled: false,
  showEdges: false,
  asChild: false,
  as: 'nav',
  class: undefined,
})
const emit = defineEmits<PaginationRootEmits>()

const forwarded = computed(() => ({
  itemsPerPage: props.itemsPerPage,
  total: props.total,
  siblingCount: props.siblingCount,
  disabled: props.disabled,
  showEdges: props.showEdges,
  asChild: props.asChild,
  as: props.as,
  ...(props.page === undefined ? {} : { page: props.page }),
  ...(props.defaultPage === undefined ? {} : { defaultPage: props.defaultPage }),
}))
</script>

<template>
  <PaginationRoot
    v-slot="slotProps"
    data-slot="pagination"
    v-bind="forwarded"
    :class="cn('mx-auto flex w-full justify-center', props.class)"
    @update:page="emit('update:page', $event)"
  >
    <slot v-bind="slotProps" />
  </PaginationRoot>
</template>
