<script setup lang="ts">
import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-vue-next'
import type { DirectoryNode } from '../types/media'

const props = defineProps<{ nodes: Record<string, DirectoryNode>; visibleNodes: DirectoryNode[]; selectedPath: string }>()
const emit = defineEmits<{ select: [path: string]; toggle: [path: string] }>()

function isLastSibling(node: DirectoryNode) {
  const siblings = node.parent ? props.nodes[node.parent]?.children : []
  return siblings?.at(-1) === node.path
}

function treeGuides(node: DirectoryNode) {
  const depths: number[] = []
  let ancestor = node.parent ? props.nodes[node.parent] : undefined
  while (ancestor?.parent) {
    if (!isLastSibling(ancestor)) depths.push(ancestor.depth)
    ancestor = props.nodes[ancestor.parent]
  }
  return depths
}
</script>

<template>
  <nav class="folder-tree" aria-label="文件夹导航">
    <div v-for="node in visibleNodes" :key="node.path" class="folder-line"
      :class="{ selected: selectedPath === node.path, 'root-folder': node.depth === 0 }" :style="{ '--depth': node.depth }">
      <span v-for="depth in treeGuides(node)" :key="depth" class="tree-guide"
        :style="{ left: `${(depth - 1) * 20 + 17}px` }" aria-hidden="true" />
      <span v-if="node.depth" class="tree-branch" :class="{ last: isLastSibling(node) }"
        :style="{ left: `${(node.depth - 1) * 20 + 17}px` }" aria-hidden="true" />
      <button v-if="node.children.length || !node.loaded" class="tree-disclosure"
        :aria-expanded="node.expanded" :aria-label="`${node.expanded ? '收起' : '展开'} ${node.name}`"
        :disabled="node.loading" @click="emit('toggle', node.path)">
        <ChevronDown v-if="node.expanded" :size="13" /><ChevronRight v-else :size="13" />
      </button>
      <span v-else class="tree-disclosure-spacer" />
      <button class="folder-row" :aria-current="selectedPath === node.path ? 'page' : undefined"
        :title="node.path" @click="emit('select', node.path)">
        <component :is="node.expanded || selectedPath === node.path ? FolderOpen : Folder"
          class="tree-folder-icon" :size="18" :stroke-width="1.7" />
        <span class="folder-label">{{ node.name }}</span>
        <span v-if="node.loading" class="muted-count">…</span>
      </button>
    </div>
  </nav>
</template>

<style scoped>
.folder-tree { min-height: 0; flex: 1; overflow: auto; padding: 14px 12px 20px; scrollbar-width: thin; scrollbar-color: #789e89 transparent; overscroll-behavior: contain; }
.folder-line { position: relative; min-height: 40px; display: flex; align-items: center; margin-bottom: 4px; padding-left: calc(var(--depth) * 20px + 6px); min-width: calc(var(--depth) * 20px + 150px); border: 2px solid transparent; border-radius: 8px; transition: background 160ms ease; }
.tree-disclosure, .tree-disclosure-spacer { width: 20px; height: 28px; flex: 0 0 20px; display: grid; place-items: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: #596b5c; }
.tree-disclosure:hover:not(:disabled) { background: #dce6da; color: #304534; }
.folder-row { min-width: 0; flex: 1; min-height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 8px 0 3px; border: 0; border-radius: 5px; background: transparent; color: #3f5142; text-align: left; font-size: 13px; }
.folder-line:hover { background: #e5f8ec; }
.folder-line.selected { background: var(--accent-soft); }
.folder-line.selected .folder-row { color: var(--ink); font-weight: 700; }
.folder-label { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.root-folder { margin-bottom: 6px; }
.root-folder .folder-label { font-weight: 600; }
.tree-folder-icon { flex-shrink: 0; color: #455e4c; fill: var(--yellow); }
.folder-line.selected .tree-folder-icon { color: var(--ink); }
.tree-guide, .tree-branch { position: absolute; top: -6px; bottom: -2px; border-left: 1px solid #8db49d; pointer-events: none; }
.tree-branch::after { content: ''; position: absolute; top: 25px; width: 10px; border-top: 1px solid #8db49d; }
.tree-branch.last { bottom: 50%; }
.folder-row:focus-visible, .tree-disclosure:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
@media (prefers-reduced-motion: reduce) { .folder-line { transition: none; } }
</style>
