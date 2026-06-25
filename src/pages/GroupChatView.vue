<template>
  <div class="group-page">
    <div class="group-header">
      <button class="back-btn" @click="$router.push('/social')">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <div class="group-info">
        <span class="group-name">{{ groupName }}</span>
        <span class="group-meta">{{ memberCount }}{{ t('members') }} · {{ inviteCode }}</span>
      </div>
      <div class="header-agents" v-if="dsAgentList.length">
        <span v-for="a in dsAgentList.slice(0, 5)" :key="a.id" class="header-agent-chip" :class="a.status" :title="a.name + ' · ' + t('dsRole_' + a.role)" @click="scrollToAgentPanel">
          <span class="chip-dot" :class="a.status"></span>
          <span class="chip-name">{{ a.name }}</span>
        </span>
      </div>
      <button class="leave-btn" @click="leaveGroup" :title="t('leaveGroup')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 1.5H3a.5.5 0 00-.5.5v10a.5.5 0 00.5.5h2M8.5 4l2.5 2.5-2.5 2.5M11 6.5H4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>

    <!-- DS Agent Panel -->
    <DsAgentPanel ref="dsPanelRef" :room-id="roomId" @agent-event="onAgentEvent" />

    <!-- Messages -->
    <div class="group-msgs" ref="msgRef">
      <div v-if="loading" class="g-loading">{{ t('loading') }}</div>
      <div v-for="m in messages" :key="m._key" :class="['g-msg', m._isAi ? 'ai' : (m._mine ? 'me' : 'them')]">
        <div class="g-sender">
          <span class="g-sender-name">{{ m._isAi ? (m.sender_name || t('dsAiName')) : (m._mine ? t('tagMe') : (m.sender_name || '?')) }}</span>
          <span class="g-sender-tag" v-if="m._isAi && m.sender_name && m.sender_name !== 'DS'">{{ m.sender_name }}</span>
        </div>
        <!-- 文件气泡：检测消息是否是文件格式 -->
        <template v-if="m._isFile">
          <!-- 短回复（如"✓ 已完成"） -->
          <div v-if="m._prefixText" class="g-bubble ai-b file-prefix">{{ m._prefixText }}</div>
          <!-- 文件气泡 -->
          <FileBubble
            :name="m._fileName"
            :type="m._fileType"
            :content="m._fileContent"
            :size="m._fileSize"
            :is-real-file="m._isRealFile"
            :file-path="m._filePath"
            @open-file="openRealFile"
          />
        </template>
        <!-- 普通文本气泡 -->
        <div v-else class="g-bubble" :class="{ 'ai-b': m._isAi }" v-html="renderText(m.text)"></div>
      </div>
      <div v-if="dsThinking" class="g-msg ai">
        <div class="g-sender"><span class="g-sender-name">{{ dsThinkingName }}</span></div>
        <div class="g-bubble ai-b thinking">{{ dsThinking }}</div>
      </div>
      <!-- 流式输出：实时显示 AI 的输出 -->
      <div v-if="agentStreams.length" class="agent-streams">
        <div v-for="s in agentStreams" :key="s.agentId" class="g-msg ai">
          <div class="g-sender">
            <span class="g-sender-name">{{ s.agentName }}</span>
            <span class="g-stream-tag">streaming</span>
          </div>
          <div class="g-bubble ai-b stream-b">{{ s.text }}<span class="cursor" /></div>
        </div>
      </div>
    </div>

    <!-- Mention autocomplete -->
    <div v-if="mentionShow" class="mention-pop">
      <div class="mention-header">{{ t('dsMentionAgents') }}</div>
      <button v-for="a in mentionList" :key="a.id" class="mention-item" @click="selectMention(a)">
        <span class="mention-icon" v-html="getAgentIcon(a.avatar)"></span>
        <span class="mention-name">{{ a.name }}</span>
        <span class="mention-role">{{ t('dsRole_' + a.role) }}</span>
        <span class="mention-status" :class="a.status"></span>
      </button>
      <div v-if="!mentionList.length" class="mention-empty">{{ t('dsNoAgents') }}</div>
    </div>

    <!-- Input -->
    <div class="group-input">
      <div class="g-input-row">
        <!-- 定时任务开关 -->
        <SchedulePanel :room-id="roomId" :agents="dsAgentList" />
        <textarea v-model="input" :placeholder="t('dmPlaceholder')" @keydown="onKey" @input="onInput" :disabled="sending" rows="1" ref="inputRef" />
        <button class="g-send" @click="send" :disabled="!input.trim() || sending">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M4 6l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { groups, dsAgents, getSavedUser } from '../api/index.js'
