<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { useVirtualizer } from '@tanstack/vue-virtual'
import CollectionEmpty from './CollectionEmpty.vue'
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
  query?: string
  loading?: boolean
  error?: string
}>()
const emit = defineEmits<{
  selectFolder: [path: string]
  openImage: [image: ImageItem]
  visibility: [path: string, visible: boolean, version: number]
}>()

type CollectionRow = {
  kind: 'folders' | 'images' | 'list'
  items: Array<DirectoryEntry | ImageItem>
  lastInGroup: boolean
}

const scroll = ref<HTMLElement>()
const contentWidth = ref(0)
const dateFormat = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' })
let sizeObserver: ResizeObserver | undefined

const columns = computed(() => props.viewMode === 'list'
  ? 1
  : Math.max(1, Math.floor((contentWidth.value + 24) / (180 + 24))))
const rows = computed<CollectionRow[]>(() => {
  const result: CollectionRow[] = []
  const groups = props.viewMode === 'list'
    ? [{ kind: 'list' as const, items: [...props.folders, ...props.images] }]
    : [
        { kind: 'folders' as const, items: [...props.folders] },
        { kind: 'images' as const, items: [...props.images] },
      ]
  for (const group of groups) {
    for (let index = 0; index < group.items.length; index += columns.value) {
      const items = group.items.slice(index, index + columns.value)
      result.push({ kind: group.kind, items, lastInGroup: index + columns.value >= group.items.length })
    }
  }
  return result
})
const virtualizerOptions = computed(() => ({
  count: rows.value.length,
  getScrollElement: () => scroll.value ?? null,
  // A row index can represent different content after regrouping the grid.
  getItemKey: (index: number) => `${props.viewMode}:${columns.value}:${rows.value[index]?.items[0]?.path}`,
  estimateSize: () => props.viewMode === 'grid' ? 230 : 68,
  overscan: 4,
  initialRect: { width: 0, height: 600 },
}))
const virtualizer = useVirtualizer(virtualizerOptions)
const estimateRowSize = computed(() => props.viewMode === 'grid' ? 230 : 68)
const virtualRows = computed(() => {
  const visible = virtualizer.value.getVirtualItems()
  if (visible.length || !rows.value.length) return visible
  return rows.value.slice(0, 8).map((_, index) => ({
    key: virtualizer.value.options.getItemKey(index),
    index,
    start: index * estimateRowSize.value,
    size: estimateRowSize.value,
    end: (index + 1) * estimateRowSize.value,
    lane: 0,
  }))
})
const totalSize = computed(() => Math.max(virtualizer.value.getTotalSize(), rows.value.length * estimateRowSize.value))
useCollectionMotion(scroll, () => [props.version, props.viewMode])

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isFolder(item: DirectoryEntry | ImageItem): item is DirectoryEntry {
  return 'is_dir' in item && item.is_dir
}

function measureRow(element: HTMLElement | null) {
  if (!element) {
    virtualizer.value.measureElement(null)
    return
  }
  // Function refs run before insertion; measure after Vue commits the layout.
  void nextTick(() => {
    if (element.isConnected) virtualizer.value.measureElement(element)
  })
}

function resetScroll() {
  virtualizer.value.scrollToOffset(0)
}

watch(() => [props.version, props.viewMode, props.images, props.folders], resetScroll, { flush: 'post' })
onMounted(() => {
  sizeObserver = new ResizeObserver(([entry]) => {
    if (entry?.contentRect.width) contentWidth.value = entry.contentRect.width
  })
  if (scroll.value) {
    sizeObserver.observe(scroll.value)
    contentWidth.value = scroll.value.clientWidth
  }
})
onBeforeUnmount(() => sizeObserver?.disconnect())
</script>

