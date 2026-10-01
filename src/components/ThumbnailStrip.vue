<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ImageSource } from '../types/media'

const props = defineProps<{ images: readonly ImageSource[]; selectedPath?: string }>()
const strip = ref<HTMLElement>()
const offset = ref(0)
const width = ref(800)
const STRIDE = 68
const start = computed(() => Math.max(0, Math.floor(offset.value / STRIDE) - 3))
const end = computed(() => Math.min(props.images.length, Math.ceil((offset.value + width.value) / STRIDE) + 3))
const visible = computed(() => props.images.slice(start.value, end.value))
let observer: ResizeObserver | undefined

function revealSelection() {
  const index = props.images.findIndex(image => image.path === props.selectedPath)
  if (!strip.value || index < 0) return
  const left = index * STRIDE
  const right = left + 60
  if (left < strip.value.scrollLeft) strip.value.scrollLeft = left
  else if (right > strip.value.scrollLeft + width.value) strip.value.scrollLeft = right - width.value
  offset.value = strip.value.scrollLeft
}

watch(() => props.selectedPath, revealSelection)
watch(() => props.images, () => {
  if (strip.value) strip.value.scrollLeft = 0
  offset.value = 0
  revealSelection()
})
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry?.contentRect.width) return
    width.value = entry.contentRect.width
    revealSelection()
  })
  if (strip.value) observer.observe(strip.value)
  revealSelection()
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <div ref="strip" class="thumbnail-strip" aria-label="图片缩略图" @scroll="offset = strip?.scrollLeft ?? 0">
    <div class="strip-track" :style="{ width: `${Math.max(0, images.length * STRIDE - 8)}px` }">
      <div class="strip-items" :style="{ left: `${start * STRIDE}px` }">
        <slot v-for="(image, index) in visible" :key="image.path" :image="image" :index="start + index" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.thumbnail-strip { overflow-x: auto; padding: 12px 22px; scrollbar-width: thin; scrollbar-color: #6d626d #202025; }
.strip-track { position: relative; height: 46px; }
.strip-items { position: absolute; display: flex; gap: 8px; }
.strip-items :deep(button) { display: flex; align-items: center; justify-content: center; flex: 0 0 60px; width: 60px; height: 46px; padding: 3px; overflow: hidden; border: 1px solid transparent; border-radius: 8px; background: #343239; color: inherit; }
.strip-items :deep(button:hover) { background: #3e3a42; }
.strip-items :deep(button:focus-visible) { outline: 2px solid #ff9aaa; outline-offset: 2px; }
.strip-items :deep(button.selected) { border-color: #ff9aaa; background: #57434b; }
.strip-items :deep(img) { display: block; width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: contain; border-radius: 4px; pointer-events: none; }
</style>
