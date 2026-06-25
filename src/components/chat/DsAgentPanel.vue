<template>
  <div class="ds-panel" :class="{ fold: folded }">
    <!-- Panel header -->
    <div class="ds-header" @click="folded = !folded">
      <div class="ds-header-left">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="ds-hdr-icon">
          <rect x="2.5" y="4" width="9" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
          <circle cx="5.5" cy="7.5" r="0.8" fill="currentColor"/>
          <circle cx="8.5" cy="7.5" r="0.8" fill="currentColor"/>
          <path d="M7 2v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span class="ds-title">{{ t('dsAgents') }}</span>
        <span class="ds-count" v-if="agents.length">{{ agents.length }}</span>
        <span class="ds-active" v-if="activeCount > 0">{{ activeCount }} {{ t('dsActive') }}</span>
      </div>
      <div class="ds-header-right">
        <button class="ds-add-btn" @click.stop="showAdd = !showAdd" :title="t('dsAddAgent')">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2v8M2 6h8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" class="ds-arr"><path :d="folded ? 'M3 2l4 3-4 3' : 'M2 3l3 4 3-4'" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
    </div>

    <!-- Add agent form -->
    <div v-if="showAdd && !folded" class="ds-add-form">
      <div class="ds-template-list">
        <button v-for="tpl in templates" :key="tpl.role" class="ds-tpl-btn" @click="addAgent(tpl)" :title="tpl.role">
          <span class="ds-tpl-icon" v-html="tpl.icon"></span>
          <span class="ds-tpl-name">{{ tpl.name }}</span>
        </button>
      </div>
    </div>

    <!-- Agent list — 紧凑小条子样式 -->
    <div v-if="!folded" class="ds-body">
      <div v-if="!agents.length && !showAdd" class="ds-empty">
        {{ t('dsNoAgents') }}
        <button class="ds-empty-btn" @click="showAdd = true">{{ t('dsAddFirst') }}</button>
      </div>

      <!-- 单个 agent 小条子 -->
      <div v-for="a in agents" :key="a.id" class="ds-bar" :class="{ active: a.status === 'working' }">
        <!-- 条子主体：点击展开详情 -->
        <div class="ds-bar-main" @click="toggleAgent(a.id)">
          <span class="ds-bar-icon" v-html="getIcon(a.avatar)"></span>
          <span class="ds-bar-name">{{ a.name }}</span>
          <span class="ds-bar-role">{{ t('dsRole_' + a.role) }}</span>
          <!-- 状态点（黑白灰） -->
          <span class="ds-dot" :class="a.status"></span>
          <!-- 当前任务简述（只显示一行） -->
          <span v-if="a.status === 'working' && a.current_task" class="ds-bar-task">{{ truncate(a.current_task, 30) }}</span>
          <!-- Plan 进度指示（如果有计划） -->
          <span v-if="agentPlans[a.id]" class="ds-bar-plan-tag">{{ planProgress(a.id) }}</span>
          <!-- 主动介入：中断按钮 -->
          <button v-if="a.status === 'working'" class="ds-bar-stop" @click.stop="interruptAgent(a)" :title="t('dsInterrupt')">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><rect x="1.5" y="1.5" width="5" height="5" fill="currentColor"/></svg>
          </button>
          <button class="ds-bar-del" @click.stop="removeAgent(a)" :title="t('dsRemove')">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          </button>
        </div>

        <!-- 展开详情（用户点击才显示） -->
        <div v-if="expandedAgent === a.id" class="ds-bar-detail">
          <div v-if="a.status === 'working' && a.current_task" class="ds-current-task">
            <span class="ds-task-label">{{ t('dsWorking') }}:</span>
            <span class="ds-task-text">{{ a.current_task }}</span>
          </div>

          <!-- Plan 计划展示（复杂任务） -->
          <div v-if="agentPlans[a.id]" class="ds-plan">
            <div class="ds-plan-header">
              <span class="ds-plan-title">{{ t('dsPlan') }}</span>
              <span class="ds-plan-summary" v-if="agentPlans[a.id].summary">{{ agentPlans[a.id].summary }}</span>
            </div>
            <div class="ds-plan-list">
              <div v-for="(step, i) in agentPlans[a.id].plan" :key="i" class="ds-plan-step" :class="step.status">
                <span class="ds-step-mark">
                  <svg v-if="step.status === 'completed'" width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <span v-else-if="step.status === 'in_progress'" class="ds-step-dot"></span>
                  <span v-else class="ds-step-num">{{ i + 1 }}</span>
                </span>
                <span class="ds-step-text">{{ step.step }}</span>
              </div>
            </div>
          </div>

          <!-- 流式输出实时显示 -->
          <div v-if="streamTexts[a.id]" class="ds-stream">
            <div class="ds-stream-text">{{ streamTexts[a.id] }}<span class="ds-cursor" v-if="a.status === 'working'"></span></div>
          </div>

          <!-- Progress log -->
          <div v-if="agentLogs[a.id] && agentLogs[a.id].length" class="ds-log" ref="logRef">
            <div v-for="(e, i) in agentLogs[a.id]" :key="i" class="ds-log-line" :class="e.type">
              <template v-if="e.type === 'thinking'">
                <span class="ds-log-dim">{{ truncate(e.text, 120) }}</span>
              </template>
              <template v-else-if="e.type === 'tool_start' || e.type === 'tool_detected'">
                <span class="ds-log-dot"></span>
                <span class="ds-log-act">{{ actMap(e.tool) }}</span>
                <span class="ds-log-det">{{ det(e) }}</span>
              </template>
              <template v-else-if="e.type === 'round'">
                <span class="ds-log-round">R{{ e.round }}</span>
              </template>
              <template v-else-if="e.type === 'done' || e.type === 'final'">
                <span class="ds-log-ok">{{ truncate(e.text, 100) }}</span>
              </template>
              <template v-else-if="e.type === 'error'">
                <span class="ds-log-err">{{ e.text }}</span>
              </template>
            </div>
          </div>

          <div v-else-if="a.status === 'idle'" class="ds-idle">{{ t('dsIdle') }}</div>
          <div v-else-if="a.status === 'error'" class="ds-err-state">{{ t('dsErrorState') }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue'
import { dsAgents } from '../../api/index.js'
import { useI18n } from '../../composables/useI18n.js'

const { t } = useI18n()

const props = defineProps({
  roomId: { type: String, required: true },
})

const emit = defineEmits(['agent-event'])

const agents = ref([])
const templates = ref([])
const showAdd = ref(false)
const folded = ref(false)
const expandedAgent = ref(null)
const agentLogs = reactive({})
const streamTexts = reactive({}) // 实时流式文本
const agentPlans = reactive({}) // agent 的任务计划
const logRef = ref(null)

const activeCount = ref(0)

// SVG icons for agent avatars
const ICONS = {
  code: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2.5L1.5 6 4 9.5M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  pen: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 10l1-2.5 6-6 1.5 1.5-6 6-2.5 1z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chart: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 10V3.5M5.5 10V6M9.5 10V1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  server: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2" width="9" height="3" rx="0.8" stroke="currentColor" stroke-width="1.2"/><rect x="1.5" y="7" width="9" height="3" rx="0.8" stroke="currentColor" stroke-width="1.2"/><circle cx="3.5" cy="3.5" r="0.4" fill="currentColor"/><circle cx="3.5" cy="8.5" r="0.4" fill="currentColor"/></svg>',
  bot: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="3.5" width="8" height="6" rx="1.2" stroke="currentColor" stroke-width="1.2"/><circle cx="4.5" cy="6.5" r="0.7" fill="currentColor"/><circle cx="7.5" cy="6.5" r="0.7" fill="currentColor"/><path d="M6 1.5v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
}

function getIcon(avatar) {
  return ICONS[avatar] || ICONS.bot
}

function actMap(tool) {
  const map = {
    list_files: t('actListing'),
    read_file: t('actReading'),
    write_file: t('actWriting'),
    edit_file: t('actEditing'),
    glob: t('actFinding'),
    grep: t('actSearching'),
    run_command: t('actRunning'),
    web_search: t('actWebSearching'),
  }
  return map[tool] || tool
}

function det(e) {
  const a = e.args || {}
  return a.path || a.pattern || a.query || (a.command || '').slice(0, 40) || a.dir || ''
}

function truncate(text, len) {
  if (!text) return ''
  return text.length > len ? text.slice(0, len) + '...' : text
}

async function loadAgents() {
  try {
    const data = await dsAgents.listByRoom(props.roomId)
    agents.value = data.agents || []
    updateActiveCount()
  } catch (e) {
    console.error('Load agents failed:', e)
  }
}

async function loadTemplates() {
  try {
    const data = await dsAgents.templates()
    templates.value = data.templates || []
  } catch (e) {
    console.error('Load templates failed:', e)
  }
}

async function addAgent(tpl) {
  try {
    await dsAgents.create(props.roomId, {
      role: tpl.role,
      name: tpl.name,
      avatar: tpl.avatar,
      model: tpl.model,
    })
    showAdd.value = false
    await loadAgents()
    emit('agent-event', { type: 'list_changed' })
  } catch (e) {
    alert(e.message)
  }
}

async function removeAgent(a) {
  if (!confirm(t('dsRemoveConfirm') + ' ' + a.name + '?')) return
  try {
    await dsAgents.deleteAgent(a.id)
    await loadAgents()
    emit('agent-event', { type: 'list_changed' })
  } catch (e) {
    alert(e.message)
  }
}

function toggleAgent(id) {
  expandedAgent.value = expandedAgent.value === id ? null : id
  nextTick(scrollLog)
}

// ─── Plan 进度计算：返回 "2/5" 格式 ───
function planProgress(agentId) {
  const p = agentPlans[agentId]
  if (!p || !p.plan) return ''
  const done = p.plan.filter(s => s.status === 'completed').length
  return `${done}/${p.plan.length}`
}

// ─── 主动介入：中断 agent ───
async function interruptAgent(a) {
  if (!confirm(t('dsInterruptConfirm') + ' ' + a.name + '?')) return
  try {
    // 调用 abort API
    await dsAgents.abortAgent(a.id)
    a.status = 'idle'
    a.current_task = ''
    if (streamTexts[a.id]) delete streamTexts[a.id]
  } catch (e) {
    alert(e.message)
  }
}

function scrollLog() {
  const el = logRef.value
  if (el && Array.isArray(el)) {
    el[0]?.scrollTo({ top: el[0].scrollHeight })
  } else if (el) {
    el.scrollTo({ top: el.scrollHeight })
  }
}

function updateActiveCount() {
  activeCount.value = agents.value.filter(a => a.status === 'working').length
}

// Handle incoming DS events from WebSocket
function handleDsEvent(evt) {
  if (!evt) return

  if (evt.type === 'ds_status') {
    // Update agent status
    const agent = agents.value.find(a => a.id === evt.agentId)
    if (agent) {
      agent.status = evt.status
      if (evt.status === 'working') {
        agent.current_task = evt.task
      } else if (evt.status === 'idle' || evt.status === 'done') {
        agent.current_task = ''
        // 完成时清空流式文本
        if (streamTexts[evt.agentId]) {
          delete streamTexts[evt.agentId]
        }
        // 完成时保留 plan 一段时间，让用户看到最终状态
        if (agentPlans[evt.agentId]) {
          setTimeout(() => {
            delete agentPlans[evt.agentId]
          }, 5000)
        }
      }
    }
    updateActiveCount()
    emit('agent-event', evt)
  } else if (evt.type === 'ds_progress') {
    const event = evt.event

    // ─── Plan 事件：更新 agent 计划 ───
    if (event.type === 'plan') {
      agentPlans[evt.agentId] = {
        plan: event.plan || [],
        summary: event.summary || '',
      }
      return
    }

    // ─── 流式文本：实时更新 ───
    if (event.type === 'stream_text') {
      if (!streamTexts[evt.agentId]) {
        streamTexts[evt.agentId] = ''
      }
      streamTexts[evt.agentId] = event.text
      nextTick(scrollLog)
      return // 流式文本不记录到日志
    }

    // ─── thinking 完成后也更新流式显示 ───
    if (event.type === 'thinking' && !streamTexts[evt.agentId]) {
      streamTexts[evt.agentId] = event.text
    }

    // Append to agent log
    if (!agentLogs[evt.agentId]) {
      agentLogs[evt.agentId] = []
    }
    // Deduplicate
    const log = agentLogs[evt.agentId]
    const dk = event.type + '|' + (event.tool || '') + '|' + (event.round || '')
    if (!log.some(l => l._dk === dk)) {
      log.push({ ...event, _dk: dk })
      if (log.length > 100) log.splice(0, log.length - 100)
    }
    nextTick(scrollLog)
    emit('agent-event', evt)
  }
}

// Expose for parent
defineExpose({ handleDsEvent, loadAgents })

onMounted(() => {
  loadAgents()
  loadTemplates()
})

watch(() => props.roomId, () => {
  loadAgents()
})
</script>

<style scoped>
/* ─── 黑白灰简约风格 ─── */
.ds-panel { border: 1px solid var(--border); border-radius: var(--radius); margin: 4px 12px; background: var(--bg2); font-family: var(--font-mono); font-size: 10px; flex-shrink: 0; }
.ds-panel.fold { margin-bottom: 2px; }

.ds-header { display: flex; align-items: center; justify-content: space-between; padding: 5px 10px; cursor: pointer; user-select: none; }
.ds-header:hover { background: var(--bg3); border-radius: var(--radius) var(--radius) 0 0; }
.ds-header-left { display: flex; align-items: center; gap: 6px; }
.ds-hdr-icon { color: var(--text2); flex-shrink: 0; }
.ds-title { font-size: 11px; color: var(--text); font-weight: 500; }
.ds-count { font-size: 9px; color: var(--text3); background: var(--bg3); padding: 1px 5px; border-radius: 8px; }
.ds-active { font-size: 9px; color: var(--text2); font-weight: 400; }
.ds-header-right { display: flex; align-items: center; gap: 4px; }
.ds-add-btn { width: 20px; height: 20px; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.ds-add-btn:hover { background: var(--bg3); color: var(--text); }
.ds-arr { color: var(--text3); flex-shrink: 0; }

.ds-add-form { padding: 6px 8px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.ds-template-list { display: flex; flex-wrap: wrap; gap: 4px; }
.ds-tpl-btn { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); color: var(--text2); cursor: pointer; font-size: 10px; font-family: inherit; transition: all .12s; }
.ds-tpl-btn:hover { border-color: var(--text3); color: var(--text); }
.ds-tpl-icon { display: flex; align-items: center; }
.ds-tpl-name { font-weight: 400; }

.ds-body { padding: 3px 6px; display: flex; flex-direction: column; gap: 2px; }
.ds-empty { text-align: center; color: var(--text3); font-size: 10px; padding: 10px 8px; display: flex; flex-direction: column; gap: 6px; align-items: center; }
.ds-empty-btn { padding: 4px 10px; border: 1px solid var(--text3); border-radius: var(--radius-sm); background: transparent; color: var(--text); cursor: pointer; font-size: 10px; font-family: inherit; }
.ds-empty-btn:hover { background: var(--bg3); }

/* ─── 紧凑小条子样式（黑白灰） ─── */
.ds-bar { border-radius: var(--radius-sm); background: var(--bg); overflow: hidden; transition: all .12s; }
.ds-bar.active { background: var(--bg3); }
.ds-bar-main { display: flex; align-items: center; gap: 5px; padding: 4px 8px; cursor: pointer; min-height: 24px; }
.ds-bar-main:hover { background: var(--bg3); }
.ds-bar-icon { color: var(--text2); display: flex; align-items: center; flex-shrink: 0; }
.ds-bar-name { font-size: 11px; color: var(--text); font-weight: 500; flex-shrink: 0; }
.ds-bar-role { font-size: 9px; color: var(--text3); flex-shrink: 0; }
.ds-bar-task { font-size: 10px; color: var(--text3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.ds-bar-plan-tag { font-size: 9px; color: var(--text2); background: var(--bg3); padding: 0 4px; border-radius: 3px; flex-shrink: 0; }
.ds-bar-stop { width: 14px; height: 14px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); opacity: 0; transition: all .12s; flex-shrink: 0; }
.ds-bar-main:hover .ds-bar-stop { opacity: 1; }
.ds-bar-stop:hover { background: var(--bg3); color: var(--text); }
.ds-bar-del { width: 16px; height: 16px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); opacity: 0; transition: all .12s; flex-shrink: 0; }
.ds-bar-main:hover .ds-bar-del { opacity: 1; }
.ds-bar-del:hover { background: var(--bg3); color: var(--text); }

/* ─── 状态点（黑白灰，不要彩色） ─── */
.ds-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text3); flex-shrink: 0; margin-left: auto; }
.ds-dot.idle { background: var(--text3); }
.ds-dot.working { background: var(--text); animation: ds-blink 1.2s infinite; }
.ds-dot.done { background: var(--text); }
.ds-dot.error { background: var(--text); opacity: 0.5; }
@keyframes ds-blink { 0%,100%{opacity:1} 50%{opacity:.3} }

