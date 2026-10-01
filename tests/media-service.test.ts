import { beforeEach, describe, expect, it, vi } from 'vitest'
import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core'
import { chooseRoot, imageSource, listDirectory, sampleDirectory } from '../src/services/media'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(), isTauri: vi.fn(),
  convertFileSrc: vi.fn((path: string, protocol: string) => `${protocol}://localhost/${encodeURIComponent(path)}`),
}))
beforeEach(() => vi.mocked(isTauri).mockReturnValue(true))

describe('native boundary', () => {
  it('does not let the frontend authorize an arbitrary root path', async () => {
    vi.mocked(invoke).mockResolvedValue(null)
    await chooseRoot()
    expect(invoke).toHaveBeenCalledWith('choose_directory')
  })

  it('passes session credentials to both directory operations', async () => {
    await listDirectory('/photos', 3)
    await sampleDirectory('/photos/child', 3)
    expect(invoke).toHaveBeenCalledWith('list_directory', { path: '/photos', session: 3 })
    expect(invoke).toHaveBeenCalledWith('sample_directory_images', { path: '/photos/child', session: 3 })
  })

  it('builds distinct original and thumbnail URLs with explicit revisions', () => {
    const image = imageSource({ path: '/photos/空 格#?.png', name: '空 格#?.png' }, 2, 7)
    expect(convertFileSrc).toHaveBeenCalledWith('/photos/空 格#?.png', 'media')
    expect(image.src).toContain('session=2&revision=7')
    expect(image.thumbnailSrc).toBe(`${image.src}&thumbnail=1`)
  })

  it('gives a clear message in browser-only development', async () => {
    vi.mocked(isTauri).mockReturnValue(false)
    await expect(chooseRoot()).rejects.toThrow('桌面应用')
    expect(invoke).not.toHaveBeenCalled()
  })
})
