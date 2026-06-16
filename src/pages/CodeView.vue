<template>
  <div class="cv-root" ref="rootRef">
    <!-- ═══ Code Area (center) ═══ -->
    <div class="cv-main">
      <div v-if="!store.projectPath" class="cv-empty">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <rect x="4" y="4" width="32" height="28" rx="4" stroke="var(--accent)" stroke-width="1.5"/>
          <path d="M14 18l4 4 8-8" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="cv-empty-title">{{ t('codeEmptyTitle') }}</span>
        <span class="cv-empty-desc">{{ t('codeEmptyDesc') }}</span>
        <div class="cv-empty-actions">
          <button class="cv-act-btn" @click="openProjectQuick">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3h3.8L7 4.5H12V11H2V3z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            {{ t('codeOpenProject') }}
          </button>
          <button class="cv-act-btn" @click="showNewProject = true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            {{ t('codeNewProject') }}
          </button>
        </div>
      </div>

      <template v-else>
        <div class="cv-tabs" v-if="store.openFiles.length">
          <div v-for="f in store.openFiles" :key="f.path"
            :class="['cv-tab', { active: f.path === store.activeFilePath, deleted: f._deleted }]"
            @click="store.activeFilePath = f.path">
            <span class="cv-tab-name">{{ f.name }}</span>
            <button class="cv-tab-close" @click.prevent.stop="store.closeFile(f.path)">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>

        <div class="cv-code" v-if="activeFile">
          <div class="cv-code-inner" ref="codeRef">
            <div v-for="(line, i) in displayLines" :key="i" class="cv-line"
              :class="{ 'cv-line-del': line._deleted, 'cv-line-add': line._added }">
              <span class="cv-line-num">{{ line._num }}</span>
              <span class="cv-line-code" v-html="line._html || escHtml(line.text || '')"></span>
              <!-- Per-diff accept/reject inline -->
              <div v-if="line._diffActions" class="cv-diff-inline-actions">
                <button class="cv-diff-btn accept" @click="acceptDiffIdx(line._diffIdx)" :title="t('codeAcceptAll')">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 5.5L4 7.5 9 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button class="cv-diff-btn reject" @click="rejectDiffIdx(line._diffIdx)" :title="t('codeRejectAll')">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M3 3l5 5M8 3l-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="cv-code-empty">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" opacity=".3">
            <path d="M5 3h9l5 5v13H5V3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M14 3v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          <span>{{ t('codeSelectFile') }}</span>
        </div>
      </template>
    </div>

    <!-- ═══ Resize handle ═══ -->
    <div class="cv-resize-handle" @mousedown="startResize('chat', $event)" v-if="store.projectPath"></div>

    <!-- ═══ AI Chat (right) ═══ -->
    <div class="cv-chat" v-if="store.projectPath" :style="{ width: chatWidth + 'px' }">
      <div class="cv-chat-top">
        <div class="cv-chat-tabs" v-if="store.openTabs.length">
          <div v-for="tab in store.openTabList" :key="tab.id"
            :class="['cv-ctab', { active: tab.id === store.currentId }]"
            @click="store.switchTab(tab.id)">
            <span class="cv-ctab-title">{{ tab.title }}</span>
            <button class="cv-ctab-close" @click.prevent.stop="store.closeTab(tab.id)">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 2l5 5M7 2l-5 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="cv-chat-acts">
          <button class="cv-chat-act" @click="newCodeConv" title="新对话">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1v11M1 6.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <button class="cv-chat-act" @click="showSwitch = true" title="切换项目">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h5.5L8.5 5H11v5.5H2V3.5z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>

      <!-- ═══ Messages — compact 3-line output ═══ -->
      <div class="cv-chat-msgs" ref="chatRef" @scroll="onChatScroll">
        <template v-for="m in store.messages" :key="m._id || m.id">
          <template v-if="!m._isRoundMarker">
            <!-- User message -->
            <div v-if="m.role === 'user'" class="cv-msg cv-msg-user">
              <div class="cv-bubble cv-bubble-user">{{ m.text }}</div>
            </div>
            <!-- AI message: compact -->
            <template v-else>
              <CodeAgentCompact
                :message="m"
                :yammy-active="yammy.msgId === (m._id || m.id)"
                :yammy-playing="yammy.playing"
                :yammy-shaking="yammy.shaking"
                @yammy-click="onYammyClick"
              />
              <!-- Final report — always visible when AI is done -->
              <div v-if="m._done && m.text" class="cv-report">
                <div class="cv-report-text markdown-body" v-html="m.html || renderMd(m.text)"></div>
              </div>
            </template>
          </template>
        </template>
        <div v-if="!store.messages.filter(m => !m._isRoundMarker).length && store.currentId" class="cv-chat-hint">
          {{ t('codeChatHint') }}
        </div>
      </div>

      <TokenBar :promptTokens="tokPrompt" :completionTokens="tokComp" :totalTokens="tokTotal" :model="codeModel" :balance="balance" @refresh-balance="fetchBalance" />
      <div class="cv-chat-bar">
        <!-- Image chips (code mode — images only) -->
        <div v-if="pendingImages.length" class="cv-img-chips">
          <div class="cv-img-chip">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span class="cv-img-chip-text">图片 数量: {{ pendingImages.length }}</span>
            <button class="cv-img-chip-remove" @click="pendingImages = []">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
        </div>
        <div class="cv-chat-row">
          <textarea ref="inputRef" v-model="task" :placeholder="t('codePlaceholder')" :rows="1"
            @keydown="onKey" @input="autoResize" @paste="onPasteImages" class="cv-input" />
          <input ref="imgInputRef" type="file" accept="image/*" multiple class="cv-hidden-input" @change="onImagesSelected" />
          <button class="cv-img-btn" title="添加图片" @click="imgInputRef?.click()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="cv-model-wrap">
            <button class="cv-model-btn" @click="showModelMenu = !showModelMenu">
              <span class="cv-model-dot" :class="{ pro: (codeModel || '').includes('pro') }"></span>
            </button>
            <Transition name="hist-pop">
              <div v-if="showModelMenu" class="cv-model-menu">
                <button :class="['cv-model-opt', { active: codeModel === 'deepseek-v4-pro' }]" @click="pickModel('deepseek-v4-pro')">
                  <span class="cv-model-dot pro"></span>V4-Pro
                </button>
                <button :class="['cv-model-opt', { active: codeModel === 'deepseek-v4-flash' }]" @click="pickModel('deepseek-v4-flash')">
                  <span class="cv-model-dot"></span>V4-Flash
                </button>
              </div>
            </Transition>
          </div>
          <button v-if="loading" class="cv-pause" @click="togglePause" :title="paused ? '恢复' : '暂停'">
            <svg v-if="!paused" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2" y="2" width="3" height="8" rx="1" fill="currentColor"/>
              <rect x="7" y="2" width="3" height="8" rx="1" fill="currentColor"/>
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M3 2l8 4-8 4V2z" fill="currentColor"/>
            </svg>
          </button>
          <button class="cv-send" :class="{ off: !task.trim() }" :disabled="!task.trim()" @click="send">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1.5 1.5l11 5.5-11 5.5 3-5.5-3-5.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Modals unchanged -->
    <div v-if="showOpenProject" class="cv-modal-overlay" @click.self="showOpenProject = false">
      <div class="cv-modal">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 4h4L8.3 5.5H13V12H3V4z" stroke="var(--accent)" stroke-width="1.2" stroke-linejoin="round"/></svg>
          <span>{{ t('codeOpenProject') }}</span>
          <button class="cv-modal-close" @click="showOpenProject = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="cv-modal-body">
          <div class="cv-field">
            <label class="cv-label">{{ t('codeProjectPath') || '项目路径' }}</label>
            <input v-model="openProjectPath" class="cv-field-input" placeholder="E:\MyProject" @keydown.enter="confirmOpenProject" />
          </div>
          <div class="cv-field-hint">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="var(--text3)" stroke-width="1"/><path d="M6 3.5v2.5M6 8.5v.01" stroke="var(--text3)" stroke-width="1.2" stroke-linecap="round"/></svg>
            {{ t('codeInputPath') }}
          </div>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showOpenProject = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" :disabled="!openProjectPath.trim()" @click="confirmOpenProject">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 6.5l1.5 1.5L10 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            确认
          </button>
        </div>
      </div>
    </div>

    <div v-if="showConfirmTakeover" class="cv-modal-overlay">
      <div class="cv-modal" style="width:380px">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--accent)" stroke-width="1.2"/><path d="M8 5v3.5M8 11v.01" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round"/></svg>
          <span>SuperDS</span>
        </div>
        <div class="cv-modal-body">
          <p class="cv-confirm-text">{{ t('codeTakeover') }}</p>
          <p class="cv-confirm-sub">{{ t('codeTakeoverSub') }}</p>
          <p class="cv-confirm-path">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h3L6 4h4v5.5H2V3z" stroke="var(--text3)" stroke-width="1" stroke-linejoin="round"/></svg>
            {{ takeoverPath }}
          </p>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showConfirmTakeover = false">{{ t('codeReject') }}</button>
          <button class="cv-modal-btn ok" @click="confirmTakeover">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5L5 9l5.5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            同意
          </button>
        </div>
      </div>
    </div>

    <div v-if="showNewProject" class="cv-modal-overlay" @click.self="showNewProject = false">
      <div class="cv-modal">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M7 1v14M1 7h14" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>{{ t('codeNewProject') }}</span>
          <button class="cv-modal-close" @click="showNewProject = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="cv-modal-body">
          <div class="cv-field">
            <label class="cv-label">{{ t('codeProjectName') }}</label>
            <input v-model="newProjectName" class="cv-field-input" :placeholder="t('codeProjectNameHint') || '输入项目名称...'" @keydown.enter="confirmNewProject" />
          </div>
          <div class="cv-field">
            <label class="cv-label">{{ t('codeParentDir') }}</label>
            <input v-model="newProjectParent" class="cv-field-input" :placeholder="t('codeParentDirHint') || '如 E:\\'" />
          </div>
          <div class="cv-field-hint">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v6M6 10v.01" stroke="var(--text3)" stroke-width="1.2" stroke-linecap="round"/></svg>
            将在 {{ previewPath }} 创建项目文件夹
          </div>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showNewProject = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" :disabled="!newProjectName.trim()" @click="confirmNewProject">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 6.5L5 9l5.5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            创建
          </button>
        </div>
      </div>
    </div>

    <div v-if="showSwitch" class="cv-modal-overlay" @click.self="showSwitch = false">
      <div class="cv-modal" style="width:360px">
        <div class="cv-modal-hdr">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="var(--accent)" stroke-width="1.2"/><path d="M8 5v3.5M8 11v.01" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round"/></svg>
          <span>{{ t('codeSwitchProj') }}</span>
        </div>
        <div class="cv-modal-body" style="text-align:center">
          <p class="cv-confirm-text">{{ t('codeOneProject') }}</p>
          <p class="cv-confirm-sub" style="margin-bottom:0">{{ t('codeSwitchSub') }}</p>
        </div>
        <div class="cv-modal-ft">
          <button class="cv-modal-btn cancel" @click="showSwitch = false">{{ t('codeCancel') }}</button>
          <button class="cv-modal-btn ok" @click="doSwitchProject">{{ t('codeConfirmSwitch') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useCodeStore } from '../stores/codeStore.js'
import { renderMarkdown, reinitMermaid } from '../utils/markdown.js'
import { scanFileTree, readFileContent, newProject, runCodeAgent } from '../api/code.api.js'
import { BASE_URL } from '../api/client.js'
import { getApiHeaders } from '../utils/apiHeaders.js'
import { useI18n } from '../composables/useI18n.js'
import { createCompactState, mutateCompactState } from '../utils/codeCompact.js'
import CodeAgentCompact from '../components/code/CodeAgentCompact.vue'
import TokenBar from '../components/common/TokenBar.vue'
import hljs from 'highlight.js'
window.hljs = hljs

const { t } = useI18n()
const store = useCodeStore()
const renderMd = (text) => renderMarkdown(text || '')
const task = ref('')
const inputRef = ref(null)
const imgInputRef = ref(null)
const pendingImages = ref([]) // { name, type, size, key, data, content }
const codeRef = ref(null)
const chatRef = ref(null)
const rootRef = ref(null)
const showOpenProject = ref(false)
const openProjectPath = ref('')
const showConfirmTakeover = ref(false)
const takeoverPath = ref('')
const showNewProject = ref(false)
const newProjectName = ref('')
const newProjectParent = ref('E:\\')
const loading = ref(false)
const paused = ref(false)
const tokPrompt = ref(0)
const tokComp = ref(0)
const tokTotal = ref(0)
const balance = ref(null)
const codeModel = ref(localStorage.getItem('code_model') || 'deepseek-v4-pro')
const showModelMenu = ref(false)
let _isCreatingProject = false

// ═══ TokenBar persistence ═══
const TOKEN_KEY = 'ds_code_tokens'
function saveCodeTokens() {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify({
      prompt: tokPrompt.value, comp: tokComp.value, total: tokTotal.value, ts: Date.now()
    }))
  } catch {}
}
function loadCodeTokens() {
  try {
    const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null')
    if (saved) {
      tokPrompt.value = saved.prompt || 0
      tokComp.value = saved.comp || 0
      tokTotal.value = saved.total || 0
    }
  } catch {}
}
watch([tokPrompt, tokComp, tokTotal], () => { saveCodeTokens() })