/* ─── 展开详情 ─── */
.ds-bar-detail { border-top: 1px solid var(--border); padding: 6px 8px; }
.ds-current-task { display: flex; gap: 4px; margin-bottom: 4px; font-size: 10px; }
.ds-task-label { color: var(--text2); font-weight: 500; flex-shrink: 0; }
.ds-task-text { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* ─── Plan 计划展示（简约黑白灰） ─── */
.ds-plan { margin: 4px 0; padding: 6px 8px; background: var(--bg); border-radius: var(--radius-sm); border-left: 2px solid var(--text3); }
.ds-plan-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.ds-plan-title { font-size: 10px; color: var(--text); font-weight: 500; }
.ds-plan-summary { font-size: 9px; color: var(--text3); }
.ds-plan-list { display: flex; flex-direction: column; gap: 2px; }
.ds-plan-step { display: flex; align-items: center; gap: 6px; padding: 2px 0; font-size: 10px; }
.ds-plan-step.completed .ds-step-text { color: var(--text3); text-decoration: line-through; }
.ds-plan-step.in_progress .ds-step-text { color: var(--text); font-weight: 500; }
.ds-plan-step.pending .ds-step-text { color: var(--text3); }
.ds-step-mark { width: 12px; height: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--text2); }
.ds-step-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--text); animation: ds-blink 1s infinite; }
.ds-step-num { font-size: 9px; color: var(--text3); }

