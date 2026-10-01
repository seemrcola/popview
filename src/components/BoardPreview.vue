<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import ImageBoard from './ImageBoard.vue'
import ThumbnailStrip from './ThumbnailStrip.vue'
import ImageThumbnail from './ImageThumbnail.vue'
import type { ImageSource } from '../types/media'
import '../styles/viewer.css'

const props = defineProps<{ images: ImageSource[]; initialImage?: ImageSource }>()
const emit = defineEmits<{ close: [] }>()
const board = ref<InstanceType<typeof ImageBoard>>()
const active = ref(true)
const thumbnailDrag = ref<{ image: ImageSource; x: number; y: number } | null>(null)
let pendingDrag: { image: ImageSource; pointerId: number; x: number; y: number; target: HTMLElement } | undefined
let suppressThumbnailClick = false
function startThumbnailDrag(event: PointerEvent, image: ImageSource) {
  if (event.button !== 0 || pendingDrag) return
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
  thumbnailDrag.value = { image: pendingDrag.image, x: event.clientX, y: event.clientY }
}
function finishThumbnailDrag(event: PointerEvent) {
  if (!pendingDrag || pendingDrag.pointerId !== event.pointerId) return
  if (thumbnailDrag.value) {
    event.preventDefault()
    board.value?.addImageAt(pendingDrag.image, event.clientX, event.clientY)
  }
  cancelThumbnailDrag()
}
function cancelThumbnailDrag() {
  const pending = pendingDrag
  pendingDrag = undefined
  thumbnailDrag.value = null
  if (pending?.target.hasPointerCapture(pending.pointerId)) pending.target.releasePointerCapture(pending.pointerId)
}
function clickThumbnail(event: MouseEvent, image: ImageSource) {
  if (suppressThumbnailClick && event.detail > 0) {
    suppressThumbnailClick = false
    event.preventDefault()
    return
  }
  suppressThumbnailClick = false
  board.value?.addImage(image)
}
function cancelDialog() {
  if (pendingDrag) cancelThumbnailDrag()
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
    <header class="viewer-header">
      <slot name="modes" />
      <div class="viewer-controls"><slot name="close" /></div>
    </header>
    <ImageBoard ref="board" :active="active" :drag-point="thumbnailDrag" />
    <footer class="viewer-footer">
      <ThumbnailStrip :images="images" :selected-path="board?.selectedPath">
        <template #default="{ image: item }">
          <button class="board-thumbnail" :class="{ selected: board?.selectedPath === item.path }"
            :aria-label="'添加到画板：' + item.name" :title="'点击或拖入画板：' + item.name" :draggable="false"
            @dragstart.prevent @pointerdown="startThumbnailDrag($event, item)" @pointermove="moveThumbnailDrag"
            @pointerup="finishThumbnailDrag" @pointercancel="cancelThumbnailDrag" @lostpointercapture="cancelThumbnailDrag"
            @click="clickThumbnail($event, item)"><ImageThumbnail :src="item.thumbnailSrc" /></button>
        </template>
      </ThumbnailStrip>
    </footer>
    <div v-if="thumbnailDrag" class="thumbnail-drag-preview" :style="{ left: (thumbnailDrag.x + 14) + 'px', top: (thumbnailDrag.y + 14) + 'px' }" aria-hidden="true"><img :src="thumbnailDrag.image.thumbnailSrc" alt="" :draggable="false" /></div>
  </section>
</template>

<style scoped>

.thumbnail-drag-preview { position: fixed; z-index: 100; display: flex; width: 64px; height: 64px; padding: 4px; border: 1px solid #ff9aaa; border-radius: 6px; background: #343239; pointer-events: none; opacity: .85; }
.thumbnail-drag-preview img { width: 100%; height: 100%; min-height: 0; object-fit: contain; }
.board-thumbnail { cursor: grab; touch-action: none; user-select: none; }
</style>
