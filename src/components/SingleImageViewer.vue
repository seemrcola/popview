<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-vue-next'

import ThumbnailStrip from './ThumbnailStrip.vue'
import ImageThumbnail from './ImageThumbnail.vue'
import type { ImageSource } from '../types/media'
import '../styles/viewer.css'

const props = defineProps<{ images: ImageSource[]; initialPath: string }>()
const emit = defineEmits<{ close: []; select: [image: ImageSource] }>()
const canvas = ref<HTMLElement>()
const index = ref(Math.max(0, props.images.findIndex(image => image.path === props.initialPath)))
const image = computed(() => props.images[index.value])
const dimensions = ref({ width: 0, height: 0 })
const viewport = ref({ width: 0, height: 0 })
const fit = ref(true)
const zoom = ref(1)
const pan = ref({ x: 0, y: 0 })
const dragging = ref(false)
const loading = ref(true)
const failed = ref(false)
let origin = { x: 0, y: 0 }
let observer: ResizeObserver | undefined
const fitScale = computed(() => dimensions.value.width ? Math.min(1, viewport.value.width / dimensions.value.width, viewport.value.height / dimensions.value.height) : 1)
const scale = computed(() => fit.value ? fitScale.value : zoom.value)
const imageStyle = computed(() => ({ width: `${dimensions.value.width}px`, height: `${dimensions.value.height}px`, transform: `translate(${pan.value.x}px, ${pan.value.y}px) scale(${scale.value})` }))

function clampPan() {
  const horizontal = Math.max(0, (dimensions.value.width * scale.value - viewport.value.width) / 2)
  const vertical = Math.max(0, (dimensions.value.height * scale.value - viewport.value.height) / 2)
  pan.value = { x: Math.max(-horizontal, Math.min(horizontal, pan.value.x)), y: Math.max(-vertical, Math.min(vertical, pan.value.y)) }
}
function select(nextIndex: number) {
  if (!props.images.length) return
  index.value = (nextIndex + props.images.length) % props.images.length
  emit('select', props.images[index.value])
}
watch(() => image.value?.path, () => {
  fit.value = true
  loading.value = true
  failed.value = false
  dragging.value = false
  dimensions.value = { width: 0, height: 0 }
  pan.value = { x: 0, y: 0 }
})
function loaded(event: Event) {
  const element = event.target as HTMLImageElement
  dimensions.value = { width: element.naturalWidth, height: element.naturalHeight }
  loading.value = false
}
function toggleFit() {
  if (loading.value || failed.value) return
  fit.value = !fit.value
  zoom.value = 1
  pan.value = { x: 0, y: 0 }
}
function changeZoom(factor: number, anchor = { x: 0, y: 0 }) {
  if (loading.value || failed.value) return
  const previous = scale.value
  zoom.value = Math.min(8, Math.max(.01, previous * factor))
  fit.value = false
  const ratio = zoom.value / previous
  pan.value = { x: anchor.x - (anchor.x - pan.value.x) * ratio, y: anchor.y - (anchor.y - pan.value.y) * ratio }
  clampPan()
}
function wheel(event: WheelEvent) {
  if (loading.value || failed.value || !canvas.value) return
  const bounds = canvas.value.getBoundingClientRect()
  changeZoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .002), { x: event.clientX - bounds.left - bounds.width / 2, y: event.clientY - bounds.top - bounds.height / 2 })
}
function startPan(event: PointerEvent) {
  if (event.button !== 0 || loading.value || failed.value) return
  dragging.value = true
  origin = { x: event.clientX - pan.value.x, y: event.clientY - pan.value.y }
  canvas.value?.setPointerCapture(event.pointerId)
}
function movePan(event: PointerEvent) {
  if (!dragging.value) return
  pan.value = { x: event.clientX - origin.x, y: event.clientY - origin.y }
  clampPan()
}
function keydown(event: KeyboardEvent) {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if ((event.target as HTMLElement).closest('.viewer-modes')) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    select(index.value + (event.key === 'ArrowLeft' ? -1 : 1))
  } else if (event.key === '+' || event.key === '=') changeZoom(1.2)
  else if (event.key === '-') changeZoom(1 / 1.2)
  else if (event.key === '0') { fit.value = true; pan.value = { x: 0, y: 0 } }
}
function focus() { canvas.value?.focus({ preventScroll: true }) }
function cancel() { emit('close') }
defineExpose({ focus, cancel })
onActivated(focus)
onDeactivated(() => { dragging.value = false })
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry || !entry.contentRect.width || !entry.contentRect.height) return
    viewport.value = { width: Math.max(1, entry.contentRect.width - 64), height: Math.max(1, entry.contentRect.height - 32) }
    clampPan()
  })
  if (canvas.value) observer.observe(canvas.value)
})
onBeforeUnmount(() => { observer?.disconnect() })
</script>

