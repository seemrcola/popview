export type DirectoryEntry = {
  path: string
  name: string
  is_dir: boolean
  size: number
  modified: number | null
}

export type ImageSource = {
  path: string
  name: string
  src: string
  thumbnailSrc: string
}

export type ImageItem = ImageSource & { size: number; modified: number | null }
export type FolderImage = Pick<DirectoryEntry, 'path' | 'name'>
export type RootDirectory = { session: number; path: string; entries: DirectoryEntry[] }
export type DirectoryNode = {
  path: string
  name: string
  parent?: string
  depth: number
  children: string[]
  loaded: boolean
  expanded: boolean
  loading: boolean
  error: string
}