<template>
  <CollectionEmpty v-if="!folders.length && !images.length" :query="query" :loading="loading" :error="error" />
  <div v-else ref="scroll" class="media-scroll">
    <CollectionEmpty v-if="query?.trim() && !images.length && !loading && !error" compact :query="query" />
    <div v-if="rows.length" class="virtual-collection" :style="{ height: `${totalSize}px` }">
      <div v-for="virtualRow in virtualRows" :key="String(virtualRow.key)" class="virtual-row"
        :class="{ 'folder-row-last': rows[virtualRow.index].kind === 'folders' && rows[virtualRow.index].lastInGroup }"
        :data-index="virtualRow.index" :ref="(element) => measureRow(element as HTMLElement | null)"
        :style="{ transform: `translateY(${virtualRow.start}px)` }">
        <div v-if="rows[virtualRow.index].kind === 'folders'" class="folder-cards"
          :style="{ '--collection-columns': columns }">
          <FolderCard v-for="folder in rows[virtualRow.index].items" :key="folder.path"
            :folder="folder" :images="imagesFor(folder.path)" :version="version"
            @select="emit('selectFolder', $event)"
            @visibility="(path, visible, generation) => emit('visibility', path, visible, generation)" />
        </div>
        <div v-else-if="rows[virtualRow.index].kind === 'images'" class="media-grid"
          :style="{ '--collection-columns': columns }">
          <button v-for="item in rows[virtualRow.index].items as ImageItem[]" :key="item.path" class="media-item"
            :title="item.name" @click="emit('openImage', item)">
            <div class="media-preview"><ImageThumbnail :src="item.thumbnailSrc" :alt="item.name" fit="cover" /></div>
            <div class="media-name">{{ item.name }}</div>
            <div class="media-meta">{{ formatSize(item.size) }} · {{ item.modified == null ? '日期未知' : dateFormat.format(new Date(item.modified * 1000)) }}</div>
          </button>
        </div>
        <div v-else class="media-list">
          <template v-for="item in rows[virtualRow.index].items" :key="item.path">
            <button v-if="isFolder(item)" class="media-item list-item folder-list-item" :title="item.name"
              @click="emit('selectFolder', item.path)">
              <div class="media-preview folder-list-preview"><FolderIcon class="folder-list-icon" /></div>
              <div class="media-name">{{ item.name }}</div><div class="media-meta">文件夹</div>
              <ChevronRight class="list-open" :size="16" :stroke-width="1.7" aria-hidden="true" />
            </button>
            <button v-else class="media-item list-item" :title="item.name" @click="emit('openImage', item)">
              <div class="media-preview"><ImageThumbnail :src="item.thumbnailSrc" :alt="item.name" fit="cover" /></div>
              <div class="media-name">{{ item.name }}</div>
              <div class="media-meta">{{ formatSize(item.size) }} · {{ item.modified == null ? '日期未知' : dateFormat.format(new Date(item.modified * 1000)) }}</div>
              <ChevronRight class="list-open" :size="16" :stroke-width="1.7" aria-hidden="true" />
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.media-scroll { min-height: 0; flex: 1; overflow-y: auto; overflow-x: hidden; padding: var(--content-inset); scrollbar-width: thin; scrollbar-color: var(--scrollbar) transparent; overscroll-behavior: contain; }
.virtual-collection { position: relative; width: 100%; }
.virtual-row { position: absolute; top: 0; left: 0; width: 100%; contain: layout style; }
.folder-row-last { padding-bottom: var(--space-8); }
.media-grid, .folder-cards { display: grid; grid-template-columns: repeat(var(--collection-columns), minmax(0, 1fr)); gap: var(--grid-gap); }
.media-grid { align-content: start; }
.media-item { min-width: 0; padding: 0; border: 0; border-radius: var(--radius-media); background: transparent; color: var(--ink); text-align: left; overflow: hidden; transition: background 180ms ease; }
.media-item:not(.list-item):hover { background: var(--content-hover); }
.media-item:not(.list-item):active { background: var(--content-pressed); }
.media-preview { position: relative; aspect-ratio: var(--preview-ratio); display: grid; place-items: center; overflow: hidden; border-radius: var(--radius-media); background: var(--surface-subtle); }
.media-preview > .image-thumbnail { position: absolute; inset: 0; }
.media-name { padding: var(--space-2) var(--space-1) 0; overflow: hidden; font-size: var(--font-label); line-height: 20px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.media-meta { padding: var(--space-1) var(--space-1) var(--space-2); color: var(--ink-muted); font-size: var(--font-meta); line-height: 18px; font-variant-numeric: tabular-nums; }
.media-item:active .media-meta { color: var(--ink); }
.media-preview { transition: transform var(--motion-settle) var(--ease-spring); }
.media-item:active .media-preview { transform: scale(.98); transition-duration: 80ms; }
.media-list { display: flex; flex-direction: column; gap: 0; }
.list-item { position: relative; isolation: isolate; width: 100%; min-height: 68px; display: flex; align-items: center; gap: 14px; padding: 10px 42px 10px 12px; border-bottom: 1px solid var(--line); border-radius: 0; }
.list-item::before { content: ''; position: absolute; z-index: -1; inset: 4px 0; border-radius: var(--radius-control); background: transparent; transition: background-color 100ms ease; pointer-events: none; }
.list-item:focus-visible::before { background-color: var(--content-hover); }
.list-item:active::before { background-color: var(--content-pressed); }
.list-open { position: absolute; right: 14px; top: 50%; color: var(--accent); opacity: 0; transform: translate(-4px, -50%); transition: opacity 100ms ease, transform 220ms var(--ease-spring); pointer-events: none; }
.list-item:focus-visible .list-open, .list-item:active .list-open { opacity: 1; transform: translate(0, -50%); }
.list-item:last-child { border-bottom: 0; }
.list-item .media-preview { width: 56px; height: 42px; flex: 0 0 56px; border-radius: var(--radius-control); }
.list-item .media-name { min-width: 0; padding: 0; flex: 1; }
.list-item .media-meta { flex-shrink: 0; padding: 0; }
.folder-list-item .folder-list-preview { background: var(--folder-surface); }
.folder-list-item { --folder-shadow: 0 1px 1px #236c9626; }
.folder-list-item:focus-visible { --folder-tilt: -7deg; --folder-shadow: 0 2px 2px #236c9633; }
@media (hover: hover) and (pointer: fine) {
  .list-item:hover:not(:active)::before { background-color: var(--content-hover); transition-duration: 150ms; }
  .list-item:hover .list-open { opacity: 1; transform: translate(0, -50%); }
  .folder-list-item:hover { --folder-tilt: -7deg; --folder-shadow: 0 2px 2px #236c9633; }
}
@media (hover: none) { .list-open { opacity: .6; transform: translate(0, -50%); } }
.folder-list-preview .folder-list-icon { width: 36px; height: 32px; }
@media (max-width: 760px) {
  .list-item { flex-wrap: wrap; gap: 6px 12px; }
  .list-item .media-meta { width: 100%; padding-left: 68px; }
}
@media (prefers-reduced-motion: reduce) {
  .media-item { transition: none; }
  .media-preview { transition: none; }
  .media-item:active .media-preview { transform: none; }
  .list-item::before, .list-open { transition: none; }
  .list-open { transform: translate(0, -50%); }
}
</style>
