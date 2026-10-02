import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardPreview from '../src/components/BoardPreview.vue'
import ImageBoard from '../src/components/ImageBoard.vue'
import type { ImageSource } from '../src/types/media'

const image: ImageSource = { path: '/photos/landscape.png', name: 'landscape.png', src: 'original-image', thumbnailSrc: 'thumbnail-image' }
const bounds = { x: 100, y: 80, left: 100, top: 80, right: 900, bottom: 680, width: 800, height: 600, toJSON: () => ({}) }
const pointer = { pointerId: 1, button: 0 }

beforeEach(() => {
  const captures = new Map<HTMLElement, number>()
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(bounds)
  vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(function (pointerId) { captures.set(this, pointerId) })
  vi.spyOn(HTMLElement.prototype, 'hasPointerCapture').mockImplementation(function (pointerId) { return captures.get(this) === pointerId })
  vi.spyOn(HTMLElement.prototype, 'releasePointerCapture').mockImplementation(function (pointerId) {
    captures.delete(this)
    this.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId, bubbles: true }))
  })
  vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue(undefined)
})

function naturalSize(element: Element, width: number, height: number) {
  Object.defineProperties(element, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  })
}

function setup(width = 400, height = 200) {
  const wrapper = mount(BoardPreview, { props: { images: [image] }, attachTo: document.body })
  const thumbnail = wrapper.get('.board-thumbnail')
  naturalSize(thumbnail.get('img').element, width, height)
  return { wrapper, thumbnail, stage: wrapper.get('.board-stage') }
}

function rectangle(element: Element) {
  const style = (element as HTMLElement).style
  return { x: parseFloat(style.left), y: parseFloat(style.top), width: parseFloat(style.width), height: parseFloat(style.height) }
}

async function zoomBy(stage: ReturnType<typeof setup>['stage'], factor: number) {
  let remaining = -Math.log(factor) / .002
  while (Math.abs(remaining) > .00001) {
    const deltaY = Math.max(-100, Math.min(100, remaining))
    await stage.trigger('wheel', { deltaY, clientX: 500, clientY: 380 })
    remaining -= deltaY
  }
}

function deferredDecode() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  vi.mocked(HTMLImageElement.prototype.decode).mockReturnValueOnce(promise)
  return resolve
}

