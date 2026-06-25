<template>
  <div class="proj-page">
    <!-- Header -->
    <div class="proj-header">
      <div class="proj-header-left">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="proj-header-icon">
          <path d="M3 7C3 5.9 3.9 5 5 5H9L11 7H19C20.1 7 21 7.9 21 9V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div>
          <h2 class="proj-title">{{ t('projTitle') }}</h2>
          <p class="proj-sub">{{ t('projSub') }}</p>
        </div>
      </div>
      <div class="proj-header-actions">
        <button class="proj-btn primary" @click="showCreate = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ t('projNew') }}
        </button>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="!projects.length && !showCreate" class="proj-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" class="proj-empty-icon">
        <path d="M3 7C3 5.9 3.9 5 5 5H9L11 7H19C20.1 7 21 7.9 21 9V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      </svg>
      <p class="proj-empty-title">{{ t('projEmptyTitle') }}</p>
      <p class="proj-empty-desc">{{ t('projEmptyDesc') }}</p>
      <button class="proj-btn primary" @click="showCreate = true">{{ t('projCreateFirst') }}</button>
    </div>

    <!-- Project grid -->
    <div v-if="projects.length" class="proj-grid">
      <div
        v-for="p in projects"
        :key="p.id"
        class="proj-card"
        :style="{ '--proj-color': p.color || '#5b8def' }"
        @click="openProject(p)"
      >
        <div class="proj-card-bar"></div>
        <div class="proj-card-body">
          <div class="proj-card-top">
            <span class="proj-card-dot" :style="{ background: p.color || '#5b8def' }"></span>
            <h3 class="proj-card-name">{{ p.name }}</h3>
            <button class="proj-card-menu" @click.stop="openMenu($event, p)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>
            </button>
          </div>
          <p class="proj-card-desc">{{ p.instructions ? (p.instructions.length > 80 ? p.instructions.slice(0, 80) + '…' : p.instructions) : t('projCardNoInstr') }}</p>
          <div class="proj-card-meta">
            <span class="proj-card-stat">{{ t('projConvCount', getConvCount(p.id)) }}</span>
            <span class="proj-card-stat">{{ t('projKbCount', getKbCount(p)) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit modal -->
    <div v-if="showCreate || editing" class="proj-modal-mask" @click.self="closeModal">
      <div class="proj-modal">
        <div class="proj-modal-header">
          <h3>{{ editing ? t('projEditTitle') : t('projNewTitle') }}</h3>
          <button class="proj-modal-close" @click="closeModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="proj-modal-body">
          <div class="proj-field">
            <label>{{ t('projFieldName') }}</label>
            <input v-model="form.name" class="proj-input" :placeholder="t('projFieldNamePh')" />
          </div>
          <div class="proj-field">
            <label>{{ t('projFieldColor') }}</label>
            <div class="proj-colors">
              <button
                v-for="c in colors"
                :key="c"
                :class="['proj-color', { active: form.color === c }]"
                :style="{ background: c }"
                @click="form.color = c"
              ></button>
            </div>
          </div>
          <div class="proj-field">
            <label>{{ t('projFieldInstr') }}</label>
            <p class="proj-field-hint">{{ t('projFieldInstrHint') }}</p>
            <textarea v-model="form.instructions" class="proj-textarea" rows="6" :placeholder="t('projFieldInstrPh')"></textarea>
          </div>
          <div class="proj-field">
            <label>{{ t('projFieldKb') }}</label>
            <p class="proj-field-hint">{{ t('projFieldKbHint') }}</p>
            <div class="proj-kb-list">
              <label v-for="kb in knowledgeBases" :key="kb.id" class="proj-kb-item">
                <input type="checkbox" :value="kb.id" v-model="form.knowledgeIds" />
                <span>{{ kb.name }}</span>
              </label>
              <p v-if="!knowledgeBases.length" class="proj-kb-empty">{{ t('projKbEmpty') }}</p>
            </div>
          </div>
        </div>
        <div class="proj-modal-footer">
          <button v-if="editing" class="proj-btn danger" @click="deleteProject">{{ t('projDelete') }}</button>
          <div class="proj-modal-footer-right">
            <button class="proj-btn" @click="closeModal">{{ t('projCancel') }}</button>
            <button class="proj-btn primary" @click="saveProject">{{ editing ? t('projSave') : t('projCreate') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Project detail drawer -->
    <div v-if="current" class="proj-detail-mask" @click.self="current = null">
      <div class="proj-detail">
        <div class="proj-detail-header" :style="{ background: current.color || '#5b8def' }">
          <h2>{{ current.name }}</h2>
          <button class="proj-detail-close" @click="current = null">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="proj-detail-body">
          <div class="proj-detail-section">
            <div class="proj-detail-section-head">
              <h4>{{ t('projDetailInstr') }}</h4>
              <button class="proj-detail-edit" @click="editProject(current)">{{ t('projDetailEdit') }}</button>
            </div>
            <p class="proj-detail-text">{{ current.instructions || t('projDetailNoInstr') }}</p>
          </div>
          <div class="proj-detail-section">
            <div class="proj-detail-section-head">
              <h4>{{ t('projDetailConvs') }}（{{ getConvCount(current.id) }}）</h4>
              <button class="proj-detail-new" @click="newChatInProject(current)">{{ t('projDetailNewChat') }}</button>
            </div>
            <div class="proj-detail-convs">
              <div
                v-for="c in getConvs(current.id)"
                :key="c.id"
                class="proj-detail-conv"
                @click="goChat(c.id)"
              >
                <span class="proj-detail-conv-title">{{ c.title || t('newChat') }}</span>
                <span class="proj-detail-conv-time">{{ formatTime(c.created_at) }}</span>
              </div>
              <p v-if="!getConvs(current.id).length" class="proj-detail-empty">{{ t('projDetailNoConv') }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Context menu -->
    <div v-if="menu.visible" class="proj-menu" :style="{ top: menu.y + 'px', left: menu.x + 'px' }" @click.stop>
      <button class="proj-menu-item" @click="editProject(menu.project); menu.visible = false">{{ t('projMenuEdit') }}</button>
      <button class="proj-menu-item danger" @click="confirmDelete(menu.project); menu.visible = false">{{ t('projMenuDelete') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getProjects, getProject, createProject, updateProject, deleteProject as removeProject, setConversationProject, getConversationsByProject } from '../db/database.js'
import { useKnowledgeStore } from '../stores/knowledgeStore.js'
import { useI18n } from '../composables/useI18n.js'

const router = useRouter()
const kbStore = useKnowledgeStore()
const { t } = useI18n()

const projects = ref([])
const showCreate = ref(false)
const editing = ref(false)
const current = ref(null)
const knowledgeBases = ref([])
const convCache = ref({}) // projectId -> conversations

const colors = ['#5b8def', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#64748b']

const form = reactive({
  id: '',
  name: '',
  instructions: '',
  knowledgeIds: [],
  color: '#5b8def',
})

const menu = reactive({ visible: false, x: 0, y: 0, project: null })

function loadProjects() {
  projects.value = getProjects()
  // Cache conversations per project
  for (const p of projects.value) {
    convCache.value[p.id] = getConversationsByProject(p.id)
  }
}

function loadKnowledgeBases() {
  knowledgeBases.value = (kbStore.documents || []).map(d => ({ id: String(d.id), name: d.title || d.name || t('kbUnnamed') }))
}

function openProject(p) {
  current.value = p
}

function editProject(p) {
  editing.value = true
  showCreate.value = false
  current.value = null
  form.id = p.id
  form.name = p.name
  form.instructions = p.instructions || ''
  form.color = p.color || '#5b8def'
  try { form.knowledgeIds = JSON.parse(p.knowledge_ids || '[]') } catch { form.knowledgeIds = [] }
}

function closeModal() {
  showCreate.value = false
  editing.value = false
  form.id = ''
  form.name = ''
  form.instructions = ''
  form.knowledgeIds = []
  form.color = '#5b8def'
}

function saveProject() {
  if (!form.name.trim()) { alert(t('projEnterName')); return }
  const kbIds = JSON.stringify(form.knowledgeIds)
  if (editing.value) {
    updateProject(form.id, form.name.trim(), form.instructions.trim(), kbIds, form.color)
  } else {
    const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    createProject(id, form.name.trim(), form.instructions.trim(), kbIds, form.color)
  }
  closeModal()
  loadProjects()
}

function confirmDelete(p) {
  if (!confirm(t('projDeleteConfirm').replace('{name}', p.name))) return
  removeProject(p.id)
  loadProjects()
}

function deleteProject() {
  if (!editing.value) return
  if (!confirm(t('projDeleteConfirm').replace('{name}', form.name))) return
  removeProject(form.id)
  closeModal()
  loadProjects()
}

function newChatInProject(p) {
  // Create a new conversation and assign to project
  // We navigate to home which will create a new conversation, then we assign it
  // Use a query param so HomeView can pick it up
  router.push(`/?project=${p.id}`)
}

function goChat(convId) {
  router.push(`/chat/${convId}`)
  current.value = null
}

function openMenu(e, p) {
  menu.visible = true
  menu.x = e.clientX
  menu.y = e.clientY
  menu.project = p
}

function closeMenu() {
  menu.visible = false
}

function getConvCount(pid) {
  return (convCache.value[pid] || []).length
}

function getConvs(pid) {
  return convCache.value[pid] || []
}

function getKbCount(p) {
  try { return JSON.parse(p.knowledge_ids || '[]').length } catch { return 0 }
}

function formatTime(t) {
  if (!t) return ''
  return t.replace('T', ' ').slice(0, 16)
}

onMounted(async () => {
  loadProjects()
  try { await kbStore.loadDocuments() } catch {}
  loadKnowledgeBases()
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>

<style scoped>
.proj-page {
  height: 100vh;
  overflow-y: auto;
  background: var(--bg);
  padding: 32px 40px;
}

/* Header */
.proj-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
}
.proj-header-left {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}
.proj-header-icon { color: var(--text2); flex-shrink: 0; margin-top: 2px; }
.proj-title { margin: 0; font-size: 20px; font-weight: 600; color: var(--text); }
.proj-sub { margin: 4px 0 0; font-size: 13px; color: var(--text3); }

.proj-header-actions { display: flex; gap: 8px; }

.proj-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg2);
  color: var(--text2);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.proj-btn:hover { background: var(--bg3); color: var(--text); }
.proj-btn.primary { background: #5b8def; color: #fff; border-color: #5b8def; }
.proj-btn.primary:hover { opacity: 0.88; }
.proj-btn.danger { background: transparent; color: #ef4444; border-color: rgba(239,68,68,0.3); }
.proj-btn.danger:hover { background: rgba(239,68,68,0.1); }

/* Empty */
.proj-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}
.proj-empty-icon { color: var(--text-muted); margin-bottom: 16px; }
.proj-empty-title { font-size: 16px; font-weight: 600; color: var(--text2); margin: 0 0 8px; }
.proj-empty-desc { font-size: 13px; color: var(--text3); max-width: 420px; line-height: 1.6; margin: 0 0 20px; }

/* Grid */
.proj-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.proj-card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.18s;
}
.proj-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  border-color: var(--proj-color);
}
.proj-card-bar { height: 4px; background: var(--proj-color); }
.proj-card-body { padding: 16px; }
.proj-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.proj-card-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.proj-card-name { flex: 1; margin: 0; font-size: 15px; font-weight: 600; color: var(--text); }
.proj-card-menu {
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; color: var(--text3);
  border-radius: 6px; cursor: pointer;
}
.proj-card-menu:hover { background: var(--bg3); color: var(--text); }
.proj-card-desc {
  margin: 0 0 12px;
  font-size: 12.5px;
  color: var(--text3);
  line-height: 1.5;
  min-height: 38px;
}
.proj-card-meta { display: flex; gap: 12px; }
.proj-card-stat { font-size: 11.5px; color: var(--text-muted); }

/* Modal */
.proj-modal-mask, .proj-detail-mask {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.proj-modal {
  background: var(--bg);
  border-radius: 14px;
  width: 560px;
  max-width: 92vw;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.proj-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}
.proj-modal-header h3 { margin: 0; font-size: 16px; font-weight: 600; color: var(--text); }
.proj-modal-close {
  width: 28px; height: 28px;
  background: transparent; border: none; color: var(--text3);
  cursor: pointer; border-radius: 6px;
}
.proj-modal-close:hover { background: var(--bg3); color: var(--text); }
.proj-modal-body { padding: 20px 22px; }
.proj-field { margin-bottom: 18px; }
.proj-field label { display: block; font-size: 13px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
.proj-field-hint { font-size: 11.5px; color: var(--text3); margin: 0 0 8px; line-height: 1.5; }
.proj-input, .proj-textarea {
  width: 100%;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 9px 12px;
  color: var(--text);
  font-size: 13px;
  outline: none;
  font-family: inherit;
}
.proj-input:focus, .proj-textarea:focus { border-color: #5b8def; }
.proj-textarea { resize: vertical; line-height: 1.6; }
.proj-colors { display: flex; gap: 8px; flex-wrap: wrap; }
.proj-color {
  width: 28px; height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.proj-color.active { border-color: var(--text); transform: scale(1.1); }
.proj-kb-list { display: flex; flex-direction: column; gap: 6px; }
.proj-kb-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px;
  background: var(--bg2);
  border-radius: 6px;
  font-size: 13px; color: var(--text2);
  cursor: pointer;
}
.proj-kb-item:hover { background: var(--bg3); }
.proj-kb-empty { font-size: 12px; color: var(--text-muted); margin: 0; }
.proj-modal-footer {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 22px;
  border-top: 1px solid var(--border);
}
.proj-modal-footer-right { display: flex; gap: 8px; }

/* Detail drawer */
.proj-detail {
  background: var(--bg);
  border-radius: 14px;
  width: 520px;
  max-width: 92vw;
  max-height: 88vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.proj-detail-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 22px;
  color: #fff;
}
.proj-detail-header h2 { margin: 0; font-size: 18px; font-weight: 600; }
.proj-detail-close {
  width: 30px; height: 30px;
  background: rgba(255,255,255,0.2); border: none; color: #fff;
  cursor: pointer; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.proj-detail-close:hover { background: rgba(255,255,255,0.3); }
.proj-detail-body { padding: 20px 22px; }
.proj-detail-section { margin-bottom: 22px; }
.proj-detail-section-head {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.proj-detail-section-head h4 { margin: 0; font-size: 13px; font-weight: 600; color: var(--text2); }
.proj-detail-edit, .proj-detail-new {
  background: transparent; border: none; color: #5b8def;
  font-size: 12px; cursor: pointer; padding: 2px 6px;
  border-radius: 4px;
}
.proj-detail-edit:hover, .proj-detail-new:hover { background: rgba(91,141,239,0.1); }
.proj-detail-text {
  margin: 0;
  font-size: 13px;
  color: var(--text2);
  line-height: 1.6;
  white-space: pre-wrap;
  background: var(--bg2);
  padding: 12px;
  border-radius: 8px;
}
.proj-detail-convs { display: flex; flex-direction: column; gap: 4px; }
.proj-detail-conv {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 12px;
  background: var(--bg2);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.proj-detail-conv:hover { background: var(--bg3); }
.proj-detail-conv-title { font-size: 13px; color: var(--text); }
.proj-detail-conv-time { font-size: 11px; color: var(--text-muted); }
.proj-detail-empty { font-size: 12px; color: var(--text-muted); margin: 8px 0; }

/* Context menu */
.proj-menu {
  position: fixed;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  z-index: 1001;
  min-width: 120px;
}
.proj-menu-item {
  display: block; width: 100%;
  padding: 7px 12px;
  background: transparent; border: none;
  color: var(--text2); font-size: 13px;
  text-align: left; cursor: pointer;
  border-radius: 5px;
}
.proj-menu-item:hover { background: var(--bg3); color: var(--text); }
.proj-menu-item.danger { color: #ef4444; }
.proj-menu-item.danger:hover { background: rgba(239,68,68,0.1); }
</style>
