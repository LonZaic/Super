import { createApp } from 'vue'
import { createPinia } from 'pinia'
// ─── CSS Architecture: design tokens first, then legacy styles ───
import './assets/styles/variables.css'
import './assets/styles/reset.css'
import './assets/styles/theme-dark.css'
import './assets/styles/theme-light.css'
import './assets/styles/animations.css'
import './style.css'
// ─── Media renderer (SVG/Mermaid) — must load before app mounts ───
import './utils/mediaRenderer.js'
// ─── SVG stroke animator — stroke-by-stroke drawing animation ───
import './utils/svgAnimator.js'
// ─── Router & App ───
import router from './router/index.js'
import App from './App.vue'
// ─── Database ───
import { initDB } from './db/database.js'
import { vDebounce } from './directives/index.js'

// Create Vue instance
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.directive('debounce', vDebounce)

// Initialize settings (theme, API key) after pinia is ready
import { useSettingsStore } from './stores/settingsStore.js'
import { useChatStore } from './store/chatStore.js'
const settingsStore = useSettingsStore()
settingsStore.init()

// Global error handler — show errors on screen instead of white screen
app.config.errorHandler = (err, vm, info) => {
  const comp = vm?.$options?.name || vm?.$options?.__name || vm?.$el?.tagName || '?'
  const msg = `[${comp}] ${err.message || err} (${info})`
  console.error('[Vue Error]', comp, info, err)
  const el = document.getElementById('app')
  if (el) {
    // Clear old error banners that look identical (from before HMR fix)
    const prev = el.querySelectorAll('.vue-err-banner')
    if (prev.length > 2) prev.forEach(p => p.remove())
    const div = document.createElement('div')
    div.className = 'vue-err-banner'
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;padding:10px 16px;z-index:99999;font-family:monospace;font-size:12px;white-space:pre-wrap;'
    div.textContent = msg
    el.appendChild(div)
  }
}

// ─── Auto local-auth on startup — ensures token matches default user (lzl) ───
async function ensureAuth() {
  try {
    const { localAuth } = await import('./api/index.js')
    await localAuth.login()
  } catch (e) {
    console.warn('[Auth] Local auto-login failed:', e.message)
  }
}

// Mount app
// Always init client-side sql.js — needed for agent conversations persistence
const token = localStorage.getItem('bbot_token')
await initDB().catch(err => {
  console.error('DB init failed:', err)
})
await ensureAuth()
app.mount('#app')

// Ensure session state is persisted on page close/refresh
window.addEventListener('beforeunload', () => {
  try {
    const store = useChatStore()
    store._saveSession()
  } catch {}
})
