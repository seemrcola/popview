<script setup lang="ts">
import { ArrowUpRight, LoaderCircle } from 'lucide-vue-next'

defineProps<{ busy: boolean; error: string }>()
const emit = defineEmits<{ choose: [] }>()
</script>

<template>
  <main class="welcome-screen">
    <div class="welcome-titlebar" data-tauri-drag-region aria-hidden="true" />
    <div class="welcome-brand" aria-label="PopView">Pop<span>View</span><i aria-hidden="true" /></div>
    <button class="welcome-launch" :disabled="busy" :aria-busy="busy" @click="emit('choose')">
      <svg class="welcome-art" viewBox="0 0 260 250" fill="none" aria-hidden="true">
        <ellipse cx="132" cy="219" rx="72" ry="7" fill="#e9e2d3" />
        <circle cx="130" cy="122" r="91" fill="#f4efe2" />
        <path d="M46 126V104a13 13 0 0 1 13-13h40l15 16h84a14 14 0 0 1 14 14v72a14 14 0 0 1-14 14H60a14 14 0 0 1-14-14Z" fill="#dc8d91" stroke="#34312f" stroke-width="2.5" stroke-linejoin="round" />
        <g class="print-drift">
          <g class="print print-left">
            <rect x="58" y="57" width="94" height="116" rx="7" fill="#fffcf5" stroke="#34312f" stroke-width="2" />
            <rect x="66" y="65" width="78" height="84" rx="3" fill="#b6dace" />
            <circle cx="105" cy="104" r="23" fill="#f8f0c8" />
            <circle cx="105" cy="104" r="12" fill="#e5a09f" />
            <path d="M90 159h30" stroke="#bcb5a5" stroke-width="2" stroke-linecap="round" />
          </g>
          <g class="print print-right">
            <rect x="123" y="52" width="86" height="110" rx="7" fill="#fffcf5" stroke="#34312f" stroke-width="2" />
            <rect x="131" y="60" width="70" height="78" rx="3" fill="#bfc5e7" />
            <path d="M131 111c15-34 36 22 70-11v35a3 3 0 0 1-3 3h-64a3 3 0 0 1-3-3Z" fill="#858fbf" />
            <circle cx="177" cy="81" r="11" fill="#fff0b6" />
            <path d="M154 149h24" stroke="#bcb5a5" stroke-width="2" stroke-linecap="round" />
          </g>
          <g class="print print-front">
            <rect x="88" y="74" width="96" height="116" rx="7" fill="#fffcf5" stroke="#34312f" stroke-width="2" />
            <rect x="96" y="82" width="80" height="84" rx="3" fill="#a9dbe9" />
            <circle cx="151" cy="104" r="12" fill="#fff0b6" />
            <path d="m96 146 24-25 22 22 13-13 21 19v14a3 3 0 0 1-3 3H99a3 3 0 0 1-3-3Z" fill="#72aaa0" />
            <path d="M123 177h26" stroke="#bcb5a5" stroke-width="2" stroke-linecap="round" />
          </g>
        </g>
        <g class="welcome-pocket">
          <path d="M46 133h169l-11 67a13 13 0 0 1-13 11H64a13 13 0 0 1-13-12l-8-62a4 4 0 0 1 3-4Z" fill="#f3b5b5" stroke="#34312f" stroke-width="2.5" stroke-linejoin="round" />
          <path d="M54 141h150" stroke="#ffe0d8" stroke-width="2" stroke-linecap="round" />
          <rect x="109" y="165" width="38" height="22" rx="6" fill="#fff3d4" stroke="#34312f" stroke-width="1.5" />
          <path d="M121 176h14" stroke="#766a56" stroke-width="2" stroke-linecap="round" />
        </g>
        <g class="welcome-spark" stroke="#8b7861" stroke-width="1.5" stroke-linecap="round">
          <path d="M37 62v10m-5-5h10M222 96v8m-4-4h8" />
          <circle cx="217" cy="55" r="3" fill="#efc16a" stroke="none" />
        </g>
      </svg>
      <span class="welcome-action">
        <span>{{ busy ? '打开中…' : '选择文件夹' }}</span>
        <LoaderCircle v-if="busy" class="welcome-loading" :size="18" aria-hidden="true" />
        <ArrowUpRight v-else :size="19" aria-hidden="true" />
      </span>
    </button>
    <p v-if="error" class="welcome-error" role="alert">{{ error }}</p>
  </main>
