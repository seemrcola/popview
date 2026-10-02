import { computed, effectScope, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { useImageSearch } from '../src/composables/useImageSearch'
import { errorMessage, userFacingError } from '../src/services/errors'

describe('useImageSearch', () => {
  it('filters by a trimmed, case-insensitive filename query and resets', () => {
    const images = ref([{ name: 'Cat.PNG' }, { name: 'dog.jpg' }])
    const scope = effectScope()
    const search = scope.run(() => useImageSearch(computed(() => images.value)))!

    search.query.value = '  cat  '
    expect(search.filteredItems.value.map(image => image.name)).toEqual(['Cat.PNG'])
    search.reset()
    expect(search.filteredItems.value).toHaveLength(2)
    scope.stop()
  })

  it('clears a query when the source directory has no images', async () => {
    const images = ref([{ name: 'cat.png' }])
    const scope = effectScope()
    const search = scope.run(() => useImageSearch(computed(() => images.value)))!

    search.query.value = 'cat'
    images.value = []
    await nextTick()
    expect(search.query.value).toBe('')
    scope.stop()
  })
})

describe('errorMessage', () => {
  it('preserves useful messages and supplies a safe fallback', () => {
    expect(errorMessage(new Error('拒绝访问'))).toBe('拒绝访问')
    expect(errorMessage('目录不存在')).toBe('目录不存在')
    expect(errorMessage(new Error('   '), '读取失败')).toBe('读取失败')
    expect(errorMessage(null, '读取失败')).toBe('读取失败')
    expect(userFacingError(new Error('permission denied'))).toBe('没有权限读取此位置')
    expect(userFacingError(new Error('自定义错误'))).toBe('自定义错误')
  })
})
