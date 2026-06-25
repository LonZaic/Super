<template>
  <div class="home-page">
    <!-- Top bar with tabs — CodeView style -->
    <div class="topbar">
      <div class="tab-bar" v-if="store.openTabs.length">
        <div
          v-for="tab in store.openTabList"
          :key="tab.id"
          :class="['tab', { active: tab.id === store.currentId }]"
          @click="switchTab(tab.id)"
        >
          <span class="tab-title">{{ tab.title || t('newChatTab') }}</span>
          <button class="tab-close" @click.prevent.stop="closeTab(tab.id)">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="topbar-right">
        <span class="topbar-user" v-if="loggedIn">{{ userName }}</span>
      </div>
    </div>

    <!-- Empty State -->
    <div class="content" v-if="!store.currentId">
      <div class="greeting">
        <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
          <!-- Orbit ring -->
          <ellipse cx="19" cy="19" rx="16" ry="6" stroke="var(--accent)" stroke-width="1" stroke-dasharray="3 2" transform="rotate(-20 19 19)"/>
          <!-- Sun -->
          <circle cx="19" cy="19" r="5.5" fill="var(--accent)" opacity="0.1" stroke="var(--accent)" stroke-width="1.5"/>
          <circle cx="19" cy="19" r="2" fill="var(--accent)"/>
          <!-- Planet 1 -->
          <circle cx="11" cy="21" r="1.5" fill="var(--accent)" opacity="0.7"/>
          <!-- Planet 2 -->
          <circle cx="27.5" cy="16" r="1" fill="var(--accent)" opacity="0.5"/>
          <!-- Planet 3 (tiny, far) -->
          <circle cx="8" cy="10" r="0.7" fill="var(--accent)" opacity="0.35"/>
        </svg>
        <span class="greeting-text">{{ greeting }}</span>
      </div>

      <div class="hp-sections">
        <!-- 特色功能 -->
        <div class="hp-section">
          <div class="hp-section-title">{{ t('hpFeatureSection') }}</div>
          <div class="feature-grid">
            <div class="feature-card primary" @click="newChat()">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 4h12v8H6l-3 3V4z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="6.5" cy="8" r="0.8" fill="currentColor"/>
                <circle cx="9" cy="8" r="0.8" fill="currentColor"/>
                <circle cx="11.5" cy="8" r="0.8" fill="currentColor"/>
              </svg>
              <div class="feature-card-title">{{ t('hpQuickStart') }}</div>
              <div class="feature-card-desc">{{ t('hpQuickStartDesc') }}</div>
            </div>
            <div class="feature-card" @click="$router.push('/groups')">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.3"/>
                <circle cx="13" cy="4" r="2" stroke="currentColor" stroke-width="1.3"/>
                <path d="M1 14c0-2.4 2-4.5 5-4.5s5 2.1 5 4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                <path d="M12 8.5c1.8 0 3.5 1.3 3.5 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <div class="feature-card-title">{{ t('groupChatTitle') }}</div>
              <div class="feature-card-desc">{{ t('groupChatDesc') }}</div>
            </div>
            <div class="feature-card" @click="$router.push('/knowledge')">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 2v14h12V2H3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M6 6h6M6 9h6M6 12h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <div class="feature-card-title">{{ t('hpKnowledge') }}</div>
              <div class="feature-card-desc">{{ t('hpKnowledgeDesc') }}</div>
            </div>
            <div class="feature-card" @click="$router.push('/workflow')">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="2" y="3" width="5" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
                <rect x="11" y="3" width="5" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
                <rect x="6.5" y="11" width="5" height="4" rx="1" stroke="currentColor" stroke-width="1.3"/>
                <path d="M4.5 7v2a1 1 0 001 1h1M13.5 7v2a1 1 0 01-1 1h-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <div class="feature-card-title">{{ t('hpWorkflow') }}</div>
              <div class="feature-card-desc">{{ t('hpWorkflowDesc') }}</div>
            </div>
            <div class="feature-card" @click="$router.push('/novels')">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 3.5C3 3.22 3.22 3 3.5 3H8c.83 0 1.5.67 1.5 1.5V15c0-.83-.67-1.5-1.5-1.5H3.5c-.28 0-.5-.22-.5-.5V3.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                <path d="M15 3.5c0-.28-.22-.5-.5-.5H10c-.83 0-1.5.67-1.5 1.5V15c0-.83.67-1.5 1.5-1.5h4.5c.28 0 .5-.22.5-.5V3.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
              <div class="feature-card-title">{{ t('hpNovels') }}</div>
              <div class="feature-card-desc">{{ t('hpNovelsDesc') }}</div>
            </div>
            <div class="feature-card" @click="$router.push('/projects')">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 5a1 1 0 011-1h3l1.5 2H15a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
              </svg>
              <div class="feature-card-title">{{ t('hpProjects') }}</div>
              <div class="feature-card-desc">{{ t('hpProjectsDesc') }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Inline input for quick start -->
      <div class="input-wrap">
        <!-- File chips -->
        <div v-if="pendingFiles.length" class="hp-file-chips">
          <div v-for="(f, i) in pendingFiles" :key="i" class="hp-file-chip" :title="f.name">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M14 2H6C5.47 2 5 2.47 5 3V21C5 21.53 5.47 22 6 22H18C18.53 22 19 21.53 19 21V7L14 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2V7H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="hp-file-chip-name">{{ f.name }}</span>
            <button class="hp-file-chip-remove" @click="pendingFiles.splice(i, 1)">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="input-box">
          <textarea
            ref="textareaRef"
            v-model="inputText"
            :placeholder="t('askPlaceholder')"
            @keydown="onKey"
            @input="autoResize"
            @paste="onPaste"
            rows="1"
          />
          <div class="input-toolbar">
            <div class="toolbar-left">
              <input ref="fileInputRef" type="file" multiple class="hp-hidden-input" @change="onFilesSelected" />
              <button class="tool-btn" :title="t('addFile')" @click="fileInputRef?.click()">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              </button>
              <button :class="['tool-btn bordered', { active: thinking === 'on' }]" @click="cycleThinking">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M6.5 3v3.5L9 8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                {{ thinkingLabel }}
              </button>
              <button :class="['tool-btn bordered', { active: computerMode }]" @click="computerMode = !computerMode" :title="t('manageComputer')">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 21h8M12 17v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                {{ t('manageComputer') }}
                <span v-if="computerMode" class="hp-pc-dot"></span>
              </button>
            </div>
            <div class="toolbar-right">
              <button class="model-selector" @click="cycleModel">
                <span class="model-dot" />
                {{ modelLabel }}
              </button>
              <button class="send-btn" @click="quickStart()" :disabled="!inputText.trim() && !pendingFiles.length">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1v12M3 5l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Chat View (when a tab is open) -->
    <ChatView v-else :key="store.currentId" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, inject } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '../store/chatStore.js'
