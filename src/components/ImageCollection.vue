<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, FileImage } from 'lucide-vue-next'
import FolderCard from './FolderCard.vue'
import FolderIcon from './FolderIcon.vue'
import ImageThumbnail from './ImageThumbnail.vue'
import type { DirectoryEntry, ImageItem, ImageSource } from '../types/media'

const props = defineProps<{
  folders: readonly DirectoryEntry[]
  images: ImageItem[]
  viewMode: 'grid' | 'list'
  version: number
  imagesFor: (path: string) => ImageSource[]
}>()
const emit = defineEmits<{
  selectFolder: [path: string]
  openImage: [image: ImageItem]
  visibility: [path: string, visible: boolean, version: number]
}>()
const PAGE_SIZE = 120
const page = ref(0)
const scroll = ref<HTMLElement>()
const pageCount = computed(() => Math.max(1, Math.ceil((props.folders.length + props.images.length) / PAGE_SIZE)))
const pageFolders = computed(() => props.folders.slice(page.value * PAGE_SIZE, (page.value + 1) * PAGE_SIZE))
const pageImages = computed(() => props.images.slice(Math.max(0, page.value * PAGE_SIZE - props.folders.length), Math.max(0, (page.value + 1) * PAGE_SIZE - props.folders.length)))
const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' })

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function changePage(next: number) {
  page.value = Math.max(0, Math.min(pageCount.value - 1, next))
  scroll.value?.scrollTo({ top: 0 })
}

watch(() => [props.version, props.images, props.folders], () => {
  changePage(0)
})
</script>

<template>
  <div v-if="!folders.length && !images.length" class="media-empty">
    <div class="empty-sticker"><FileImage :size="30" /></div><h2>没有匹配的图片或文件夹</h2>
  </div>
  <div v-else ref="scroll" class="media-scroll">
    <div v-if="viewMode === 'grid' && pageFolders.length" class="folder-cards">
      <FolderCard v-for="folder in pageFolders" :key="`${version}:${folder.path}`" :folder="folder"
        :images="imagesFor(folder.path)" :version="version" @select="emit('selectFolder', $event)"
        @visibility="(path, visible, generation) => emit('visibility', path, visible, generation)" />
    </div>
    <div v-if="pageImages.length || (viewMode === 'list' && pageFolders.length)" :class="viewMode === 'grid' ? 'media-grid' : 'media-list'">
      <template v-if="viewMode === 'list'">
        <button v-for="folder in pageFolders" :key="folder.path" class="media-item list-item folder-list-item"
          :title="folder.name" @click="emit('selectFolder', folder.path)">
          <div class="media-preview folder-list-preview"><FolderIcon class="folder-list-icon" /></div>
          <div class="media-name">{{ folder.name }}</div>
          <div class="media-meta">文件夹</div>
        </button>
      </template>
      <button v-for="item in pageImages" :key="item.path" class="media-item"
        :class="{ 'list-item': viewMode === 'list' }" @click="emit('openImage', item)">
        <div class="media-preview">
          <ImageThumbnail :src="item.thumbnailSrc" :alt="item.name" fit="cover" />
        </div>
        <div class="media-name">{{ item.name }}</div>
        <div class="media-meta">{{ formatSize(item.size) }} · {{ item.modified == null ? '日期未知' : dateFormat.format(new Date(item.modified * 1000)) }}</div>
      </button>
    </div>
    <nav v-if="pageCount > 1" class="collection-pages" aria-label="图片列表分页">
      <button :disabled="page === 0" aria-label="上一页" @click="changePage(page - 1)"><ChevronLeft :size="16" />上一页</button>
      <span role="status">{{ page + 1 }} / {{ pageCount }}</span>
      <button :disabled="page === pageCount - 1" aria-label="下一页" @click="changePage(page + 1)">下一页<ChevronRight :size="16" /></button>
    </nav>
  </div>
</template>

<style scoped>
.folder-list-item .folder-list-preview { background: #edf7fd; border-color: #c4deed; }
.folder-list-item { --folder-shadow: 0 1px 1px #236c9626; }
.folder-list-item:is(:hover, :focus-visible) { --folder-tilt: -7deg; --folder-shadow: 0 2px 2px #236c9633; }
.folder-list-preview .folder-list-icon { width: 36px; height: 32px; }
.collection-pages { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 24px 0 8px; }
.collection-pages button { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border: 1px solid #17171c; border-radius: 8px; background: #fff3b0; }
.collection-pages button:disabled { opacity: .45; cursor: default; }
.collection-pages button:focus-visible, .media-item:focus-visible { outline: 2px solid #a43c59; outline-offset: 3px; }
.media-scroll { min-height: 0; flex: 1; overflow-y: auto; overflow-x: hidden; padding: 20px; scrollbar-color: #17171c transparent; }.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); align-content: start; gap: 16px; }.media-item { min-width: 0; padding: 0; border: 1.5px solid #17171c; border-radius: 11px; background: #fff; color: #27242b; text-align: left; overflow: hidden; box-shadow: 3px 3px 0 #17171c; transition: transform .15s, box-shadow .15s; }.media-item:hover { transform: translate(-1px,-1px); box-shadow: 5px 5px 0 #17171c; }.media-preview { position: relative; aspect-ratio: 1.25; display: grid; place-items: center; overflow: hidden; background: #dff4eb; }.media-preview :deep(img) { width: 100%; height: 100%; object-fit: cover; transition: transform .25s; }.media-item:hover .media-preview :deep(img) { transform: scale(1.04); }.preview-hint { position: absolute; right: 7px; bottom: 7px; padding: 3px 6px; border: 1px solid #17171c; border-radius: 5px; background: #ff8d9e; color: #17171c; font-size: 9px; font-weight: 700; }.preview-hint { opacity: 0; background: #fffdf7; transition: opacity .15s; }.media-item:hover .preview-hint { opacity: 1; }.media-name { padding: 9px 10px 0; overflow: hidden; font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }.media-meta { padding: 4px 10px 10px; color: #938993; font-size: 10px; }.media-list { display: flex; flex-direction: column; gap: 0; }.list-item { width: 100%; min-height: 57px; display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-width: 1.5px 1.5px 0; border-radius: 0; box-shadow: none; }.list-item:last-child { border-bottom-width: 1.5px; border-radius: 0 0 10px 10px; }.list-item:hover { transform: none; background: #fff3b0; box-shadow: none; }.list-item .media-preview { width: 56px; height: 42px; flex: 0 0 56px; border: 1px solid #17171c; border-radius: 6px; }.list-item .media-name { padding: 0; flex: 1; }.list-item .media-meta { padding: 0; }.media-empty { min-height: 0; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: #aaa0aa; text-align: center; }.empty-sticker { width: 64px; height: 64px; display: grid; place-items: center; border: 1.5px solid #17171c; border-radius: 17px; background: #fff3b0; color: #17171c; box-shadow: 4px 4px 0 #17171c; transform: rotate(-5deg); }.media-empty h2 { margin: 8px 0 0; color: #27242b; font-family: 'Space Grotesk'; font-size: 16px; }.media-empty p { max-width: 380px; margin: 0 0 8px; color: #918890; font-size: 11px; line-height: 1.5; }
@media (max-width: 900px) {.media-grid { grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); } }
.folder-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 24px 18px; margin-bottom: 20px; }
@media (max-width: 900px) {.media-grid { grid-template-columns: repeat(auto-fill, minmax(135px, 1fr)); } }
</style>
