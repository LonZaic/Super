<template>
  <Teleport to="body">
    <Transition name="cmd-fade">
      <div v-if="visible" class="cmd-overlay" @click="close">
        <div class="cmd-modal" @click.stop>
          <!-- Search input -->
          <div class="cmd-input-wrap">
            <svg class="cmd-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8"/>
              <path d="M21 21l-4.3-4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              class="cmd-input"
              :placeholder="t('cmdPlaceholder') || '输入命令或搜索...'"
              @keydown="onKeydown"
            />
            <kbd class="cmd-esc">ESC</kbd>
          </div>

          <!-- Results -->
          <div class="cmd-results" ref="resultsRef">
            <template v-if="filteredCommands.length">
              <div v-for="(group, gi) in groupedCommands" :key="group.name">
                <div v-if="group.items.length" class="cmd-group-label">{{ group.label }}</div>
                <button
                  v-for="item in group.items"
                  :key="item.id"
                  :class="['cmd-item', { active: item._flatIndex === selectedIndex }]"
                  @click="execute(item)"
                  @mouseenter="selectedIndex = item._flatIndex"
                >
                  <div class="cmd-item-icon">
                    <span v-if="item.emoji" class="cmd-emoji">{{ item.emoji }}</span>
                    <component v-else-if="item.icon" :is="item.icon" />
                    <span v-else class="cmd-dot"></span>
                  </div>
                  <div class="cmd-item-body">
                    <span class="cmd-item-title" v-html="highlight(item.title)"></span>
                    <span v-if="item.subtitle" class="cmd-item-sub">{{ item.subtitle }}</span>
                  </div>
                  <div class="cmd-item-meta">
                    <kbd v-if="item.shortcut" class="cmd-shortcut">{{ item.shortcut }}</kbd>
                    <svg v-if="item._flatIndex === selectedIndex" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </div>
                </button>
              </div>
            </template>
            <div v-else class="cmd-empty">
              <span>没有匹配的命令</span>
            </div>
          </div>

          <!-- Footer -->
          <div class="cmd-footer">
            <div class="cmd-footer-hints">
              <span><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
              <span><kbd>↵</kbd> 执行</span>
              <span><kbd>ESC</kbd> 关闭</span>
            </div>
            <span class="cmd-footer-count">{{ filteredCommands.length }} 个命令</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../store/chatStore.js'
import { useI18n } from '../composables/useI18n.js'

const { t } = useI18n()
const router = useRouter()
const store = useChatStore()

const visible = ref(false)
const query = ref('')
const selectedIndex = ref(0)
const inputRef = ref(null)
const resultsRef = ref(null)

// ─── Command definitions ───
const commands = computed(() => {
  const list = []

  // Navigation
  list.push({ id: 'nav-home', group: 'navigation', label: '导航', title: '返回首页 / 新对话', emoji: '💬', action: () => router.push('/') })
  list.push({ id: 'nav-code', group: 'navigation', title: '代码模式', emoji: '💻', action: () => router.push('/code') })
  list.push({ id: 'nav-knowledge', group: 'navigation', title: '知识库', emoji: '📚', action: () => router.push('/knowledge') })
  list.push({ id: 'nav-collections', group: 'navigation', title: '收藏夹', emoji: '🔖', action: () => router.push('/collections') })
  list.push({ id: 'nav-mcp', group: 'navigation', title: 'MCP / 技能', emoji: '🔌', action: () => router.push('/mcp-skills') })
  list.push({ id: 'nav-social', group: 'navigation', title: '社交广场', emoji: '👥', action: () => router.push('/social') })

  // Chat actions
  list.push({ id: 'chat-new', group: 'chat', label: '对话', title: '新建对话', emoji: '✨', shortcut: 'Ctrl+N', action: () => { newConversation() } })
  list.push({ id: 'chat-clear', group: 'chat', title: '清空当前对话', emoji: '🗑️', action: () => { if (confirm('确定清空当前对话？')) { store.clearCurrent?.() } } })
  list.push({ id: 'chat-stop', group: 'chat', title: '停止生成', emoji: '⏹️', shortcut: 'Ctrl+.', action: () => { store.abort(store.currentId) } })

  // Recent conversations
  const convs = store.conversations || []
  for (const c of convs.slice(0, 8)) {
    list.push({
      id: 'conv-' + c.id,
      group: 'recent',
      label: '最近对话',
      title: c.title || '未命名对话',
      subtitle: c.model || '',
      emoji: '💬',
      action: () => router.push('/chat/' + c.id),
    })
  }

  // Settings / theme
  list.push({ id: 'theme-toggle', group: 'settings', label: '设置', title: '切换深色/浅色主题', emoji: '🌓', action: () => { toggleTheme() } })
  list.push({ id: 'theme-dark', group: 'settings', title: '深色模式', emoji: '🌙', action: () => { setTheme('dark') } })
  list.push({ id: 'theme-light', group: 'settings', title: '浅色模式', emoji: '☀️', action: () => { setTheme('light') } })

  // Knowledge base
  list.push({ id: 'kb-upload', group: 'knowledge', label: '知识库', title: '上传文档到知识库', emoji: '📤', action: () => { router.push('/knowledge') } })
  list.push({ id: 'kb-search', group: 'knowledge', title: '搜索知识库', emoji: '🔍', action: () => { router.push('/knowledge') } })

  // Help
  list.push({ id: 'help-shortcuts', group: 'help', label: '帮助', title: '查看快捷键', emoji: '⌨️', action: () => { showShortcuts() } })

  return list
})

