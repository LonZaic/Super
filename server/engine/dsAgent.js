// ══════════════════════════════════════
// DS Agent Runner — Background task execution engine
// Runs agent tasks in background, broadcasts progress via WebSocket
// Supports: multi-agent, shared memory, inter-agent awareness
// ══════════════════════════════════════

const { dsAgent, dsTask, dsMemory, room } = require('../db')
const { runAgent } = require('./agent')
const { broadcastToRoom } = require('../ws')
const { getTemplate, parseMentions } = require('./dsRegistry')
const { parallelAgents, spawnSubAgent, mapReduce } = require('./orchestrator')
const { shouldRelay, getContextStats, broadcastRelayEvent } = require('./relay')

// Track running tasks: taskId -> AbortController
const runningTasks = new Map()

// Track active agents per room: roomId -> Set<agentId>
const activeAgents = new Map()

// ─── Broadcast helper ───
function broadcast(roomId, event) {
  broadcastToRoom(roomId, { type: 'ds_event', event })
}

// ─── Send a message as DS agent to group chat ───
function sendDsMessage(roomId, agentName, text) {
  try {
    room.sendMessage(roomId, null, text, true, agentName)
    broadcastToRoom(roomId, {
      type: 'group_msg',
      message: {
        room_id: roomId,
        sender_id: null,
        sender_name: agentName,
        text: text,
        is_ai: 1,
        created_at: new Date().toISOString(),
      },
    })
  } catch (e) {
    console.error('[DS] sendDsMessage error:', e.message)
  }
}

// ─── Build context for agent: recent chat + shared memory ───
function buildAgentContext(roomId, agentId, agentName) {
  // Get recent chat messages (last 20)
  const recentMsgs = room.getMessages(roomId, 20)

  // Get shared memory for this room
  const sharedMem = dsMemory.listByRoom(roomId)

  // Get other agents' recent activity
  const otherAgents = dsAgent.listByRoom(roomId).filter(a => a.id !== agentId)
  const otherActivity = []
  for (const a of otherAgents) {
    const tasks = dsTask.listByAgent(a.id, 3)
    for (const t of tasks) {
      if (t.status === 'done' || t.status === 'running') {
        otherActivity.push(`[${a.name}] ${t.task} -> ${t.status === 'running' ? '进行中' : (t.result || '').slice(0, 100)}`)
      }
    }
  }

  let context = ''

  // Recent chat context
  if (recentMsgs.length > 0) {
    context += '## 群聊最近消息\n'
    for (const m of recentMsgs) {
      const sender = m.is_ai ? (m.sender_name || 'DS') : (m.sender_name || '用户')
      context += `[${sender}]: ${m.text}\n`
    }
    context += '\n'
  }

  // Other agents' activity (inter-agent awareness)
  if (otherActivity.length > 0) {
    context += '## 其他 Agent 近期活动\n'
    for (const a of otherActivity) {
      context += `${a}\n`
    }
    context += '\n'
  }

  // Shared memory
  if (sharedMem.length > 0) {
    context += '## 共享记忆\n'
    for (const m of sharedMem.slice(0, 20)) {
      context += `- ${m.key}: ${m.value}\n`
    }
    context += '\n'
  }

  return context
}

// ─── Extract and store memory from task result ───
function extractMemory(roomId, agentId, agentName, task, result) {
  // Store task summary in shared memory
  const summary = (result || '').slice(0, 500)
  dsMemory.set(roomId, `task_${Date.now()}`, `${agentName}完成了: ${task.slice(0, 100)} -> ${summary}`, agentId)

  // Store agent's last activity
  dsMemory.set(roomId, `${agentName}_last_activity`, task.slice(0, 200), agentId)
}

