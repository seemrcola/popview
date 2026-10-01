<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FolderIcon from './FolderIcon.vue'
import type { ImageSource } from '../types/media'

const props = defineProps<{ folder: { path: string; name: string }; images: ImageSource[]; version: number }>()
const emit = defineEmits<{ select: [path: string]; visibility: [path: string, visible: boolean, version: number] }>()
const card = ref<HTMLElement>()
const failedImages = ref(new Set<string>())
const images = computed(() => props.images.filter(image => !failedImages.value.has(image.thumbnailSrc)))
let observer: IntersectionObserver | undefined
let disposed = false

watch(() => props.images.map(image => image.thumbnailSrc).join('\0'), () => failedImages.value.clear())
onMounted(() => {
  observer = new IntersectionObserver(([entry]) => {
    if (!disposed && entry) emit('visibility', props.folder.path, entry.isIntersecting, props.version)
  })
  if (card.value) observer.observe(card.value)
})
onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  emit('visibility', props.folder.path, false, props.version)
})
</script>

<template>
  <button ref="card" class="folder-card" :title="folder.name" @click="emit('select', folder.path)">
    <div class="folder-art">
      <FolderIcon :open="images.length > 0">
        <div class="folder-photos">
          <img v-for="image in images" :key="image.path" :src="image.thumbnailSrc" alt="" loading="lazy" decoding="async" @error="failedImages.add(image.thumbnailSrc)" />
        </div>
      </FolderIcon>
    </div>
    <div class="folder-copy"><strong>{{ folder.name }}</strong></div>
  </button>
</template>

<style scoped>
.folder-card { min-width: 0; min-height: 178px; padding: 4px 0 12px; display: flex; flex-direction: column; align-items: center; gap: 8px; border: 0; border-radius: 12px; background: transparent; color: var(--ink); text-align: center; transition: background 180ms ease; }
.folder-card:is(:hover, :focus-visible) { background: #fff1bd; --folder-tilt: -12deg; --folder-shadow: 0 8px 7px #236c9633; }
.folder-art { width: 150px; height: 135px; flex: 0 0 135px; transition: transform 240ms cubic-bezier(.22, 1, .36, 1); }
.folder-photos { position: absolute; inset: 0; z-index: 1; pointer-events: none; }
.folder-photos img { --photo-rest: translate(-9px, 2px) rotate(-8deg); --photo-hover: translate(-13px, -4px) rotate(-12deg); position: absolute; width: 72px; height: 76px; left: 39px; top: 27px; object-fit: contain; padding: 3px; border: 1px solid #c8dce7; border-radius: 4px; background: #fff; box-shadow: 0 2px 5px #184f7226; transform: var(--photo-rest); transition: transform 240ms cubic-bezier(.22, 1, .36, 1); }
.folder-photos img:nth-child(2) { --photo-rest: translate(11px, -5px) rotate(8deg); --photo-hover: translate(15px, -10px) rotate(12deg); }
.folder-photos img:nth-child(3) { --photo-rest: translate(0, 1px) rotate(-2deg); --photo-hover: translate(0, -5px) rotate(-1deg); }
.folder-card:is(:hover, :focus-visible) .folder-photos img { transform: var(--photo-hover); }
.folder-copy { min-width: 0; width: 100%; }
.folder-copy strong { display: block; padding: 3px 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink); font-size: 13px; line-height: 20px; font-weight: 600; }
.folder-card:is(:hover, :focus-visible) .folder-art { transform: translateY(-4px) scale(1.015); }
.folder-card:active .folder-art { transform: translateY(-1px) scale(.99); transition-duration: 100ms; }
@media (prefers-reduced-motion: reduce) {
  .folder-card, .folder-art, .folder-photos img { transition: none; }
  .folder-card:is(:hover, :focus-visible, :active) .folder-art { transform: none; }
  .folder-card:is(:hover, :focus-visible) .folder-photos img { transform: var(--photo-rest); }
}
</style>