</template>

<style scoped>
.welcome-screen { height: 100dvh; min-height: 400px; padding: 32px 22px 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: auto; background: var(--surface); }
.welcome-brand { display: flex; align-items: baseline; color: #34312f; font-size: 23px; line-height: 1.2; font-weight: 750; letter-spacing: -.04em; margin-bottom: 20px; }
.welcome-brand > span { font-weight: 450; }
.welcome-brand > i { width: 6px; height: 6px; border-radius: 50%; background: #d98289; margin-left: 4px; }
.welcome-launch { display: flex; flex-direction: column; align-items: center; gap: 18px; width: 100%; max-width: 260px; padding: 0 0 6px; border: 0; background: transparent; color: #34312f; border-radius: 16px; -webkit-tap-highlight-color: transparent; }
.welcome-launch:disabled { opacity: 1; cursor: wait; }
.welcome-art { width: 100%; height: auto; overflow: visible; flex-shrink: 0; }
.welcome-action { display: flex; align-items: center; justify-content: space-between; width: 206px; max-width: 100%; min-height: 46px; padding: 0 16px; border: 1px solid var(--ink); border-radius: 5px; background: var(--yellow); color: var(--ink); font-size: 14px; font-weight: 500; transition: background 180ms ease, transform 180ms ease; }
.welcome-launch:hover:not(:disabled) .welcome-action { background: var(--accent-soft); }
.welcome-launch:active:not(:disabled) .welcome-action { transform: translateY(1px); }
.welcome-launch:focus-visible { outline: none; }
.welcome-launch:focus-visible .welcome-action { outline: 2px solid var(--accent); outline-offset: 5px; }
.print { transition: transform 420ms cubic-bezier(.22,1,.36,1); }
.print-left { transform: rotate(-13deg); transform-origin: 112px 167px; }
.print-right { transform: rotate(12deg); transform-origin: 159px 160px; }
.print-front { transform: rotate(-3deg); transform-origin: 135px 180px; }
.print-drift { animation: print-float 5s ease-in-out infinite; }
.welcome-launch:is(:hover, :focus-visible):not(:disabled) .print-left { transform: translate(-7px, -10px) rotate(-20deg); }
.welcome-launch:is(:hover, :focus-visible):not(:disabled) .print-right { transform: translate(8px, -13px) rotate(19deg); }
.welcome-launch:is(:hover, :focus-visible):not(:disabled) .print-front { transform: translateY(-17px) rotate(2deg); }
.welcome-launch:disabled .print-drift { animation-play-state: paused; }
.welcome-loading { animation: welcome-spin 1s linear infinite; }
.welcome-error { width: 100%; max-width: 360px; margin: 20px 0 0; color: #963849; font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; text-align: center; }
@keyframes print-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@keyframes welcome-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) {
  .print-drift, .welcome-loading { animation: none; }
  .print, .welcome-action { transition: none; }
  .welcome-launch:active:not(:disabled) .welcome-action { transform: none; }
  .welcome-launch:is(:hover, :focus-visible):not(:disabled) .print-left { transform: rotate(-13deg); }
  .welcome-launch:is(:hover, :focus-visible):not(:disabled) .print-right { transform: rotate(12deg); }
  .welcome-launch:is(:hover, :focus-visible):not(:disabled) .print-front { transform: rotate(-3deg); }
}
</style>