function pickModel(m) {
  codeModel.value = m
  showModelMenu.value = false
  try { localStorage.setItem('code_model', m) } catch {}
}

async function togglePause() {
  paused.value = !paused.value
  const endpoint = paused.value ? '/api/code/pause' : '/api/code/resume'
  try {
    await fetch(`${BASE_URL}${endpoint}`, { method: 'POST', headers: getApiHeaders({}) })
  } catch {}
}

const previewPath = computed(() => {
  const base = newProjectParent.value.replace(/\\$/, '')
  const name = newProjectName.value.trim() || 'NewProject'
  return base + '\\' + name
})

// ─── Chat panel width ───
const chatWidth = ref(360)
let _resizeStartX = 0
let _resizeStartW = 0

function startResize(target, e) {
  _resizeStartX = e.clientX
  _resizeStartW = chatWidth.value
  document.addEventListener("mousemove", onResize)
  document.addEventListener("mouseup", stopResize)
  document.body.style.cursor = "col-resize"
  document.body.style.userSelect = "none"
}

function onResize(e) {
  chatWidth.value = Math.max(280, Math.min(600, _resizeStartW + (_resizeStartX - e.clientX)))
}

function stopResize() {
  document.removeEventListener("mousemove", onResize)
  document.removeEventListener("mouseup", stopResize)
  document.body.style.cursor = ""
  document.body.style.userSelect = ""
  localStorage.setItem("code_chat_width", chatWidth.value)
}

