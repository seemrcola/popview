<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ChevronRight, Ellipsis, Folder } from 'lucide-vue-next'

type Crumb = { name: string; path: string }
const props = defineProps<{ items: Crumb[] }>()
const emit = defineEmits<{ select: [crumb: Crumb] }>()
const container = ref<HTMLElement>()
const width = ref(0)
function closeMenu(event?: Event) {
  const menu = container.value?.querySelector('details')
  if (!menu?.open || (event?.type === 'pointerdown' && menu.contains(event.target as Node))) return
  menu.open = false
  if (event?.type === 'keydown') menu.querySelector('summary')?.focus()
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu(event)
}
watch(() => props.items, () => closeMenu())
const capacity = computed(() => width.value < 360 ? 2 : width.value < 560 ? 3 : 4)
const hidden = computed(() => props.items.length > capacity.value ? props.items.slice(1, -(capacity.value - 1)) : [])
const visible = computed(() => hidden.value.length ? [props.items[0], null, ...props.items.slice(-(capacity.value - 1))] : props.items)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => { width.value = entry.contentRect.width })
  if (container.value) observer.observe(container.value)
  document.addEventListener('pointerdown', closeMenu)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  document.removeEventListener('pointerdown', closeMenu)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <nav ref="container" class="folder-breadcrumbs" aria-label="文件夹路径">
    <ol>
      <li v-for="(crumb, index) in visible" :key="crumb?.path ?? 'overflow'" :class="{ current: crumb?.path === items.at(-1)?.path, overflow: !crumb }">
        <ChevronRight v-if="index" class="separator" :size="12" aria-hidden="true" />
        <details v-if="!crumb">
          <summary class="overflow-trigger" :aria-label="`展开 ${hidden.length} 个上级文件夹`" title="展开上级文件夹"><Ellipsis :size="16" /></summary>
            <div class="breadcrumb-menu">
              <div class="breadcrumb-menu-label">上级文件夹 · {{ hidden.length }}</div>
              <button v-for="(ancestor, ancestorIndex) in hidden" :key="ancestor.path" class="breadcrumb-menu-item" :title="ancestor.path" @click="closeMenu(); emit('select', ancestor)">
                <span class="breadcrumb-depth">{{ ancestorIndex + 2 }}</span><Folder :size="14" aria-hidden="true" /><span class="breadcrumb-menu-name">{{ ancestor.name }}</span>
              </button>
            </div>
        </details>
        <span v-else-if="crumb.path === items.at(-1)?.path" class="crumb-name" aria-current="page" :title="crumb.path">{{ crumb.name }}</span>
        <button v-else class="crumb-name" :title="crumb.path" @click="emit('select', crumb)">{{ crumb.name }}</button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.folder-breadcrumbs { min-width: 0; width: 100%; }
.folder-breadcrumbs ol { display: flex; align-items: center; gap: 4px; margin: 0; padding: 0; list-style: none; }
.folder-breadcrumbs li { display: flex; align-items: center; gap: 4px; min-width: 0; flex: 0 1 auto; }
.folder-breadcrumbs li.overflow { flex: 0 0 auto; }
.folder-breadcrumbs .separator { flex: 0 0 12px; color: #9b9298; }
.folder-breadcrumbs .crumb-name { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 6px 4px; border: 0; border-radius: 5px; background: transparent; color: #736960; font-size: 12px; line-height: 20px; text-align: left; }
.folder-breadcrumbs .current .crumb-name { color: #27242b; font-weight: 600; }
.folder-breadcrumbs button:hover, .folder-breadcrumbs summary:hover, .folder-breadcrumbs details[open] summary { background: #f0ece4; color: #27242b; }
.folder-breadcrumbs .overflow-trigger { display: grid; place-items: center; width: 28px; height: 30px; padding: 0; border: 0; border-radius: 5px; color: #736960; background: transparent; }
.folder-breadcrumbs button:focus-visible, .folder-breadcrumbs summary:focus-visible { outline: 2px solid #a43c59; outline-offset: -2px; }
.folder-breadcrumbs details { position: relative; }
.folder-breadcrumbs summary { list-style: none; cursor: pointer; }
.folder-breadcrumbs summary::-webkit-details-marker { display: none; }
.breadcrumb-menu { position: absolute; top: calc(100% + 8px); left: 0; z-index: 50; width: 260px; max-width: calc(100vw - 48px); max-height: min(360px, 50vh); overflow-y: auto; padding: 6px; border: 1px solid #d6cec2; border-radius: 8px; background: #fffdf7; color: #27242b; box-shadow: 0 8px 24px #30271e1a; scrollbar-width: thin; scrollbar-color: #b7ada0 transparent; }
.breadcrumb-menu-label { padding: 6px 8px 9px; font-size: 11px; color: #736960; }
.breadcrumb-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; min-height: 34px; padding: 7px 8px; border: 0; border-radius: 4px; background: transparent; text-align: left; color: inherit; font-size: 12px; cursor: pointer; }
.breadcrumb-menu-item svg { flex-shrink: 0; color: #87704b; }
.breadcrumb-depth { min-width: 18px; color: #736960; font-size: 10px; font-variant-numeric: tabular-nums; }
.breadcrumb-menu-name { overflow-wrap: anywhere; }
</style>