// ─── Run a DS agent task in background ───
async function runDsTask({ agentId, task, apiKey, roomId, triggeredBy }) {
  const agent = dsAgent.findById(agentId)
  if (!agent) throw new Error('Agent not found: ' + agentId)

  // Check if agent is already busy
  if (agent.status === 'working') {
    // Queue the task or reject
    sendDsMessage(roomId, agent.name, '我正在处理其他任务，请稍等片刻再 @我。')
    return null
  }

  // Create task record
  const taskId = dsTask.create(agentId, roomId, task)
  const abortController = new AbortController()
  runningTasks.set(taskId, abortController)

  // Mark agent as working
  dsAgent.updateStatus(agentId, 'working', task)
  broadcast(roomId, {
    type: 'ds_status',
    agentId,
    agentName: agent.name,
    status: 'working',
    task: task,
    taskId,
  })

  // Send acknowledgment to chat
  const template = getTemplate(agent.role)
  const ackMsg = generateAck(agent.name, agent.role, task)
  sendDsMessage(roomId, agent.name, ackMsg)

  // Build context
  const contextStr = buildAgentContext(roomId, agentId, agent.name)

  // Compose full task with system prompt and context
  const fullTask = `${agent.system_prompt || template.systemPrompt}\n\n${contextStr}\n\n## 当前任务\n用户 @${triggeredBy || 'someone'} 请求：\n${task}\n\n## 工作原则（像 Claude Code 一样专业）\n1. 动手前先读文件，理解现有代码结构\n2. 长任务分步执行，每步验证\n3. 遇到错误先分析原因，不要盲目重试\n4. 完成后用简洁语言汇报，不要长篇大论\n\n## 输出格式（重要！）\n**目的：不让长篇输出污染群聊，保持群聊清爽**\n\n- **短结果（<500字符）**：直接输出文本\n- **长结果（报告、代码、表格等）**：必须使用文件格式输出\n  格式: [FILE:文件名.扩展名:大小]内容[/FILE]\n  例如: [FILE:report.docx:2KB]# 报告标题\\n内容...[/FILE]\n  支持类型: .txt(文本), .docx(文档), .pdf, .xlsx(表格), .pptx(幻灯片), .js/.ts/.py(代码)\n  用户会看到文件气泡，点开可查看完整内容\n- **真实电脑文件**：如果是用户电脑上的文件，使用: [REALFILE:完整文件路径]\n  用户点击会在电脑上直接打开\n- **完成确认**：长任务完成后，先说"✓ 已完成"，再附上文件气泡\n\n## 记忆与衔接\n- 你的工作会自动存入共享记忆，其他 Agent 可以看到\n- 长对话会自动接力（压缩上下文，无缝切换到新实例）\n- 你可以参考共享记忆中其他 Agent 的发现\n\n请开始执行。`

  // Progress callback
  const onProgress = (event) => {
    // Append to task progress
    dsTask.appendProgress(taskId, event)

    // Broadcast to room
    broadcast(roomId, {
      type: 'ds_progress',
      agentId,
      agentName: agent.name,
      taskId,
      event,
    })

    // ─── 流式文本：实时广播到群聊（解决"输出不显示"）───
    // stream_text 事件会被前端接收并实时显示在消息气泡中
    // 不需要在这里额外发消息，前端会处理

    // Send intermediate messages for long tasks
    if (event.type === 'round' && event.round > 0 && event.round % 10 === 0) {
      sendDsMessage(roomId, agent.name, `仍在工作中，已完成 ${event.round} 轮...`)
    }

    // ─── 接力事件通知 ───
    if (event.type === 'relay_start') {
      sendDsMessage(roomId, agent.name, `[上下文接力] 对话较长，正在压缩上下文以保持记忆连续性...`)
    }
    if (event.type === 'relay_done') {
      sendDsMessage(roomId, agent.name, `[上下文接力完成] 已无缝切换到新实例继续工作，不会丢失任何上下文。`)
    }

    // ─── 压缩事件通知 ───
    if (event.type === 'compact_done') {
      // 静默处理，不打扰用户
    }
  }

  try {
    // Run the agent — 传递 roomId/agentId/agentName 以支持接力模式
    const result = await runAgent({
      task: fullTask,
      apiKey,
      model: agent.model || template.model,
      permissionMode: 'default',
      signal: abortController.signal,
      onProgress,
      roomId,
      agentId,
      agentName: agent.name,
    })

    // Store memory
    extractMemory(roomId, agentId, agent.name, task, result)

    // Update task
    dsTask.updateStatus(taskId, 'done', result)

    // Update agent status
    dsAgent.updateStatus(agentId, 'idle', '')

    // Broadcast completion
    broadcast(roomId, {
      type: 'ds_status',
      agentId,
      agentName: agent.name,
      status: 'done',
      taskId,
      result: result,
    })

    // Send result to chat
    const resultMsg = formatResult(agent.name, task, result)
    sendDsMessage(roomId, agent.name, resultMsg)

    return result
  } catch (err) {
    // Update task as error
    dsTask.updateStatus(taskId, 'error', err.message)

    // Update agent status
    dsAgent.updateStatus(agentId, 'error', '')

    // Broadcast error
    broadcast(roomId, {
      type: 'ds_status',
      agentId,
      agentName: agent.name,
      status: 'error',
      taskId,
      error: err.message,
    })

    // Send error to chat
    sendDsMessage(roomId, agent.name, `任务执行出错: ${err.message}`)

    throw err
  } finally {
    runningTasks.delete(taskId)
  }
}

