<template>
  <div class="kb-page">
    <!-- Header -->
    <div class="kb-header">
      <div class="kb-header-left">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="kb-header-icon">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 7h8M8 11h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <div>
          <h2 class="kb-title">{{ t('kbTitle') }}</h2>
          <p class="kb-sub">{{ t('kbSub') }}</p>
        </div>
      </div>
      <div class="kb-header-actions">
        <div class="kb-status" :class="{ ready: modelReady }">
          <span class="kb-status-dot"></span>
          <span>{{ modelReady ? t('kbStatusReady') : t('kbStatusNotReady') }}</span>
        </div>
        <button class="kb-btn" @click="showAddText = true" :disabled="uploading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2v6h6M9 13h6M9 17h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ t('kbAddText') }}
        </button>
        <button class="kb-btn primary" @click="fileInput?.click()" :disabled="uploading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><polyline points="17 8 12 3 7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          {{ uploading ? t('kbProcessing') : t('kbUpload') }}
        </button>
        <input ref="fileInput" type="file" accept=".txt,.md,.json,.csv,.pdf,.docx,.log,.js,.ts,.py,.java,.go,.html,.css,.xml,.yml,.yaml,.sql" hidden @change="onFilePicked" />
      </div>
    </div>

    <!-- Auto lookup toggle -->
    <div class="kb-rag-bar">
      <div class="kb-rag-info">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <div>
          <span class="kb-rag-title">{{ t('kbAutoLookupTitle') }}</span>
          <span class="kb-rag-desc">{{ t('kbAutoLookupDesc') }}</span>
        </div>
      </div>
      <button :class="['kb-toggle', { on: ragEnabled }]" @click="setRagEnabled(!ragEnabled)">
        <span class="kb-toggle-knob"></span>
      </button>
    </div>

    <!-- Stats -->
    <div class="kb-stats" v-if="documents.length">
      <div class="kb-stat">
        <span class="kb-stat-num">{{ documentCount }}</span>
        <span class="kb-stat-label">{{ t('kbStatDocs') }}</span>
      </div>
      <div class="kb-stat">
        <span class="kb-stat-num">{{ totalChunks }}</span>
        <span class="kb-stat-label">{{ t('kbStatChunks') }}</span>
      </div>
    </div>

    <!-- Document list -->
    <div class="kb-list" v-if="documents.length">
      <div v-for="doc in documents" :key="doc.id" class="kb-doc-card" :class="[getFileTypeClass(doc.file_type, doc.source), { processing: doc._status === 'processing', failed: doc._status === 'failed' }]">
        <div class="kb-doc-icon" :class="getFileTypeClass(doc.file_type, doc.source)">
          <span class="kb-doc-ext">{{ getFileExt(doc.file_type, doc.source) }}</span>
        </div>
        <div class="kb-doc-info">
          <span class="kb-doc-title">{{ doc.title }}</span>
          <div class="kb-doc-meta">
            <span v-if="doc._status === 'processing'" class="kb-doc-status processing">
              <span class="kb-mini-spinner"></span> 处理中...
            </span>
            <span v-else-if="doc._status === 'failed'" class="kb-doc-status failed">失败: {{ doc._error || '未知错误' }}</span>
            <span v-else-if="doc._status === 'ready'" class="kb-doc-status ready">已就绪</span>
            <span v-if="doc.chunk_count">{{ t('kbDocChunks', doc.chunk_count) }}</span>
            <span v-if="doc.char_count">{{ formatSize(doc.char_count) }}</span>
            <span v-if="doc.source">{{ doc.source }}</span>
            <span v-if="doc.created_at">{{ formatDate(doc.created_at) }}</span>
          </div>
        </div>
        <div class="kb-doc-actions" v-if="doc._status !== 'processing'">
          <button class="kb-doc-btn" :title="t('kbPreview')" @click="previewDoc(doc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/></svg>
          </button>
          <button class="kb-doc-btn danger" :title="t('kbDelete')" @click="confirmDelete(doc)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="kb-doc-actions" v-else>
          <div class="kb-mini-spinner"></div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div class="kb-empty" v-else-if="!loading">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        <rect x="8" y="6" width="32" height="36" rx="3" stroke="var(--text4)" stroke-width="1.5"/>
        <path d="M16 18h16M16 24h16M16 30h10" stroke="var(--text4)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span class="kb-empty-title">{{ t('kbEmptyTitle') }}</span>
      <span class="kb-empty-desc">{{ t('kbEmptyDesc') }}</span>
    </div>

    <!-- Loading -->
    <div class="kb-loading" v-if="loading">
      <div class="kb-spinner"></div>
      <span>{{ t('kbLoading') }}</span>
    </div>

    <!-- Add Text Modal -->
    <Teleport to="body">
      <div v-if="showAddText" class="kb-modal-overlay" @click="showAddText = false">
        <div class="kb-modal" @click.stop>
          <div class="kb-modal-header">
            <span>{{ t('kbAddTextTitle') }}</span>
            <button class="kb-modal-close" @click="showAddText = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="kb-modal-body">
            <input v-model="addTextTitle" class="kb-input" :placeholder="t('kbAddTextTitlePh')" />
            <textarea v-model="addTextContent" class="kb-textarea" :placeholder="t('kbAddTextPh')"></textarea>
          </div>
          <div class="kb-modal-footer">
            <button class="kb-btn" @click="showAddText = false">{{ t('cancel') }}</button>
            <button class="kb-btn primary" :disabled="!addTextContent.trim() || uploading" @click="submitAddText">{{ uploading ? t('kbProcessing') : t('kbAdd') }}</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Preview Modal -->
    <Teleport to="body">
      <div v-if="previewDocData" class="kb-modal-overlay" @click="previewDocData = null">
        <div class="kb-modal kb-modal-preview" @click.stop>
          <div class="kb-modal-header">
            <span>{{ t('kbPreviewTitle').replace('{name}', previewDocData.title) }}</span>
            <button class="kb-modal-close" @click="previewDocData = null">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="kb-modal-body kb-preview-body">
            <div v-for="(chunk, i) in (previewDocData.chunks || [])" :key="i" class="kb-chunk">
              <span class="kb-chunk-label">{{ t('kbChunkLabel', i + 1) }}</span>
              <p class="kb-chunk-text">{{ chunk.text }}</p>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="deleting" class="kb-modal-overlay" @click="deleting = null">
        <div class="kb-modal kb-modal-sm" @click.stop>
          <div class="kb-modal-body">
            <p class="kb-confirm-text">{{ t('kbDeleteConfirm').replace('{name}', deleting.title) }}</p>
            <p class="kb-confirm-sub">{{ t('kbDeleteSub') }}</p>
          </div>
          <div class="kb-modal-footer">
            <button class="kb-btn" @click="deleting = null">{{ t('cancel') }}</button>
            <button class="kb-btn danger" @click="doDelete">{{ t('kbDelete') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useKnowledgeStore } from '../stores/knowledgeStore.js'
import { useI18n } from '../composables/useI18n.js'

const { t, lang } = useI18n()
const kbStore = useKnowledgeStore()

const fileInput = ref(null)
const showAddText = ref(false)
const addTextTitle = ref('')
const addTextContent = ref('')
const previewDocData = ref(null)
const deleting = ref(null)

const documents = kbStore.documents
const loading = kbStore.loading
const uploading = kbStore.uploading
const modelReady = kbStore.modelReady
const ragEnabled = kbStore.ragEnabled
const documentCount = kbStore.documentCount
const totalChunks = kbStore.totalChunks

function setRagEnabled(v) { kbStore.setRagEnabled(v) }

async function onFilePicked(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    await kbStore.uploadDocument(file, file.name)
  } catch (err) {
    alert(t('kbUploadFail').replace('{msg}', err.message))
  }
  if (fileInput.value) fileInput.value.value = ''
}

