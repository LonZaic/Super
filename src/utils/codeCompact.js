// ═══════════════════════════════════════════
// Code Agent Compact State — SSE event → 3-line UI mapping
// Line 1 = 思考 (chat-style, auto-collapse when done)
// Line 2 = 动作描述 (what AI is doing)
// Line 3 = 工具标签 (tool tags)
// Below 3 = Plan / Command outputs / History
// Mutates reactive _compactState on AI messages directly.
// ═══════════════════════════════════════════

import { getAgentPhrase } from './agentPhrases.js'

const TOOL_CATEGORY = {
  read_file: 'read', write_file: 'write', write_to_file: 'write',
  replace_in_file: 'edit', edit_file: 'edit',
  search_file: 'search', search_files: 'search', search_content: 'search',
  glob: 'search', grep: 'search',
  execute_command: 'run', run_command: 'run', bash: 'run',
  web_search: 'web', web_fetch: 'web',
  list_files: 'browse', read_lints: 'browse',
  task: 'think',
}

function toolCat(tool) { return TOOL_CATEGORY[tool] || 'think' }

// Action phrase for line 2
const ACTION_MAP = {
  read:    ['翻阅文件中', '正在读取代码', '通读项目中', '仔细阅读文件'],
  write:   ['开始编写代码', '正在创建文件', '写入新内容', '代码生成中'],
  edit:    ['正在修改文件', '精确调整代码', '编辑进行中', '精雕细琢中'],
  search:  ['搜索代码中', '正在查找', '搜寻相关文件', '代码搜索中'],
  run:     ['执行命令中', '正在运行', '终端工作中', '命令运行中'],
  browse:  ['浏览项目结构', '巡视文件中', '查看目录中', '了解项目中'],
  web:     ['联网搜索中', '正在网上查找', '检索网络资源', '网页抓取中'],
  think:   ['正在思考中...', '分析任务中...', '深度思考中...', '推敲方案中'],
}

let _actionIdx = {}

function actionPhrase(cat) {
  const pool = ACTION_MAP[cat] || ACTION_MAP.think
  _actionIdx[cat] = ((_actionIdx[cat] || 0) + 1) % pool.length
  return pool[_actionIdx[cat]]
}

// Strip HTML tags
function stripHtml(s) {
  return (s || '').replace(/<[^>]*>/g, '')
}

// Smart thinking append (dedup)
function appendThinking(cs, text) {
  const clean = stripHtml(text).trim()
  if (!clean) return
  const old = cs.thinkingText
  if (!old) {
    cs.thinkingText = clean
  } else if (clean.startsWith(old)) {
    // Server sends accumulated text
    cs.thinkingText = clean
  } else if (clean.length > old.length && clean.includes(old)) {
    cs.thinkingText = clean
  } else if (old.includes(clean)) {
    // New text is subset of old — ignore
    return
  } else {
    // New thought chunk, append
    cs.thinkingText += '\n' + clean
  }
}

// Reset for new task round
function resetState(cs) {
  cs.thinkingText = ''
  cs.thinkingDone = false
  cs.thinkingOpen = true
  cs.actionText = '正在分析任务...'
  cs.actionType = 'running'
  cs.toolTags = []
  cs.commandOutputs = []
  cs.tasks = cs.tasks || []  // preserve tasks across resets
}

// Create initial state
export function createCompactState() {
  return {
    // Line 1: Thinking (chat-style, collapsible)
    thinkingText: '',
    thinkingDone: false,
    thinkingOpen: true,

    // Line 2: Action description
    actionText: '准备中...',
    actionType: 'running',   // 'running' | 'done' | 'error'

    // Line 3: Tool tags
    toolTags: [],

    // Below line 3: Plan & Commands
    tasks: [],
    commandOutputs: [],
  }
}

