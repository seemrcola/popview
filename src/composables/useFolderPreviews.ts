import { onScopeDispose, ref, watch, watchEffect } from 'vue'
import { imageSource, sampleDirectory } from '../services/media'
import type { ImageSource } from '../types/media'
import type { DirectoryBrowser } from './useDirectoryBrowser'

type PreviewState = { images: ImageSource[] | null; loading: boolean }
const MAX_PREVIEW_REQUESTS = 2

export function useFolderPreviews(browser: Pick<DirectoryBrowser, 'session' | 'viewVersion' | 'selectedPath' | 'currentEntries' | 'getDirectory'>) {
  const samples = ref<Record<string, PreviewState>>({})
  const visiblePaths = ref(new Set<string>())
  const activeRequests = ref(0)
  let disposed = false
  let previousSession = browser.session.value
  let previousPath = browser.selectedPath.value

  watch(browser.viewVersion, () => {
    visiblePaths.value.clear()
    if (browser.session.value !== previousSession) {
      samples.value = {}
    } else if (browser.selectedPath.value === previousPath) {
      for (const folder of browser.currentEntries.value) delete samples.value[folder.path]
    }
    previousSession = browser.session.value
    previousPath = browser.selectedPath.value
  }, { flush: 'sync' })

  function imagesFor(path: string): ImageSource[] {
    const directory = browser.getDirectory(path)
    if (directory?.entries && !directory.stale) {
      return directory.entries.filter(entry => !entry.is_dir).slice(0, 3)
        .map(entry => imageSource(entry, browser.session.value, directory.revision))
    }
    return samples.value[path]?.images ?? []
  }

  function setVisible(path: string, visible: boolean, version: number) {
    if (version !== browser.viewVersion.value || disposed) return
    if (visible) visiblePaths.value.add(path)
    else visiblePaths.value.delete(path)
  }

  watchEffect(() => {
    if (disposed || activeRequests.value >= MAX_PREVIEW_REQUESTS) return
    for (const folder of browser.currentEntries.value) {
      if (activeRequests.value >= MAX_PREVIEW_REQUESTS) break
      if (!folder.is_dir || !visiblePaths.value.has(folder.path)) continue
      const directory = browser.getDirectory(folder.path)
      if ((directory?.entries && !directory.stale) || directory?.loading) continue
      samples.value[folder.path] ??= { images: null, loading: false }
      const preview = samples.value[folder.path]
      if (preview.images !== null || preview.loading) continue
      const session = browser.session.value
      const revision = browser.viewVersion.value
      preview.loading = true
      ++activeRequests.value
      void sampleDirectory(folder.path, session)
        .then(images => { preview.images = images.map(image => imageSource(image, session, revision)) })
        .catch(() => { preview.images = [] })
        .finally(() => {
          preview.loading = false
          --activeRequests.value
        })
    }
  })

  onScopeDispose(() => { disposed = true })
  return { imagesFor, setVisible }
}
