<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Focus, Minus, Plus, Scan, Trash2 } from 'lucide-vue-next'

import type { ImageSource } from '../types/media'

type PlacementPreview = { src: string; width: number; height: number }
type BoardImage = ImageSource & { id: number; x: number; y: number; width: number; height: number; ready: boolean; failed: boolean; layer: number; previewSrc?: string; fixedSize: boolean }
type Gesture = { type: 'pan' | 'move' | 'resize'; pointerId: number; clientX: number; clientY: number; x: number; y: number; width: number; height: number; item?: BoardImage }
const props = defineProps<{ active: boolean; dragPoint: { x: number; y: number } | null }>()
const emit = defineEmits<{ presented: [id: number] }>()
const stage = ref<HTMLElement>()
const items = ref<BoardImage[]>([])
const selectedId = ref<number | null>(null)
const selected = computed(() => items.value.find(item => item.id === selectedId.value))
const camera = ref({ x: 0, y: 0, zoom: 1 })
const cameraZoom = computed(() => camera.value.zoom)
const viewport = ref({ width: 1, height: 1 })
const spaceHeld = ref(false)
const interacting = ref(false)
const dropOver = computed(() => props.dragPoint ? containsPoint(props.dragPoint.x, props.dragPoint.y) : false)
const notice = ref('')
let sequence = 0
let topLayer = 0
let gesture: Gesture | undefined
let observer: ResizeObserver | undefined
const worldStyle = computed(() => ({ transform: `translate(${camera.value.x}px, ${camera.value.y}px) scale(${camera.value.zoom})` }))
const selectionStyle = computed(() => ({ transform: `scale(${1 / camera.value.zoom})` }))
const selectedPath = computed(() => selected.value?.path)

