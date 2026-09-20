<script setup lang="ts">
import {
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch
} from 'vue'

const props = defineProps<{
  src: string
  alt: string
  imageClass?: string
  placeholderClass?: string
}>()

const target = ref<HTMLElement | null>(null)
const shouldLoad = ref(false)
const failed = ref(false)
let observer: IntersectionObserver | null = null
let active = false
let observationVersion = 0

function disconnectObserver(): void {
  observer?.disconnect()
  observer = null
}

async function observeVisibility(): Promise<void> {
  const version = ++observationVersion
  disconnectObserver()
  if (!active) return
  if (!('IntersectionObserver' in globalThis)) {
    shouldLoad.value = true
    return
  }
  await nextTick()
  if (version !== observationVersion || !active || !target.value || shouldLoad.value || failed.value) {
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return
    shouldLoad.value = true
    disconnectObserver()
  }, { rootMargin: '240px 0px' })
  observer.observe(target.value)
}

function handleError(): void {
  failed.value = true
  shouldLoad.value = false
}

function stopLoading(): void {
  active = false
  observationVersion += 1
  disconnectObserver()
  shouldLoad.value = false
}

watch(
  () => props.src,
  () => {
    failed.value = false
    shouldLoad.value = false
    if (active) void observeVisibility()
  }
)

onMounted(() => {
  active = true
  void observeVisibility()
})
onActivated(() => {
  active = true
  void observeVisibility()
})
onDeactivated(stopLoading)
onBeforeUnmount(stopLoading)
</script>

<template>
  <img
    v-if="shouldLoad && !failed"
    ref="target"
    :src="src"
    :alt="alt"
    :class="imageClass"
    loading="lazy"
    decoding="async"
    fetchpriority="low"
    @error="handleError"
  />
  <span
    v-else
    ref="target"
    :class="placeholderClass"
    aria-hidden="true"
  />
</template>
