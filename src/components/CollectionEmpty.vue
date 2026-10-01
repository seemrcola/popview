<script setup lang="ts">
import { computed } from 'vue'
import { CircleAlert, Image, LoaderCircle, Search } from 'lucide-vue-next'
import FolderIcon from './FolderIcon.vue'

const props = defineProps<{ query?: string; loading?: boolean; error?: string; compact?: boolean }>()
const state = computed(() => props.loading ? 'loading' : props.error ? 'error' : props.query?.trim() ? 'search' : 'empty')
const label = computed(() => ({ loading: '加载中…', error: '读取失败', search: '没有匹配的图片', empty: '暂无可浏览的图片' })[state.value])
</script>

<template>
  <div class="collection-empty" :class="[{ compact }, state]">
    <div class="empty-symbol" aria-hidden="true">
      <div class="empty-art">
        <FolderIcon open>
          <div class="empty-photo"><Image :size="25" :stroke-width="1.5" /></div>
        </FolderIcon>
        <span v-if="state !== 'empty'" class="empty-badge">
          <Search v-if="state === 'search'" :size="24" :stroke-width="1.8" />
          <CircleAlert v-else-if="state === 'error'" :size="23" :stroke-width="1.8" />
          <LoaderCircle v-else class="empty-loader" :size="23" :stroke-width="1.8" />
        </span>
      </div>
    </div>
    <p class="empty-label" :role="state === 'error' ? 'alert' : 'status'">{{ label }}</p>
  </div>
</template>

<style scoped>
.collection-empty { min-height: 0; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 32px 24px; overflow-y: auto; text-align: center; animation: empty-arrive 180ms var(--ease-out); }
.empty-symbol { width: 104px; height: 96px; flex-shrink: 0; cursor: default; }
.empty-art { position: relative; width: 104px; height: 96px; transition: transform var(--motion-settle) var(--ease-spring); }
.empty-photo { position: absolute; z-index: 1; left: 33px; top: 18px; width: 40px; height: 45px; display: grid; place-items: center; border: 1px solid #c2d8dd; border-radius: 5px; background: #fffdf8; color: #72978c; transform: rotate(-7deg); transform-origin: 50% 90%; transition: transform var(--motion-settle) var(--ease-spring); }
.empty-badge { position: absolute; z-index: 3; right: -2px; bottom: 1px; width: 36px; height: 36px; display: grid; place-items: center; border: 3px solid var(--surface); border-radius: 50%; background: var(--mint); color: #3f6356; transition: transform var(--motion-settle) var(--ease-spring); }
.error .empty-badge { background: #fbe9eb; color: #963849; }
.loading .empty-badge { background: var(--surface-subtle); color: var(--ink-muted); }
.empty-label { margin: 0; color: var(--ink-muted); font-size: 13px; line-height: 1.6; }
@media (hover: hover) and (pointer: fine) {
  .empty-symbol:hover { --folder-tilt: -12deg; }
  .empty-symbol:hover .empty-photo { transform: translateY(-7px) rotate(3deg); }
  .empty-symbol:hover .empty-badge { transform: translate(2px, -3px) rotate(-9deg); }
}
.empty-symbol:active .empty-art { transform: scale(.96, .93); transition-duration: 80ms; }
.compact { flex: none; flex-direction: row; justify-content: flex-start; gap: 12px; padding: 0 0 20px; }
.compact .empty-symbol { width: 52px; height: 48px; }
.compact .empty-art { zoom: .5; }
.empty-loader { animation: empty-spin 1s linear infinite; }
@keyframes empty-spin { to { transform: rotate(360deg); } }
@keyframes empty-arrive { from { opacity: .6; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .collection-empty, .empty-loader { animation: none; }
  .empty-art, .empty-photo, .empty-badge { transition: none; }
  .empty-symbol:hover .empty-photo { transform: rotate(-7deg); }
  .empty-symbol:hover .empty-badge, .empty-symbol:active .empty-art { transform: none; }
}
</style>
