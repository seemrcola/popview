<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Image, LayoutDashboard, X } from 'lucide-vue-next'
import SingleImageViewer from './SingleImageViewer.vue'
import BoardPreview from './BoardPreview.vue'
import type { ImageSource } from '../types/media'

const props = defineProps<{ images: ImageSource[]; initialPath: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const viewer = ref<{ focus: () => void; cancel: () => void }>()
const mode = ref<'single' | 'board'>('single')
const selectedImage = ref(props.images.find(image => image.path === props.initialPath) ?? props.images[0])
const viewerProps = computed(() => mode.value === 'single'
  ? { images: props.images, initialPath: props.initialPath }
  : { images: props.images, initialImage: selectedImage.value })
const returnFocus = document.activeElement as HTMLElement | null

onMounted(() => {
  dialog.value?.showModal()
  viewer.value?.focus()
})
onBeforeUnmount(() => {
  dialog.value?.close()
  returnFocus?.focus()
})
</script>

<template>
  <dialog ref="dialog" class="image-viewer" aria-label="图片查看器" @cancel.prevent="viewer?.cancel()">
    <KeepAlive>
      <component :is="mode === 'single' ? SingleImageViewer : BoardPreview" ref="viewer" v-bind="viewerProps" @close="emit('close')" @select="selectedImage = $event">
        <template #modes>
          <div class="viewer-modes" role="group" aria-label="查看模式">
            <button :class="{ active: mode === 'single' }" :aria-pressed="mode === 'single'" @click="mode = 'single'"><Image :size="15" />单图</button>
            <button :class="{ active: mode === 'board' }" :aria-pressed="mode === 'board'" @click="mode = 'board'"><LayoutDashboard :size="15" />画板</button>
          </div>
        </template>
        <template #close><button title="关闭" aria-label="关闭预览" @click="emit('close')"><X :size="20" /></button></template>
      </component>
    </KeepAlive>
  </dialog>
</template>

<style scoped>
.image-viewer { position: fixed; inset: 0; width: 100vw; height: 100dvh; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: var(--viewer-surface); color: var(--viewer-ink); }
.image-viewer[open] { display: flex; flex-direction: column; }
.image-viewer::backdrop { background: var(--viewer-surface); }
.image-viewer[open] { animation: preview-arrive 180ms var(--ease-out); }
@keyframes preview-arrive { from { opacity: .65; } to { opacity: 1; } }
.viewer-modes { display: flex; flex-shrink: 0; gap: 2px; padding: 3px; border-radius: var(--radius-control); background: var(--viewer-raised); }
.viewer-modes button { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; font-size: 12px; border-radius: var(--radius-control); color: var(--viewer-muted); }
.viewer-modes button.active { background: var(--viewer-selected); color: var(--viewer-selected-ink); }
@media (max-width: 650px) { .viewer-modes button { padding-inline: 8px; } }
@media (prefers-reduced-motion: reduce) { .image-viewer[open] { animation: none; } }
</style>