import { isLoggedIn } from '../api/index.js'
import { useI18n } from '../composables/useI18n.js'
import ChatView from './ChatView.vue'
import TokenBar from '../components/common/TokenBar.vue'
import { computerMode } from '../stores/computerModeStore.js'
import { setConversationProject } from '../db/database.js'

const router = useRouter()
const route = useRoute()
const store = useChatStore()
const { t } = useI18n()
const openSettings = inject('openSettings')

const inputText = ref('')
const textareaRef = ref(null)
const fileInputRef = ref(null)
const pendingFiles = ref([])
const loggedIn = ref(isLoggedIn())
const thinking = ref('on')

const userName = computed(() => {
  try { return JSON.parse(localStorage.getItem('bbot_user')).name } catch { return '' }
})

const greeting = computed(() => {
  const h = new Date().getHours()
  const key = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const name = userName.value
  return name ? `${t(key)}, ${name}` : t(key)
})

const thinkingLabel = computed(() => thinking.value === 'off' ? t('thinkOff') : t('thinkOn'))
const modelLabel = computed(() => store.model.includes('pro') ? t('v4pro') : t('v4flash'))

function cycleThinking() {
  thinking.value = thinking.value === 'off' ? 'on' : 'off'
}
function cycleModel() {
  store.setModel(store.model.includes('flash') ? 'deepseek-v4-pro' : 'deepseek-v4-flash')
}

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    if (!inputText.value.trim() && !pendingFiles.value.length) return
    e.preventDefault(); quickStart()
  }
}
function autoResize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 160) + 'px'
}

