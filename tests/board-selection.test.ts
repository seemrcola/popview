import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import BoardPreview from '../src/components/BoardPreview.vue'
import ImageBoard from '../src/components/ImageBoard.vue'

const images = ['a', 'b', 'c'].map(name => ({ path: `/photos/${name}.png`, name: `${name}.png`, src: `original-${name}`, thumbnailSrc: `thumbnail-${name}` }))
const pointer = { pointerId: 1, button: 0 }
const bounds = { x: 100, y: 80, left: 100, top: 80, right: 900, bottom: 680, width: 800, height: 600, toJSON: () => ({}) }

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(bounds)
  vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(() => {})
  vi.spyOn(HTMLElement.prototype, 'hasPointerCapture').mockReturnValue(false)
})

async function setup(initialImage = images[0]) {
  const wrapper = mount(BoardPreview, { props: { images, initialImage }, attachTo: document.body })
  await nextTick()
  return wrapper
}

function placement(element: Element) {
  const style = (element as HTMLElement).style
  return [style.left, style.top, style.width, style.height]
}

describe('board membership and selection', () => {
  it.each([[0, 1], [1, 2], [2, 1]])('focuses the adjacent image after removing image %s from the toolbar', async (removed, successor) => {
    const wrapper = await setup()
    const thumbnails = wrapper.findAll('.board-thumbnail')
    await thumbnails[1].trigger('click')
    await thumbnails[2].trigger('click')
    await thumbnails[removed].trigger('click')
    await wrapper.get('.board-stage').trigger('wheel', { deltaY: -100, clientX: 500, clientY: 380 })
    const camera = wrapper.get('.board-world').attributes('style')
    const remaining = wrapper.findAll('.board-image')[successor].element as HTMLElement
    const geometry = placement(remaining)
    const layer = Number(remaining.style.zIndex)
    const stageFocus = vi.spyOn(wrapper.get('.board-stage').element as HTMLElement, 'focus')
    const remove = wrapper.get('[aria-label="移出画板"]')
    ;(remove.element as HTMLElement).focus()
    await remove.trigger('click')
    await nextTick()
    expect(wrapper.findAll('.board-image')).toHaveLength(2)
    expect(wrapper.get('.board-image.selected').element).toBe(remaining)
    expect(document.activeElement).toBe(remaining)
    expect(thumbnails[successor].attributes('aria-current')).toBe('true')
    expect(placement(remaining)).toEqual(geometry)
    expect(Number(remaining.style.zIndex)).toBeGreaterThan(layer)
    expect(wrapper.get('.board-world').attributes('style')).toBe(camera)
    expect(stageFocus).not.toHaveBeenCalled()
  })

  it('supports consecutive keyboard deletions and leaves the empty board unfocused', async () => {
    const wrapper = await setup()
    const thumbnails = wrapper.findAll('.board-thumbnail')
    await thumbnails[1].trigger('click')
    await thumbnails[2].trigger('click')
    await thumbnails[0].trigger('click')
    const stage = wrapper.get('.board-stage').element as HTMLElement
    expect(document.activeElement).toBe(stage)
    const stageFocus = vi.spyOn(stage, 'focus')
    for (const image of images.slice(1)) {
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
      await nextTick()
      await nextTick()
      expect(wrapper.get('.board-image.selected img').attributes('src')).toBe(image.src)
      expect(document.activeElement).toBe(wrapper.get('.board-image.selected').element)
    }
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))
    await nextTick()
    await nextTick()
    expect(wrapper.find('.board-image').exists()).toBe(false)
    expect(wrapper.find('.board-image-controls').exists()).toBe(false)
    expect(wrapper.find('.board-thumbnail.selected').exists()).toBe(false)
    expect(document.activeElement).not.toBe(stage)
    expect(stageFocus).not.toHaveBeenCalled()
  })

  it('blurs the stage when its last image is deleted by keyboard', async () => {
    const wrapper = await setup()
    const stage = wrapper.get('.board-stage').element as HTMLElement
    expect(document.activeElement).toBe(stage)
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))
    await nextTick()
    await nextTick()
    expect(wrapper.find('.board-image').exists()).toBe(false)
    expect(document.activeElement).not.toBe(stage)
  })

  it('keeps every board member highlighted after deselection and clears it on removal', async () => {
    const wrapper = await setup()
    const thumbnails = wrapper.findAll('.board-thumbnail')
    expect(thumbnails[0].attributes('aria-pressed')).toBe('true')
    await thumbnails[1].trigger('click')
    expect(thumbnails.filter(item => item.classes().includes('in-board'))).toHaveLength(2)
    await wrapper.get('.board-stage').trigger('pointerdown', pointer)
    await wrapper.get('.board-stage').trigger('pointerup', pointer)
    expect(wrapper.find('.board-thumbnail.selected').exists()).toBe(false)
    expect(wrapper.findAll('.board-thumbnail.in-board')).toHaveLength(2)
    await thumbnails[0].trigger('click')
    await wrapper.get('[aria-label="移出画板"]').trigger('click')
    expect(thumbnails[0].classes()).not.toContain('in-board')
    expect(thumbnails[0].attributes('aria-pressed')).toBe('false')
    expect(thumbnails[1].classes()).toContain('in-board')
    await thumbnails[0].trigger('click')
    expect(wrapper.findAll('.board-image')).toHaveLength(2)
    expect(thumbnails[0].classes()).toContain('in-board')
  })

  it('reselects and raises an existing image without changing its identity or geometry', async () => {
    const wrapper = await setup()
    const thumbnails = wrapper.findAll('.board-thumbnail')
    const original = wrapper.get('.board-image').element
    const before = placement(original)
    await thumbnails[1].trigger('click')
    const otherLayer = Number((wrapper.findAll('.board-image')[1].element as HTMLElement).style.zIndex)
    const animate = vi.spyOn(original as HTMLElement, 'animate')
    await thumbnails[0].trigger('click', { detail: 1 })
    await thumbnails[0].trigger('click', { detail: 0 })
    expect(wrapper.findAll('.board-image')).toHaveLength(2)
    expect(wrapper.get('.board-image.selected').element).toBe(original)
    expect(placement(original)).toEqual(before)
    expect(Number((original as HTMLElement).style.zIndex)).toBeGreaterThan(otherLayer)
    expect(animate).toHaveBeenCalledTimes(2)
    expect(thumbnails[0].attributes('aria-current')).toBe('true')
    expect(wrapper.get('[role="status"]').text()).toBe('已选中 a.png')
  })

  it('also deduplicates drag insertion at the board entry point', async () => {
    const wrapper = await setup()
    const thumbnail = wrapper.findAll('.board-thumbnail')[0]
    const original = wrapper.get('.board-image').element
    const before = placement(original)
    await wrapper.findAll('.board-thumbnail')[1].trigger('click')
    await thumbnail.trigger('pointerdown', { ...pointer, clientX: 140, clientY: 740 })
    await thumbnail.trigger('pointermove', { ...pointer, clientX: 460, clientY: 320 })
    await thumbnail.trigger('pointerup', { ...pointer, clientX: 460, clientY: 320 })
    expect(wrapper.findAll('.board-image')).toHaveLength(2)
    expect(wrapper.get('.board-image.selected').element).toBe(original)
    expect(placement(original)).toEqual(before)
    expect(wrapper.find('.thumbnail-drag-preview').exists()).toBe(false)
    const board = wrapper.getComponent(ImageBoard)
    expect(board.vm.addImage(images[0])).toBe(Number(original.getAttribute('data-image-id')))
    expect(wrapper.findAll('.board-image')).toHaveLength(2)
  })

  it('brings an offscreen existing image back into view while preserving zoom and placement', async () => {
    const wrapper = await setup()
    const stage = wrapper.get('.board-stage')
    const original = wrapper.get('.board-image').element
    const before = placement(original)
    await stage.trigger('wheel', { deltaY: -100, clientX: 500, clientY: 380 })
    const board = wrapper.getComponent(ImageBoard)
    const zoom = board.vm.cameraZoom
    await stage.trigger('pointerdown', { ...pointer, clientX: 400, clientY: 300 })
    await stage.trigger('pointermove', { ...pointer, clientX: 2400, clientY: 2300 })
    await stage.trigger('pointerup', pointer)
    await wrapper.findAll('.board-thumbnail')[0].trigger('click')
    const rect = board.vm.getImageRect(Number(original.getAttribute('data-image-id')))!
    expect(rect.x).toBeCloseTo(bounds.left + bounds.width / 2)
    expect(rect.y).toBeCloseTo(bounds.top + bounds.height / 2)
    expect(board.vm.cameraZoom).toBe(zoom)
    expect(placement(original)).toEqual(before)
  })

  it('keeps duplicate selection available with reduced motion and skips the flash', async () => {
    const wrapper = await setup()
    const original = wrapper.get('.board-image').element as HTMLElement
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    vi.spyOn(preference, 'matches', 'get').mockReturnValue(true)
    vi.spyOn(window, 'matchMedia').mockReturnValue(preference)
    const animate = vi.spyOn(original, 'animate')
    await wrapper.findAll('.board-thumbnail')[1].trigger('click')
    await wrapper.findAll('.board-thumbnail')[0].trigger('click')
    expect(wrapper.get('.board-image.selected').element).toBe(original)
    expect(animate).not.toHaveBeenCalled()
  })
})
