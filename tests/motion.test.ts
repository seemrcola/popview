import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImageCollection from '../src/components/ImageCollection.vue'

const image = { path: '/photo.png', name: 'photo.png', src: 'original', thumbnailSrc: 'thumbnail', size: 1200, modified: null }
const props = { folders: [], images: [image], viewMode: 'grid' as const, version: 1, imagesFor: () => [] }

afterEach(() => vi.restoreAllMocks())

describe('restrained collection motion', () => {
  it('animates mode changes without postponing interaction and interrupts prior motion', async () => {
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    const wrapper = mount(ImageCollection, { props })
    expect(animate).not.toHaveBeenCalled()
    await wrapper.setProps({ viewMode: 'list' })
    expect(animate).toHaveBeenCalledOnce()
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 180 })
    const first = animate.mock.results[0].value as Animation
    await wrapper.get('.media-item').trigger('click')
    expect(wrapper.emitted('openImage')?.[0]).toEqual([image])
    await wrapper.setProps({ viewMode: 'grid' })
    expect(first.playState).toBe('idle')
    const last = animate.mock.results[1].value as Animation
    wrapper.unmount()
    expect(last.playState).toBe('idle')
  })

  it('does not animate search updates', async () => {
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    const wrapper = mount(ImageCollection, { props })
    await wrapper.setProps({ images: [{ ...image, name: 'other.png' }] })
    expect(animate).not.toHaveBeenCalled()
  })

  it('respects reduced motion and removes its preference listener', async () => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    vi.spyOn(preference, 'matches', 'get').mockReturnValue(true)
    vi.spyOn(window, 'matchMedia').mockReturnValue(preference)
    const remove = vi.spyOn(preference, 'removeEventListener')
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    const wrapper = mount(ImageCollection, { props })
    await wrapper.setProps({ viewMode: 'list' })
    expect(animate).not.toHaveBeenCalled()
    expect(wrapper.find('.media-list').exists()).toBe(true)
    wrapper.unmount()
    expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
  })

  it('cancels immediately when the motion preference changes', async () => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    vi.spyOn(window, 'matchMedia').mockReturnValue(preference)
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    const wrapper = mount(ImageCollection, { props })
    await wrapper.setProps({ viewMode: 'list' })
    const animation = animate.mock.results[0].value as Animation
    preference.dispatchEvent(new Event('change'))
    expect(animation.playState).toBe('idle')
  })

  it('keeps navigation functional without the animation API', async () => {
    vi.spyOn(HTMLElement.prototype, 'animate', 'get').mockReturnValue(undefined)
    const wrapper = mount(ImageCollection, { props })
    await wrapper.setProps({ viewMode: 'list' })
    expect(wrapper.find('.media-list').exists()).toBe(true)
  })
})