// ─── Quick chat reply (non-agent, for simple questions) ───
async function quickReply({ agentId, messages, apiKey, roomId }) {
  const agent = dsAgent.findById(agentId)
  if (!agent) throw new Error('Agent not found')

  const template = getTemplate(agent.role)
  const { DEEPSEEK_API_BASE } = require('../config/constants')

  const systemMsg = { role: 'system', content: agent.system_prompt || template.systemPrompt }
  const allMsgs = [systemMsg, ...messages]

  const res = await fetch(DEEPSEEK_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: agent.model || template.model,
      messages: allMsgs,
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || 'API request failed')
  }

  return res.body // Return stream for caller to process
}

// ─── Abort a running task ───
function abortTask(taskId) {
  const ctrl = runningTasks.get(taskId)
  if (ctrl) {
    ctrl.abort()
    runningTasks.delete(taskId)
    return true
  }
  return false
}

// ─── Abort all tasks for an agent ───
function abortAgentTasks(agentId) {
  const agent = dsAgent.findById(agentId)
  if (!agent) return 0

  // Find running tasks for this agent
  let count = 0
  for (const [taskId, ctrl] of runningTasks) {
    const task = dsTask.findById(taskId)
    if (task && task.agent_id === agentId) {
      ctrl.abort()
      runningTasks.delete(taskId)
      count++
    }
  }

  dsAgent.updateStatus(agentId, 'idle', '')
  return count
}

// ─── Get agent status summary ───
function getAgentStatus(agentId) {
  const agent = dsAgent.findById(agentId)
  if (!agent) return null

  const activeTasks = dsTask.listByAgent(agentId, 5).filter(t => t.status === 'running')
  const recentTasks = dsTask.listByAgent(agentId, 10)

  return {
    ...agent,
    activeTasks,
    recentTasks,
  }
}

// ─── Get all agents status for a room ───
function getRoomAgentsStatus(roomId) {
  const agents = dsAgent.listByRoom(roomId)
  return agents.map(a => {
    const activeTasks = dsTask.listByAgent(a.id, 3).filter(t => t.status === 'running')
    return {
      ...a,
      hasActiveTask: activeTasks.length > 0,
      activeTask: activeTasks[0] || null,
    }
  })
}

// ─── Helpers ───
function generateAck(name, role, task) {
  const acks = {
    coder: ['收到，开始编码...', '明白，我来处理这个编程任务。', '好的，正在分析代码需求...'],
    researcher: ['收到，开始调研...', '明白，我来搜索相关资料。', '好的，正在联网查询...'],
    writer: ['收到，开始写作...', '明白，我来撰写内容。', '好的，正在构思文档...'],
    analyst: ['收到，开始分析数据...', '明白，我来处理数据。', '好的，正在分析中...'],
    devops: ['收到，开始部署...', '明白，我来处理运维任务。', '好的，正在配置环境...'],
    general: ['收到，正在处理...', '好的，我来帮你。', '明白，马上处理...'],
  }
  const list = acks[role] || acks.general
  return list[Math.floor(Math.random() * list.length)] + ' (任务: ' + task.slice(0, 40) + (task.length > 40 ? '...' : '') + ')'
}