function screenToWorld(clientX: number, clientY: number) {
  const bounds = stage.value?.getBoundingClientRect()
  return { x: (clientX - (bounds?.left ?? 0) - camera.value.x) / camera.value.zoom, y: (clientY - (bounds?.top ?? 0) - camera.value.y) / camera.value.zoom }
}
function getImageRect(id: number) {
  const item = items.value.find(item => item.id === id)
  const bounds = stage.value?.getBoundingClientRect()
  if (!item || !bounds) return
  return { x: bounds.left + camera.value.x + (item.x + item.width / 2) * camera.value.zoom, y: bounds.top + camera.value.y + (item.y + item.height / 2) * camera.value.zoom, width: item.width * camera.value.zoom, height: item.height * camera.value.zoom }
}
function activate(item: BoardImage) {
  selectedId.value = item.id
  item.layer = ++topLayer
}
function getImageWorldSize(naturalWidth = 0, naturalHeight = 0) {
  const bounds = stage.value?.getBoundingClientRect()
  if (!bounds?.width || !bounds.height) return
  const width = Math.min(320, bounds.width * .65)
  const height = Math.min(280, bounds.height * .65)
  if (naturalWidth <= 0 || naturalHeight <= 0) return { width, height }
  const ratio = Math.min(width / naturalWidth, height / naturalHeight)
  return { width: naturalWidth * ratio, height: naturalHeight * ratio }
}
function addImage(image: ImageSource, point?: { x: number; y: number }, preview?: PlacementPreview) {
  const bounds = stage.value?.getBoundingClientRect()
  const size = preview ?? getImageWorldSize()
  if (!bounds || !size || !bounds.width || !bounds.height) return
  const center = point ?? screenToWorld(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)
  const offset = point ? 0 : (items.value.length % 6) * 24 / camera.value.zoom
  const { width, height } = size
  const item: BoardImage = { ...image, id: ++sequence, x: center.x - width / 2 + offset, y: center.y - height / 2 + offset, width, height, ready: false, failed: false, layer: ++topLayer, previewSrc: preview?.src, fixedSize: !!preview }
  items.value.push(item)
  selectedId.value = item.id
  notice.value = `已添加 ${image.name}`
  stage.value?.focus({ preventScroll: true })
  return item.id
}
async function previewLoaded(item: BoardImage, event: Event) {
  try {
    await (event.target as HTMLImageElement).decode()
  } catch {
    item.previewSrc = undefined
  }
  emit('presented', item.id)
}
function previewFailed(item: BoardImage) {
  item.previewSrc = undefined
  emit('presented', item.id)
}
function imageFailed(item: BoardImage) {
  item.failed = true
  if (!item.previewSrc) emit('presented', item.id)
}
async function loaded(item: BoardImage, event: Event) {
  const image = event.target as HTMLImageElement
  try {
    await image.decode()
  } catch {
    imageFailed(item)
    return
  }
  if (!item.fixedSize) {
    const ratio = Math.min(item.width / image.naturalWidth, item.height / image.naturalHeight)
    const width = image.naturalWidth * ratio
    const height = image.naturalHeight * ratio
    item.x += (item.width - width) / 2
    item.y += (item.height - height) / 2
    item.width = width
    item.height = height
  }
  item.ready = true
  emit('presented', item.id)
}
function changeCameraZoom(factor: number, anchor = { x: viewport.value.width / 2, y: viewport.value.height / 2 }) {
  if (gesture) return
  const previous = camera.value.zoom
  const zoom = Math.max(.001, Math.min(16, previous * factor))
  const ratio = zoom / previous
  camera.value = { x: anchor.x - (anchor.x - camera.value.x) * ratio, y: anchor.y - (anchor.y - camera.value.y) * ratio, zoom }
}
function wheel(event: WheelEvent) {
  const bounds = stage.value?.getBoundingClientRect()
  if (!bounds) return
  changeCameraZoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .002), { x: event.clientX - bounds.left, y: event.clientY - bounds.top })
}
function frameImages(images: BoardImage[]) {
  if (!images.length) return
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const item of images) {
    left = Math.min(left, item.x)
    top = Math.min(top, item.y)
    right = Math.max(right, item.x + item.width)
    bottom = Math.max(bottom, item.y + item.height)
  }
  const zoom = Math.max(.001, Math.min(4, Math.max(1, viewport.value.width - 100) / (right - left), Math.max(1, viewport.value.height - 100) / (bottom - top)))
  camera.value = { zoom, x: viewport.value.width / 2 - (left + right) / 2 * zoom, y: viewport.value.height / 2 - (top + bottom) / 2 * zoom }
}
function scaleImage(factor: number) {
  const item = selected.value
  if (!item?.ready) return
  const bounded = Math.max(16 / Math.max(item.width, item.height), Math.min(100000 / Math.max(item.width, item.height), factor))
  const width = item.width * bounded
  const height = item.height * bounded
  item.x += (item.width - width) / 2
  item.y += (item.height - height) / 2
  item.width = width
  item.height = height
}
function removeSelected() {
  if (!selected.value) return
  emit('presented', selected.value.id)
  notice.value = `已从画板移除 ${selected.value.name}，原文件未删除`
  items.value = items.value.filter(item => item.id !== selectedId.value)
  selectedId.value = null
  stage.value?.focus({ preventScroll: true })
}
function startGesture(event: PointerEvent, type: Gesture['type'], item?: BoardImage) {
  if (gesture || (event.button !== 0 && event.button !== 1)) return
  if (type === 'resize' && !item?.ready) return
  event.preventDefault()
  stage.value?.focus({ preventScroll: true })
  const pan = type === 'pan' || spaceHeld.value || event.button === 1
  if (item && !pan) activate(item)
  else if (type === 'pan' && !spaceHeld.value && event.button === 0) selectedId.value = null
  gesture = { type: pan ? 'pan' : type, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: pan ? camera.value.x : item!.x, y: pan ? camera.value.y : item!.y, width: item?.width ?? 0, height: item?.height ?? 0, item }
  interacting.value = true
  stage.value?.setPointerCapture(event.pointerId)
}
function moveGesture(event: PointerEvent) {
  if (!gesture || gesture.pointerId !== event.pointerId) return
  const deltaX = event.clientX - gesture.clientX
  const deltaY = event.clientY - gesture.clientY
  if (gesture.type === 'pan') {
    camera.value.x = gesture.x + deltaX
    camera.value.y = gesture.y + deltaY
  } else if (gesture.item) {
    const item = gesture.item
    if (gesture.type === 'move') {
      item.x = gesture.x + deltaX / camera.value.zoom
      item.y = gesture.y + deltaY / camera.value.zoom
    } else {
      const width = gesture.width + deltaX / camera.value.zoom
      const height = gesture.height + deltaY / camera.value.zoom
      const ratio = (width * gesture.width + height * gesture.height) / (gesture.width ** 2 + gesture.height ** 2)
      const factor = Math.max(16 / Math.max(gesture.width, gesture.height), Math.min(100000 / Math.max(gesture.width, gesture.height), ratio))
      item.width = gesture.width * factor
      item.height = gesture.height * factor
    }
  }
}
function endGesture(event?: PointerEvent) {
  if (event && gesture && event.pointerId !== gesture.pointerId) return
  const pointerId = gesture?.pointerId
  gesture = undefined
  interacting.value = false
  if (pointerId !== undefined && stage.value?.hasPointerCapture(pointerId)) stage.value.releasePointerCapture(pointerId)
}
function resetInput() {
  spaceHeld.value = false
  endGesture()
}
function containsPoint(clientX: number, clientY: number) {
  const bounds = stage.value?.getBoundingClientRect()
  return !!(props.active && bounds && bounds.width > 0 && bounds.height > 0 && clientX >= bounds.left && clientX <= bounds.right && clientY >= bounds.top && clientY <= bounds.bottom)
}
function addImageAt(image: ImageSource, clientX: number, clientY: number, preview?: PlacementPreview) {
  if (!containsPoint(clientX, clientY)) return
  return addImage(image, screenToWorld(clientX, clientY), preview)
}
function keydown(event: KeyboardEvent) {
  if (!props.active || event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.target as HTMLElement
  if (target.closest('button, input, textarea, select, [contenteditable="true"]')) return
  if (event.code === 'Space') spaceHeld.value = true
  else if (event.key === 'Delete' || event.key === 'Backspace') removeSelected()
  else if (event.key === '+' || event.key === '=') changeCameraZoom(1.2)
  else if (event.key === '-') changeCameraZoom(1 / 1.2)
  else if (event.key === '0') frameImages(items.value)
  else if (selected.value && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    const distance = (event.shiftKey ? 20 : 2) / camera.value.zoom
    selected.value.x += event.key === 'ArrowLeft' ? -distance : event.key === 'ArrowRight' ? distance : 0
    selected.value.y += event.key === 'ArrowUp' ? -distance : event.key === 'ArrowDown' ? distance : 0
  } else return
  event.preventDefault()
}
function keyup(event: KeyboardEvent) {
  if (event.code === 'Space') spaceHeld.value = false
}
function focus() { stage.value?.focus({ preventScroll: true }) }
watch(() => props.active, active => { if (!active) resetInput() })
defineExpose({ addImage, addImageAt, getImageWorldSize, getImageRect, cameraZoom, keydown, keyup, selectedPath, focus })
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry.contentRect.width || !entry.contentRect.height) return
    viewport.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  })
  if (stage.value) observer.observe(stage.value)
  window.addEventListener('blur', resetInput)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('blur', resetInput)
})
</script>