try {
  const saved = localStorage.getItem("code_chat_width")
  if (saved) chatWidth.value = parseInt(saved) || 360
} catch {}

// ─── Yammy mascot state (mirrors ChatView pattern) ───
const yammy = reactive({
  msgId: null,
  playing: false,
  clickCount: 0,
  shaking: false,
  _playTimer: null,
})

function onYammyClick() {
  if (!yammy.msgId) return
  yammy.clickCount++
  if (yammy.clickCount >= 10) {
    yammy.shaking = true
    yammy.clickCount = 0
    setTimeout(() => { yammy.shaking = false }, 600)
    return
  }
  yammy.playing = true
  clearTimeout(yammy._playTimer)
  yammy._playTimer = setTimeout(() => { yammy.playing = false }, 1800)
}
const activeFile = computed(() =>
  store.openFiles.find(f => f.path === store.activeFilePath)
)

// ─── Syntax-highlighted display lines with correct diff coloring ───
const displayLines = computed(() => {
  const f = activeFile.value
  if (!f) return []
  const content = f.content || ''
  // If file is deleted, show all lines as deleted
  if (f._deleted) {
    return content.split('\n').map((text, i) => ({
      text, _num: i + 1, _deleted: true, _added: false, _html: escHtml(text)
    }))
  }

  const filePath = f.path
  const fileDiffs = store.pendingDiffs.filter(d => d.filePath === filePath)
  const lines = content.split('\n')

  // Build a map: line index → diff info
  // For each diff, mark old range as deleted, new range as added
  const diffMarkers = new Map() // lineIndex → { deleted, added, diffIdx }

  for (let di = 0; di < fileDiffs.length; di++) {
    const diff = fileDiffs[di]
    const oldLines = (diff.oldCode || '').split('\n')
    const newLines = (diff.newCode || '').split('\n')
    const start = Math.max(0, (diff.lineStart || 1) - 1)

    // Mark old lines as deleted where they match the file content
    for (let j = 0; j < oldLines.length; j++) {
      const idx = start + j
      if (idx < lines.length && oldLines[j] === lines[idx]) {
        diffMarkers.set(idx, { deleted: true, added: false, diffIdx: di })
      }
    }
    // New lines are already in content (AI wrote them) — mark as added
    for (let j = 0; j < newLines.length; j++) {
      const idx = start + j
      if (idx < lines.length) {
        // Only mark as added if not already deleted (new code replaces old)
        if (j < oldLines.length && oldLines[j] === newLines[j]) continue // unchanged line
        diffMarkers.set(idx, { deleted: false, added: true, diffIdx: di })
      }
    }
  }

  let result = lines.map((text, i) => {
    const marker = diffMarkers.get(i)
    return {
      text,
      _num: i + 1,
      _deleted: marker ? marker.deleted : false,
      _added: marker ? marker.added : false,
      _diffIdx: marker ? marker.diffIdx : undefined,
      _diffActions: marker ? (i === findLastDiffLine(diffMarkers, marker.diffIdx, i)) : false,
      _html: '',
    }
  })

  // Syntax highlighting
  try {
    const lang = extToLang(f.name || '')
    const raw = result.map(l => l.text).join('\n')
    const hl = tryHighlight(raw, lang)
    if (hl) {
      const hlLines = hl.split('\n')
      result.forEach((l, i) => {
        if (i < hlLines.length) l._html = hlLines[i]
      })
    }
  } catch {}

  return result
})