function formatResult(name, task, result) {
  const text = (result || '').trim()
  if (!text) return '任务已完成。'

  // ─── 检测 agent 是否已经用文件格式输出 ───
  // 如果 agent 输出了 [FILE:...] 或 [REALFILE:...] 格式，直接返回
  if (text.startsWith('[FILE:') || text.startsWith('[REALFILE:')) {
    return text
  }

  // ─── 智能文件格式化：长内容自动转为文件气泡 ───
  // 目的：不让 AI 长篇输出污染群聊，只显示"做好了"+文件气泡
  // 用户点开文件气泡查看完整内容
  if (text.length > 500) {
    // 检测内容类型
    let fileType = 'text'
    let fileName = 'result'
    let ext = 'txt'

    // 检测是否是代码
    if (text.match(/```[\s\S]*?```/) || text.match(/function\s|class\s|import\s|const\s|var\s/)) {
      fileType = 'code'
      fileName = 'code_snippet'
      ext = 'js'
    }
    // 检测是否是表格（Markdown 表格）
    else if (text.match(/\|.*\|.*\n\|[-:| ]+\|/)) {
      fileType = 'table'
      fileName = 'data_table'
      ext = 'xlsx'
    }
    // 检测是否是报告/文档（有标题结构）
    else if (text.match(/^#\s|^\*\*/m)) {
      fileType = 'word'
      fileName = 'report'
      ext = 'docx'
    }

    const sizeKB = Math.max(1, Math.ceil(text.length / 1024))
    // 短回复 + 文件气泡：用户看到"做好了"，点开文件气泡看详情
    return `✓ 已完成\n[FILE:${fileName}.${ext}:${sizeKB}KB]${text}[/FILE]`
  }

  return text
}

// ══════════════════════════════════════════════════════
// 并行多 DS 执行 — 当群聊中 @多个 DS 时
// ══════════════════════════════════════════════════════

/**
 * 并行执行多个 DS Agent 的任务
 *
 * 当用户在群聊中同时 @多个 DS 时，使用此函数并行执行。
 * 每个 DS 独立工作，完成后结果汇总到群聊。
 *
 * @param {Object} params
 * @param {Array} params.tasks - [{ agentId, task, triggeredBy }]
 * @param {string} params.apiKey
 * @param {string} params.roomId
 */
async function runParallelDsTasks({ tasks, apiKey, roomId }) {
  const results = []

  // 为每个 DS Agent 启动独立任务
  const promises = tasks.map(async ({ agentId, task, triggeredBy }) => {
    try {
      const result = await runDsTask({ agentId, task, apiKey, roomId, triggeredBy })
      results.push({ agentId, task, result, success: true })
    } catch (e) {
      results.push({ agentId, task, error: e.message, success: false })
    }
  })

  await Promise.all(promises)

  // 广播汇总结果
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length

  broadcast(roomId, {
    type: 'ds_parallel_done',
    totalCount: tasks.length,
    successCount,
    failCount,
    results: results.map(r => ({
      agentId: r.agentId,
      task: r.task,
      success: r.success,
      error: r.error,
    })),
  })

  return results
}

// ══════════════════════════════════════════════════════
// Ambient 模式 — DS 主动行动（灵感来自 Claude Tag Ambient）
// ══════════════════════════════════════════════════════

/**
 * Ambient 检查 — DS 主动扫描群聊，发现需要关注的事项
 *
 * 这是 Claude Tag 的 Ambient 模式实现：
 *   - 主动提醒被忽视的讨论
 *   - 跟进长期未解决的问题
 *   - 发现相关信息并提醒
 *
 * 应该定期调用（如每 30 分钟）或在新消息到达时调用
 *
 * @param {string} roomId - 群聊ID
 * @param {string} apiKey - API Key
 * @param {Object} [options]
 * @param {number} [options.sinceMinutes=30] - 检查最近多少分钟的消息
 */
async function ambientCheck(roomId, apiKey, options = {}) {
  const sinceMinutes = options.sinceMinutes || 30
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000)

  // 获取最近消息
  const recentMsgs = room.getMessages(roomId, 50)
  const recentStr = recentMsgs
    .filter(m => new Date(m.created_at) > since)
    .map(m => `[${m.sender_name || (m.is_ai ? 'DS' : '用户')}]: ${m.text}`)
    .join('\n')

  if (!recentStr.trim()) return null

  // 获取群里的 DS Agent 列表
  const agents = dsAgent.listByRoom(roomId)
  if (agents.length === 0) return null

  // 获取共享记忆
  const sharedMem = dsMemory.listByRoom(roomId).slice(0, 10)
  const memStr = sharedMem.map(m => `- ${m.key}: ${m.value}`).join('\n') || '无'

  // 让 AI 分析是否有需要主动跟进的事项
  const { DEEPSEEK_API_BASE } = require('../config/constants')
  const resp = await fetch(DEEPSEEK_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      messages: [
        {
          role: 'system',
          content: `你是群聊的 Ambient 监控助手。分析最近的群聊消息，判断是否有需要主动跟进的事项。

# 判断标准
1. 有人提出了问题但没人回答（超过 ${sinceMinutes} 分钟）
2. 有人 @了 DS 但任务似乎没完成
3. 讨论中提到了重要的待办事项但没人跟进
4. 发现了与共享记忆中相关的信息

# 输出格式
如果有需要跟进的事项，输出 JSON:
{
  "alerts": [
    {
      "type": "unanswered_question" | "incomplete_task" | "todo_followup" | "memory_match",
      "severity": "low" | "medium" | "high",
      "description": "具体描述",
      "suggested_agent": "建议哪个 DS Agent 处理（name 或 null）",
      "suggested_action": "建议的行动"
    }
  ]
}

如果没有需要跟进的事项，输出: {"alerts": []}

# 重要
- 只输出 JSON，不要其他文字
- 不要过度报警 — 只报告真正需要关注的事项
- severity 要合理评估`,
        },
        {
          role: 'user',
          content: `## 最近 ${sinceMinutes} 分钟的群聊消息\n${recentStr}\n\n## 共享记忆\n${memStr}\n\n## 群里的 DS Agent\n${agents.map(a => `- ${a.name} (${a.role}, 状态: ${a.status})`).join('\n')}`,
        },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    }),
  })

  if (!resp.ok) return null

  const data = await resp.json()
  const text = data.choices?.[0]?.message?.content || ''

  try {
    const parsed = JSON.parse(text)
    if (parsed.alerts && parsed.alerts.length > 0) {
      // 广播 ambient 警报
      for (const alert of parsed.alerts) {
        broadcast(roomId, {
          type: 'ds_ambient_alert',
          alert,
          roomId,
        })

        // 如果有建议的 Agent 且严重程度高，主动发消息
        if (alert.severity === 'high' && alert.suggested_agent) {
          const agent = agents.find(a => a.name === alert.suggested_agent)
          if (agent && agent.status === 'idle') {
            sendDsMessage(roomId, agent.name, `[Ambient 提醒] ${alert.description}\n\n建议行动: ${alert.suggested_action}`)
          }
        }
      }
      return parsed.alerts
    }
  } catch {}

  return null
}

