import { afterEach, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'

enableAutoUnmount(afterEach)
vi.stubGlobal('ResizeObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})
vi.stubGlobal('IntersectionObserver', class {
  observe() {}
  unobserve() {}
  disconnect() {}
})
HTMLDialogElement.prototype.showModal = function () { this.open = true }
HTMLDialogElement.prototype.close = function () { this.open = false }
HTMLElement.prototype.scrollTo = function (options) {
  if (typeof options === 'object') {
    this.scrollTop = options.top ?? this.scrollTop
    this.scrollLeft = options.left ?? this.scrollLeft
  }
}
