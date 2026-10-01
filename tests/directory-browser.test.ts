import { effectScope, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useDirectoryBrowser } from '../src/composables/useDirectoryBrowser'
import { useFolderPreviews } from '../src/composables/useFolderPreviews'
import { chooseRoot, listDirectory, sampleDirectory } from '../src/services/media'
import type { DirectoryEntry, RootDirectory } from '../src/types/media'

vi.mock('../src/services/media', () => ({
  chooseRoot: vi.fn(), listDirectory: vi.fn(), sampleDirectory: vi.fn(),
  imageSource: (image: { path: string; name: string }, session: number, revision: number) => ({ ...image, src: `${session}:${revision}:${image.path}`, thumbnailSrc: `thumb:${image.path}` }),
}))

const folder = (path: string): DirectoryEntry => ({ path, name: path.split('/').pop()!, is_dir: true, size: 0, modified: null })
const image = (path: string): DirectoryEntry => ({ ...folder(path), is_dir: false })
const root = (path = '/root', session = 1): RootDirectory => ({ path, session, entries: [folder(`${path}/a`), folder(`${path}/b`), folder(`${path}/c`)] })
function deferred<Type>() {
  let resolve!: (value: Type) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Type>((success, failure) => { resolve = success; reject = failure })
  return { promise, resolve, reject }
}
let scope: ReturnType<typeof effectScope>
beforeEach(() => {
  vi.resetAllMocks()
  scope = effectScope()
  vi.mocked(chooseRoot).mockResolvedValue(root())
  vi.mocked(listDirectory).mockResolvedValue([])
  vi.mocked(sampleDirectory).mockResolvedValue([])
})
afterEach(() => scope.stop())

function setup() {
  return scope.run(() => {
    const browser = useDirectoryBrowser()
    const previews = useFolderPreviews(browser)
    return { browser, previews }
  })!
}

describe('directory session', () => {
  it('ignores repeated chooser requests without losing the successful root', async () => {
    const { browser } = setup()
    const choice = deferred<RootDirectory | null>()
    vi.mocked(chooseRoot).mockReturnValue(choice.promise)
    const first = browser.openRoot()
    expect(await browser.openRoot()).toBe(false)
    expect(chooseRoot).toHaveBeenCalledTimes(1)
    choice.resolve(root())
    expect(await first).toBe(true)
    expect(browser.rootPath.value).toBe('/root')
  })

  it('deduplicates simultaneous expansion and selection', async () => {
    const { browser } = setup()
    await browser.openRoot()
    const request = deferred<DirectoryEntry[]>()
    vi.mocked(listDirectory).mockReturnValue(request.promise)
    const expand = browser.toggleDirectory('/root/a')
    const select = browser.selectDirectory('/root/a')
    await nextTick()
    expect(listDirectory).toHaveBeenCalledTimes(1)
    request.resolve([])
    await Promise.all([expand, select])
    expect(browser.selectedPath.value).toBe('/root/a')
    expect(browser.nodes.value['/root/a'].expanded).toBe(true)
  })

  it('keeps the most recent navigation when requests resolve out of order', async () => {
    const { browser } = setup()
    await browser.openRoot()
    const slow = deferred<DirectoryEntry[]>()
    vi.mocked(listDirectory).mockImplementation(path => path.endsWith('/a') ? slow.promise : Promise.resolve([]))
    const first = browser.selectDirectory('/root/a')
    await browser.selectDirectory('/root/b')
    slow.resolve([])
    expect(await first).toBe(false)
    expect(browser.selectedPath.value).toBe('/root/b')
  })

  it('isolates old requests from a new root', async () => {
    const { browser } = setup()
    await browser.openRoot()
    const request = deferred<DirectoryEntry[]>()
    vi.mocked(listDirectory).mockReturnValue(request.promise)
    const oldSelection = browser.selectDirectory('/root/a')
    vi.mocked(chooseRoot).mockResolvedValue(root('/next', 2))
    await browser.openRoot()
    request.resolve([image('/root/a/old.png')])
    expect(await oldSelection).toBe(false)
    expect(browser.selectedPath.value).toBe('/next')
    expect(browser.getDirectory('/root/a')).toBeUndefined()
  })

  it('retains the previous root on cancellation and failure', async () => {
    const { browser } = setup()
    await browser.openRoot()
    const version = browser.viewVersion.value
    vi.mocked(chooseRoot).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('denied'))
    expect(await browser.openRoot()).toBe(false)
    await expect(browser.openRoot()).rejects.toThrow('denied')
    expect(browser.rootPath.value).toBe('/root')
    expect(browser.viewVersion.value).toBe(version)
  })

  it('keeps data on refresh failure and retries successfully', async () => {
    const { browser } = setup()
    await browser.openRoot()
    vi.mocked(listDirectory).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([image('/root/new.png')])
    expect(await browser.selectDirectory('/root', true)).toBe(false)
    expect(browser.currentEntries.value).toHaveLength(3)
    expect(browser.error.value).toContain('offline')
    expect(await browser.selectDirectory('/root', true)).toBe(true)
    expect(browser.currentEntries.value[0].name).toBe('new.png')
    expect(browser.error.value).toBe('')
  })

  it('marks child caches stale explicitly after parent refresh', async () => {
    const { browser } = setup()
    await browser.openRoot()
    await browser.toggleDirectory('/root/a')
    vi.mocked(listDirectory).mockResolvedValueOnce(root().entries)
    await browser.selectDirectory('/root', true)
    expect(browser.getDirectory('/root/a')?.stale).toBe(true)
    const calls = vi.mocked(listDirectory).mock.calls.length
    await browser.selectDirectory('/root/a')
    expect(listDirectory).toHaveBeenCalledTimes(calls + 1)
    expect(browser.getDirectory('/root/a')?.stale).toBe(false)
  })
})

