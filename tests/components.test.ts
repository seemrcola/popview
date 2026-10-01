import { flushPromises, mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import ImageCollection from '../src/components/ImageCollection.vue'
import ImagePreview from '../src/components/ImagePreview.vue'
import FolderCard from '../src/components/FolderCard.vue'
import FolderIcon from '../src/components/FolderIcon.vue'
import ThumbnailStrip from '../src/components/ThumbnailStrip.vue'
import type { DirectoryEntry, ImageItem } from '../src/types/media'

const images = (count: number): ImageItem[] => Array.from({ length: count }, (_, index) => ({
  path: `/photos/${index}.png`, name: `${index}.png`, src: `original-${index}`, thumbnailSrc: `thumbnail-${index}`, size: 1200, modified: null,
}))
const folders = (count: number): DirectoryEntry[] => Array.from({ length: count }, (_, index) => ({
  path: `/photos/folder-${index}`, name: `Folder ${index}`, is_dir: true, size: 0, modified: null,
}))

describe('collection', () => {
  it('renders folders before images as clickable list rows without loading covers', async () => {
    const imagesFor = vi.fn(() => [])
    const wrapper = mount(ImageCollection, { props: { folders: folders(2), images: images(1), viewMode: 'list', version: 1, imagesFor } })
    const rows = wrapper.findAll('.media-list > .list-item')
    expect(rows).toHaveLength(3)
    expect(rows.every(row => row.get('.list-open').attributes('aria-hidden') === 'true')).toBe(true)
    expect(rows.map(row => row.get('.media-name').text())).toEqual(['Folder 0', 'Folder 1', '0.png'])
    expect(rows[0].get('.media-meta').text()).toBe('文件夹')
    expect(rows[0].findComponent(FolderIcon).exists()).toBe(true)
    expect(wrapper.findComponent(FolderCard).exists()).toBe(false)
    expect(imagesFor).not.toHaveBeenCalled()
    await rows[0].trigger('click')
    expect(wrapper.emitted('selectFolder')?.[0]).toEqual(['/photos/folder-0'])
    expect(wrapper.emitted('openImage')).toBeUndefined()
    expect(rows[2].attributes('title')).toBe('0.png')
    await rows[2].get('.list-open').trigger('click')
    expect(wrapper.emitted('openImage')?.[0]).toEqual([images(1)[0]])
    await wrapper.setProps({ viewMode: 'grid' })
    expect(wrapper.find('.list-open').exists()).toBe(false)
  })

  it('switches folder-only collections between cards and rows and releases cover visibility', async () => {
    const wrapper = mount(ImageCollection, { props: { folders: folders(1), images: [], viewMode: 'grid', version: 3, imagesFor: () => [] } })
    expect(wrapper.findAllComponents(FolderCard)).toHaveLength(1)
    await wrapper.setProps({ viewMode: 'list' })
    expect(wrapper.findAll('.folder-list-item')).toHaveLength(1)
    expect(wrapper.find('.folder-cards').exists()).toBe(false)
    expect(wrapper.emitted('visibility')?.[0]).toEqual(['/photos/folder-0', false, 3])
    await wrapper.setProps({ viewMode: 'grid' })
    expect(wrapper.findAllComponents(FolderCard)).toHaveLength(1)
    expect(wrapper.find('.media-list').exists()).toBe(false)
  })

  it('shares the page limit across folders and images and retains the page when switching views', async () => {
    const wrapper = mount(ImageCollection, { props: { folders: folders(121), images: images(1), viewMode: 'list', version: 1, imagesFor: () => [] } })
    expect(wrapper.findAll('.list-item')).toHaveLength(120)
    await wrapper.get('[aria-label="下一页"]').trigger('click')
    expect(wrapper.findAll('.list-item')).toHaveLength(2)
    expect(wrapper.findAll('.media-name').map(name => name.text())).toEqual(['Folder 120', '0.png'])
    await wrapper.setProps({ viewMode: 'grid' })
    expect(wrapper.getComponent(FolderCard).props('folder').path).toBe('/photos/folder-120')
    expect(wrapper.get('[role="status"]').text()).toBe('2 / 2')
    await wrapper.setProps({ viewMode: 'list' })
    await wrapper.get('.folder-list-item').trigger('click')
    expect(wrapper.emitted('selectFolder')?.[0]).toEqual(['/photos/folder-120'])
  })

  it('caps mounted items, uses thumbnails, and opens the original image model', async () => {
    const items = images(250)
    const wrapper = mount(ImageCollection, { props: { folders: [], images: items, viewMode: 'grid', version: 1, imagesFor: () => [] } })
    expect(wrapper.findAll('.media-item')).toHaveLength(120)
    expect(wrapper.find('img').attributes('src')).toBe('thumbnail-0')
    await wrapper.find('.media-item').trigger('click')
    expect(wrapper.emitted('openImage')?.[0][0]).toEqual(items[0])
    await wrapper.get('[aria-label="下一页"]').trigger('click')
    expect(wrapper.find('img').attributes('src')).toBe('thumbnail-120')
    await wrapper.setProps({ images: items.slice(0, 1) })
    expect(wrapper.findAll('.media-item')).toHaveLength(1)
    expect(wrapper.find('[aria-label="图片列表分页"]').exists()).toBe(false)
  })

  it('shows a usable placeholder when thumbnail decoding fails', async () => {
    const wrapper = mount(ImageCollection, { props: { folders: [], images: images(1), viewMode: 'list', version: 1, imagesFor: () => [] } })
    await wrapper.get('img').trigger('error')
    expect(wrapper.find('img').exists()).toBe(false)
    await wrapper.get('.media-item').trigger('click')
    expect(wrapper.emitted('openImage')).toHaveLength(1)
  })

  it('renders folder cards without a native runtime or ancestor selector', async () => {
    const wrapper = mount(FolderCard, { props: { folder: { path: '/photos', name: 'Photos' }, images: images(1), version: 1 } })
    expect(wrapper.get('img').attributes('src')).toBe('thumbnail-0')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')?.[0]).toEqual(['/photos'])
  })

  it('uses unique gradient identifiers for each folder icon', () => {
    const wrapper = mount(ImageCollection, { props: { folders: folders(2), images: [], viewMode: 'grid', version: 1, imagesFor: () => [] } })
    const identifiers = wrapper.findAll('linearGradient').map(gradient => gradient.attributes('id'))
    expect(identifiers).toHaveLength(4)
    expect(new Set(identifiers).size).toBe(4)
    for (const path of wrapper.findAll('path[fill^="url"]')) {
      expect(identifiers).toContain(path.attributes('fill').slice(5, -1))
    }
  })

  it('returns to the closed folder shape if all covers fail to load', async () => {
    const wrapper = mount(FolderCard, { props: { folder: { path: '/photos', name: 'Photos' }, images: images(1), version: 1 } })
    expect(wrapper.getComponent(FolderIcon).props('open')).toBe(true)
    await wrapper.get('img').trigger('error')
    expect(wrapper.getComponent(FolderIcon).props('open')).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    await wrapper.setProps({ images: [{ ...images(1)[0], thumbnailSrc: 'refreshed-thumbnail' }] })
    expect(wrapper.getComponent(FolderIcon).props('open')).toBe(true)
  })
})

describe('preview components', () => {
  it('virtualizes long thumbnail strips and reveals the selection', async () => {
    const wrapper = mount(ThumbnailStrip, {
      props: { images: images(10000), selectedPath: '/photos/0.png' },
      slots: { default: ({ image }: { image: ImageItem }) => h('button', image.name) },
    })
    expect(wrapper.findAll('button').length).toBeLessThan(25)
    await wrapper.setProps({ selectedPath: '/photos/9999.png' })
    expect(wrapper.text()).toContain('9999.png')
    expect(wrapper.findAll('button').length).toBeLessThan(25)
  })

  it('preserves single-view selection and board content when switching modes', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 700, width: 1000, height: 700, toJSON: () => ({}) })
    const wrapper = mount(ImagePreview, { props: { images: images(3), initialPath: '/photos/0.png' }, attachTo: document.body })
    await wrapper.get('[aria-label="下一张"]').trigger('click')
    expect(wrapper.get('.viewer-canvas img').attributes('src')).toBe('original-1')
    await wrapper.findAll('.viewer-modes button')[1].trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.board-image')).toHaveLength(1)
    expect(wrapper.get('.board-image img').attributes('src')).toBe('original-1')
    await wrapper.get('[aria-label="添加到画板：2.png"]').trigger('click')
    expect(wrapper.findAll('.board-image')).toHaveLength(2)
    await wrapper.findAll('.viewer-modes button')[0].trigger('click')
    expect(wrapper.get('.viewer-canvas img').attributes('src')).toBe('original-1')
    await wrapper.findAll('.viewer-modes button')[1].trigger('click')
    expect(wrapper.findAll('.board-image')).toHaveLength(2)
  })

  it('restores focus to the opener when the preview unmounts', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const wrapper = mount(ImagePreview, { props: { images: images(1), initialPath: '/photos/0.png' }, attachTo: document.body })
    wrapper.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