describe('dragging thumbnails onto the board', () => {
  it('ignores a cancelled preview load without blocking the current preview load', async () => {
    const { wrapper, thumbnail } = setup(0, 0)
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    const previousPreview = wrapper.get('.thumbnail-drag-preview img')
    naturalSize(previousPreview.element, 400, 200)
    wrapper.vm.cancel()
    await flushPromises()
    expect(previousPreview.element.isConnected).toBe(false)

    naturalSize(thumbnail.get('img').element, 200, 400)
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    const currentPreview = wrapper.get('.thumbnail-drag-preview img')
    const placement = { x: 460, y: 320, width: 140, height: 280 }
    expect(rectangle(wrapper.get('.thumbnail-drag-preview').element)).toEqual(placement)
    await previousPreview.trigger('load')
    expect(rectangle(wrapper.get('.thumbnail-drag-preview').element)).toEqual(placement)

    naturalSize(currentPreview.element, 400, 400)
    await currentPreview.trigger('load')
    expect(rectangle(wrapper.get('.thumbnail-drag-preview').element)).toEqual({ ...placement, width: 280 })
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 320 })
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, 400, 400)
    await original.trigger('load')
    await flushPromises()
    expect(rectangle(wrapper.get('.board-image').element)).toEqual({ x: 220, y: 100, width: 280, height: 280 })
  })

  it.each([
    [400, 200, 320, 160],
    [200, 400, 140, 280],
    [400, 400, 280, 280],
  ])('centers a %sx%s preview and loaded image at the pointer with a %sx%s size', async (width, height, expectedWidth, expectedHeight) => {
    const { wrapper, thumbnail } = setup(width, height)
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    expect(rectangle(wrapper.get('.thumbnail-drag-preview').element)).toEqual({ x: 460, y: 320, width: expectedWidth, height: expectedHeight })
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 500, clientY: 350 })
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    expect(thumbnail.element.hasPointerCapture(pointer.pointerId)).toBe(false)
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, width * 4, height * 4)
    await original.trigger('load')
    await flushPromises()
    expect(rectangle(wrapper.get('.board-image').element)).toEqual({ x: 400 - expectedWidth / 2, y: 270 - expectedHeight / 2, width: expectedWidth, height: expectedHeight })
    expect(wrapper.find('.board-drop-hint').exists()).toBe(false)
  })

  it('clears the drag preview on drop and shows the original only after decoding', async () => {
    const { wrapper, thumbnail } = setup()
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 320 })
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    expect(wrapper.find('.board-image-preview').exists()).toBe(false)
    expect(wrapper.get('.board-image-status').text()).toBe('加载中…')
    const original = wrapper.get('.board-image img')
    expect(original.attributes('src')).toBe(image.src)
    naturalSize(original.element, 1600, 800)
    const finishOriginal = deferredDecode()
    await original.trigger('load')
    expect(wrapper.get('.board-image-status').text()).toBe('加载中…')
    expect((original.element as HTMLElement).style.display).toBe('none')
    finishOriginal()
    await flushPromises()
    expect(wrapper.find('.board-image-preview').exists()).toBe(false)
    expect(wrapper.find('.board-image-status').exists()).toBe(false)
    expect((original.element as HTMLElement).style.display).not.toBe('none')
    const placement = { x: 200, y: 160, width: 320, height: 160 }
    expect(rectangle(wrapper.get('.board-image').element)).toEqual(placement)
    await thumbnail.trigger('click', { detail: 1 })
    expect(wrapper.findAll('.board-image')).toHaveLength(1)
    await thumbnail.trigger('click', { detail: 0 })
    expect(wrapper.findAll('.board-image')).toHaveLength(1)
  })

  it('updates preview size during a drag while preserving its pointer center and matching the drop', async () => {
    const { wrapper, thumbnail, stage } = setup()
    await stage.trigger('wheel', { deltaY: -100, clientX: 500, clientY: 380 })
    await stage.trigger('pointerdown', { pointerId: 2, button: 0, clientX: 200, clientY: 200 })
    await stage.trigger('pointermove', { pointerId: 2, clientX: 240, clientY: 220 })
    await stage.trigger('pointerup', { pointerId: 2 })
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 500, clientY: 350 })
    const beforeZoom = rectangle(wrapper.get('.thumbnail-drag-preview').element)
    await stage.trigger('wheel', { deltaY: 80, clientX: 400, clientY: 280 })
    const transform = (wrapper.get('.board-world').element as HTMLElement).style.transform
    const [cameraX, cameraY, zoom] = transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const preview = rectangle(wrapper.get('.thumbnail-drag-preview').element)
    expect(preview.width).toBeCloseTo(beforeZoom.width * Math.exp(-.16))
    expect(preview.height).toBeCloseTo(beforeZoom.height * Math.exp(-.16))
    expect(preview.x).toBe(500)
    expect(preview.y).toBe(350)
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 500, clientY: 350 })
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, 1600, 800)
    await original.trigger('load')
    await flushPromises()
    const placed = rectangle(wrapper.get('.board-image').element)
    expect(placed.width).toBe(320)
    expect(placed.height).toBe(160)
    expect(placed.width * zoom).toBeCloseTo(preview.width)
    expect(placed.height * zoom).toBeCloseTo(preview.height)
    expect(bounds.left + cameraX + (placed.x + placed.width / 2) * zoom).toBeCloseTo(500)
    expect(bounds.top + cameraY + (placed.y + placed.height / 2) * zoom).toBeCloseTo(350)
  })

  it.each([
    [.5, 400, 200, 320, 160],
    [2, 400, 200, 320, 160],
    [.5, 200, 400, 140, 280],
    [2, 200, 400, 140, 280],
  ])('reselects an existing image at zoom %s for a %sx%s image', async (zoom, naturalWidth, naturalHeight, worldWidth, worldHeight) => {
    const { wrapper, thumbnail, stage } = setup(naturalWidth, naturalHeight)
    await thumbnail.trigger('click', { detail: 1 })
    await zoomBy(stage, zoom)
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    const preview = rectangle(wrapper.get('.thumbnail-drag-preview').element)
    const existing = rectangle(wrapper.get('.board-image').element)
    expect(preview.width).toBeCloseTo(worldWidth * zoom)
    expect(preview.height).toBeCloseTo(worldHeight * zoom)
    expect(preview.width).toBeCloseTo(existing.width * zoom)
    expect(preview.height).toBeCloseTo(existing.height * zoom)
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 320 })
    expect(wrapper.findAll('.board-image')).toHaveLength(1)
    const placed = rectangle(wrapper.get('.board-image').element)
    expect(placed.width).toBe(worldWidth)
    expect(placed.height).toBe(worldHeight)
    expect(placed).toEqual(existing)
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, naturalWidth * 4, naturalHeight * 4)
    await original.trigger('load')
    await flushPromises()
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    expect(rectangle(wrapper.get('.board-image').element)).toEqual(placed)
  })

  it('does not add an image when dropped outside the board', async () => {
    const { wrapper, thumbnail } = setup()
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 740 })
    await thumbnail.trigger('click', { detail: 1 })
    expect(wrapper.find('.board-image').exists()).toBe(false)
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
  })

  it('keeps the drop center in world coordinates when the camera moves while decoding', async () => {
    const { wrapper, thumbnail, stage } = setup()
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 320 })
    const pending = rectangle(wrapper.get('.board-image').element)
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, 1600, 800)
    const finishOriginal = deferredDecode()
    await original.trigger('load')
    await stage.trigger('wheel', { deltaY: -100, clientX: 500, clientY: 380 })
    const [cameraX, cameraY, zoom] = (wrapper.get('.board-world').element as HTMLElement).style.transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    finishOriginal()
    await flushPromises()
    const placed = rectangle(wrapper.get('.board-image').element)
    expect(placed.x + placed.width / 2).toBe(pending.x + pending.width / 2)
    expect(placed.y + placed.height / 2).toBe(pending.y + pending.height / 2)
    expect(wrapper.getComponent(ImageBoard).vm.getImageRect(1)).toEqual({
      x: bounds.left + cameraX + 360 * zoom,
      y: bounds.top + cameraY + 240 * zoom,
      width: 320 * zoom,
      height: 160 * zoom,
    })
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
  })

  it('allows another drag after removing a dropped image', async () => {
    const { wrapper, thumbnail } = setup()
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 320 })
    await wrapper.get('[aria-label="移出画板"]').trigger('click')
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    expect(wrapper.find('.board-image').exists()).toBe(false)
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(true)
  })

  it.each(['pointercancel', 'lostpointercapture', 'blur', 'escape'])('cancels an active drag on %s without leaving an image', async event => {
    const { wrapper, thumbnail } = setup()
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    if (event === 'blur') window.dispatchEvent(new Event('blur'))
    else if (event === 'escape') wrapper.vm.cancel()
    else await thumbnail.trigger(event, pointer)
    await flushPromises()
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    expect(wrapper.find('.board-image').exists()).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('shows an error when the dropped original fails', async () => {
    const { wrapper, thumbnail } = setup()
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 320 })
    const original = wrapper.get('.board-image img')
    await original.trigger('error')
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    expect(wrapper.find('.board-image-preview').exists()).toBe(false)
    expect((original.element as HTMLElement).style.display).toBe('none')
    expect(wrapper.get('.board-image-status').text()).toBe('无法显示此图片')
  })

  it('falls back to the original when the thumbnail is unavailable and preserves the drop center after loading', async () => {
    const { wrapper, thumbnail } = setup(0, 0)
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    expect(wrapper.get('.thumbnail-drag-preview img').attributes('src')).toBe(image.src)
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 320 })
    const placement = rectangle(wrapper.get('.board-image').element)
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, 400, 800)
    await original.trigger('load')
    await flushPromises()
    const loaded = rectangle(wrapper.get('.board-image').element)
    expect(loaded).toEqual({ x: 290, y: 100, width: 140, height: 280 })
    expect(loaded.x + loaded.width / 2).toBe(placement.x + placement.width / 2)
    expect(loaded.y + loaded.height / 2).toBe(placement.y + placement.height / 2)
    expect(wrapper.find('.board-image-status').exists()).toBe(false)
  })

  it('uses the original source when adding by click', async () => {
    const { wrapper, thumbnail } = setup()
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 142, clientY: 741 })
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 142, clientY: 741 })
    await thumbnail.trigger('click', { detail: 1 })
    expect(wrapper.findAll('.board-image')).toHaveLength(1)
    const placement = { x: 240, y: 220, width: 320, height: 160 }
    expect(rectangle(wrapper.get('.board-image').element)).toEqual(placement)
    expect(wrapper.find('.board-image-preview').exists()).toBe(false)
    expect(wrapper.find('.board-image-status').text()).toBe('加载中…')
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, 400, 200)
    const finishOriginal = deferredDecode()
    await original.trigger('load')
    expect(rectangle(wrapper.get('.board-image').element)).toEqual(placement)
    finishOriginal()
    await flushPromises()
    expect(wrapper.find('.board-image-preview').exists()).toBe(false)
    expect(wrapper.find('.board-image-status').exists()).toBe(false)
    expect(rectangle(wrapper.get('.board-image').element)).toEqual(placement)
    expect(wrapper.getComponent(ImageBoard).vm.selectedPath).toBe(image.path)
  })

  it.each([1, 0])('adds a portrait with a 140px frame immediately for click detail=%s', async detail => {
    const { wrapper, thumbnail } = setup(200, 400)
    await thumbnail.trigger('click', { detail })
    const placement = { x: 330, y: 160, width: 140, height: 280 }
    expect(rectangle(wrapper.get('.board-image').element)).toEqual(placement)
    expect(wrapper.find('.board-image-status').text()).toBe('加载中…')
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, 800, 1600)
    await original.trigger('load')
    await flushPromises()
    expect(rectangle(wrapper.get('.board-image').element)).toEqual(placement)
    expect(wrapper.find('.board-image-status').exists()).toBe(false)
  })

  it('keeps click insertion centered and sized correctly after zooming, including repeat selections', async () => {
    const { wrapper, thumbnail, stage } = setup(200, 400)
    await stage.trigger('wheel', { deltaY: -100, clientX: 500, clientY: 380 })
    const [cameraX, cameraY, zoom] = (wrapper.get('.board-world').element as HTMLElement).style.transform.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    await thumbnail.trigger('click', { detail: 1 })
    await thumbnail.trigger('click', { detail: 1 })
    const placed = wrapper.findAll('.board-image').map(item => rectangle(item.element))
    expect(placed).toHaveLength(1)
    const item = placed[0]
    expect(item.width).toBe(140)
    expect(item.height).toBe(280)
    expect(cameraX + (item.x + item.width / 2) * zoom).toBeCloseTo(bounds.width / 2)
    expect(cameraY + (item.y + item.height / 2) * zoom).toBeCloseTo(bounds.height / 2)
  })

  it('preserves the existing click fallback when thumbnail dimensions are unavailable', async () => {
    const { wrapper, thumbnail } = setup(0, 0)
    await thumbnail.trigger('click', { detail: 1 })
    expect(wrapper.find('.board-image-preview').exists()).toBe(false)
    const original = wrapper.get('.board-image img')
    naturalSize(original.element, 200, 400)
    await original.trigger('load')
    await flushPromises()
    expect(rectangle(wrapper.get('.board-image').element)).toEqual({ x: 330, y: 160, width: 140, height: 280 })
  })
})