describe('folder previews', () => {
  it('only samples visible folders and limits requests to two', async () => {
    const { browser, previews } = setup()
    await browser.openRoot()
    const request = deferred<DirectoryEntry[]>()
    vi.mocked(sampleDirectory).mockReturnValue(request.promise)
    await flushPromises()
    expect(sampleDirectory).not.toHaveBeenCalled()
    for (const name of ['a', 'b', 'c']) previews.setVisible(`/root/${name}`, true, browser.viewVersion.value)
    await flushPromises()
    expect(sampleDirectory).toHaveBeenCalledTimes(2)
    request.resolve([])
    await flushPromises()
    expect(sampleDirectory).toHaveBeenCalledTimes(3)
  })

  it('does not sample folders with fresh directory data', async () => {
    const { browser, previews } = setup()
    await browser.openRoot()
    vi.mocked(listDirectory).mockResolvedValueOnce([image('/root/a/cached.png')])
    await browser.toggleDirectory('/root/a')
    previews.setVisible('/root/a', true, browser.viewVersion.value)
    await flushPromises()
    expect(sampleDirectory).not.toHaveBeenCalled()
    expect(previews.imagesFor('/root/a')[0].name).toBe('cached.png')
  })

  it('discards old visibility events and old-session results', async () => {
    const { browser, previews } = setup()
    await browser.openRoot()
    const request = deferred<DirectoryEntry[]>()
    vi.mocked(sampleDirectory).mockReturnValue(request.promise)
    const oldVersion = browser.viewVersion.value
    previews.setVisible('/root/a', true, oldVersion)
    await flushPromises()
    vi.mocked(chooseRoot).mockResolvedValueOnce(root('/next', 2))
    await browser.openRoot()
    previews.setVisible('/next/a', true, oldVersion)
    request.resolve([image('/root/a/old.png')])
    await flushPromises()
    expect(sampleDirectory).toHaveBeenCalledTimes(1)
    expect(previews.imagesFor('/root/a')).toEqual([])
  })

  it('refreshes samples instead of reusing invalidated child entries', async () => {
    const { browser, previews } = setup()
    await browser.openRoot()
    vi.mocked(listDirectory).mockResolvedValueOnce([image('/root/a/old.png')])
    await browser.toggleDirectory('/root/a')
    vi.mocked(listDirectory).mockResolvedValueOnce(root().entries)
    await browser.selectDirectory('/root', true)
    vi.mocked(sampleDirectory).mockResolvedValueOnce([image('/root/a/new.png')])
    previews.setVisible('/root/a', true, browser.viewVersion.value)
    await flushPromises()
    expect(previews.imagesFor('/root/a')[0].name).toBe('new.png')
  })

  it('stops queued work when its scope is disposed', async () => {
    const { browser, previews } = setup()
    await browser.openRoot()
    const request = deferred<DirectoryEntry[]>()
    vi.mocked(sampleDirectory).mockReturnValue(request.promise)
    for (const name of ['a', 'b', 'c']) previews.setVisible(`/root/${name}`, true, browser.viewVersion.value)
    await flushPromises()
    scope.stop()
    request.resolve([])
    await flushPromises()
    expect(sampleDirectory).toHaveBeenCalledTimes(2)
  })
})