async function submitAddText() {
  if (!addTextContent.value.trim()) return
  try {
    await kbStore.addText(addTextTitle.value || t('kbUnnamed'), addTextContent.value)
    showAddText.value = false
    addTextTitle.value = ''
    addTextContent.value = ''
  } catch (err) {
    alert(t('kbAddFail').replace('{msg}', err.message))
  }
}

async function previewDoc(doc) {
  try {
    const { getDocument } = await import('../api/index.js')
    // Use direct fetch since getDocument isn't in api/index
    const res = await fetch('/api/knowledge/documents/' + doc.id)
    const body = await res.json()
    const data = body?.data || body
    previewDocData.value = data
  } catch (err) {
    alert(t('kbPreviewFail').replace('{msg}', err.message))
  }
}

function confirmDelete(doc) {
  deleting.value = doc
}

async function doDelete() {
  if (!deleting.value) return
  try {
    await kbStore.deleteDocument(deleting.value.id)
    deleting.value = null
  } catch (err) {
    alert(t('kbDeleteFail').replace('{msg}', err.message))
  }
}

function formatSize(chars) {
  if (!chars) return t('kbDocChars', 0)
  if (chars < 1000) return t('kbDocChars', chars)
  return t('kbDocCharsK', (chars / 1000).toFixed(1))
}