// ═══ File handling ═══
function onPaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  const files = []
  for (const item of items) {
    if (item.kind === 'file') files.push(item.getAsFile())
  }
  if (files.length) {
    e.preventDefault()
    processFiles(files)
  }
}
async function onFilesSelected(e) {
  if (e.target.files?.length) {
    processFiles(Array.from(e.target.files))
    e.target.value = ''
  }
}
async function processFiles(files) {
  for (const f of files) {
    let content = ''
    const isText = ['txt','js','ts','py','html','css','json','xml','md','yml','yaml','sh','bat','c','cpp','h','java','go','rs','rb','php','sql','csv','log','ini','cfg','toml','vue','svelte','less','scss','env','gitignore'].includes((f.name.split('.').pop()||'').toLowerCase())
    if (f.type?.startsWith('image/')) {
      content = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(f) })
    } else if (isText) {
      content = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsText(f) })
    } else {
      // Try extractFile for docx/pdf/etc — import dynamically
      try {
        const { extractFileContent } = await import('../utils/extractFile.js')
        content = await extractFileContent(f) || ''
      } catch { content = '' }
    }
    pendingFiles.value = [...pendingFiles.value, { name: f.name, type: f.type, size: f.size, content }]
  }
}
function removeFile(i) { pendingFiles.value.splice(i, 1) }

async function quickStart() {
  const text = inputText.value.trim()
  const hasFiles = pendingFiles.value.length > 0
  if (!text && !hasFiles) return
  try {
    inputText.value = ''
    const files = pendingFiles.value.map(f => ({ name: f.name, type: f.type, size: f.size, content: f.content || '' }))
    pendingFiles.value = []
    const id = 'conv_' + Date.now()
    await store.createConversation(id)
    await store.addUserMessage(text || t('fileText'), files)
    // 必须在 addUserMessage 之后设置——确保 ChatView 检测时消息已入库
    store._pendingAutoReply = id
    router.push('/chat/' + id)
  } catch (e) {
    store._pendingAutoReply = null
    alert(t('sendFail').replace('{msg}', e.message || t('unknownError')))
    inputText.value = text
  }
}

async function newChat() {
  const id = 'conv_' + Date.now()
  await store.createConversation(id)
  router.push('/chat/' + id)
}

function switchTab(id) { store.switchTab(id); router.push('/chat/' + id) }
function closeTab(id) {
  store.closeTab(id)
  // Store already switched currentId — sync the route
  if (store.currentId) {
    router.push('/chat/' + store.currentId)
  } else {
    router.push('/')
  }
}

async function openFeature(type) {
  const id = 'conv_' + Date.now()
  await store.createConversation(id)
  const prompts = {
    design: 'Create a modern landing page with HTML/CSS',
    code: 'Write a Python script that fetches and parses JSON from an API',
  }
  const text = prompts[type] || ''
  if (text) await store.addUserMessage(text, [])
  store._pendingAutoReply = id
  router.push('/chat/' + id)
}

// Sync URL param → store tab
async function syncRoute() {
  const id = route.params.id
  if (!id) return
  // Guard: don't reload messages during pending auto-reply (quickStart flow)
  if (store._pendingAutoReply === id) {
    store.switchTab(id)
    return
  }
  // Load messages if not in cache (after refresh, session restores currentId but messagesMap is empty)
  if (!store.messagesMap[id] || !store.messagesMap[id].length) {
    await store.loadMessages(id)
  } else if (id !== store.currentId) {
    store.switchTab(id)
  }
}

watch(() => route.params.id, (id) => {
  if (id) {
    // Guard: don't reload messages during pending auto-reply (quickStart flow)
    if (store._pendingAutoReply === id) {
      store.switchTab(id)
      return
    }
    if (!store.messagesMap[id] || !store.messagesMap[id].length) store.loadMessages(id)
    else store.switchTab(id)
  }
})

onMounted(async () => {
  store.loadApiKey()
  await store.loadConversations()
  await store._restoreSession()
  loggedIn.value = isLoggedIn()
  await syncRoute()
  // Handle ?project=ID — create a new conversation assigned to this project
  const projectId = route.query.project
  if (projectId) {
    const id = 'conv_' + Date.now()
    await store.createConversation(id)
    setConversationProject(id, String(projectId))
    router.replace('/chat/' + id)
  }
})
</script>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

/* Top bar with tabs */
.topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 4px 8px 0;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  gap: 8px;
}

.tab-bar {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
}
.tab-bar::-webkit-scrollbar { height: 2px; }

.tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px 5px;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  font-size: 12px;
  color: var(--text3);
  font-weight: 300;
  white-space: nowrap;
  transition: all .12s;
  flex-shrink: 0;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  font-family: inherit;
}
.tab:hover { background: var(--bg3); color: var(--text2); }
.tab.active { background: var(--bg); color: var(--text); border-color: var(--border); }

