<template>
  <Transition name="panel">
    <div v-if="visible" :class="['code-panel', { expanded: isExpanded }]">
      <!-- Header -->
      <div class="panel-header">
        <div class="panel-tabs">
          <button
            v-for="(tab, i) in tabs"
            :key="i"
            :class="['panel-tab', { active: activeTab === i }]"
            @click="activeTab = i"
          >
            <AppIcon :name="tabIcon(tab.language)" :size="14" />
            <span class="tab-name">{{ tab.filename || t('codeN') + ' ' + (i + 1) }}</span>
            <span class="tab-lang">{{ tab.language }}</span>
            <span v-if="tab._dirty" class="tab-dirty">●</span>
          </button>
        </div>

        <div class="panel-actions">
          <!-- Canvas: Ask AI to improve -->
          <button v-if="canvasMode" class="panel-action-btn canvas-ai-btn" title="让 AI 改进当前内容" @click="showAskAI = !showAskAI">
            <AppIcon name="sparkles" :size="16" />
          </button>
          <!-- Edit / View toggle -->
          <button v-if="canvasMode" class="panel-action-btn" :title="editMode ? '查看模式' : '编辑模式'" @click="toggleEdit">
            <AppIcon :name="editMode ? 'eye' : 'edit'" :size="16" />
          </button>
          <button class="panel-action-btn" :title="t('copyCode')" @click="copyCode">
            <AppIcon v-if="!copied" name="copy" :size="16" />
            <AppIcon v-else name="check" :size="16" />
          </button>
          <button class="panel-action-btn" :title="t('downloadFile')" @click="downloadCode">
            <AppIcon name="download" :size="16" />
          </button>
          <button
            v-if="hasPreview"
            class="panel-action-btn"
            :title="showPreview ? t('showCode') : t('previewCode')"
            @click="showPreview = !showPreview"
          >
            <AppIcon :name="showPreview ? 'code' : 'play'" :size="16" />
          </button>
          <button class="panel-action-btn" :title="t('expand')" @click="isExpanded = !isExpanded">
            <AppIcon :name="isExpanded ? 'panel-close' : 'panel-right'" :size="16" />
          </button>
          <button class="panel-action-btn panel-close-btn" :title="t('close')" @click="$emit('close')">
            <AppIcon name="x" :size="16" />
          </button>
        </div>
      </div>

      <!-- Canvas: Ask AI bar -->
      <div v-if="showAskAI && canvasMode" class="ask-ai-bar">
        <input
          v-model="askAIInstruction"
          class="ask-ai-input"
          placeholder="告诉 AI 怎么改，如：加注释、优化性能、改成 TypeScript…"
          @keydown.enter="submitAskAI"
        />
        <button class="ask-ai-send" @click="submitAskAI" :disabled="!askAIInstruction.trim()">
          <AppIcon name="send" :size="14" />
          <span>发送</span>
        </button>
      </div>

      <!-- Body -->
      <div class="panel-body">
        <!-- Preview mode -->
        <div v-if="showPreview && hasPreview" class="preview-frame-wrapper">
          <iframe
            :srcdoc="previewContent"
            class="preview-frame"
            sandbox="allow-scripts allow-same-origin"
            title="Preview"
          />
        </div>

        <!-- Edit mode (Canvas) -->
        <div v-else-if="editMode && canvasMode" class="edit-view">
          <textarea
            ref="editArea"
            v-model="editContent"
            class="edit-textarea"
            :spellcheck="false"
            @input="onEditInput"
            @keydown.tab.prevent="onTab"
          />
        </div>

        <!-- Code view mode -->
        <div v-else class="code-view">
          <pre><code
            v-for="(tab, i) in tabs"
            :key="i"
            v-show="activeTab === i"
            :class="`language-${tab.language}`"
            v-html="highlightedCode[i]"
          /></pre>
        </div>
      </div>

      <!-- Footer -->
      <div class="panel-footer">
        <span class="footer-info">{{ currentTab?.language }} &middot; {{ codeLines }} {{ t('linesUnit') }}</span>
        <span v-if="editMode && canvasMode" class="footer-edit-hint">编辑模式 · Ctrl+S 保存 · 改动可被 AI 读取</span>
        <span v-if="canvasMode && lastSaved" class="footer-saved">已保存 {{ lastSaved }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import hljs from 'highlight.js'
import AppIcon from '../common/AppIcon.vue'
import { useI18n } from '../../composables/useI18n.js'
import { saveCanvasDoc } from '../../db/database.js'

const { t } = useI18n()

const props = defineProps({
  visible: { type: Boolean, default: false },
  tabs: { type: Array, default: () => [] },
  // Each tab: { filename, language, code, raw }
  canvasMode: { type: Boolean, default: false }, // When true, enables editing + AI collaboration
  convId: { type: String, default: '' }, // For persisting canvas docs
})

const emit = defineEmits(['close', 'ask-ai', 'content-update'])

const activeTab = ref(0)
const isExpanded = ref(false)
const showPreview = ref(false)
const copied = ref(false)
const editMode = ref(false)
const editContent = ref('')
const showAskAI = ref(false)
const askAIInstruction = ref('')
const lastSaved = ref('')
const editArea = ref(null)

const currentTab = computed(() => props.tabs[activeTab.value] || null)

const hasPreview = computed(() => {
  return props.tabs.some(t => t.language === 'html' || t.language === 'htm')
})

const previewContent = computed(() => {
  // Use edited content if in edit mode, otherwise original
  if (editMode.value && activeTab.value === 0 && editContent.value) return editContent.value
  const htmlTab = props.tabs.find(t => t.language === 'html' || t.language === 'htm')
  return htmlTab?.code || ''
})

const codeLines = computed(() => {
  if (editMode.value && editContent.value) return editContent.value.split('\n').length
  return currentTab.value?.code?.split('\n').length || 0
})

// Syntax highlighting via highlight.js with fallback
const highlightedCode = computed(() => {
  return props.tabs.map((tab, i) => {
    // Use edited content if available for this tab
    const code = (editMode.value && i === activeTab.value && editContent.value) ? editContent.value : tab.code
    try {
      const lang = hljs.getLanguage(tab.language)
      if (lang) {
        return hljs.highlight(code, { language: tab.language }).value
      }
      const result = hljs.highlightAuto(code)
      if (result.language) return result.value
    } catch {}
    return escapeHtml(code)
  })
})

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function tabIcon(lang) {
  const map = {
    html: 'code', htm: 'code', css: 'code', js: 'code', javascript: 'code',
    ts: 'code', typescript: 'code', jsx: 'code', tsx: 'code',
    vue: 'code', react: 'code',
    py: 'code', python: 'code',
    json: 'code', yaml: 'code', yml: 'code', toml: 'code',
    md: 'file', markdown: 'file',
    sql: 'database',
    sh: 'play', bash: 'play', zsh: 'play',
  }
  return map[lang] || 'code'
}

function toggleEdit() {
  if (!editMode.value) {
    // Entering edit mode — load current tab content
    editContent.value = currentTab.value?.code || ''
  } else {
    // Leaving edit mode — save changes
    saveEdits()
  }
  editMode.value = !editMode.value
  if (editMode.value) {
    nextTick(() => editArea.value?.focus())
  }
}

function onEditInput() {
  // Mark tab as dirty
  if (currentTab.value) currentTab.value._dirty = true
}

function onTab(e) {
  // Insert tab character in textarea
  const ta = e.target
  const start = ta.selectionStart
  const end = ta.selectionEnd
  editContent.value = editContent.value.substring(0, start) + '  ' + editContent.value.substring(end)
  nextTick(() => {
    ta.selectionStart = ta.selectionEnd = start + 2
  })
}

function saveEdits() {
  if (!currentTab.value || !editContent.value) return
  // Update the tab's code so view mode shows latest
  currentTab.value.code = editContent.value
  currentTab.value._dirty = false
  // Emit to parent so AI can see the latest content
  emit('content-update', { index: activeTab.value, code: editContent.value, tab: currentTab.value })
  // Persist to canvas_docs if we have a convId
  if (props.convId && props.canvasMode) {
    try {
      const docId = `canvas_${props.convId}_${activeTab.value}`
      saveCanvasDoc(docId, props.convId, currentTab.value.filename || '文档', currentTab.value.language || 'text', editContent.value, currentTab.value.language || '')
      lastSaved.value = new Date().toLocaleTimeString('zh-CN')
    } catch (e) { console.warn('[Canvas] save failed:', e) }
  }
}

function submitAskAI() {
  if (!askAIInstruction.value.trim()) return
  // Save current edits first so AI sees latest
  saveEdits()
  emit('ask-ai', {
    instruction: askAIInstruction.value,
    code: editContent.value || currentTab.value?.code || '',
    language: currentTab.value?.language || '',
    filename: currentTab.value?.filename || '',
  })
  askAIInstruction.value = ''
  showAskAI.value = false
}

async function copyCode() {
  if (!currentTab.value) return
  const code = editMode.value ? editContent.value : currentTab.value.code
  try {
    await navigator.clipboard.writeText(code)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

function downloadCode() {
  if (!currentTab.value) return
  const code = editMode.value ? editContent.value : currentTab.value.code
  const blob = new Blob([code], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = currentTab.value.filename || `code.${currentTab.value.language}`
  a.click()
  URL.revokeObjectURL(url)
}

// Keyboard shortcut: Ctrl+S to save in edit mode
function onKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && editMode.value) {
    e.preventDefault()
    saveEdits()
  }
}

watch(() => props.visible, (v) => {
  if (v) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

// Reset state when tabs change
watch(() => props.tabs, () => {
  activeTab.value = 0
  showPreview.value = false
  copied.value = false
  editMode.value = false
  editContent.value = ''
}, { deep: true })

// When switching tabs in edit mode, save and load new tab
watch(activeTab, () => {
  if (editMode.value) {
    saveEdits()
    editContent.value = currentTab.value?.code || ''
  }
})
</script>

<style scoped>
.code-panel {
  position: fixed;
  top: 0;
  right: 0;
  width: var(--panel-width);
  height: 100vh;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  z-index: var(--z-sticky);
  box-shadow: var(--shadow-lg);
}

.code-panel.expanded {
  width: 65vw;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
  min-height: 36px;
}

.panel-tabs {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  flex: 1;
  padding: 4px 8px 0;
  background: var(--bg2);
}
.panel-tabs::-webkit-scrollbar { height: 2px; }

.panel-tab {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px 5px;
  border-radius: 6px 6px 0 0;
  font-size: 12px;
  font-weight: 300;
  color: var(--text3);
  border: 1px solid transparent;
  border-bottom: none;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.12s;
}
.panel-tab:hover {
  background: var(--bg3);
  color: var(--text2);
}
.panel-tab.active {
  background: var(--bg);
  color: var(--text);
  border-color: var(--border);
}

.tab-lang {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.tab-dirty {
  color: var(--accent, #5b8def);
  font-size: 10px;
}

/* Actions */
.panel-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  padding: 0 6px;
}

.panel-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}
.panel-action-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.canvas-ai-btn:hover {
  background: rgba(91, 141, 239, 0.15);
  color: #5b8def;
}

.panel-close-btn:hover {
  background: var(--red-muted);
  color: var(--red);
}

/* Ask AI bar */
.ask-ai-bar {
  display: flex;
  gap: 6px;
  padding: 8px 12px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
}
.ask-ai-input {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 7px 10px;
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.ask-ai-input:focus { border-color: #5b8def; }
.ask-ai-send {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  background: #5b8def;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.ask-ai-send:disabled { opacity: 0.4; cursor: not-allowed; }
.ask-ai-send:not(:disabled):hover { opacity: 0.85; }

/* Body */
.panel-body {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
}

.code-view {
  height: 100%;
}

.code-view pre {
  margin: 0;
  padding: var(--space-4);
  height: 100%;
  overflow: auto;
}

.code-view code {
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
}

/* Edit view (Canvas) */
.edit-view {
  height: 100%;
}
.edit-textarea {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: var(--space-4);
  border: none;
  outline: none;
  resize: none;
  background: var(--bg-primary);
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.65;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
}

/* Preview */
.preview-frame-wrapper {
  height: 100%;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

/* Footer */
.panel-footer {
  padding: var(--space-1) var(--space-4);
  border-top: 1px solid var(--border);
  min-height: 28px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-info {
  font-size: var(--font-size-xs);
  color: var(--text-muted);
}
.footer-edit-hint {
  font-size: var(--font-size-xs);
  color: #5b8def;
}
.footer-saved {
  font-size: var(--font-size-xs);
  color: var(--green, #3fb950);
  margin-left: auto;
}

/* Panel transition */
.panel-enter-active {
  animation: panelSlideIn var(--transition-panel) both;
}
.panel-leave-active {
  animation: panelSlideOut var(--transition-panel) both;
}

@keyframes panelSlideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes panelSlideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}
</style>