import { on as wsOn, send as wsSend } from '../api/ws.js'
import { useI18n } from '../composables/useI18n.js'
import DsAgentPanel from '../components/chat/DsAgentPanel.vue'
import FileBubble from '../components/chat/FileBubble.vue'
import SchedulePanel from '../components/chat/SchedulePanel.vue'

const { t } = useI18n()

const route = useRoute(), router = useRouter()
const roomId = route.params.id
const groupName = ref(''), inviteCode = ref(''), memberCount = ref(0)
const myId = (getSavedUser() || {}).id || ''
const myName = (getSavedUser() || {}).name || 'User'
const messages = ref([]), input = ref(''), loading = ref(true), sending = ref(false)
const streamText = ref(''), dsThinking = ref(''), msgRef = ref(null), inputRef = ref(null)
const seenIds = new Set(), unsubs = []
let _k = 0
function mk() { return 'k_' + (++_k) }

// DS Agents state
const dsAgentList = ref([])
const dsPanelRef = ref(null)
const dsThinkingName = ref('DS')
const streamName = ref('DS')

// ─── 流式输出状态：实时显示 AI 的输出 ───
// 每个 agent 的流式文本会在这里实时更新
const agentStreams = ref([]) // [{ agentId, agentName, text }]

// ─── 文件消息解析：检测 AI 消息是否是文件格式 ───
// 支持两种格式：
// 1. 纯文件: [FILE:name:type:size]content[/FILE]
// 2. 短回复+文件: ✓ 已完成\n[FILE:name:type:size]content[/FILE]
function parseFileMessage(text) {
  if (!text || typeof text !== 'string') return null
  // 查找文件标记（可能在文本中间）
  const match = text.match(/\[FILE:(.+?):(\w+?)(?::(.+?))?\]([\s\S]*?)\[\/FILE\]/)
  if (!match) return null
  // 提取文件前的短回复（如果有）
  const prefixText = text.slice(0, text.indexOf('[FILE:')).trim()
  return {
    fileName: match[1],
    fileType: match[2],
    fileSize: match[3] || '',
    fileContent: match[4],
    isRealFile: false,
    prefixText, // 短回复，如"✓ 已完成"
  }
}

// 检测真实文件路径格式: [REALFILE:path]
function parseRealFileMessage(text) {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/^\[REALFILE:(.+?)\]$/)
  if (!match) return null
  const filePath = match[1]
  const fileName = filePath.split(/[\\/]/).pop()
  const ext = fileName.split('.').pop().toLowerCase()
  const typeMap = { txt: 'text', md: 'text', doc: 'word', docx: 'word', pdf: 'pdf', xls: 'table', xlsx: 'table', csv: 'table', ppt: 'ppt', pptx: 'ppt', js: 'code', ts: 'code', py: 'code', java: 'code', cpp: 'code', c: 'code', html: 'code', css: 'code', json: 'code' }
  return {
    fileName,
    fileType: typeMap[ext] || 'file',
    fileSize: '',
    fileContent: '',
    isRealFile: true,
    filePath,
  }
}

// 处理消息：检测是否是文件格式
function processMessage(m) {
  const text = m.text || ''
  // 检测渲染形式文件
  const fileMsg = parseFileMessage(text)
  if (fileMsg) {
    m._isFile = true
    m._fileName = fileMsg.fileName
    m._fileType = fileMsg.fileType
    m._fileSize = fileMsg.fileSize
    m._fileContent = fileMsg.fileContent
    m._isRealFile = false
    m._prefixText = fileMsg.prefixText // 短回复
    return m
  }
  // 检测真实文件
  const realFile = parseRealFileMessage(text)
  if (realFile) {
    m._isFile = true
    m._fileName = realFile.fileName
    m._fileType = realFile.fileType
    m._fileSize = realFile.fileSize
    m._fileContent = realFile.fileContent
    m._isRealFile = true
    m._filePath = realFile.filePath
    return m
  }
  m._isFile = false
  return m
}

// 打开真实文件（在电脑上打开）
function openRealFile(filePath) {
  // 通过 API 调用后端打开文件
  fetch('/api/ds/open-file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath }),
  }).catch(e => {
    console.error('Open file failed:', e)
    alert('无法打开文件: ' + filePath)
  })
}

// Mention autocomplete
const mentionShow = ref(false)
const mentionList = ref([])
const mentionStart = ref(-1)

