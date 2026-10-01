import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CollectionEmpty from '../src/components/CollectionEmpty.vue'
import ImageCollection from '../src/components/ImageCollection.vue'
import WelcomeScreen from '../src/components/WelcomeScreen.vue'

describe('minimal empty states', () => {
  it.each([
    [{}, '暂无可浏览的图片'],
    [{ query: '<旅行> & 海边' }, '没有匹配的图片'],
    [{ query: '   ' }, '暂无可浏览的图片'],
    [{ error: '/private/photos: permission denied' }, '读取失败'],
    [{ loading: true, query: '猫', error: 'denied' }, '加载中…'],
  ])('shows only one state label for %j', (props, label) => {
    const wrapper = mount(CollectionEmpty, { props })
    expect(wrapper.text()).toBe(label)
    expect(wrapper.findAll('p')).toHaveLength(1)
    expect(wrapper.find('button, a, details, [tabindex]').exists()).toBe(false)
    expect(wrapper.get('.empty-symbol').attributes('aria-hidden')).toBe('true')
  })

  it('does not add helper text below the welcome button', async () => {
    const wrapper = mount(WelcomeScreen, { props: { busy: false, error: '' } })
    expect(wrapper.find('p').exists()).toBe(false)
    expect(wrapper.find('.welcome-action svg').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('choose')).toHaveLength(1)
    await wrapper.setProps({ busy: true })
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.welcome-action').text()).toBe('打开中…')
    expect(wrapper.find('.welcome-loading').exists()).toBe(true)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('choose')).toHaveLength(1)
  })

  it('keeps search feedback compact when folders remain', async () => {
    const wrapper = mount(ImageCollection, { props: {
      folders: [{ path: '/photos/travel', name: '旅行', is_dir: true, size: 0, modified: null }],
      images: [], viewMode: 'list', version: 1, imagesFor: () => [], query: '猫',
    } })
    expect(wrapper.getComponent(CollectionEmpty).props('compact')).toBe(true)
    expect(wrapper.getComponent(CollectionEmpty).text()).toBe('没有匹配的图片')
    expect(wrapper.get('.folder-list-item').text()).toContain('旅行')
    await wrapper.setProps({ query: '   ' })
    expect(wrapper.findComponent(CollectionEmpty).exists()).toBe(false)
  })

  it('keeps current images on screen during navigation', () => {
    const wrapper = mount(ImageCollection, { props: {
      folders: [], images: [{ path: '/photo.png', name: 'photo.png', src: 'image', thumbnailSrc: 'thumb', size: 100, modified: null }],
      viewMode: 'grid', version: 1, imagesFor: () => [], loading: true,
    } })
    expect(wrapper.findComponent(CollectionEmpty).exists()).toBe(false)
    expect(wrapper.get('.media-item').text()).toContain('photo.png')
  })
})
