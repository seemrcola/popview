import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import type { DirectoryEntry, FolderImage, ImageSource, RootDirectory } from '../types/media'

export async function chooseRoot(): Promise<RootDirectory | null> {
  if (!isTauri()) throw new Error('读取本地目录需要桌面应用，请使用 npm run tauri dev 启动。')
  return invoke<RootDirectory | null>('choose_directory')
}

export function listDirectory(path: string, session: number) {
  return invoke<DirectoryEntry[]>('list_directory', { path, session })
}

export function sampleDirectory(path: string, session: number) {
  return invoke<FolderImage[]>('sample_directory_images', { path, session })
}

export function imageSource(image: FolderImage, session: number, revision = 0): ImageSource {
  const url = `${convertFileSrc(image.path, 'media')}?session=${session}&revision=${revision}`
  return { ...image, src: url, thumbnailSrc: `${url}&thumbnail=1` }
}

export async function expandWindow() {
  const window = getCurrentWindow()
  await window.setSize(new LogicalSize(1200, 760))
  await window.setMinSize(new LogicalSize(960, 600))
  await window.center()
}