// Find the last line of a given diff to show actions only once
function findLastDiffLine(markers, diffIdx, currentIdx) {
  let last = currentIdx
  for (const [idx, m] of markers) {
    if (m.diffIdx === diffIdx && idx > last) last = idx
  }
  return last === currentIdx // only true at the last line of the diff
}

function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function extToLang(name) {
  const ext = (name || '').split('.').pop().toLowerCase()
  const map = { js:'javascript', ts:'typescript', vue:'html', jsx:'javascript', tsx:'typescript', py:'python', rb:'ruby', go:'go', rs:'rust', java:'java', css:'css', scss:'scss', html:'xml', json:'json', md:'markdown', yml:'yaml', yaml:'yaml', xml:'xml', sql:'sql', sh:'bash', bat:'bash', ps1:'powershell', c:'c', cpp:'cpp', h:'c', hpp:'cpp', php:'php', swift:'swift', kt:'kotlin', dart:'dart', lua:'lua', r:'r', txt:'' }
  return map[ext] || ''
}

function tryHighlight(code, lang) {
  if (!lang || !code) return null
  try {
    if (window.hljs && window.hljs.getLanguage(lang)) {
      return window.hljs.highlight(code, { language: lang }).value
    }
  } catch {}
  return null
}

async function fetchBalance() {
  try {
    const res = await fetch(`${BASE_URL}/api/code/balance`, { headers: getApiHeaders({}) })
    const data = await res.json()
    if (data.balance_infos?.length) {
      balance.value = parseFloat(data.balance_infos[0].total_balance) || 0
    }
  } catch {}
}

onMounted(() => {
  store.restoreSession()
  if (store.projectPath) loadProject(store.projectPath)
  loadCodeTokens()  // restore persisted token counters
  fetchBalance()
  nextTick(() => { scrollChatToBottom(true) })
})

// Scroll to bottom when switching conversations
watch(() => store.currentId, () => {
  nextTick(() => { scrollChatToBottom(true) })
})

watch(() => store.activeFilePath, async (fp) => {
  if (!fp) return
  const existing = store.openFiles.find(f => f.path === fp)
  if (existing && existing.content && existing.content.length > 10) return
  try {
    const { content, name } = await readFileContent(fp, store.projectPath)
    store.updateFileContent(fp, content)
    if (!existing) store.openFile(fp, name, content)
  } catch {
    // File deleted or not found — mark it
    if (existing) {
      existing._deleted = true
      store.updateFileContent(fp, existing.content || '')
    }
  }
})

async function loadProject(projectPath) {
  store.setProject(projectPath, projectPath.split('\\').pop() || projectPath)
  try {
    const { tree } = await scanFileTree(projectPath)
    store.setFileTree(tree || [])
  } catch (e) {
    console.error('[Code] loadProject failed:', e)
    store.setFileTree([])
  }
}

let _folderInput = null

// 打开项目 → 优先弹出系统资源管理器直接选文件夹
async function openProjectQuick() {
  try {
    let folderPath = null

    // Electron: 原生文件夹对话框
    if (window.superds?.selectDirectory) {
      folderPath = await window.superds.selectDirectory()
    }
    // 浏览器: File System Access API
    else if (window.showDirectoryPicker) {
      const handle = await window.showDirectoryPicker({ mode: 'read' })
      folderPath = handle.name
      // 尝试从文件夹内文件获取完整路径
      try {
        for await (const [, child] of handle.entries()) {
          if (child.kind === 'file') {
            const file = await child.getFile()
            if (file.path) { folderPath = file.path.replace(/[\\/][^\\/]+$/, ''); break }
          }
        }
      } catch {}
    }

    if (folderPath) {
      takeoverPath.value = folderPath
      _isCreatingProject = false
      showConfirmTakeover.value = true
      return
    }
  } catch (e) {
    if (e.name === 'AbortError') return // 用户取消
  }
  // 回退：显示手动输入弹窗
  showOpenProject.value = true
}

function confirmOpenProject() {
  const p = openProjectPath.value.trim()
  if (!p) return
  takeoverPath.value = p
  _isCreatingProject = false
  showConfirmTakeover.value = true
}

async function doOpenProject() {
  const p = takeoverPath.value
  showConfirmTakeover.value = false
  showOpenProject.value = false
  openProjectPath.value = ''
  store.setProject(p, p.split('\\').pop() || p)
  store.createConversation('Code 对话')
  await loadProject(p)
}

