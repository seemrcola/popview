import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../src/App.vue'
import WelcomeScreen from '../src/components/WelcomeScreen.vue'
import ImageCollection from '../src/components/ImageCollection.vue'
import FolderBreadcrumbs from '../src/components/FolderBreadcrumbs.vue'
import { chooseRoot, listDirectory, expandWindow } from '../src/services/media'
import type { DirectoryEntry } from '../src/types/media'

vi.mock('../src/services/media', () => ({
  chooseRoot: vi.fn(), listDirectory: vi.fn(), sampleDirectory: vi.fn(), expandWindow: vi.fn(),
  imageSource: (image: { path: string; name: string }) => ({ ...image, src: image.path, thumbnailSrc: `thumb:${image.path}` }),
}))

const image: DirectoryEntry = { path: '/photos/cat.png', name: 'cat.png', is_dir: false, size: 1200, modified: null }
const folder: DirectoryEntry = { path: '/photos/child', name: 'child', is_dir: true, size: 0, modified: null }
const searchSelector = 'input[aria-label="搜索图片"]'

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(expandWindow).mockResolvedValue(undefined)
  vi.mocked(listDirectory).mockResolvedValue([])
})

async function openDirectory(entries: DirectoryEntry[]) {
  vi.mocked(chooseRoot).mockResolvedValue({ session: 1, path: '/photos', entries })
  const wrapper = shallowMount(App)
  wrapper.getComponent(WelcomeScreen).vm.$emit('choose')
  await flushPromises()
  return wrapper
}

describe('image search visibility', () => {
  it.each([{ name: 'empty', entries: [] }, { name: 'folders only', entries: [folder] }])('hides search when the directory contains $name', async ({ entries }) => {
    const wrapper = await openDirectory(entries)
    expect(wrapper.find(searchSelector).exists()).toBe(false)
    expect(wrapper.find('[aria-label="网格视图"]').exists()).toBe(true)
    expect(wrapper.find('[aria-label="列表视图"]').exists()).toBe(true)
  })

  it('keeps search available when a query matches no images', async () => {
    const wrapper = await openDirectory([image])
    await wrapper.get(searchSelector).setValue('missing')
    expect(wrapper.find(searchSelector).exists()).toBe(true)
    expect(wrapper.getComponent(ImageCollection).props('images')).toHaveLength(0)
    await wrapper.get(searchSelector).setValue('')
    expect(wrapper.getComponent(ImageCollection).props('images')).toHaveLength(1)
  })

  it('clears hidden filters when navigating through a directory without images', async () => {
    const wrapper = await openDirectory([folder, image])
    await wrapper.get(searchSelector).setValue('missing')
    wrapper.getComponent(ImageCollection).vm.$emit('selectFolder', folder.path)
    await flushPromises()
    expect(wrapper.find(searchSelector).exists()).toBe(false)
    wrapper.getComponent(FolderBreadcrumbs).vm.$emit('select', { path: '/photos', name: 'photos' })
    await flushPromises()
    expect((wrapper.get(searchSelector).element as HTMLInputElement).value).toBe('')
    expect(wrapper.getComponent(ImageCollection).props('images')).toHaveLength(1)
  })

  it('updates search availability when refresh removes or adds images', async () => {
    const wrapper = await openDirectory([image])
    await wrapper.get(searchSelector).setValue('missing')
    await wrapper.get('[aria-label="刷新当前目录"]').trigger('click')
    await flushPromises()
    expect(wrapper.find(searchSelector).exists()).toBe(false)
    vi.mocked(listDirectory).mockResolvedValueOnce([image])
    await wrapper.get('[aria-label="刷新当前目录"]').trigger('click')
    await flushPromises()
    expect((wrapper.get(searchSelector).element as HTMLInputElement).value).toBe('')
    expect(wrapper.getComponent(ImageCollection).props('images')).toHaveLength(1)
  })
})