// ─── Filtering ───
const filteredCommands = computed(() => {
  const q = query.value.trim().toLowerCase()
  let result = commands.value
  if (q) {
    result = result.filter(c => {
      const title = (c.title || '').toLowerCase()
      const sub = (c.subtitle || '').toLowerCase()
      return title.includes(q) || sub.includes(q)
    })
  }
  // Assign flat index for keyboard nav
  return result.map((c, i) => ({ ...c, _flatIndex: i }))
})

const groupedCommands = computed(() => {
  const groups = {}
  for (const c of filteredCommands.value) {
    const g = c.group || 'other'
    if (!groups[g]) groups[g] = { name: g, label: c.label || g, items: [] }
    groups[g].items.push(c)
  }
  return Object.values(groups)
})

// ─── Highlight matched text ───
function highlight(text) {
  const q = query.value.trim()
  if (!q) return text
  try {
    const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi')
    return text.replace(re, '<mark>$1</mark>')
  } catch {
    return text
  }
}

// ─── Keyboard navigation ───
function onKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredCommands.value.length - 1)
    scrollIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    scrollIntoView()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const item = filteredCommands.value[selectedIndex.value]
    if (item) execute(item)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    close()
  }
}

function scrollIntoView() {
  nextTick(() => {
    const el = resultsRef.value?.querySelector('.cmd-item.active')
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}

// ─── Execute command ───
function execute(item) {
  if (item.action) {
    try { item.action() } catch (e) { console.error('[Cmd] execute failed:', e) }
  }
  close()
}

// ─── Actions ───
async function newConversation() {
  const id = 'conv_' + Date.now()
  await store.createConversation(id)
  router.push('/chat/' + id)
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark'
  setTheme(cur === 'dark' ? 'light' : 'dark')
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('theme', theme)
}

function showShortcuts() {
  alert('快捷键:\nCtrl+K — 命令面板\nCtrl+N — 新对话\nCtrl+. — 停止生成\nESC — 关闭面板')
}

// ─── Open / close ───
function open() {
  visible.value = true
  query.value = ''
  selectedIndex.value = 0
  nextTick(() => inputRef.value?.focus())
}

function close() {
  visible.value = false
  query.value = ''
}

// ─── Global keyboard shortcut ───
function onGlobalKeydown(e) {
  // Ctrl+K or Cmd+K
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (visible.value) close()
    else open()
    return
  }
  // Close on Escape
  if (e.key === 'Escape' && visible.value) {
    e.preventDefault()
    close()
  }
}

// Reset selection when query changes
watch(query, () => { selectedIndex.value = 0 })

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown)
})

// Expose for parent
defineExpose({ open, close })
</script>

<style scoped>
.cmd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); backdrop-filter: blur(6px); z-index: 10000; display: flex; align-items: flex-start; justify-content: center; padding-top: 12vh; }

.cmd-modal { width: 100%; max-width: 600px; background: var(--bg2); border: 1px solid var(--border2); border-radius: 14px; box-shadow: 0 25px 60px rgba(0,0,0,.5); overflow: hidden; display: flex; flex-direction: column; max-height: 70vh; }

.cmd-input-wrap { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.cmd-search-icon { color: var(--text3); flex-shrink: 0; }
.cmd-input { flex: 1; border: none; background: transparent; color: var(--text); font-size: 15px; font-family: inherit; outline: none; }
.cmd-input::placeholder { color: var(--text4); }
.cmd-esc { font-size: 10px; padding: 3px 6px; background: var(--bg4); color: var(--text3); border-radius: 4px; border: 1px solid var(--border); }

.cmd-results { flex: 1; overflow-y: auto; padding: 8px; }
.cmd-results::-webkit-scrollbar { width: 6px; }
.cmd-results::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 6px; }

.cmd-group-label { font-size: 11px; font-weight: 600; color: var(--text4); text-transform: uppercase; letter-spacing: .5px; padding: 10px 12px 6px; }

.cmd-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border: none; background: transparent; color: var(--text2); font-family: inherit; font-size: 14px; cursor: pointer; border-radius: 8px; text-align: left; transition: background .1s; }
.cmd-item:hover { background: var(--bg3); }
.cmd-item.active { background: var(--bg3); color: var(--text); }

.cmd-item-icon { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.cmd-emoji { font-size: 16px; }
.cmd-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--text4); }

.cmd-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cmd-item-title { font-size: 14px; line-height: 1.3; }
.cmd-item-title :deep(mark) { background: rgba(99,102,241,.25); color: var(--accent); border-radius: 2px; padding: 0 1px; }
.cmd-item-sub { font-size: 11px; color: var(--text4); }

.cmd-item-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; color: var(--text4); }
.cmd-shortcut { font-size: 10px; padding: 2px 6px; background: var(--bg4); border: 1px solid var(--border); border-radius: 4px; color: var(--text3); }

.cmd-empty { padding: 40px 20px; text-align: center; color: var(--text4); font-size: 14px; }

.cmd-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 18px; border-top: 1px solid var(--border); font-size: 11px; color: var(--text4); }
.cmd-footer-hints { display: flex; gap: 16px; }
.cmd-footer-hints kbd { font-size: 10px; padding: 1px 5px; background: var(--bg4); border: 1px solid var(--border); border-radius: 3px; margin-right: 3px; }

/* Transition */
.cmd-fade-enter-active, .cmd-fade-leave-active { transition: opacity .15s; }
.cmd-fade-enter-active .cmd-modal, .cmd-fade-leave-active .cmd-modal { transition: transform .15s, opacity .15s; }
.cmd-fade-enter-from, .cmd-fade-leave-to { opacity: 0; }
.cmd-fade-enter-from .cmd-modal, .cmd-fade-leave-to .cmd-modal { transform: translateY(-10px); opacity: 0; }
</style>