<template>
  <section class="single-image-viewer viewer-surface" aria-label="单图查看" @keydown="keydown">
    <header class="viewer-header" data-tauri-drag-region>
      <slot name="modes" />
    </header>
    <div class="viewer-workspace">
      <div class="viewer-info">
        <strong :title="image?.name">{{ image?.name }}</strong>
        <span>{{ index + 1 }} / {{ images.length }}</span>
      </div>
      <div class="viewer-controls" role="group" aria-label="图片操作">
        <button title="缩小" aria-label="缩小" :disabled="loading || failed" @click="changeZoom(1 / 1.2)"><ZoomOut :size="18" /></button>
        <button class="viewer-scale" :disabled="loading || failed" :title="fit ? '原始大小' : '适应窗口'" @click="toggleFit">{{ fit ? '适应' : Math.round(scale * 100) + '%' }}</button>
        <button title="放大" aria-label="放大" :disabled="loading || failed" @click="changeZoom(1.2)"><ZoomIn :size="18" /></button>
        <slot name="close" />
      </div>
      <div ref="canvas" class="viewer-canvas" :class="{ dragging }" tabindex="0" aria-label="图片，左右方向键切换，加减键缩放" @wheel.prevent="wheel" @dblclick="toggleFit" @pointerdown="startPan" @pointermove="movePan" @pointerup="dragging = false" @pointercancel="dragging = false" @lostpointercapture="dragging = false">
        <img v-if="image" :key="image.path" :src="image.src" :alt="image.name" :style="imageStyle" :draggable="false" v-show="!loading && !failed" @load="loaded" @error="failed = true; loading = false" />
        <span v-if="loading" class="viewer-message" role="status">加载中…</span>
        <span v-else-if="failed" class="viewer-message" role="alert">无法显示此图片</span>
      </div>
      <button v-if="images.length > 1" class="viewer-arrow previous" aria-label="上一张" @click="select(index - 1)"><ChevronLeft /></button>
      <button v-if="images.length > 1" class="viewer-arrow next" aria-label="下一张" @click="select(index + 1)"><ChevronRight /></button>
    </div>
    <footer v-if="images.length > 1" class="viewer-footer">
      <ThumbnailStrip :images="images" :selected-path="image?.path">
        <template #default="{ image: item, index: position }">
          <button :class="{ selected: position === index }" :aria-label="item.name" :title="item.name"
            :aria-current="position === index ? 'true' : undefined" @click="select(position)">
            <ImageThumbnail :src="item.thumbnailSrc" />
          </button>
        </template>
      </ThumbnailStrip>
    </footer>
  </section>
</template>

<style scoped>

.viewer-controls .viewer-scale { min-width: 64px; font-size: 12px; font-variant-numeric: tabular-nums; }
.viewer-workspace { position: relative; display: flex; flex: 1; min-width: 0; min-height: 0; }
.viewer-info { position: absolute; z-index: 1; top: var(--space-4); left: var(--content-inset); display: flex; flex-direction: column; gap: var(--space-1); max-width: min(480px, calc(100% - 264px)); padding: 6px 10px; border-radius: var(--radius-control); background: var(--viewer-surface); pointer-events: none; }
.viewer-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; line-height: 22px; }
.viewer-info span { color: var(--viewer-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.viewer-workspace > .viewer-controls { position: absolute; z-index: 1; top: var(--space-3); right: var(--content-inset); padding: var(--space-1); border-radius: var(--radius-control); background: var(--viewer-surface); }
.viewer-canvas { flex: 1; min-height: 0; position: relative; overflow: hidden; touch-action: none; cursor: grab; display: flex; align-items: center; justify-content: center; }
.viewer-canvas.dragging { cursor: grabbing; }
.viewer-canvas img { flex: none; max-width: none; max-height: none; object-fit: contain; user-select: none; pointer-events: none; }
.viewer-message { color: var(--viewer-muted); font-size: 14px; }
.viewer-arrow { position: absolute; top: 50%; margin-top: -18px; background: var(--viewer-raised); border-color: var(--viewer-grid); }
.previous { left: 16px; }.next { right: 16px; }
.viewer-canvas:focus-visible { outline: 1px solid var(--viewer-accent); outline-offset: -1px; }
@media (max-width: 650px) {
  .viewer-info { max-width: calc(100% - 230px); }
  .viewer-info strong { font-size: 12px; }
}
</style>