// SVG icons
const ICONS = {
  code: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2.5L1.5 6 4 9.5M8 2.5L10.5 6 8 9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="5" cy="5" r="3.5" stroke="currentColor" stroke-width="1.2"/><path d="M7.5 7.5L10 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  pen: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 10l1-2.5 6-6 1.5 1.5-6 6-2.5 1z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chart: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 10V3.5M5.5 10V6M9.5 10V1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  server: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1.5" y="2" width="9" height="3" rx="0.8" stroke="currentColor" stroke-width="1.2"/><rect x="1.5" y="7" width="9" height="3" rx="0.8" stroke="currentColor" stroke-width="1.2"/><circle cx="3.5" cy="3.5" r="0.4" fill="currentColor"/><circle cx="3.5" cy="8.5" r="0.4" fill="currentColor"/></svg>',
  bot: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="3.5" width="8" height="6" rx="1.2" stroke="currentColor" stroke-width="1.2"/><circle cx="4.5" cy="6.5" r="0.7" fill="currentColor"/><circle cx="7.5" cy="6.5" r="0.7" fill="currentColor"/><path d="M6 1.5v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
}

function getAgentIcon(avatar) {
  return ICONS[avatar] || ICONS.bot
}

function renderText(text) {
  if (!text) return ''
  // Highlight @mentions
  return text.replace(/@([a-zA-Z\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)/g, '<span class="mention-highlight">@$1</span>')
}

async function load() {
  try {
    const g = await groups.detail(roomId)
    groupName.value = g.name; inviteCode.value = g.invite_code; memberCount.value = g.members?.length || 0
    const ms = await groups.messages(roomId); messages.value = []; seenIds.clear()
    for (const m of ms) {
      const k = 'h_' + m.id; seenIds.add(k)
      messages.value.push({ ...m, _mine: m.sender_id === myId, _isAi: !!m.is_ai, _key: k })
    }
  } catch { groupName.value = roomId }
  finally { loading.value = false; scrollB() }
}

async function loadDsAgents() {
  try {
    const data = await dsAgents.listByRoom(roomId)
    dsAgentList.value = data.agents || []
  } catch (e) {
    console.error('Load DS agents failed:', e)
  }
}

function scrollB() { nextTick(() => { const e = msgRef.value; if (e) e.scrollTop = e.scrollHeight }) }
function scrollToAgentPanel() {
  dsPanelRef.value?.loadAgents()
}

function upsert(m) {
  const d = (m.sender_id || 'ai') + '|' + (m.text || '').slice(0, 40) + '|' + (m.created_at || '').slice(0, 16)
  if (seenIds.has(d)) return; seenIds.add(d)
  const msg = { ...m, _mine: m.sender_id === myId, _isAi: !!m.is_ai, _key: mk() }
  processMessage(msg) // 检测是否是文件格式
  messages.value.push(msg); scrollB()
}

// ─── Mention autocomplete ───
function onInput(e) {
  const val = input.value
  const pos = e.target?.selectionStart || val.length
  // Check if we're in a mention context
  const before = val.slice(0, pos)
  const atMatch = before.match(/@([a-zA-Z\u4e00-\u9fa5]*)$/)
  if (atMatch) {
    mentionShow.value = true
    mentionStart.value = before.lastIndexOf('@')
    const query = atMatch[1].toLowerCase()
    mentionList.value = dsAgentList.value.filter(a =>
      a.name.toLowerCase().includes(query) || a.role.toLowerCase().includes(query)
    )
  } else {
    mentionShow.value = false
  }
}

function selectMention(agent) {
  const val = input.value
  const before = val.slice(0, mentionStart.value)
  const after = val.slice(mentionStart.value + 1).replace(/^[a-zA-Z\u4e00-\u9fa5]*/, '')
  input.value = before + '@' + agent.name + ' ' + after
  mentionShow.value = false
  nextTick(() => inputRef.value?.focus())
}

// ─── Parse @mentions and route to DS agents ───
function parseMentions(text) {
  const mentions = []
  const re = /@([a-zA-Z\u4e00-\u9fa5][\w\u4e00-\u9fa5]*)/g
  let m
  while ((m = re.exec(text)) !== null) {
    mentions.push({ name: m[1], full: m[0], index: m.index })
  }
  return mentions
}

async function send() {
  const txt = input.value.trim()
  if (!txt || sending.value) return
  input.value = ''
  mentionShow.value = false

  // Send message to group
  wsSend({ type: 'group_msg', roomId, text: txt, isAi: false })

  // Check for @mentions of DS agents
  const mentions = parseMentions(txt)
  const matchedAgents = []

  for (const m of mentions) {
    const agent = dsAgentList.value.find(a => a.name.toLowerCase() === m.name.toLowerCase())
    if (agent) {
      // Extract task text after mention
      const afterMention = txt.slice(m.index + m.full.length).trim()
      const nextMention = mentions.find(m2 => m2.index > m.index)
      const taskText = nextMention
        ? afterMention.slice(0, nextMention.index - (m.index + m.full.length)).trim()
        : afterMention

      if (taskText) {
        matchedAgents.push({ agent, task: taskText })
      }
    }
  }

  if (matchedAgents.length === 0) return

  // Check API key
  const apiKey = localStorage.getItem('apikey') || ''
  if (!apiKey) {
    wsSend({ type: 'group_msg', roomId, text: '[DS] ' + t('apiNotSetMsg'), isAi: true })
    scrollB()
    return
  }

  // Trigger tasks for all matched agents (in parallel, 不等待完成)
  // 关键优化：用 Promise.allSettled 并行触发，不阻塞 UI
  const triggerPromises = matchedAgents.map(({ agent, task }) =>
    dsAgents.triggerTask(agent.id, task, myName).catch(e => {
      wsSend({ type: 'group_msg', roomId, text: `[${agent.name}] ${t('agentErrorMsg')}: ${e.message}`, isAi: true })
    })
  )
  Promise.allSettled(triggerPromises)
  scrollB()
}

function onKey(e) {
  if (mentionShow.value) {
    if (e.key === 'Escape') { mentionShow.value = false; return }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); return }
  }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
}

