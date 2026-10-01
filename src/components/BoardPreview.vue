<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import ImageBoard from './ImageBoard.vue'
import ThumbnailStrip from './ThumbnailStrip.vue'
import ImageThumbnail from './ImageThumbnail.vue'
import type { ImageSource } from '../types/media'
import '../styles/viewer.css'

const props = defineProps<{ images: ImageSource[]; initialImage?: ImageSource }>()
const emit = defineEmits<{ close: [] }>()
const board = ref<InstanceType<typeof ImageBoard>>()
const dragPreviewImage = ref<HTMLImageElement>()
const active = ref(true)
const thumbnailDrag = ref<{ src: string; x: number; y: number; width: number; height: number } | null>(null)
let pendingDrag: { image: ImageSource; pointerId: number; x: number; y: number; target: HTMLElement } | undefined
const pendingDropId = ref<number>()
const previewRect = computed(() => {
  if (pendingDropId.value !== undefined) return board.value?.getImageRect(pendingDropId.value)
  const drag = thumbnailDrag.value
  if (!drag) return null
  const zoom = board.value?.cameraZoom ?? 1
  return { x: drag.x, y: drag.y, width: drag.width * zoom, height: drag.height * zoom }
})
let suppressThumbnailClick = false
function startThumbnailDrag(event: PointerEvent, image: ImageSource) {
  if (event.button !== 0 || pendingDrag || pendingDropId.value !== undefined) return
  suppressThumbnailClick = false
  const target = event.currentTarget as HTMLElement
  pendingDrag = { image, pointerId: event.pointerId, x: event.clientX, y: event.clientY, target }
  target.setPointerCapture(event.pointerId)
}
function moveThumbnailDrag(event: PointerEvent) {
  if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return
  if (!thumbnailDrag.value && Math.hypot(event.clientX - pendingDrag.x, event.clientY - pendingDrag.y) < 6) return
  event.preventDefault()
  suppressThumbnailClick = true
  if (!thumbnailDrag.value) {
    const thumbnail = pendingDrag.target.querySelector('img')
    const size = board.value?.getImageWorldSize(thumbnail?.naturalWidth, thumbnail?.naturalHeight)
    if (!size) return
    thumbnailDrag.value = { src: thumbnail?.naturalWidth ? pendingDrag.image.thumbnailSrc : pendingDrag.image.src, x: event.clientX, y: event.clientY, ...size }
  } else {
    thumbnailDrag.value.x = event.clientX
    thumbnailDrag.value.y = event.clientY
  }
}
function previewLoaded(event: Event) {
  if (!pendingDrag || !thumbnailDrag.value || event.target !== dragPreviewImage.value) return
  const image = event.target as HTMLImageElement
  const size = board.value?.getImageWorldSize(image.naturalWidth, image.naturalHeight)
  if (size) Object.assign(thumbnailDrag.value, size)
}
function finishThumbnailDrag(event: PointerEvent) {
  if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return
  if (thumbnailDrag.value) {
    event.preventDefault()
    thumbnailDrag.value.x = event.clientX
    thumbnailDrag.value.y = event.clientY
    pendingDropId.value = board.value?.addImageAt(pendingDrag.image, event.clientX, event.clientY, thumbnailDrag.value)
  }
  releaseThumbnailPointer()
  if (pendingDropId.value === undefined) thumbnailDrag.value = null
}
function releaseThumbnailPointer() {
  const pending = pendingDrag
  pendingDrag = undefined
  if (pending?.target.hasPointerCapture(pending.pointerId)) pending.target.releasePointerCapture(pending.pointerId)
}
function cancelThumbnailDrag() {
  releaseThumbnailPointer()
  pendingDropId.value = undefined
  thumbnailDrag.value = null
}
function lostThumbnailCapture(event: PointerEvent) {
  if (pendingDrag?.pointerId === event.pointerId) cancelThumbnailDrag()
}
function imagePresented(id: number) {
  if (pendingDropId.value !== id) return
  pendingDropId.value = undefined
  thumbnailDrag.value = null
}
function clickThumbnail(event: MouseEvent, image: ImageSource) {
  if (suppressThumbnailClick && event.detail > 0) {
    suppressThumbnailClick = false
    event.preventDefault()
    return
  }
  suppressThumbnailClick = false
  const thumbnail = (event.currentTarget as HTMLElement).querySelector('img')
  const size = thumbnail && thumbnail.naturalWidth > 0 && thumbnail.naturalHeight > 0
    ? board.value?.getImageWorldSize(thumbnail.naturalWidth, thumbnail.naturalHeight)
    : undefined
  board.value?.addImage(image, undefined, size ? { src: image.thumbnailSrc, ...size } : undefined)
}
function cancelDialog() {
  if (pendingDrag || thumbnailDrag.value) cancelThumbnailDrag()
  else emit('close')
}
function focus() { board.value?.focus() }
function deactivate() {
  active.value = false
  cancelThumbnailDrag()
  suppressThumbnailClick = false
  window.removeEventListener('blur', cancelThumbnailDrag)
}
defineExpose({ focus, cancel: cancelDialog })
onMounted(() => {
  window.addEventListener('blur', cancelThumbnailDrag)
  if (props.initialImage) board.value?.addImage(props.initialImage)
})
onActivated(() => {
  active.value = true
  window.addEventListener('blur', cancelThumbnailDrag)
  focus()
})
onDeactivated(deactivate)
onBeforeUnmount(deactivate)
</script>

<template>
  <section class="board-preview viewer-surface" aria-label="画板查看" @keydown="board?.keydown($event)" @keyup="board?.keyup($event)">
    <header class="viewer-header" data-tauri-drag-region>
      <slot name="modes" />
      <div class="viewer-controls"><slot name="close" /></div>
    </header>
    <ImageBoard ref="board" :active="active" :drag-point="pendingDropId === undefined ? thumbnailDrag : null" @presented="imagePresented" />
    <footer class="viewer-footer">
      <ThumbnailStrip :images="images" :selected-path="board?.selectedPath">
        <template #default="{ image: item }">
          <button class="board-thumbnail" :class="{ selected: board?.selectedPath === item.path }"
            :aria-label="'添加到画板：' + item.name" :title="'点击或拖入画板：' + item.name" :draggable="false"
            @dragstart.prevent @pointerdown="startThumbnailDrag($event, item)" @pointermove="moveThumbnailDrag"
            @pointerup="finishThumbnailDrag" @pointercancel="cancelThumbnailDrag" @lostpointercapture="lostThumbnailCapture"
            @click="clickThumbnail($event, item)"><ImageThumbnail :src="item.thumbnailSrc" /></button>
        </template>
      </ThumbnailStrip>
    </footer>
    <div v-if="thumbnailDrag && previewRect" class="thumbnail-drag-preview" :style="{ left: previewRect.x + 'px', top: previewRect.y + 'px', width: previewRect.width + 'px', height: previewRect.height + 'px' }" aria-hidden="true"><img ref="dragPreviewImage" :src="thumbnailDrag.src" alt="" :draggable="false" @load="previewLoaded" /></div>
  </section>
</template>

<style scoped>

.thumbnail-drag-preview { position: fixed; z-index: 100; display: flex; transform: translate(-50%, -50%); background: var(--viewer-raised); pointer-events: none; }
.thumbnail-drag-preview img { width: 100%; height: 100%; min-height: 0; object-fit: contain; }
.board-thumbnail { cursor: grab; touch-action: none; user-select: none; }
</style>
