<template>
  <div class="wf-list-page">
    <div class="wf-list-header">
      <div class="wf-list-header-left">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="wf-list-icon">
          <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="18" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8.5 6H14a2 2 0 0 1 2 2v1.5M8.5 18H14a2 2 0 0 0 2-2v-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <div>
          <h2 class="wf-list-title">{{ t('wfTitle') }}</h2>
          <p class="wf-list-sub">{{ t('wfSub') }}</p>
        </div>
      </div>
      <button class="wf-list-btn primary" @click="createNew">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        {{ t('wfNew') }}
      </button>
    </div>

    <div class="wf-list-grid" v-if="workflows.length">
      <div v-for="wf in workflows" :key="wf.id" class="wf-card" @click="openEditor(wf.id)">
        <div class="wf-card-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="18" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8.5 6H14a2 2 0 0 1 2 2v1.5M8.5 18H14a2 2 0 0 0 2-2v-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="wf-card-body">
          <span class="wf-card-title">{{ wf.name }}</span>
          <span class="wf-card-desc">{{ wf.description || t('wfCardEdit') }}</span>
          <span class="wf-card-date">{{ formatDate(wf.updated_at || wf.created_at) }}</span>
        </div>
        <button class="wf-card-del" @click.stop="confirmDelete(wf)" :title="t('delete')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>

    <div class="wf-list-empty" v-else-if="!loading">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
        <circle cx="14" cy="14" r="5" stroke="var(--text4)" stroke-width="1.5"/>
        <circle cx="14" cy="42" r="5" stroke="var(--text4)" stroke-width="1.5"/>
        <circle cx="42" cy="28" r="5" stroke="var(--text4)" stroke-width="1.5"/>
        <path d="M19 14h14a4 4 0 0 1 4 4v5M19 42h14a4 4 0 0 0 4-4v-5" stroke="var(--text4)" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span class="wf-list-empty-title">{{ t('wfEmptyTitle') }}</span>
      <span class="wf-list-empty-desc">{{ t('wfEmptyDesc') }}</span>
      <button class="wf-list-btn primary" @click="createNew">{{ t('wfCreate') }}</button>
    </div>

    <div class="wf-list-loading" v-if="loading">
      <div class="wf-list-spinner"></div>
      <span>{{ t('wfLoading') }}</span>
    </div>

    <!-- Delete confirm -->
    <Teleport to="body">
      <div v-if="deleting" class="wf-modal-overlay" @click="deleting = null">
        <div class="wf-modal-sm" @click.stop>
          <div class="wf-modal-body">
            <p class="wf-confirm-text">{{ t('wfDeleteConfirm').replace('{name}', deleting.name) }}</p>
            <p class="wf-confirm-sub">{{ t('wfDeleteSub') }}</p>
          </div>
          <div class="wf-modal-footer">
            <button class="wf-list-btn" @click="deleting = null">{{ t('cancel') }}</button>
            <button class="wf-list-btn danger" @click="doDelete">{{ t('delete') }}</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkflowStore } from '../stores/workflowStore.js'
import { useI18n } from '../composables/useI18n.js'

const router = useRouter()
const wfStore = useWorkflowStore()
const { t, lang } = useI18n()

const workflows = wfStore.workflows
const loading = wfStore.loading
const deleting = ref(null)

async function createNew() {
  const w = await wfStore.createWorkflow(t('wfNewName'))
  if (w?.id) router.push('/workflow/' + w.id)
}

function openEditor(id) {
  router.push('/workflow/' + id)
}

function confirmDelete(wf) {
  deleting.value = wf
}

async function doDelete() {
  if (!deleting.value) return
  try {
    await wfStore.deleteWorkflow(deleting.value.id)
    deleting.value = null
  } catch (e) {
    alert(t('wfDeleteFail').replace('{msg}', e.message))
  }
}

function formatDate(d) {
  if (!d) return ''
  try {
    const locale = lang.value === 'en' ? 'en-US' : 'zh-CN'
    return new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return '' }
}

onMounted(() => {
  wfStore.loadWorkflows()
})
</script>

<style scoped>
.wf-list-page { height: 100vh; height: 100dvh; overflow-y: auto; padding: 32px 40px; }
.wf-list-page::-webkit-scrollbar { width: 6px; }
.wf-list-page::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 6px; }

.wf-list-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28px; gap: 16px; flex-wrap: wrap; }
.wf-list-header-left { display: flex; gap: 14px; align-items: flex-start; }
.wf-list-icon { color: var(--text2); flex-shrink: 0; margin-top: 2px; }
.wf-list-title { font-size: 20px; font-weight: 600; color: var(--text); margin: 0 0 4px; }
.wf-list-sub { font-size: 13px; color: var(--text3); margin: 0; line-height: 1.5; max-width: 500px; }

.wf-list-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border2); background: var(--bg3); color: var(--text2); font-size: 13px; font-family: inherit; cursor: pointer; transition: all .15s; }
.wf-list-btn:hover:not(:disabled) { background: var(--bg4); color: var(--text); }
.wf-list-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.wf-list-btn.primary:hover { filter: brightness(1.1); }
.wf-list-btn.danger { color: #ef4444; border-color: rgba(239,68,68,.3); }
.wf-list-btn.danger:hover { background: rgba(239,68,68,.1); }

.wf-list-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.wf-card { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--bg3); border: 1px solid var(--border); border-radius: 12px; cursor: pointer; transition: all .15s; position: relative; }
.wf-card:hover { border-color: var(--accent); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.1); }
.wf-card-icon { width: 40px; height: 40px; border-radius: 10px; background: var(--accent); background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.wf-card-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.wf-card-title { font-size: 14px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wf-card-desc { font-size: 11px; color: var(--text3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wf-card-date { font-size: 10px; color: var(--text4); margin-top: 2px; }
.wf-card-del { position: absolute; top: 8px; right: 8px; width: 24px; height: 24px; border-radius: 6px; border: none; background: transparent; color: var(--text4); cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .12s; }
.wf-card:hover .wf-card-del { opacity: 1; }
.wf-card-del:hover { background: rgba(239,68,68,.15); color: #ef4444; }

.wf-list-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; gap: 8px; }
.wf-list-empty-title { font-size: 16px; font-weight: 500; color: var(--text2); margin-top: 16px; }
.wf-list-empty-desc { font-size: 13px; color: var(--text3); max-width: 400px; line-height: 1.6; margin-bottom: 16px; }

.wf-list-loading { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 40px; color: var(--text3); font-size: 13px; }
.wf-list-spinner { width: 18px; height: 18px; border: 2px solid var(--bg4); border-top-color: var(--accent); border-radius: 50%; animation: wf-spin .8s linear infinite; }
@keyframes wf-spin { to { transform: rotate(360deg); } }

/* Modals */
.wf-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.wf-modal-sm { background: var(--bg2); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 360px; box-shadow: 0 20px 60px rgba(0,0,0,.4); }
.wf-modal-body { padding: 20px; }
.wf-modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 14px 20px; border-top: 1px solid var(--border); }
.wf-confirm-text { font-size: 15px; color: var(--text); margin: 0 0 6px; }
.wf-confirm-sub { font-size: 12px; color: var(--text3); margin: 0; }
</style>