function confirmNewProject() {
  const name = newProjectName.value.trim()
  if (!name) return
  const base = newProjectParent.value.replace(/\\$/, '')
  const fullPath = base + '\\' + name
  takeoverPath.value = fullPath
  _isCreatingProject = true
  showConfirmTakeover.value = true
}

async function doCreateProject() {
  const name = takeoverPath.value.split('\\').pop()
  const fullPath = takeoverPath.value
  showConfirmTakeover.value = false
  showNewProject.value = false
  newProjectName.value = ''
  try {
    const { tree } = await newProject(fullPath, name)
    store.setFileTree(tree || [])
    store.setProject(fullPath, name)
    store.createConversation(name)
  } catch (e) { alert('创建失败: ' + e.message) }
}

function confirmTakeover() {
  if (_isCreatingProject) doCreateProject()
  else doOpenProject()
}

async function onFileSelect(item) {
  try {
    const { content, name } = await readFileContent(item.path)
    store.openFile(item.path, name, content)
  } catch (e) { alert('读取失败: ' + e.message) }
}

async function acceptDiffIdx(di) {
  if (di == null || di >= store.pendingDiffs.length) return
  await store.acceptDiff(di)
  refreshFileTree()
}

async function rejectDiffIdx(di) {
  if (di == null || di >= store.pendingDiffs.length) return
  await store.rejectDiff(di)
  refreshFileTree()
}

// Debounced file tree refresh
let _treeRefreshTimer = null
function refreshFileTree() {
  clearTimeout(_treeRefreshTimer)
  _treeRefreshTimer = setTimeout(async () => {
    if (!store.projectPath) return
    try {
      const { tree } = await scanFileTree(store.projectPath)
      store.setFileTree(tree || [])
    } catch {}
  }, 500)
}
const showSwitch = ref(false)
function newCodeConv() { store.createConversation('Code 对话') }
function doSwitchProject() {
  showSwitch.value = false
  store.openFiles = []
  store.activeFilePath = ''
  store.currentId = null
  store.openTabs = []
  store.messagesMap = {}
  store.tasks = []          // 清空旧项目计划
  store.pendingDiffs = []   // 清空旧项目 diff
  store.handoffCount = 0    // 重置接力计数
  store.setProject('', '')
  store.setFileTree([])
  store.saveSession()
}

function onKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

function autoResize() {
  const el = inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 100) + 'px'
}

let _abortCtrl = null

// ═══ Image upload (code mode — images only) ═══
function onPasteImages(e) {
  const items = e.clipboardData?.items
  if (!items) return
  const imgFiles = []
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      imgFiles.push(item.getAsFile())
    }
  }
  if (imgFiles.length) {
    e.preventDefault()
    processImages(imgFiles)
  }
}

async function onImagesSelected(e) {
  const files = e.target.files
  if (!files?.length) return
  processImages(Array.from(files))
  e.target.value = ''
}

async function processImages(files) {
  for (const f of files) {
    if (!f.type?.startsWith('image/')) continue
    const key = 'ci_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
    const dataUrl = await new Promise(resolve => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.readAsDataURL(f)
    })
    pendingImages.value = [...pendingImages.value, {
      name: f.name, type: f.type, size: f.size, key, data: dataUrl, content: dataUrl
    }]
  }
}