function getFileTypeClass(fileType, source) {
  const ext = (fileType || '').toLowerCase()
  const name = (source || '').toLowerCase()
  if (ext === 'pdf' || name.endsWith('.pdf')) return 'ft-pdf'
  if (ext === 'docx' || ext === 'doc' || name.endsWith('.docx') || name.endsWith('.doc')) return 'ft-word'
  if (ext === 'txt' || ext === 'md' || ext === 'text' || name.endsWith('.txt') || name.endsWith('.md')) return 'ft-text'
  if (['json', 'csv', 'xml', 'yml', 'yaml', 'sql'].includes(ext)) return 'ft-data'
  if (['js', 'ts', 'py', 'java', 'go', 'c', 'cpp', 'rs', 'rb', 'php', 'sh', 'html', 'css'].includes(ext)) return 'ft-code'
  if (ext === 'log') return 'ft-log'
  return 'ft-default'
}

function getFileExt(fileType, source) {
  const ext = (fileType || '').toLowerCase()
  if (ext) return ext.toUpperCase()
  const m = (source || '').match(/\.([^.]+)$/)
  return m ? m[1].toUpperCase() : '?'
}

function formatDate(d) {
  if (!d) return ''
  try {
    const locale = lang.value === 'en' ? 'en-US' : 'zh-CN'
    return new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  } catch { return '' }
}

onMounted(async () => {
  await kbStore.loadDocuments()
  kbStore.checkStatus()
  // Warm up model in background if not ready
  if (!kbStore.modelReady) {
    kbStore.warmup().catch(() => {})
  }
})
</script>

<style scoped>
.kb-page { height: 100vh; height: 100dvh; overflow-y: auto; padding: 32px 40px; }
.kb-page::-webkit-scrollbar { width: 6px; }
.kb-page::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 6px; }

.kb-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
.kb-header-left { display: flex; gap: 14px; align-items: flex-start; }
.kb-header-icon { color: var(--text2); flex-shrink: 0; margin-top: 2px; }
.kb-title { font-size: 20px; font-weight: 600; color: var(--text); margin: 0 0 4px; }
.kb-sub { font-size: 13px; color: var(--text3); margin: 0; line-height: 1.5; }
.kb-header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

.kb-status { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text3); padding: 6px 10px; background: var(--bg3); border-radius: 20px; }
.kb-status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text4); }
.kb-status.ready .kb-status-dot { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,.5); }

.kb-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border2); background: var(--bg3); color: var(--text2); font-size: 13px; font-family: inherit; cursor: pointer; transition: all .15s; }
.kb-btn:hover:not(:disabled) { background: var(--bg4); color: var(--text); }
.kb-btn:disabled { opacity: .5; cursor: not-allowed; }
.kb-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.kb-btn.primary:hover:not(:disabled) { filter: brightness(1.1); }
.kb-btn.danger { color: #ef4444; border-color: rgba(239,68,68,.3); }
.kb-btn.danger:hover:not(:disabled) { background: rgba(239,68,68,.1); }

.kb-rag-bar { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 20px; }
.kb-rag-info { display: flex; gap: 10px; align-items: center; }
.kb-rag-info svg { color: var(--accent); flex-shrink: 0; }
.kb-rag-title { font-size: 13px; font-weight: 500; color: var(--text); display: block; }
.kb-rag-desc { font-size: 11px; color: var(--text3); display: block; margin-top: 2px; }
.kb-toggle { width: 40px; height: 22px; border-radius: 11px; border: none; background: var(--bg4); cursor: pointer; position: relative; transition: background .2s; flex-shrink: 0; }
.kb-toggle.on { background: var(--accent); }
.kb-toggle-knob { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
.kb-toggle.on .kb-toggle-knob { transform: translateX(18px); }

.kb-stats { display: flex; gap: 16px; margin-bottom: 20px; }
.kb-stat { flex: 1; padding: 16px 20px; background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; }
.kb-stat-num { font-size: 24px; font-weight: 600; color: var(--accent); display: block; }
.kb-stat-label { font-size: 12px; color: var(--text3); margin-top: 4px; display: block; }

.kb-list { display: flex; flex-direction: column; gap: 10px; }

/* Glassmorphism card — Apple-style frosted glass */
.kb-doc-card {
  display: flex; align-items: center; gap: 14px;
  padding: 16px 18px;
  border-radius: 14px;
  position: relative; overflow: hidden;
  /* Frosted glass base */
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 24px rgba(0, 0, 0, 0.04);
  transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s cubic-bezier(.2,.8,.2,1);
  isolation: isolate;
}
.kb-doc-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.06), 0 16px 40px rgba(0, 0, 0, 0.08);
}
.kb-doc-card.processing { opacity: .92; }
.kb-doc-card.failed { border-color: rgba(239, 68, 68, 0.4); }

