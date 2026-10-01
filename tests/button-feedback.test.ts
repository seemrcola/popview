import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installButtonFeedback } from '../src/composables/useButtonFeedback'

let root: HTMLDivElement
let dispose: () => void
let preference: MediaQueryList

function pointer(target: EventTarget, type: string, options: PointerEventInit = {}) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, clientX: 30, clientY: 15, ...options }))
}

beforeEach(() => {
  root = document.createElement('div')
  root.innerHTML = '<button class="sidebar-open">打开</button><button class="icon-button" disabled>禁用</button><button class="media-item">图片</button><button class="welcome-launch"><span class="welcome-action">选择文件夹</span></button>'
  document.body.append(root)
  preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  vi.spyOn(window, 'matchMedia').mockReturnValue(preference)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 40, toJSON: () => ({}) })
  dispose = installButtonFeedback(root)
})
afterEach(() => { dispose(); root.remove(); vi.restoreAllMocks() })

describe('button tactile feedback', () => {
  it('starts at the pointer location, squashes, and rebounds without cancelling click', () => {
    const button = root.querySelector('button')!
    const click = vi.fn()
    button.addEventListener('click', click)
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    pointer(button, 'pointerdown')
    expect(button.style.getPropertyValue('--button-x')).toBe('30px')
    expect(button.style.getPropertyValue('--button-y')).toBe('15px')
    expect(root.querySelectorAll('.button-ripple')).toHaveLength(1)
    expect(animate.mock.calls[0][0]).toContainEqual({ transform: 'scale(.98, .94)' })
    pointer(window, 'pointerup')
    expect(animate.mock.calls[2][0]).toContainEqual({ transform: 'scale(1.012, 1.035)', offset: .32 })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })
    button.dispatchEvent(event)
    expect(click).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(false)
  })

  it('bounds rapid clicks to one ripple and cancels replaced effects', () => {
    const button = root.querySelector('button')!
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    for (let count = 0; count < 12; count++) {
      pointer(button, 'pointerdown')
      pointer(window, 'pointerup')
    }
    expect(root.querySelectorAll('.button-ripple')).toHaveLength(1)
    expect((animate.mock.results[1].value as Animation).playState).toBe('idle')
    dispose()
    expect(root.querySelector('.button-ripple')).toBeNull()
    for (const result of animate.mock.results) expect((result.value as Animation).playState).toBe('idle')
  })

  it('centers keyboard activation and keeps welcome artwork outside the squash', () => {
    const button = root.querySelector<HTMLButtonElement>('.welcome-launch')!
    button.click()
    const action = root.querySelector<HTMLElement>('.welcome-action')!
    expect(action.style.getPropertyValue('--button-x')).toBe('50px')
    expect(action.style.getPropertyValue('--button-y')).toBe('20px')
    expect(action.querySelector('.button-ripple')).not.toBeNull()
    expect(button.classList.contains('tactile-host')).toBe(false)
  })

  it('skips disabled controls, image surfaces, right clicks and secondary pointers', () => {
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    pointer(root.querySelector('[disabled]')!, 'pointerdown')
    pointer(root.querySelector('.media-item')!, 'pointerdown')
    pointer(root.querySelector('button')!, 'pointerdown', { button: 2 })
    pointer(root.querySelector('button')!, 'pointerdown', { isPrimary: false })
    expect(animate).not.toHaveBeenCalled()
  })

  it('ignores another pointer release and clears all feedback on cancel', () => {
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    pointer(root.querySelector('button')!, 'pointerdown')
    pointer(window, 'pointerup', { pointerId: 2 })
    expect(animate).toHaveBeenCalledTimes(2)
    pointer(window, 'pointercancel')
    expect(root.querySelector('.tactile-host')).toBeNull()
    expect(root.querySelector('.button-ripple')).toBeNull()
  })

  it('tracks the mouse highlight but does not leave sticky hover on touch', () => {
    const button = root.querySelector('button')!
    pointer(button, 'pointermove', { pointerType: 'touch' })
    expect(root.querySelector('.tactile-hover')).toBeNull()
    pointer(button, 'pointermove')
    expect(button.classList.contains('tactile-hover')).toBe(true)
    pointer(button, 'pointermove', { pointerType: 'touch' })
    expect(root.querySelector('.tactile-hover')).toBeNull()
    pointer(button, 'pointermove')
    pointer(root, 'pointermove')
    expect(root.querySelector('.tactile-hover')).toBeNull()
  })

  it('removes the ripple after completion and restores the resting state on blur', async () => {
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    pointer(root.querySelector('button')!, 'pointerdown')
    const ripple = animate.mock.results[1].value as Animation
    ripple.finish()
    await ripple.finished
    expect(root.querySelector('.button-ripple')).toBeNull()
    window.dispatchEvent(new Event('blur'))
    expect(root.querySelector('.tactile-host')).toBeNull()
    expect((animate.mock.results[0].value as Animation).playState).toBe('idle')
  })

  it('immediately removes effects on reduced motion and skips further animations', () => {
    pointer(root.querySelector('button')!, 'pointerdown')
    vi.spyOn(preference, 'matches', 'get').mockReturnValue(true)
    preference.dispatchEvent(new Event('change'))
    expect(root.querySelector('.button-ripple')).toBeNull()
    const animate = vi.spyOn(HTMLElement.prototype, 'animate')
    pointer(root.querySelector('button')!, 'pointerdown')
    expect(animate).not.toHaveBeenCalled()
  })

  it('works without Web Animations and removes listeners on disposal', () => {
    const animate = vi.spyOn(HTMLElement.prototype, 'animate', 'get').mockReturnValue(undefined)
    pointer(root.querySelector('button')!, 'pointerdown')
    expect(root.querySelector('.button-ripple')).toBeNull()
    animate.mockRestore()
    dispose()
    pointer(root.querySelector('button')!, 'pointerdown')
    expect(root.querySelector('.tactile-host')).toBeNull()
  })
})
