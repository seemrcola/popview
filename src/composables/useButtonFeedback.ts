import { onBeforeUnmount, onMounted } from 'vue'

const selector = '.welcome-launch, .sidebar-open, .icon-button, .collection-pages button, .viewer-header button, .viewer-controls button, .viewer-arrow'

export function installButtonFeedback(root: HTMLElement) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const effects = new Map<HTMLElement, { animation: Animation; dispose: () => void }>()
  let pressed: { surface: HTMLElement; pointerId: number } | undefined
  let hovered: HTMLElement | undefined

  function surfaceFor(target: EventTarget | null) {
    if (preference.matches || !(target instanceof Element)) return
    const button = target.closest<HTMLButtonElement>(selector)
    if (!button || !root.contains(button) || button.disabled || button.getAttribute('aria-disabled') === 'true') return
    const surface = button.querySelector<HTMLElement>('.welcome-action') ?? button
    if (!surface.animate) return
    surface.classList.add('tactile-host')
    if (getComputedStyle(surface).position === 'static') surface.classList.add('tactile-relative')
    return surface
  }

  function stop(surface: HTMLElement) {
    const effect = effects.get(surface)
    if (!effect) return
    effects.delete(surface)
    effect.animation.cancel()
    effect.dispose()
  }

  function animate(surface: HTMLElement, frames: Keyframe[], duration: number, hold = false, dispose = () => {}) {
    stop(surface)
    const animation = surface.animate(frames, { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: hold ? 'forwards' : 'none' })
    effects.set(surface, { animation, dispose })
    void animation.finished.then(() => {
      if (!hold && effects.get(surface)?.animation === animation) {
        effects.delete(surface)
        dispose()
      }
    }).catch(() => {})
  }

  function release() {
    if (!pressed) return
    const surface = pressed.surface
    pressed = undefined
    if (!surface.isConnected || preference.matches) { stop(surface); return }
    animate(surface, [
      { transform: getComputedStyle(surface).transform, offset: 0 },
      { transform: 'scale(1.012, 1.035)', offset: .32 },
      { transform: 'scale(.996, .99)', offset: .64 },
      { transform: 'scale(1)', offset: 1 },
    ], 420)
  }

  function press(surface: HTMLElement, clientX?: number, clientY?: number) {
    const bounds = surface.getBoundingClientRect()
    const left = clientX == null ? bounds.width / 2 : Math.max(0, Math.min(bounds.width, clientX - bounds.left))
    const top = clientY == null ? bounds.height / 2 : Math.max(0, Math.min(bounds.height, clientY - bounds.top))
    surface.style.setProperty('--button-x', `${left}px`)
    surface.style.setProperty('--button-y', `${top}px`)
    animate(surface, [{ transform: getComputedStyle(surface).transform }, { transform: 'scale(.98, .94)' }], 90, true)
    surface.querySelectorAll<HTMLElement>('.button-ripple').forEach(ripple => stop(ripple))
    const layer = document.createElement('span')
    layer.className = 'button-ripple-clip'
    layer.setAttribute('aria-hidden', 'true')
    const ripple = document.createElement('span')
    ripple.className = 'button-ripple'
    const diameter = Math.hypot(bounds.width, bounds.height) * 2
    ripple.style.cssText = `width:${diameter}px;height:${diameter}px;left:${left - diameter / 2}px;top:${top - diameter / 2}px`
    layer.append(ripple)
    surface.append(layer)
    animate(ripple, [{ transform: 'scale(0)', opacity: .2 }, { opacity: .1, offset: .4 }, { transform: 'scale(1)', opacity: 0 }], 520, false, () => layer.remove())
  }

  function pointerDown(event: PointerEvent) {
    if (event.button !== 0 || !event.isPrimary) return
    if (event.pointerType !== 'mouse') hovered?.classList.remove('tactile-hover')
    const surface = surfaceFor(event.target)
    if (!surface) return
    release()
    pressed = { surface, pointerId: event.pointerId }
    press(surface, event.clientX, event.clientY)
  }
  function pointerUp(event: PointerEvent) {
    if (pressed?.pointerId === event.pointerId) release()
  }
  function pointerMove(event: PointerEvent) {
    const surface = event.pointerType === 'mouse' ? surfaceFor(event.target) : undefined
    if (hovered !== surface) hovered?.classList.remove('tactile-hover')
    hovered = surface
    if (!surface) return
    const bounds = surface.getBoundingClientRect()
    surface.style.setProperty('--button-x', `${Math.max(0, Math.min(bounds.width, event.clientX - bounds.left))}px`)
    surface.style.setProperty('--button-y', `${Math.max(0, Math.min(bounds.height, event.clientY - bounds.top))}px`)
    surface.classList.add('tactile-hover')
  }
  function keyboardClick(event: MouseEvent) {
    if (event.detail !== 0) return
    const surface = surfaceFor(event.target)
    if (!surface) return
    release()
    press(surface)
    pressed = { surface, pointerId: -1 }
    release()
  }
  function reset() {
    pressed = undefined
    hovered = undefined
    for (const surface of effects.keys()) stop(surface)
    for (const surface of root.querySelectorAll<HTMLElement>('.tactile-host')) {
      surface.classList.remove('tactile-host', 'tactile-relative', 'tactile-hover')
      surface.style.removeProperty('--button-x')
      surface.style.removeProperty('--button-y')
    }
  }
  root.addEventListener('pointerdown', pointerDown, true)
  root.addEventListener('pointermove', pointerMove, { passive: true })
  root.addEventListener('click', keyboardClick, true)
  root.addEventListener('pointerleave', reset)
  window.addEventListener('pointerup', pointerUp)
  window.addEventListener('pointercancel', reset)
  window.addEventListener('blur', reset)
  preference.addEventListener('change', reset)
  return () => {
    reset()
    root.removeEventListener('pointerdown', pointerDown, true)
    root.removeEventListener('pointermove', pointerMove)
    root.removeEventListener('click', keyboardClick, true)
    root.removeEventListener('pointerleave', reset)
    window.removeEventListener('pointerup', pointerUp)
    window.removeEventListener('pointercancel', reset)
    window.removeEventListener('blur', reset)
    preference.removeEventListener('change', reset)
  }
}

export function useButtonFeedback() {
  let dispose: (() => void) | undefined
  onMounted(() => {
    const root = document.getElementById('app')
    if (root) dispose = installButtonFeedback(root)
  })
  onBeforeUnmount(() => dispose?.())
}
