<script setup lang="ts">
import { useId } from 'vue'

withDefaults(defineProps<{ open?: boolean }>(), { open: false })
const id = useId()
</script>

<template>
  <span class="folder-icon" aria-hidden="true">
    <svg class="folder-back" viewBox="0 0 160 144" fill="none" focusable="false">
      <defs>
        <linearGradient :id="`${id}-back`" x1="80" y1="16" x2="80" y2="131" gradientUnits="userSpaceOnUse">
          <stop stop-color="#69CAF3" /><stop offset="1" stop-color="#318ED0" />
        </linearGradient>
      </defs>
      <path d="M13 25a9 9 0 0 1 9-9h32a12 12 0 0 1 9 4l7 8h68a9 9 0 0 1 9 9v84a10 10 0 0 1-10 10H23a10 10 0 0 1-10-10Z"
        :fill="`url(#${id}-back)`" stroke="#318FC6" stroke-width=".8" />
      <path d="M22 17h32a11 11 0 0 1 8 4l7 8h69" stroke="#C3EEFF" stroke-opacity=".65" />
    </svg>
    <slot />
    <svg class="folder-front" viewBox="0 0 160 144" fill="none" focusable="false">
      <defs>
        <linearGradient :id="`${id}-front`" x1="80" :y1="open ? 84 : 44" x2="80" y2="132" gradientUnits="userSpaceOnUse">
          <stop stop-color="#91DDFB" /><stop offset=".42" stop-color="#66C6F3" /><stop offset="1" stop-color="#409FE0" />
        </linearGradient>
      </defs>
      <path :d="open ? 'M17 84h126a7 7 0 0 1 7 8l-4 31a10 10 0 0 1-10 9H24a10 10 0 0 1-10-9l-4-31a7 7 0 0 1 7-8Z' : 'M18 44h124a8 8 0 0 1 8 9l-4 70a10 10 0 0 1-10 9H24a10 10 0 0 1-10-9l-4-70a8 8 0 0 1 8-9Z'"
        :fill="`url(#${id}-front)`" stroke="#3A9AD5" stroke-width=".8" />
      <path :d="open ? 'M18 85h124' : 'M19 45h122'" stroke="#DBF5FF" stroke-opacity=".85" stroke-linecap="round" />
      <path d="M25 130h110" stroke="#2789CC" stroke-opacity=".3" stroke-linecap="round" />
    </svg>
  </span>
</template>

<style scoped>
.folder-icon { position: relative; display: block; width: 100%; height: 100%; isolation: isolate; filter: drop-shadow(var(--folder-shadow, 0 4px 3px #236c9626)); transition: filter 240ms cubic-bezier(.22, 1, .36, 1); }
.folder-back, .folder-front { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.folder-back { z-index: 0; }
.folder-front { z-index: 2; transform-origin: 50% 92%; transform: perspective(500px) rotateX(var(--folder-tilt, 0deg)); transition: transform var(--motion-settle) var(--ease-spring); }
@media (prefers-reduced-motion: reduce) {
  .folder-icon, .folder-front { transition: none; }
  .folder-front { transform: none; }
}
</style>