/* ─── 流式输出区域（简约） ─── */
.ds-stream { margin: 4px 0; padding: 6px 8px; background: var(--bg3); border-radius: var(--radius-sm); border-left: 2px solid var(--text2); }
.ds-stream-text { font-size: 11px; color: var(--text); line-height: 1.5; white-space: pre-wrap; word-break: break-word; max-height: 200px; overflow-y: auto; }
.ds-cursor { display: inline-block; width: 6px; height: 11px; background: var(--text); animation: ds-cursor-blink 1s infinite; vertical-align: text-bottom; margin-left: 1px; }
@keyframes ds-cursor-blink { 0%,50%{opacity:1} 51%,100%{opacity:0} }

.ds-log { max-height: 100px; overflow-y: auto; display: flex; flex-direction: column; gap: 1px; }
.ds-log-line { display: flex; align-items: baseline; gap: 4px; line-height: 1.35; padding: 1px 0; }
.ds-log-dim { color: var(--text3); font-size: 10px; }
.ds-log-dot { width: 3px; height: 3px; border-radius: 50%; background: var(--text2); flex-shrink: 0; margin-top: 4px; }
.ds-log-act { color: var(--text); font-weight: 500; }
.ds-log-det { color: var(--text3); font-size: 9px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 120px; }
.ds-log-round { color: var(--text3); font-size: 9px; }
.ds-log-ok { color: var(--text2); font-size: 10px; }
.ds-log-err { color: var(--text); font-size: 10px; opacity: 0.7; }

.ds-idle { color: var(--text3); font-size: 10px; padding: 4px 0; }
.ds-err-state { color: var(--text); font-size: 10px; padding: 4px 0; opacity: 0.7; }
</style>