<template>
  <section class="image-board" aria-label="自由图片画板">
    <div class="board-toolbar">
      <div class="board-viewport-controls" role="group" aria-label="画板视野">
        <button aria-label="缩小画板" title="缩小画板" @click="changeCameraZoom(1 / 1.2)"><Minus :size="15" /></button>
        <button class="board-percentage" title="恢复画板 100%" @click="changeCameraZoom(1 / camera.zoom)">{{ camera.zoom < .1 ? (camera.zoom * 100).toFixed(1) : Math.round(camera.zoom * 100) }}%</button>
        <button aria-label="放大画板" title="放大画板" @click="changeCameraZoom(1.2)"><Plus :size="15" /></button>
        <button :disabled="!items.length" class="board-text-button" title="显示全部图片（0）" @click="frameImages(items)"><Scan :size="15" />显示全部</button>
      </div>
      <span v-if="selected" class="board-selection-name" :title="selected.name">{{ selected.name }}</span>
    </div>
    <div class="board-workspace">
    <div ref="stage" class="board-stage" :class="{ panning: spaceHeld, interacting, 'drop-over': dropOver }" tabindex="0" aria-label="画板。拖动图片移动，右下角缩放；拖动空白处平移，滚轮缩放视野。" @pointerdown="startGesture($event, 'pan')" @pointermove="moveGesture" @pointerup="endGesture" @pointercancel="endGesture" @lostpointercapture="endGesture" @wheel.prevent="wheel">
      <div class="board-world" :style="worldStyle">
        <div v-for="item in items" :key="item.id" class="board-image" :class="{ selected: item.id === selectedId, failed: item.failed }" :style="{ left: `${item.x}px`, top: `${item.y}px`, width: `${item.width}px`, height: `${item.height}px`, zIndex: item.layer, outlineWidth: `${1.5 / camera.zoom}px` }" @pointerdown.stop="startGesture($event, 'move', item)">
          <img v-if="item.previewSrc && !item.ready" class="board-image-preview" :src="item.previewSrc" alt="" :draggable="false" @load="previewLoaded(item, $event)" @error="previewFailed(item)" />
          <img :src="item.src" :alt="item.name" :draggable="false" v-show="item.ready" @load="loaded(item, $event)" @error="imageFailed(item)" />
          <span v-if="!item.ready && (!item.previewSrc || item.failed)" class="board-image-status" :class="{ 'over-preview': !!item.previewSrc }">{{ item.failed ? '无法显示此图片' : '加载中…' }}</span>
          <template v-if="item.id === selectedId">
            <span class="board-image-label" :style="selectionStyle">{{ item.name }}</span>
            <button v-if="item.ready" class="board-resize" :style="selectionStyle" title="拖动以等比缩放" aria-label="拖动以缩放图片，也可使用工具栏缩放按钮" tabindex="-1" @pointerdown.stop="startGesture($event, 'resize', item)"></button>
          </template>
        </div>
      </div>
      <div v-if="!items.length" class="board-empty"><Scan :size="32" :stroke-width="1.25" aria-hidden="true" /><strong>把图片放在一起，自由比较</strong><span>从底部拖入或点击图片，不限数量</span></div>
      <div v-if="props.dragPoint" class="board-drop-hint">{{ dropOver ? '松开，放在这里' : '拖到画板任意位置添加' }}</div>
    </div>
      <div v-if="selected" class="board-image-controls" role="group" aria-label="选中图片操作">
        <button :disabled="!selected.ready" title="缩小选中图片" aria-label="缩小选中图片" @click="scaleImage(1 / 1.2)"><Minus :size="17" /></button>
        <button :disabled="!selected.ready" title="放大选中图片" aria-label="放大选中图片" @click="scaleImage(1.2)"><Plus :size="17" /></button>
        <button title="聚焦选中图片" aria-label="聚焦选中图片" @click="frameImages([selected])"><Focus :size="17" /></button>
        <button title="移出画板，不删除原文件" aria-label="移出画板" @click="removeSelected"><Trash2 :size="17" /></button>
      </div>
    </div>
    <span class="sr-only" role="status" aria-live="polite">{{ notice }}</span>
  </section>