/* Bottom-to-top color gradient layer (fades to white/transparent upward) */
.kb-doc-card::before {
  content: '';
  position: absolute; left: 0; right: 0; bottom: 0;
  height: 100%;
  z-index: -1;
  pointer-events: none;
}
.kb-doc-card.ft-pdf::before      { background: linear-gradient(0deg, rgba(239, 68, 68, 0.22) 0%, rgba(239, 68, 68, 0.06) 40%, rgba(255, 255, 255, 0) 80%); }
.kb-doc-card.ft-word::before     { background: linear-gradient(0deg, rgba(59, 130, 246, 0.22) 0%, rgba(59, 130, 246, 0.06) 40%, rgba(255, 255, 255, 0) 80%); }
.kb-doc-card.ft-text::before     { background: linear-gradient(0deg, rgba(20, 184, 166, 0.22) 0%, rgba(20, 184, 166, 0.06) 40%, rgba(255, 255, 255, 0) 80%); }
.kb-doc-card.ft-data::before     { background: linear-gradient(0deg, rgba(245, 158, 11, 0.22) 0%, rgba(245, 158, 11, 0.06) 40%, rgba(255, 255, 255, 0) 80%); }
.kb-doc-card.ft-code::before     { background: linear-gradient(0deg, rgba(34, 197, 94, 0.22) 0%, rgba(34, 197, 94, 0.06) 40%, rgba(255, 255, 255, 0) 80%); }
.kb-doc-card.ft-log::before      { background: linear-gradient(0deg, rgba(139, 92, 246, 0.22) 0%, rgba(139, 92, 246, 0.06) 40%, rgba(255, 255, 255, 0) 80%); }
.kb-doc-card.ft-default::before  { background: linear-gradient(0deg, rgba(107, 114, 128, 0.18) 0%, rgba(107, 114, 128, 0.05) 40%, rgba(255, 255, 255, 0) 80%); }

/* Dark mode: use dark glass */
:root[data-theme="dark"] .kb-doc-card,
.dark .kb-doc-card {
  background: rgba(40, 44, 52, 0.55);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.15);
}
:root[data-theme="dark"] .kb-doc-card.ft-pdf::before     { background: linear-gradient(0deg, rgba(239, 68, 68, 0.28) 0%, rgba(239, 68, 68, 0.08) 40%, rgba(255, 255, 255, 0) 80%); }
:root[data-theme="dark"] .kb-doc-card.ft-word::before    { background: linear-gradient(0deg, rgba(59, 130, 246, 0.28) 0%, rgba(59, 130, 246, 0.08) 40%, rgba(255, 255, 255, 0) 80%); }
:root[data-theme="dark"] .kb-doc-card.ft-text::before    { background: linear-gradient(0deg, rgba(20, 184, 166, 0.28) 0%, rgba(20, 184, 166, 0.08) 40%, rgba(255, 255, 255, 0) 80%); }
:root[data-theme="dark"] .kb-doc-card.ft-data::before    { background: linear-gradient(0deg, rgba(245, 158, 11, 0.28) 0%, rgba(245, 158, 11, 0.08) 40%, rgba(255, 255, 255, 0) 80%); }
:root[data-theme="dark"] .kb-doc-card.ft-code::before    { background: linear-gradient(0deg, rgba(34, 197, 94, 0.28) 0%, rgba(34, 197, 94, 0.08) 40%, rgba(255, 255, 255, 0) 80%); }
:root[data-theme="dark"] .kb-doc-card.ft-log::before     { background: linear-gradient(0deg, rgba(139, 92, 246, 0.28) 0%, rgba(139, 92, 246, 0.08) 40%, rgba(255, 255, 255, 0) 80%); }
:root[data-theme="dark"] .kb-doc-card.ft-default::before { background: linear-gradient(0deg, rgba(160, 167, 178, 0.2) 0%, rgba(160, 167, 178, 0.05) 40%, rgba(255, 255, 255, 0) 80%); }

