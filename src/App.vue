<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Grid2X2, List, Search } from 'lucide-vue-next'
import ImagePreview from './components/ImagePreview.vue'
import WelcomeScreen from './components/WelcomeScreen.vue'
import FolderBreadcrumbs from './components/FolderBreadcrumbs.vue'
import FolderTree from './components/FolderTree.vue'
import ImageCollection from './components/ImageCollection.vue'
import appIcon from '../src-tauri/icons/popview-icon.svg'
import { expandWindow, imageSource } from './services/media'
import { useDirectoryBrowser } from './composables/useDirectoryBrowser'
import { useFolderPreviews } from './composables/useFolderPreviews'
import { useButtonFeedback } from './composables/useButtonFeedback'
import './styles/buttons.css'
import type { ImageItem } from './types/media'

const browser = useDirectoryBrowser()
useButtonFeedback()
const { rootPath, selectedPath, nodes, visibleNodes, currentEntries, currentLabel, breadcrumbs, isLoading, viewVersion } = browser
const { imagesFor, setVisible } = useFolderPreviews(browser)
const query = ref('')
const viewMode = ref<'grid' | 'list'>('grid')
const chooseError = ref('')
const scanError = computed(() => chooseError.value || browser.error.value)
const isChoosing = ref(false)
const previewItem = ref<ImageItem | null>(null)
const folderEntries = computed(() => currentEntries.value.filter(entry => entry.is_dir))
const images = computed<ImageItem[]>(() => currentEntries.value.filter(entry => !entry.is_dir).map(entry => ({
  ...imageSource(entry, browser.session.value, viewVersion.value), size: entry.size, modified: entry.modified,
})))
const filteredImages = computed(() => {
  const search = query.value.trim().toLowerCase()
  return images.value.filter(item => item.name.toLowerCase().includes(search))
})
watch(viewVersion, () => { previewItem.value = null })
watch(() => images.value.length, count => { if (!count) query.value = '' })

async function chooseFolder() {
  if (isChoosing.value) return
  isChoosing.value = true
  chooseError.value = ''
  const firstOpen = !rootPath.value
  try {
    if (!await browser.openRoot()) return
    query.value = ''
    if (firstOpen) await expandWindow().catch(() => { chooseError.value = '目录已打开，但窗口调整失败，请手动调整窗口大小。' })
  } catch (error) {
    chooseError.value = error instanceof Error ? error.message : String(error)
  } finally {
    isChoosing.value = false
  }
}

function selectFolder(path: string) {
  chooseError.value = ''
  void browser.selectDirectory(path)
}

</script>

<template>
  <WelcomeScreen v-if="!rootPath" :busy="isChoosing" :error="scanError" @choose="chooseFolder" />
  <main v-else class="app-shell">
    <header class="app-toolbar" data-tauri-drag-region>
      <div class="app-title"><img class="brand-icon" :src="appIcon" alt="" /><div><strong>PopView</strong><span>{{ currentLabel }}</span></div></div>
    </header>
    <div class="app-body">
      <aside class="file-sidebar">
        <div class="sidebar-heading">
          <div><strong>文件夹</strong><span class="muted-count">{{ visibleNodes.length }}</span></div>
          <button class="sidebar-open" :disabled="isChoosing" @click="chooseFolder">{{ isChoosing ? '打开中…' : '选择文件夹' }}</button>
        </div>
        <div v-if="chooseError || (browser.error.value && (folderEntries.length || filteredImages.length))" class="scan-error" role="alert" :title="scanError">{{ chooseError || '文件夹读取失败' }}</div>
        <FolderTree :nodes="nodes" :visible-nodes="visibleNodes" :selected-path="selectedPath"
          @select="selectFolder" @toggle="browser.toggleDirectory" />
      </aside>
      <section class="media-panel" :aria-busy="isLoading">
        <div class="media-toolbar">
          <div class="media-heading">
            <FolderBreadcrumbs :items="breadcrumbs" @select="selectFolder($event.path)" />
            <p>{{ folderEntries.length }} 个子文件夹 · {{ filteredImages.length }} 张图片<span v-if="isLoading" role="status"> · 加载中…</span></p>
          </div>
          <div class="media-actions">
            <label v-if="images.length" class="search-box"><Search :size="15" /><input v-model="query" aria-label="搜索图片" placeholder="搜索图片" /></label>
            <div class="view-switch" :data-mode="viewMode" role="group" aria-label="显示方式">
              <button class="icon-button" :class="{ active: viewMode === 'grid' }" :aria-pressed="viewMode === 'grid'" title="网格" aria-label="网格视图" @click="viewMode = 'grid'"><Grid2X2 :size="15" /></button>
              <button class="icon-button" :class="{ active: viewMode === 'list' }" :aria-pressed="viewMode === 'list'" title="列表" aria-label="列表视图" @click="viewMode = 'list'"><List :size="15" /></button>
            </div>
          </div>
        </div>
        <ImageCollection :folders="folderEntries" :images="filteredImages" :view-mode="viewMode"
          :query="query" :loading="isLoading" :error="browser.error.value"
          :version="viewVersion" :images-for="imagesFor" @select-folder="selectFolder"
          @open-image="previewItem = $event" @visibility="setVisible" />
      </section>
    </div>
    <ImagePreview v-if="previewItem" :images="filteredImages" :initial-path="previewItem.path" @close="previewItem = null" />
  </main>
</template>