async function send() {
  const txt = task.value.trim()
  if (!txt || loading.value || !store.projectPath) return
  task.value = ''
  loading.value = true
  paused.value = false

  if (!store.currentId) store.createConversation(txt.slice(0, 30))
  store.tasks = []
  tokPrompt.value = 0; tokComp.value = 0; tokTotal.value = 0

  // Include images in task
  const imgs = pendingImages.value
  let displayText = txt
  if (imgs.length) {
    const imgNames = imgs.map(i => i.name).join(', ')
    displayText = txt + (txt ? '\n' : '') + `[图片: ${imgNames}]`
  }
  store.pushMessage({ _id: 'u_' + Date.now(), role: 'user', text: displayText, files: [...imgs] })
  store.addUserMessage(displayText)
  pendingImages.value = []

  const dbId = store.addAiMessage('', '', '', '[]', '[]', false, false, '')
  const aiMsg = reactive({
    _id: 'a_' + Date.now(), role: 'ai', text: '', html: '', thinking: '',
    _events: [], _done: false, _error: false,
    _compactState: createCompactState(),
    _todos: [],
    _todosOpen: true,
  })
  store.pushMessage(aiMsg)

  // Activate yammy
  yammy.msgId = aiMsg._id
  yammy.playing = true
  yammy.clickCount = 0
  yammy.shaking = false

  _userScrolled = false
  scrollChatToBottom(true)

  _abortCtrl = new AbortController()
  let _saveDirty = false
  const _saveToDb = () => {
    if (!_saveDirty || dbId < 0) return
    _saveDirty = false
    store.updateMessageText(dbId, aiMsg.text, aiMsg.html, aiMsg.thinking,
      JSON.stringify(aiMsg._events), aiMsg._done ? 1 : 0, aiMsg._error ? 1 : 0, '')
  }
  const _dbInterval = setInterval(_saveToDb, 5000)

  try {
    // ═══ Pre-crawl URLs in user message ═══
    let taskTxt = txt
    const userUrls = (txt || '').match(/(https?:\/\/[^\s]+)/g) || []
    if (userUrls.length > 0) {
        try {
            const crawlResults = []
            for (const u of userUrls) {
                try {
                    const isCodeHost = /github\.com|gitee\.com|gitlab\.com/i.test(u)
                    const endpoint = isCodeHost ? '/api/search/deep-crawl' : '/api/search/direct-crawl'
                    const crawlRes = await fetch(`${BASE_URL}${endpoint}`, {
                        method: 'POST',
                        headers: getApiHeaders({}),
                        body: JSON.stringify({ url: u })
                    })
                    const crawlData = await crawlRes.json()
                    if (crawlData.text && crawlData.text.length > 20) {
                        crawlResults.push(crawlData.text)
                    }
                } catch {}
            }
            if (crawlResults.length > 0) {
                const MAX_INJECT = 300000
                let injectText = crawlResults.join('\n\n---\n\n')
                if (injectText.length > MAX_INJECT) {
                    injectText = injectText.slice(0, MAX_INJECT) + '\n\n[... 余下内容已截断，需要具体文件内容请直接询问]'
                }
                taskTxt = `[已爬取网页内容，优先参考]\n${injectText}\n\n---\n用户任务:\n${txt}`
            }
        } catch {}
    }

    const pendingCount = (store.tasks || []).filter(t => !t.done).length
    const existingPlan = pendingCount > 0
      ? store.tasks.map(t => ({ id: t.id, text: t.text, done: !!t.done }))
      : null
    await runCodeAgent(taskTxt, store.projectPath, codeModel.value, async (event) => {
      const e = event
      aiMsg._events.push(e)
      _saveDirty = true

      // ─── Mutate compact state directly (no recomputation) ───
      mutateCompactState(aiMsg._compactState, e)

      // ─── Keep legacy state for detail panel ───
      if (e.type === 'code_diff') {
        store.addDiff({
          filePath: e.filePath,
          oldCode: e.oldCode || '',
          newCode: e.newCode || '',
          lineStart: e.lineStart || 1,
          isNewFile: e.isNewFile || false,
        })
        const fname = e.fileName || e.filePath.split('\\').pop()
        store.openFile(e.filePath, fname, '// 加载中...')
        try {
          const { content } = await readFileContent(e.filePath, store.projectPath)
          store.updateFileContent(e.filePath, content)
        } catch {}
        refreshFileTree()
      }
      if (e.type === 'plan_done' && e.tasks) {
        store.setTasks(e.tasks)
        if (e.tasks.length > 1) {
          aiMsg._todos = e.tasks.map(t => ({ id: t.id, text: t.text, status: t.done ? 'completed' : 'pending' }))
        }
      }
      if (e.type === 'plan_reused' && e.tasks) {
        store.setTasks(e.tasks)
        if (e.tasks.length > 1) {
          aiMsg._todos = e.tasks.map(t => ({ id: t.id, text: t.text, status: t.done ? 'completed' : 'pending' }))
        }
      }
      if (e.type === 'task_done' && e.taskId) {
        store.markTaskDone(e.taskId)
        if (aiMsg._todos) {
          const td = aiMsg._todos.find(t => t.id === e.taskId)
          if (td) td.status = 'completed'
        }
      }
      if (e.type === 'task_start' && e.taskId) {
        if (aiMsg._todos) {
          const td = aiMsg._todos.find(t => t.id === e.taskId)
          if (td) td.status = 'in_progress'
        }
      }
      if (e.type === 'done') {
        aiMsg._done = true
        aiMsg._todosOpen = false
        if (e.text) {
          aiMsg.text = e.text
          aiMsg.html = renderMarkdown(e.text)
        }
        if (e.todos && e.todos.length) {
          aiMsg._todos = e.todos
        }
        yammy.playing = false
      }
      if (e.type === 'token_usage') {
        tokPrompt.value = e.promptTokens || 0
        tokComp.value = e.completionTokens || 0
        tokTotal.value = e.totalTokens || 0
      }
      if (e.type === 'context_usage' && e.pct >= 80) {
        aiMsg._handoffReady = e.handoffReady || false
      }
      if (e.type === 'error') {
        aiMsg._error = true
        aiMsg.html = renderMarkdown('**出错**: ' + (e.text || '未知'))
        yammy.playing = false
      }
      scrollChatToBottom() // respect user scroll
    }, _abortCtrl.signal, existingPlan)
  } catch (e) {
    if (e.name === 'AbortError') {
      aiMsg._error = true
      aiMsg.html = renderMarkdown('<span style="color:var(--red)">[!] **任务中断**</span>')
    } else {
      aiMsg._error = true
      aiMsg.html = renderMarkdown('**出错**: ' + (e.message || '未知'))
    }
    yammy.playing = false
  }

  clearInterval(_dbInterval)
  aiMsg._done = true
  loading.value = false
  _abortCtrl = null
  _saveToDb()
  if (store.projectPath) loadProject(store.projectPath)
  scrollChatToBottom()
}

// ─── Scroll — respect user scroll position ───
let _userScrolled = false
let _scrollTimer = null

function onChatScroll() {
  const el = chatRef.value
  if (!el) return
  const dist = el.scrollHeight - el.scrollTop - el.clientHeight
  // If user scrolled back to bottom (< 4px), resume auto-scroll
  if (dist < 4) {
    _userScrolled = false
    return
  }
  // If user scrolled up significantly, stop auto-scroll
  if (dist > 30) {
    _userScrolled = true
    // Reset after 8 seconds of no scrolling
    clearTimeout(_scrollTimer)
    _scrollTimer = setTimeout(() => { _userScrolled = false }, 8000)
  }
}

function scrollChatToBottom(force = false) {
  nextTick(() => {
    const el = chatRef.value
    if (!el) return
    if (!force && _userScrolled) return
    el.scrollTop = el.scrollHeight
  })
}
</script>