// ─── Main event handler ───
// Server events (from codeAgent.js) mapped to compact state mutations.
//
// Event flow for a full-plan task:
//   start → thinking → planning → plan_done → task_start*N
//   → (step_thinking → step_thinking_done → tool_start → tool_result)*N
//   → task_done*N → report_stream → context_usage → done
//
// Analysis mode:
//   start → plan_done → task_start
//   → (round → streaming → step_thinking → step_thinking_done → step_report)*N
//   → task_done → report_stream → context_usage → done
//
export function mutateCompactState(cs, e) {
  if (!cs) return

  switch (e.type) {

    case 'start':
      resetState(cs)
      break

    case 'thinking':
      appendThinking(cs, e.text || '')
      cs.thinkingOpen = true
      cs.thinkingDone = false
      cs.actionText = '正在思考中...'
      cs.actionType = 'running'
      break

    // Multi-round thinking during task execution (sent before tool calls or step reports)
    case 'step_thinking':
      appendThinking(cs, e.text || '')
      cs.thinkingOpen = true
      cs.thinkingDone = false
      break

    case 'step_thinking_done':
      cs.thinkingDone = true
      // Keep thinking visible — user can click to collapse
      break

    // AI step completion report (no tool calls → AI is reporting back)
    case 'step_report':
      if (e.text) {
        cs.actionText = (e.text || '').replace(/\n/g, ' ').slice(0, 80)
      }
      break

    case 'streaming':
      // AI body output streaming — shown as thinking for analysis mode
      break

    case 'round':
      // Show round progress
      if (e.taskRound) {
        cs.actionText = `第 ${e.taskRound} 轮`
      }
      break

    case 'tool_start': {
      const cat = toolCat(e.tool)
      const existing = cs.toolTags.find(t => t.tool === e.tool && t.live)
      if (!existing) {
        cs.toolTags.push({
          id: 't' + Date.now(),
          label: cat,
          tool: e.tool,
          live: true,
          done: false,
        })
      }
      cs.actionText = actionPhrase(cat)
      cs.actionType = 'running'
      break
    }

    case 'tool_result': {
      const live = cs.toolTags.find(t => t.live)
      if (live) {
        live.live = false
        live.done = true
      }
      if (e.output || e.result) {
        const out = typeof e.output === 'string' ? e.output
          : (typeof e.result === 'string' ? e.result
          : JSON.stringify(e.output || e.result, null, 2))
        cs.commandOutputs.push({
          id: 'c' + Date.now(),
          _summary: e.summary || stripHtml(out).slice(0, 60),
          _output: out.slice(0, 3000),
        })
      }
      break
    }

    case 'planning':
      cs.actionText = '正在制定计划...'
      break

    case 'plan_done':
    case 'plan_reused':
      if (e.tasks && Array.isArray(e.tasks)) {
        cs.tasks = e.tasks.map(t => ({
          id: t.id,
          text: stripHtml(t.text || t.description || ''),
          status: t.done ? 'completed' : 'pending',
        }))
      }
      cs.actionText = cs.tasks.length > 0
        ? `计划完成，共 ${cs.tasks.length} 步`
        : '分析完毕，开始执行'
      break

    case 'task_start':
      if (e.taskId) {
        const t = cs.tasks.find(t => t.id === e.taskId)
        if (t) {
          t.status = 'in_progress'
          cs.actionText = stripHtml(t.text)
        }
      }
      break

    case 'task_done':
      if (e.taskId) {
        const t = cs.tasks.find(t => t.id === e.taskId)
        if (t) t.status = 'completed'
      }
      cs.actionText = cs.tasks.every(t => t.status === 'completed')
        ? '全部任务完成'
        : '继续下一步...'
      break

    case 'report_stream':
      cs.actionText = '正在生成报告...'
      break

    case 'done':
      cs.actionText = '任务完成'
      cs.actionType = 'done'
      cs.thinkingDone = true
      cs.thinkingOpen = false
      cs.toolTags.forEach(t => { if (t.live) { t.live = false; t.done = true } })
      break

    case 'error':
      cs.actionText = e.message || '出错了'
      cs.actionType = 'error'
      cs.thinkingDone = true
      cs.thinkingOpen = false
      cs.toolTags.forEach(t => { if (t.live) { t.live = false } })
      break

    case 'token_usage':
    case 'code_diff':
      break

    case 'subagent_start':
      cs.actionText = `子代理: ${e.name || '工作中'}...`
      break

    case 'subagent_done':
      cs.actionText = '子代理完成'
      break

    case 'handoff_ready':
      cs.actionText = '上下文使用率较高，准备接力...'
      break

    case 'context_usage':
      if (e.pct >= 80) cs.actionText = `上下文 ${e.pct}%`
      break

    default:
      break
  }
}

// Reconstruct compact state from stored events (for page refresh)
export function reconstructCompactState(msg) {
  const cs = createCompactState()
  const events = msg._events || []

  // Replay all stored events
  for (const e of events) {
    mutateCompactState(cs, e)
  }

  // If message is done, apply final state
  if (msg._done) {
    cs.actionType = 'done'
    cs.actionText = '任务完成'
    cs.thinkingDone = true
    cs.thinkingOpen = false
    cs.toolTags.forEach(t => { if (t.live) { t.live = false; t.done = true } })
  }

  // If message has an error
  if (msg._error) {
    cs.actionType = 'error'
    cs.thinkingDone = true
    cs.thinkingOpen = false
  }

  return cs
}
