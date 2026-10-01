import { onBeforeUnmount, onMounted, watch, type Ref, type WatchSource } from 'vue'

export function useCollectionMotion(element: Ref<HTMLElement | undefined>, source: WatchSource) {
  let animation: Animation | undefined
  let preference: MediaQueryList | undefined
  const cancel = () => { animation?.cancel(); animation = undefined }

  onMounted(() => {
    preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    preference.addEventListener('change', cancel)
  })
  watch(source, () => {
    cancel()
    if (preference?.matches || !element.value?.animate) return
    animation = element.value.animate([
      { opacity: .65, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 180, easing: 'cubic-bezier(.22, 1, .36, 1)' })
    void animation.finished.catch(() => {})
  }, { flush: 'post' })
  onBeforeUnmount(() => {
    cancel()
    preference?.removeEventListener('change', cancel)
  })
}