// ─── Handle DS events from WebSocket ───
function onAgentEvent(evt) {
  // Reload agent list when agents are added/removed so @ mention list stays current
  if (evt && evt.type === 'list_changed') {
    loadDsAgents()
  }
}

async function leaveGroup() {
  if (!confirm(t('leaveConfirm'))) return
  try { await groups.leave(roomId); router.push('/social') } catch (e) { alert(e.message) }
}

function setupWS() {
  unsubs.push(wsOn('group_msg', (m) => {
    if (m.message.room_id === roomId) upsert(m.message)
  }))
  unsubs.push(wsOn('ds_event', (m) => {
    if (m.event) {
      dsPanelRef.value?.handleDsEvent(m.event)

      // ─── 处理流式输出事件：实时显示在群聊中 ───
      const evt = m.event
      if (evt.type === 'ds_progress') {
        const event = evt.event
        const agentId = evt.agentId
        const agentName = evt.agentName

        // 流式文本：更新群聊中的流式输出
        if (event.type === 'stream_text') {
          let existing = agentStreams.value.find(s => s.agentId === agentId)
          if (!existing) {
            existing = { agentId, agentName, text: '' }
            agentStreams.value.push(existing)
          }
          existing.text = event.text
          scrollB()
        }

        // thinking 完成后也更新流式显示
        if (event.type === 'thinking' && !agentStreams.value.find(s => s.agentId === agentId)) {
          agentStreams.value.push({ agentId, agentName, text: event.text })
          scrollB()
        }
      }

      // ─── agent 完成时清除流式输出 ───
      if (evt.type === 'ds_status' && (evt.status === 'done' || evt.status === 'idle')) {
        const idx = agentStreams.value.findIndex(s => s.agentId === evt.agentId)
        if (idx >= 0) {
          // 延迟清除，让用户看到最后的内容
          setTimeout(() => {
            const i = agentStreams.value.findIndex(s => s.agentId === evt.agentId)
            if (i >= 0) agentStreams.value.splice(i, 1)
          }, 1500)
        }
      }
    }
  }))
  unsubs.push(wsOn('ds_routed', (m) => {
    if (m.roomId === roomId) {
      // Agents were triggered via WS routing
    }
  }))
}

onMounted(() => {
  load()
  loadDsAgents()
  setupWS()
})

onUnmounted(() => unsubs.forEach(f => f()))
</script>

<style scoped>
.group-page { display: flex; flex-direction: column; height: 100%; background: var(--bg); position: relative; }
.group-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; height: 52px; }
.back-btn { width: 32px; height: 32px; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.back-btn:hover { background: var(--bg3); color: var(--text); }
.group-info { display: flex; flex-direction: column; }
.group-name { font-size: 13px; font-weight: 500; color: var(--text); }
.group-meta { font-size: 11px; color: var(--text3); font-weight: 300; }
.header-agents { display: flex; gap: 4px; flex: 1; overflow-x: auto; padding: 0 4px; }
.header-agents::-webkit-scrollbar { display: none; }
.header-agent-chip { display: flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 10px; background: var(--bg3); font-size: 10px; color: var(--text2); cursor: pointer; transition: all .12s; white-space: nowrap; flex-shrink: 0; }
.header-agent-chip:hover { background: var(--bg4); }
.header-agent-chip.working { background: rgba(34,197,94,0.1); color: var(--green); }
.chip-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--text3); }
.chip-dot.working { background: var(--green); animation: chip-pulse 1s infinite; }
.chip-dot.done { background: var(--green); }
.chip-dot.error { background: var(--red); }
@keyframes chip-pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
.leave-btn { width: 30px; height: 30px; border-radius: var(--radius-sm); border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all .12s; }
.leave-btn:hover { background: rgba(248,81,73,0.1); color: var(--red); }