// ══════════════════════════════════════════════════════
// 跨 Agent 通信 — 让 DS 之间互相感知
// ══════════════════════════════════════════════════════

/**
 * 让一个 DS Agent 向另一个 DS Agent 发送消息
 *
 * 例如: CodeBot 完成代码后通知 ResearchBot 去查资料
 *
 * @param {string} roomId - 群聊ID
 * @param {string} fromAgentId - 发送方 Agent ID
 * @param {string} toAgentName - 接收方 Agent 名称
 * @param {string} message - 消息内容
 * @param {string} apiKey - API Key
 */
async function interAgentMessage(roomId, fromAgentId, toAgentName, message, apiKey) {
  const fromAgent = dsAgent.findById(fromAgentId)
  if (!fromAgent) throw new Error('Sender agent not found')

  const toAgents = dsAgent.listByRoom(roomId)
  const toAgent = toAgents.find(a => a.name === toAgentName)
  if (!toAgent) {
    // 在群聊中公开回复
    sendDsMessage(roomId, fromAgent.name, `@${toAgentName} ${message}`)
    return
  }

  // 在群聊中公开 @对方
  sendDsMessage(roomId, fromAgent.name, `@${toAgentName} ${message}`)

  // 如果对方空闲，自动触发任务
  if (toAgent.status === 'idle') {
    // 存入共享记忆，让对方知道
    dsMemory.set(roomId, `${fromAgent.name}_to_${toAgentName}_${Date.now()}`, message, fromAgentId)

    // 自动触发对方处理
    try {
      await runDsTask({
        agentId: toAgent.id,
        task: `${fromAgent.name} 请求你: ${message}`,
        apiKey,
        roomId,
        triggeredBy: fromAgent.name,
      })
    } catch (e) {
      console.error('[DS] interAgentMessage task failed:', e.message)
    }
  }
}

// ══════════════════════════════════════════════════════
// 获取群聊上下文统计 — 用于 UI 显示
// ══════════════════════════════════════════════════════

/**
 * 获取群聊中所有 DS Agent 的上下文使用统计
 */
function getRoomContextStats(roomId) {
  const agents = dsAgent.listByRoom(roomId)
  return agents.map(a => {
    const tasks = dsTask.listByAgent(a.id, 5)
    const runningTask = tasks.find(t => t.status === 'running')
    return {
      agentId: a.id,
      agentName: a.name,
      role: a.role,
      status: a.status,
      currentTask: a.current_task,
      hasRunningTask: !!runningTask,
      runningTaskId: runningTask?.id || null,
    }
  })
}

module.exports = {
  runDsTask,
  runParallelDsTasks,
  ambientCheck,
  interAgentMessage,
  quickReply,
  abortTask,
  abortAgentTasks,
  getAgentStatus,
  getRoomAgentsStatus,
  getRoomContextStats,
  sendDsMessage,
  buildAgentContext,
}