/* File type icon — soft glassy chip */
.kb-doc-icon {
  width: 42px; height: 42px; border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; font-size: 10px; font-weight: 700; letter-spacing: .5px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 2px 6px rgba(0, 0, 0, 0.06);
}
.kb-doc-icon.ft-pdf      { color: #dc2626; }
.kb-doc-icon.ft-word     { color: #2563eb; }
.kb-doc-icon.ft-text     { color: #0d9488; }
.kb-doc-icon.ft-data     { color: #d97706; }
.kb-doc-icon.ft-code     { color: #16a34a; }
.kb-doc-icon.ft-log      { color: #7c3aed; }
.kb-doc-icon.ft-default  { color: #6b7280; }
:root[data-theme="dark"] .kb-doc-icon,
.dark .kb-doc-icon {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 2px 6px rgba(0, 0, 0, 0.2);
}
.kb-doc-ext { font-size: 10px; font-weight: 700; }

.kb-doc-info { flex: 1; min-width: 0; }
.kb-doc-title { font-size: 14px; font-weight: 600; color: var(--text); display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -.01em; }
.kb-doc-meta { display: flex; gap: 12px; margin-top: 5px; font-size: 11px; color: var(--text3); flex-wrap: wrap; align-items: center; }

/* Status badges — pill style */
.kb-doc-status { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 10px; font-size: 10px; font-weight: 600; backdrop-filter: blur(8px); }
.kb-doc-status.processing { background: rgba(245, 158, 11, 0.15); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.25); }
.kb-doc-status.ready { background: rgba(34, 197, 94, 0.15); color: #16a34a; border: 1px solid rgba(34, 197, 94, 0.25); }
.kb-doc-status.failed { background: rgba(239, 68, 68, 0.15); color: #dc2626; border: 1px solid rgba(239, 68, 68, 0.25); }

.kb-mini-spinner { display: inline-block; width: 12px; height: 12px; border: 1.5px solid currentColor; border-top-color: transparent; border-radius: 50%; animation: kb-spin .8s linear infinite; }

.kb-doc-actions { display: flex; gap: 4px; flex-shrink: 0; align-items: center; }
.kb-doc-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid transparent; background: rgba(255, 255, 255, 0.4); color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .15s; backdrop-filter: blur(8px); }
.kb-doc-btn:hover { background: rgba(255, 255, 255, 0.7); color: var(--text); border-color: rgba(255, 255, 255, 0.8); }
.kb-doc-btn.danger:hover { color: #dc2626; background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.25); }
:root[data-theme="dark"] .kb-doc-btn,
.dark .kb-doc-btn { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.06); }
:root[data-theme="dark"] .kb-doc-btn:hover,
.dark .kb-doc-btn:hover { background: rgba(255, 255, 255, 0.12); border-color: rgba(255, 255, 255, 0.15); }

.kb-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
.kb-empty-title { font-size: 16px; font-weight: 500; color: var(--text2); margin-top: 16px; }
.kb-empty-desc { font-size: 13px; color: var(--text3); margin-top: 8px; max-width: 400px; line-height: 1.6; }

.kb-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text3); font-size: 13px; }
.kb-spinner { width: 18px; height: 18px; border: 2px solid var(--bg4); border-top-color: var(--accent); border-radius: 50%; animation: kb-spin .8s linear infinite; }
@keyframes kb-spin { to { transform: rotate(360deg); } }

/* Modals */
.kb-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.kb-modal { background: var(--bg2); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 560px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
.kb-modal-sm { max-width: 360px; }
.kb-modal-preview { max-width: 700px; }
.kb-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: 15px; font-weight: 500; color: var(--text); }
.kb-modal-close { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.kb-modal-close:hover { background: var(--bg3); color: var(--text); }
.kb-modal-body { padding: 20px; overflow-y: auto; flex: 1; }
.kb-preview-body { display: flex; flex-direction: column; gap: 16px; }
.kb-input { width: 100%; padding: 10px 12px; border: 1px solid var(--border2); border-radius: 8px; background: var(--bg3); color: var(--text); font-size: 14px; font-family: inherit; margin-bottom: 12px; }
.kb-input:focus { outline: none; border-color: var(--accent); }
.kb-textarea { width: 100%; min-height: 200px; padding: 12px; border: 1px solid var(--border2); border-radius: 8px; background: var(--bg3); color: var(--text); font-size: 13px; font-family: inherit; resize: vertical; line-height: 1.6; }
.kb-textarea:focus { outline: none; border-color: var(--accent); }
.kb-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border); }
.kb-chunk { padding: 12px; background: var(--bg3); border-radius: 8px; border-left: 3px solid var(--accent); }
.kb-chunk-label { font-size: 11px; color: var(--accent); font-weight: 500; display: block; margin-bottom: 6px; }
.kb-chunk-text { font-size: 13px; color: var(--text2); line-height: 1.6; margin: 0; white-space: pre-wrap; }
.kb-confirm-text { font-size: 15px; color: var(--text); margin: 0 0 6px; }
.kb-confirm-sub { font-size: 12px; color: var(--text3); margin: 0; }
</style>
