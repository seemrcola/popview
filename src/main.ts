import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { isTauri } from '@tauri-apps/api/core'

if (isTauri() && /Mac/.test(navigator.platform)) {
  document.documentElement.classList.add('macos-overlay')
}

createApp(App).mount('#app')