<style scoped>
.cv-root { display: flex; height: 100%; overflow: hidden; }
.cv-resize-handle { width: 4px; cursor: col-resize; flex-shrink: 0; background: transparent; transition: background .2s; z-index: 10; }
.cv-resize-handle:hover { background: var(--accent); opacity: .4; }
.cv-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; background: var(--bg); }
.cv-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; }
.cv-empty-title { font-size: 18px; font-weight: 400; color: var(--text); }
.cv-empty-desc { font-size: 13px; color: var(--text3); font-weight: 300; }
.cv-empty-actions { display: flex; gap: 10px; margin-top: 12px; }
.cv-act-btn { display: flex; align-items: center; gap: 7px; padding: 8px 16px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg2); color: var(--text2); cursor: pointer; font-size: 13px; font-family: inherit; font-weight: 300; transition: all .12s; }
.cv-act-btn:hover { background: var(--bg3); border-color: var(--accent); color: var(--text); }

/* ─── Tabs ─── */
.cv-tabs { display: flex; gap: 2px; padding: 4px 8px 0; background: var(--bg2); border-bottom: 1px solid var(--border); overflow-x: auto; flex-shrink: 0; }
.cv-tabs::-webkit-scrollbar { height: 2px; }
.cv-tab { display: flex; align-items: center; gap: 5px; padding: 6px 10px 5px; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 12px; font-weight: 300; color: var(--text3); border: 1px solid transparent; border-bottom: none; white-space: nowrap; transition: all .12s; }
.cv-tab:hover { background: var(--bg3); color: var(--text2); }
.cv-tab.active { background: var(--bg); color: var(--text); border-color: var(--border); }
.cv-tab.deleted .cv-tab-name { text-decoration: line-through; color: var(--red); opacity: .7; }
.cv-tab-name { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.cv-tab-close { display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; border-radius: 3px; border: none; background: transparent; color: var(--text3); cursor: pointer; }
.cv-tab-close:hover { background: var(--bg4); color: var(--red); }

/* ─── Code area ─── */
.cv-code { flex: 1; overflow: auto; padding: 8px 0; position: relative; }
.cv-code::-webkit-scrollbar { width: 4px; }
.cv-code::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 4px; }
.cv-code-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--text3); font-size: 13px; font-weight: 300; }
.cv-code-inner { font-family: var(--font-mono); font-size: 13px; line-height: 1.65; }
.cv-line { display: flex; gap: 0; padding: 0 12px; transition: background .15s; }
.cv-line:hover { background: var(--bg3); }
.cv-line-num { width: 42px; text-align: right; padding-right: 14px; color: var(--text3); font-size: 11px; user-select: none; flex-shrink: 0; }
.cv-line-code { white-space: pre; color: var(--text); flex: 1; overflow: hidden; text-overflow: ellipsis; }
.cv-line-del { background: rgba(248,81,73,.08); }
.cv-line-del .cv-line-code { text-decoration: line-through; color: var(--red); opacity: .7; }
.cv-line-add { background: rgba(63,185,80,.08); }
.cv-line-add .cv-line-code { color: var(--green); }
/* Per-diff inline actions */
.cv-diff-inline-actions { display: flex; gap: 2px; margin-left: auto; flex-shrink: 0; }
.cv-diff-inline-actions .cv-diff-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 3px; border: 1px solid var(--border); background: var(--bg2); cursor: pointer; transition: all .12s; padding: 0; }
.cv-diff-inline-actions .cv-diff-btn.accept { color: var(--green); border-color: rgba(63,185,80,.3); }
.cv-diff-inline-actions .cv-diff-btn.accept:hover { background: rgba(63,185,80,.15); }
.cv-diff-inline-actions .cv-diff-btn.reject { color: var(--red); border-color: rgba(248,81,73,.25); }
.cv-diff-inline-actions .cv-diff-btn.reject:hover { background: rgba(248,81,73,.15); }

/* ─── Chat area ─── */
.cv-chat { width: 360px; display: flex; flex-direction: column; border-left: 1px solid var(--border); background: var(--bg2); flex-shrink: 0; overflow: hidden; }
.cv-chat-top { display: flex; align-items: center; padding: 4px 4px 0; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.cv-chat-tabs { display: flex; gap: 2px; overflow-x: auto; flex: 1; min-width: 0; }
.cv-chat-tabs::-webkit-scrollbar { height: 2px; }
.cv-chat-acts { display: flex; gap: 2px; flex-shrink: 0; padding-left: 4px; }
.cv-chat-act { width: 26px; height: 26px; border-radius: 5px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.cv-chat-act:hover { background: var(--bg3); color: var(--text); }
.cv-ctab { display: flex; align-items: center; gap: 4px; padding: 5px 8px; border-radius: 6px 6px 0 0; cursor: pointer; font-size: 11px; font-weight: 300; color: var(--text3); border: 1px solid transparent; border-bottom: none; white-space: nowrap; }
.cv-ctab:hover { color: var(--text2); }
.cv-ctab.active { background: var(--bg); color: var(--text); border-color: var(--border); }
.cv-ctab-title { max-width: 100px; overflow: hidden; text-overflow: ellipsis; }
.cv-ctab-close { display: flex; align-items: center; width: 12px; height: 12px; border: none; background: transparent; color: var(--text3); cursor: pointer; }
.cv-chat-msgs { flex: 1; overflow-y: auto; padding: 10px; }
.cv-chat-msgs::-webkit-scrollbar { width: 3px; }
.cv-msg { margin-bottom: 10px; }
.cv-msg-user { display: flex; justify-content: flex-end; }
.cv-bubble { padding: 8px 12px; font-size: 13px; line-height: 1.55; font-weight: 300; word-break: break-word; }
.cv-bubble-user { background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); max-width: 85%; }
.cv-chat-hint { padding: 20px 0; text-align: center; font-size: 12px; color: var(--text3); font-weight: 300; }

/* Final report — left-aligned with compact body */
.cv-report {
  padding: 6px 0 4px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text);
  word-break: break-word;
}
.cv-report-text :deep(pre) { margin: 6px 0; padding: 8px 10px; background: var(--bg3); border-radius: 4px; font-size: 11px; overflow-x: auto; }
.cv-report-text :deep(code) { font-family: var(--font-mono); font-size: 11px; }
.cv-report-text :deep(p) { margin: 4px 0; }

