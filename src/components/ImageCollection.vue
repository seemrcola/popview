<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, FileImage } from 'lucide-vue-next'
import FolderCard from './FolderCard.vue'
import FolderIcon from './FolderIcon.vue'
import ImageThumbnail from './ImageThumbnail.vue'
import { useCollectionMotion } from '../composables/useCollectionMotion'
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
useCollectionMotion(scroll, () => [props.version, props.viewMode, page.value])
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
.media-scroll { min-height: 0; flex: 1; overflow-y: auto; overflow-x: hidden; padding: 28px; scrollbar-width: thin; scrollbar-color: #b8ada1 transparent; overscroll-behavior: contain; }
.media-grid, .folder-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 24px 20px; }
.media-grid { align-content: start; }
.media-item { min-width: 0; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--ink); text-align: left; overflow: hidden; transition: background 180ms ease; }
.media-item:hover { background: #fff1bd; }
.media-item:active { background: var(--accent-soft); }
.media-preview { aspect-ratio: 1.25; display: grid; place-items: center; overflow: hidden; border-radius: 8px; background: var(--surface-subtle); }
.media-name { padding: 12px 12px 0; overflow: hidden; font-size: 13px; line-height: 20px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.media-meta { padding: 3px 12px 12px; color: var(--ink-muted); font-size: 12px; line-height: 18px; font-variant-numeric: tabular-nums; }
.media-item:active .media-meta { color: var(--ink); }
.media-preview { transition: transform var(--motion-settle) var(--ease-spring); }
.media-item:active .media-preview { transform: scale(.98); transition-duration: 80ms; }
.media-item:focus-visible { outline-offset: -2px; }
.media-list { display: flex; flex-direction: column; gap: 0; }
.list-item { width: 100%; min-height: 68px; display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-bottom: 1px solid var(--line); border-radius: 0; }
.list-item:last-child { border-bottom: 0; }
.list-item .media-preview { width: 56px; height: 42px; flex: 0 0 56px; border-radius: 6px; }
.list-item .media-name { min-width: 0; padding: 0; flex: 1; }
.list-item .media-meta { flex-shrink: 0; padding: 0; }
.folder-list-item .folder-list-preview { background: #edf4f7; }
.folder-list-item { --folder-shadow: 0 1px 1px #236c9626; }
.folder-list-item:is(:hover, :focus-visible) { --folder-tilt: -7deg; --folder-shadow: 0 2px 2px #236c9633; }
.folder-list-preview .folder-list-icon { width: 36px; height: 32px; }
.folder-cards { margin-bottom: 32px; }
.folder-cards:last-child { margin-bottom: 0; }
.collection-pages { display: flex; justify-content: center; align-items: center; gap: 20px; padding: 28px 0 4px; color: var(--ink-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.collection-pages button { display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 8px 12px; border: 0; border-radius: 8px; background: var(--surface-subtle); color: var(--ink); font-weight: 600; transition: background 160ms ease; }
.collection-pages button:hover:not(:disabled) { background: var(--yellow); }
.collection-pages button:active:not(:disabled) { background: var(--accent-soft); }
.media-empty { min-height: 0; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 32px; color: var(--ink-muted); text-align: center; }
.empty-sticker { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 16px; background: var(--yellow); color: var(--ink); }
.media-empty h2 { margin: 0; color: var(--ink-muted); font-size: 14px; line-height: 1.6; font-weight: 500; text-wrap: balance; }
@media (max-width: 1000px) { .media-scroll { padding: 20px; } }
@media (max-width: 760px) {
  .media-grid, .folder-cards { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 20px 16px; }
  .list-item { flex-wrap: wrap; gap: 6px 12px; }
  .list-item .media-meta { width: 100%; padding-left: 68px; }
}
@media (prefers-reduced-motion: reduce) {
  .media-item, .collection-pages button { transition: none; }
  .media-preview { transition: none; }
  .media-item:active .media-preview { transform: none; }
}
</style>
