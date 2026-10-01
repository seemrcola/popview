import { computed, readonly, ref } from 'vue'
import { chooseRoot, listDirectory } from '../services/media'
import type { DirectoryEntry, DirectoryNode } from '../types/media'

type DirectoryState = { entries: DirectoryEntry[] | null; loading: boolean; error: string; revision: number; invalidation: number; stale: boolean }
type DirectoryCache = Record<string, DirectoryState>

export function useDirectoryBrowser() {
  const directories = ref<DirectoryCache>({})
  const session = ref(0)
  const viewVersion = ref(0)
  const rootPath = ref('')
  const selectedPath = ref('')
  const targetPath = ref('')
  const expandedPaths = ref(new Set<string>())
  const pending = new WeakMap<DirectoryState, Promise<boolean>>()
  let navigationRequest = 0
  let choosingRoot = false

  const nodes = computed(() => {
    const result: Record<string, DirectoryNode> = {}
    function visit(path: string, name: string, depth: number, parent?: string) {
      const directory = directories.value[path]
      const folders = directory?.entries?.filter(entry => entry.is_dir) ?? []
      result[path] = {
        path, name, parent, depth,
        children: folders.map(entry => entry.path),
        loaded: directory?.entries != null,
        expanded: expandedPaths.value.has(path),
        loading: directory?.loading ?? false,
        error: directory?.error ?? '',
      }
      for (const folder of folders) visit(folder.path, folder.name, depth + 1, path)
    }
    if (rootPath.value) {
      visit(rootPath.value, rootPath.value.split(/[\\/]/).filter(Boolean).pop() ?? rootPath.value, 0)
    }
    return result
  })
  const visibleNodes = computed(() => {
    const result: DirectoryNode[] = []
    function visit(path: string) {
      const node = nodes.value[path]
      if (!node) return
      result.push(node)
      if (node.expanded) node.children.forEach(visit)
    }
    visit(rootPath.value)
    return result
  })
  const currentEntries = computed<readonly DirectoryEntry[]>(() => readonly(directories.value[selectedPath.value]?.entries ?? []))
  const isLoading = computed(() => directories.value[targetPath.value]?.loading ?? false)
  const error = computed(() => {
    const path = targetPath.value
    const message = directories.value[path]?.error
    if (message) return `${path}: ${message}`
    const failedNode = visibleNodes.value.find(node => node.error)
    return failedNode ? `${failedNode.path}: ${failedNode.error}` : ''
  })
  const breadcrumbs = computed(() => {
    const result: DirectoryNode[] = []
    let path = selectedPath.value
    while (path) {
      const node = nodes.value[path]
      if (!node) break
      result.unshift(node)
      path = node.parent ?? ''
    }
    return result
  })

  function loadDirectory(path: string, refresh = false, cache = directories.value): Promise<boolean> {
    cache[path] ??= { entries: null, loading: false, error: '', revision: 0, invalidation: 0, stale: false }
    const directory = cache[path]
    const existing = pending.get(directory)
    if (existing) return existing
    if (directory.entries !== null && !directory.stale && !refresh) return Promise.resolve(true)
    const invalidation = directory.invalidation
    const requestSession = session.value
    directory.loading = true
    directory.error = ''
    const request = Promise.resolve()
      .then(() => listDirectory(path, requestSession))
      .then(entries => {
        directory.entries = entries
        directory.stale = invalidation !== directory.invalidation
        ++directory.revision
        if (refresh) {
          for (const entry of entries) {
            const child = cache[entry.path]
            if (entry.is_dir && child) {
              child.stale = true
              ++child.invalidation
            }
          }
        }
        if (cache === directories.value && selectedPath.value && !nodes.value[selectedPath.value]) {
          selectedPath.value = nodes.value[path] ? path : rootPath.value
          if (!nodes.value[targetPath.value]) targetPath.value = selectedPath.value
          ++viewVersion.value
        }
        return true
      })
      .catch((cause: unknown) => {
        directory.error = cause instanceof Error ? cause.message : String(cause)
        return false
      })
      .finally(() => {
        directory.loading = false
        pending.delete(directory)
      })
    pending.set(directory, request)
    return request
  }

  async function openRoot() {
    if (choosingRoot) return false
    choosingRoot = true
    try {
      const root = await chooseRoot()
      if (!root) return false
      ++navigationRequest
      directories.value = { [root.path]: { entries: root.entries, loading: false, error: '', revision: 1, invalidation: 0, stale: false } }
      session.value = root.session
      rootPath.value = root.path
      selectedPath.value = root.path
      targetPath.value = root.path
      expandedPaths.value = new Set([root.path])
      ++viewVersion.value
      return true
    } finally {
      choosingRoot = false
    }
  }

  async function selectDirectory(path: string, refresh = false) {
    if (!nodes.value[path]) return false
    const request = ++navigationRequest
    const cache = directories.value
    targetPath.value = path
    const loaded = await loadDirectory(path, refresh, cache)
    if (cache !== directories.value || request !== navigationRequest) return false
    if (!loaded || !nodes.value[path]) return false
    const changed = selectedPath.value !== path
    selectedPath.value = path
    if (changed || refresh) ++viewVersion.value
    return true
  }

  async function toggleDirectory(path: string) {
    if (!nodes.value[path]) return
    if (expandedPaths.value.has(path)) {
      expandedPaths.value.delete(path)
      return
    }
    const cache = directories.value
    if (await loadDirectory(path, false, cache)) {
      if (cache === directories.value && nodes.value[path]) expandedPaths.value.add(path)
    }
  }

  function getDirectory(path: string) {
    const directory = directories.value[path]
    return directory ? readonly(directory) : undefined
  }

  return {
    session: readonly(session), viewVersion: readonly(viewVersion), getDirectory,
    rootPath: readonly(rootPath), selectedPath: readonly(selectedPath), nodes, visibleNodes, currentEntries,
    breadcrumbs, isLoading, error, openRoot, selectDirectory, toggleDirectory,
  }
}

export type DirectoryBrowser = ReturnType<typeof useDirectoryBrowser>