/* Messages */
.group-msgs { flex: 1; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; min-height: 0; }
.g-loading { text-align: center; color: var(--text3); font-size: 12px; padding: 20px; font-weight: 300; }
.g-msg { max-width: 72%; display: flex; flex-direction: column; gap: 2px; }
.g-msg.me { align-self: flex-end; }
.g-msg.them { align-self: flex-start; }
.g-msg.ai { align-self: flex-start; max-width: 82%; }
.g-sender { font-size: 10px; font-weight: 500; color: var(--text3); padding-left: 2px; display: flex; align-items: center; gap: 4px; }
.g-sender-tag { font-size: 9px; color: var(--accent); background: rgba(99,102,241,0.1); padding: 0 4px; border-radius: 3px; }
.g-bubble { padding: 8px 12px; font-size: 13px; line-height: 1.55; color: var(--text); border-radius: var(--radius-lg); font-weight: 300; word-break: break-word; }
.g-msg.them .g-bubble { border-bottom-left-radius: 4px; }
.g-msg.me .g-bubble { background: var(--bg3); border: 1px solid var(--border); border-bottom-right-radius: 4px; }
.ai-b { border-left: 2px solid var(--accent); background: transparent; border-radius: var(--radius-lg) !important; }
.thinking { font-style: italic; color: var(--text3); }
.cursor { display: inline-block; width: 5px; height: 13px; background: var(--accent); animation: blink .8s infinite; vertical-align: middle; }

/* ─── 流式输出样式 ─── */
.agent-streams { display: contents; }
.g-stream-tag { font-size: 9px; color: var(--green); background: rgba(34,197,94,0.1); padding: 0 4px; border-radius: 3px; margin-left: 4px; }
.stream-b { border-left-color: var(--green) !important; }
.file-prefix { margin-bottom: 4px; font-size: 12px; color: var(--green); }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }

/* Mention autocomplete */
.mention-pop { position: absolute; bottom: 60px; left: 12px; right: 12px; max-width: 320px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 100; overflow: hidden; }
.mention-header { padding: 6px 10px; font-size: 10px; color: var(--text3); border-bottom: 1px solid var(--border); font-family: var(--font-mono); }
.mention-item { display: flex; align-items: center; gap: 6px; width: 100%; padding: 6px 10px; border: none; background: transparent; color: var(--text); cursor: pointer; font-size: 12px; font-family: inherit; text-align: left; transition: background .1s; }
.mention-item:hover { background: var(--bg3); }
.mention-icon { color: var(--accent); display: flex; align-items: center; }
.mention-name { font-weight: 500; }
.mention-role { font-size: 10px; color: var(--text3); flex: 1; }
.mention-status { width: 6px; height: 6px; border-radius: 50%; background: var(--text3); }
.mention-status.working { background: var(--green); }
.mention-status.idle { background: var(--text3); }
.mention-empty { padding: 10px; text-align: center; color: var(--text3); font-size: 11px; }

/* Input */
.group-input { padding: 8px 12px 10px; border-top: 1px solid var(--border); flex-shrink: 0; }
.g-input-row { display: flex; align-items: flex-end; gap: 6px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 6px 8px 6px 14px; }
.g-input-row textarea { flex: 1; resize: none; border: none; outline: none; background: transparent; color: var(--text); font-size: 14px; font-family: inherit; font-weight: 300; line-height: 1.5; padding: 4px 0; min-height: 22px; max-height: 90px; }
.g-input-row textarea::placeholder { color: var(--text3); }
.g-send { width: 30px; height: 30px; border-radius: var(--radius-sm); border: none; background: var(--accent); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .12s; flex-shrink: 0; }
.g-send:hover:not(:disabled) { background: var(--accent-hover); }
.g-send:disabled { background: var(--bg4); color: var(--text3); cursor: not-allowed; }

:deep(.mention-highlight) { color: var(--accent); font-weight: 500; }
</style>