/* ─── Image chips (code mode) ─── */
.cv-img-chips { padding: 0 10px 6px; display: flex; flex-wrap: wrap; gap: 5px; }
.cv-img-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 10px; background: var(--bg3); border: 1px solid var(--border);
  border-radius: 10px; font-size: 11px; color: var(--text2);
}
.cv-img-chip svg { flex-shrink: 0; color: var(--text-muted); }
.cv-img-chip-text { white-space: nowrap; }
.cv-img-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; border-radius: 50%; border: none; background: transparent;
  color: var(--text3); flex-shrink: 0; cursor: pointer; transition: all .12s;
}
.cv-img-chip-remove:hover { background: rgba(248,81,73,0.12); color: var(--red); }
.cv-img-btn {
  width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
  border: none; background: transparent; color: var(--text2); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all .12s;
}
.cv-img-btn:hover { background: var(--bg4); color: var(--accent); }
.cv-hidden-input { display: none; }

/* ─── Chat bar ─── */
.cv-chat-bar { padding: 8px 10px 12px; border-top: 1px solid var(--border); flex-shrink: 0; }
.cv-chat-row { display: flex; align-items: center; gap: 6px; background: var(--bg3); border: 1px solid var(--border); border-radius: 8px; padding: 6px 8px; }
.cv-input { flex: 1; resize: none; background: none; border: none; outline: none; color: var(--text); font: 300 13px/1.5 var(--font-sans); min-height: 22px; max-height: 100px; }
.cv-input::placeholder { color: var(--text3); }
.cv-send { width: 28px; height: 28px; border-radius: 6px; border: none; background: var(--accent); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity .12s; }
.cv-send.off { background: var(--bg4); color: var(--text3); cursor: not-allowed; }
.cv-pause { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg3); color: var(--text2); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .12s; }
.cv-pause:hover { background: var(--bg4); color: var(--text); border-color: var(--accent); }
.cv-model-btn { width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0; border: none; background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cv-model-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--yellow); transition: background .15s; }
.cv-model-dot.pro { background: var(--accent); }
.cv-model-wrap { position: relative; }
.cv-model-menu { position: absolute; bottom: 100%; right: 0; margin-bottom: 6px; background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,.35); padding: 4px; z-index: var(--z-dropdown); min-width: 130px; }
.cv-model-opt { display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 10px; border-radius: 6px; border: none; background: transparent; color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 300; cursor: pointer; transition: background .1s; }
.cv-model-opt:hover { background: var(--bg3); }
.cv-model-opt.active { background: var(--accent-muted); color: var(--accent); }

/* ─── Modals ─── */
.cv-modal-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; }
.cv-modal { background: var(--bg2); border: 1px solid var(--border2); border-radius: var(--radius); width: 420px; box-shadow: 0 12px 40px rgba(0,0,0,.4); }
.cv-modal-hdr { display: flex; align-items: center; gap: 8px; padding: 16px 18px; border-bottom: 1px solid var(--border); font-size: 15px; font-weight: 500; color: var(--text); }
.cv-modal-hdr svg { color: var(--accent); flex-shrink: 0; }
.cv-modal-close { margin-left: auto; width: 26px; height: 26px; border-radius: 6px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.cv-modal-close:hover { background: var(--bg3); color: var(--text); }
.cv-modal-body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
.cv-field { display: flex; flex-direction: column; gap: 5px; }
.cv-label { font-size: 12px; font-weight: 500; color: var(--text2); }
.cv-field-input { flex: 1; padding: 8px 10px; border-radius: var(--radius-sm); background: var(--bg3); border: 1px solid var(--border); color: var(--text); font-size: 13px; font-family: inherit; font-weight: 300; outline: none; transition: border-color .15s; }
.cv-field-input:focus { border-color: var(--accent); }
.cv-field-input::placeholder { color: var(--text3); }
.cv-field-hint { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text3); font-weight: 300; }
.cv-modal-ft { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 18px 16px; }
.cv-modal-btn { display: flex; align-items: center; gap: 5px; padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px; font-family: inherit; font-weight: 400; border: 1px solid var(--border); cursor: pointer; transition: all .12s; }
.cv-modal-btn.cancel { background: var(--bg3); color: var(--text2); }
.cv-modal-btn.cancel:hover { background: var(--bg4); color: var(--text); }
.cv-modal-btn.ok { background: var(--accent); color: #fff; border-color: var(--accent); }
.cv-modal-btn.ok:hover { background: var(--accent-hover); }
.cv-modal-btn.ok:disabled { background: var(--bg4); color: var(--text3); border-color: var(--border); cursor: not-allowed; }
.cv-confirm-text { font-size: 15px; color: var(--text); font-weight: 400; margin: 0 0 4px; }
.cv-confirm-sub { font-size: 12px; color: var(--text3); font-weight: 300; margin: 0 0 12px; }
.cv-confirm-path { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text3); font-family: var(--font-mono); background: var(--bg3); padding: 6px 10px; border-radius: 4px; word-break: break-all; }
.cv-folder-input { display: none; }
.cv-line-code :deep(.hljs-selector-class) { color: #61afef; }
.cv-line-code :deep(.hljs-selector-id) { color: #61afef; }
</style>