</template>

<style scoped>
.image-board { flex: 1; min-height: 0; display: flex; flex-direction: column; background: var(--viewer-canvas); }
.board-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 7px 16px; border-bottom: 1px solid var(--viewer-line); background: var(--viewer-toolbar); }
.board-viewport-controls, .board-image-controls { display: flex; align-items: center; gap: 4px; min-width: 0; }
.board-viewport-controls { flex-shrink: 0; }
.board-workspace { position: relative; display: flex; flex: 1; min-height: 0; }
.board-image-controls { position: absolute; z-index: 2; right: 12px; top: 50%; transform: translateY(-50%); flex-direction: column; max-height: calc(100% - 16px); overflow-y: auto; padding: 6px; border: 1px solid var(--viewer-grid); border-radius: var(--radius-control); background: var(--viewer-toolbar); }
.board-image-controls button { width: 36px; height: 36px; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; flex-shrink: 0; min-width: 30px; height: 30px; padding: 4px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--viewer-ink); }
button:hover:not(:disabled) { background: var(--viewer-hover); }
button:focus-visible { outline: 2px solid var(--viewer-accent); outline-offset: -2px; }
.board-percentage { min-width: 56px; font-size: 11px; font-variant-numeric: tabular-nums; }
.board-text-button { padding-inline: 9px; font-size: 11px; }
.board-selection-name { min-width: 0; max-width: 220px; margin-right: 8px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 11px; color: var(--viewer-muted); }
.board-stage { flex: 1; min-height: 0; position: relative; overflow: hidden; touch-action: none; user-select: none; cursor: grab; background-image: radial-gradient(var(--viewer-grid) .7px, transparent .7px); background-size: 24px 24px; outline: none; }
.board-stage:focus-visible { outline: 1px solid var(--viewer-accent); outline-offset: -1px; }
.board-stage.interacting, .board-stage.panning .board-image { cursor: grabbing; }
.board-stage.drop-over { box-shadow: inset 0 0 0 2px var(--viewer-accent); }
.board-world { position: absolute; top: 0; left: 0; width: 0; height: 0; transform-origin: 0 0; }
.board-image { position: absolute; cursor: move; background: var(--viewer-raised); outline: solid transparent; }
.board-image.selected { outline-color: var(--viewer-accent); }
.board-image img { display: block; width: 100%; height: 100%; max-width: none; object-fit: contain; pointer-events: none; }
.board-image-status { display: grid; place-items: center; height: 100%; font-size: 12px; color: var(--viewer-muted); }
.board-image-status.over-preview { position: absolute; inset: auto 0 0; height: auto; padding: 6px; background: var(--viewer-raised); }
.board-image-label { position: absolute; left: 0; bottom: calc(100% + 4px); max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 3px 6px; border-radius: 3px; background: var(--viewer-selected); color: var(--viewer-selected-ink); font-size: 11px; line-height: 18px; transform-origin: left bottom; pointer-events: none; }
.board-resize { position: absolute; right: -12px; bottom: -12px; width: 24px; height: 24px; min-width: 24px; padding: 0; cursor: nwse-resize; border-radius: 0; transform-origin: center; }
.board-resize::after { content: ''; width: 10px; height: 10px; background: var(--viewer-accent); border: 1px solid #573642; }
.board-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; color: var(--viewer-muted); pointer-events: none; }
.board-empty strong { font-size: 15px; font-weight: 500; color: var(--viewer-ink); }.board-empty span { font-size: 12px; }
.board-drop-hint { position: absolute; left: 50%; top: 16px; transform: translateX(-50%); padding: 9px 16px; background: var(--viewer-selected); color: var(--viewer-selected-ink); border-radius: 6px; font-size: 12px; pointer-events: none; }
@media (max-width: 700px) { .board-selection-name { display: none; } .board-toolbar { padding-inline: 8px; gap: 4px; } .board-image-controls { right: 8px; } }
</style>