.tab-title { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px; height: 14px;
  border-radius: 3px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity .12s, background .12s, color .12s;
}
.tab:hover .tab-close { opacity: 1; }
.tab-close:hover { background: var(--bg4); color: var(--red); }

.topbar-right { display: flex; align-items: center; gap: 8px; }
.topbar-user { font-size: 13px; color: var(--text2); font-weight: 300; }

/* Content area */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
}

.greeting {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 40px;
  animation: fadeUp .5s ease both;
}
.greeting-text {
  font-size: 38px;
  font-weight: 300;
  letter-spacing: -1px;
  color: var(--text);
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  width: 100%;
  max-width: 680px;
  margin-bottom: 24px;
  animation: fadeUp .5s .1s ease both;
}
.feature-grid.small {
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
  margin-bottom: 0;
}

.hp-sections {
  width: 100%;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 28px;
}
.hp-section { display: flex; flex-direction: column; gap: 8px; }
.hp-section-title {
  font-size: 11px;
  font-weight: 400;
  color: var(--text3);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding-left: 2px;
}

.feature-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  cursor: pointer;
  transition: background .15s, border-color .15s, transform .1s;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.feature-card:hover { background: var(--bg3); border-color: var(--border2); transform: translateY(-1px); }
.feature-card:active { transform: translateY(0); }
.feature-card.primary {
  background: var(--accent-muted, rgba(0,0,0,0.03));
  border-color: var(--accent);
}
.feature-card.primary:hover { background: var(--accent-hover, var(--bg3)); }
.feature-card.primary .feature-card-title { color: var(--accent); }
.feature-card.mini { padding: 10px 12px; gap: 4px; }
.feature-card.mini .feature-card-title { font-size: 12px; }
.feature-card.mini .feature-card-desc { font-size: 11px; -webkit-line-clamp: 2; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.feature-card-icon { color: var(--text2); }
.feature-card-title { font-size: 13px; font-weight: 500; color: var(--text); }
.feature-card-desc { font-size: 12px; color: var(--text3); line-height: 1.5; font-weight: 300; }

/* Input */
/* File chips */
.hp-file-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 8px; }
.hp-file-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px; background: var(--bg2); border: 1px solid var(--border);
  border-radius: 10px; font-size: 11px; color: var(--text2); max-width: 200px;
}
.hp-file-chip svg { flex-shrink: 0; color: var(--text-muted); }
.hp-file-chip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hp-file-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; border-radius: 50%; border: none; background: transparent;
  color: var(--text3); flex-shrink: 0; cursor: pointer; transition: all .12s;
}
.hp-file-chip-remove:hover { background: rgba(248,81,73,0.12); color: var(--red); }
.hp-hidden-input { display: none; }

.tool-btn.bordered {
  border: 1px solid var(--border); border-radius: var(--radius-full);
  padding: 4px 10px; gap: 5px;
}
.tool-btn.bordered:hover { border-color: var(--border2); }
.tool-btn.bordered.active { border-color: var(--accent); color: var(--accent); background: var(--accent-muted); }

.hp-pc-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: var(--green); animation: hpPcPulse 1.5s ease-in-out infinite;
  display: inline-block;
}
@keyframes hpPcPulse { 0%,100%{opacity:1} 50%{opacity:.4} }

.input-wrap {
  width: 100%;
  max-width: 680px;
  flex-shrink: 0;
  animation: fadeUp .5s .18s ease both;
}

.input-box {
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-radius: var(--radius-lg);
  padding: 14px 16px 10px;
}

.input-box textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text);
  font-size: 15px;
  font-family: inherit;
  font-weight: 300;
  resize: none;
  line-height: 1.6;
  min-height: 28px;
  max-height: 160px;
}
.input-box textarea::placeholder { color: var(--text3); }

.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 6px;
}

.toolbar-left { display: flex; align-items: center; gap: 4px; }

.tool-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  font-weight: 300;
  transition: background .12s, color .12s;
}
.tool-btn:hover { background: var(--bg3); color: var(--text2); }
.tool-btn.active { color: var(--accent); }

.toolbar-right { display: flex; align-items: center; gap: 8px; }

.model-selector {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  font-weight: 300;
  transition: background .12s;
}
.model-selector:hover { background: var(--bg3); color: var(--text2); }

.model-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--accent);
}

.send-btn {
  width: 32px; height: 32px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background .15s, transform .1s;
}
.send-btn:hover { background: var(--accent-hover); }
.send-btn:active { transform: scale(.95); }
.send-btn:disabled { background: var(--bg4); color: var(--text3); cursor: not-allowed; }

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
