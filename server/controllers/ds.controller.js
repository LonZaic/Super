// ══════════════════════════════════════
// DS Agent Controller — CRUD + task management
// ══════════════════════════════════════

const config = require('../config')
const { dsAgent, dsTask, dsMemory, dsSchedule, room } = require('../db')
const { sendSuccess, sendError } = require('../errorHandler')
const { getTemplate, listTemplates, getIcon, genAgentId, parseMentions } = require('../engine/dsRegistry')
const { runDsTask, runParallelDsTasks, ambientCheck, interAgentMessage, quickReply, abortTask, abortAgentTasks, getRoomAgentsStatus, getRoomContextStats, getAgentStatus, sendDsMessage } = require('../engine/dsAgent')

// ─── List available role templates ───
function templates(req, res) {
  sendSuccess(res, { templates: listTemplates() })
}

// ─── List agents in a room ───
function listAgents(req, res) {
  const roomId = req.params.roomId
  const agents = dsAgent.listByRoom(roomId)
  // Attach icon
  const result = agents.map(a => ({ ...a, icon: getIcon(a.avatar) }))
  sendSuccess(res, { agents: result })
}

// ─── Get room agents with status ───
function roomStatus(req, res) {
  const roomId = req.params.roomId
  const agents = getRoomAgentsStatus(roomId)
  sendSuccess(res, { agents })
}

// ─── Create a new DS agent in a room ───
function createAgent(req, res) {
  const roomId = req.params.roomId
  const { role, name, avatar, systemPrompt, model } = req.body

  // Verify room exists
  const r = room.findById(roomId)
  if (!r) return sendError(res, '房间不存在')

  // Get template or use custom
  const template = getTemplate(role)
  const agentName = name || template.name

  // Check name uniqueness in room
  const existing = dsAgent.findByName(roomId, agentName)
  if (existing) return sendError(res, `Agent "${agentName}" 已存在于该群聊`)

  const id = genAgentId()
  dsAgent.create(
    id,
    roomId,
    agentName,
    role || 'general',
    avatar || template.avatar,
    systemPrompt || template.systemPrompt,
    model || template.model
  )

  const agent = dsAgent.findById(id)
  sendSuccess(res, { agent: { ...agent, icon: getIcon(agent.avatar) } })
}

// ─── Update an agent ───
function updateAgent(req, res) {
  const { agentId } = req.params
  const { name, role, avatar, systemPrompt, model } = req.body

  const agent = dsAgent.findById(agentId)
  if (!agent) return sendError(res, 'Agent 不存在')

  // If renaming, check uniqueness
  if (name && name !== agent.name) {
    const existing = dsAgent.findByName(agent.room_id, name)
    if (existing) return sendError(res, `Agent "${name}" 已存在`)
  }

  dsAgent.update(agentId, { name, role, avatar, system_prompt: systemPrompt, model })
  const updated = dsAgent.findById(agentId)
  sendSuccess(res, { agent: { ...updated, icon: getIcon(updated.avatar) } })
}

// ─── Delete an agent ───
function deleteAgent(req, res) {
  const { agentId } = req.params
  abortAgentTasks(agentId)
  dsAgent.delete(agentId)
  sendSuccess(res, { ok: true })
}

// ─── Trigger a DS agent task (background) ───
function triggerTask(req, res) {
  const { agentId } = req.params
  const { task, triggeredBy } = req.body
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']

  if (!apiKey) return sendError(res, '缺少 API Key')
  if (!task) return sendError(res, '缺少任务描述')

  const agent = dsAgent.findById(agentId)
  if (!agent) return sendError(res, 'Agent 不存在')

  // Run in background — don't block the response
  runDsTask({
    agentId,
    task,
    apiKey,
    roomId: agent.room_id,
    triggeredBy,
  }).catch(err => {
    console.error('[DS] Task error:', err.message)
  })

  sendSuccess(res, { ok: true, message: '任务已启动', agentName: agent.name })
}

// ─── Quick reply (streaming, for simple chat) ───
async function quickChat(req, res) {
  const { agentId } = req.params
  const { messages } = req.body
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']

  if (!apiKey) return sendError(res, '缺少 API Key')
  if (!messages || !Array.isArray(messages)) return sendError(res, '缺少消息')

  const agent = dsAgent.findById(agentId)
  if (!agent) return sendError(res, 'Agent 不存在')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  try {
    const stream = await quickReply({ agentId, messages, apiKey, roomId: agent.room_id })
    const reader = stream.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      res.write(chunk)
    }
    res.end()
  } catch (err) {
    if (!res.destroyed && res.writable) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`)
      res.end()
    }
  }
}

// ─── Abort a task ───
function abort(req, res) {
  const { taskId } = req.params
  const ok = abortTask(Number(taskId))
  sendSuccess(res, { ok })
}

// ─── Abort all tasks for an agent (主动介入) ───
function abortAgent(req, res) {
  const { agentId } = req.params
  abortAgentTasks(Number(agentId))
  // 更新 agent 状态为 idle
  try { dsAgent.updateStatus(Number(agentId), 'idle', '') } catch (e) {}
  sendSuccess(res, { ok: true })
}

// ─── 定时任务：列出房间的所有定时任务 ───
function listSchedules(req, res) {
  const { roomId } = req.params
  const schedules = dsSchedule.listByRoom(roomId)
  sendSuccess(res, { schedules })
}

// ─── 定时任务：添加定时任务 ───
function addSchedule(req, res) {
  const { roomId } = req.params
  const { time, task, agentId, agentName, repeat } = req.body
  if (!time || !task) return sendError(res, '缺少时间或任务')
  const result = dsSchedule.create(roomId, {
    agentId: agentId || null,
    agentName: agentName || '',
    task,
    time,
    repeat: repeat || 'once',
  })
  sendSuccess(res, { id: result.lastInsertRowid })
}

// ─── 定时任务：删除定时任务 ───
function deleteSchedule(req, res) {
  const { scheduleId } = req.params
  dsSchedule.delete(Number(scheduleId))
  sendSuccess(res, { ok: true })
}

// ─── Get agent tasks history ───
function agentTasks(req, res) {
  const { agentId } = req.params
  const tasks = dsTask.listByAgent(agentId, 20)
  sendSuccess(res, { tasks })
}

// ─── Get room tasks ───
function roomTasks(req, res) {
  const roomId = req.params.roomId
  const tasks = dsTask.listByRoom(roomId, 50)
  sendSuccess(res, { tasks })
}

// ─── Get task progress ───
function taskProgress(req, res) {
  const { taskId } = req.params
  const progress = dsTask.getProgress(Number(taskId))
  sendSuccess(res, { progress })
}

// ─── Get agent detail with status ───
function agentDetail(req, res) {
  const { agentId } = req.params
  const status = getAgentStatus(agentId)
  if (!status) return sendError(res, 'Agent 不存在')
  sendSuccess(res, { agent: status })
}

// ─── Memory operations ───
function getMemory(req, res) {
  const roomId = req.params.roomId
  const memories = dsMemory.listByRoom(roomId)
  sendSuccess(res, { memories })
}

function setMemory(req, res) {
  const roomId = req.params.roomId
  const { key, value, agentId } = req.body
  if (!key || !value) return sendError(res, '缺少 key 或 value')
  dsMemory.set(roomId, key, value, agentId)
  sendSuccess(res, { ok: true })
}

function deleteMemory(req, res) {
  const { memoryId } = req.params
  dsMemory.delete(Number(memoryId))
  sendSuccess(res, { ok: true })
}

// ─── Parse @mentions in a message and route to agents ───
function routeMessage(req, res) {
  const { roomId } = req.params
  const { text, triggeredBy } = req.body
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']

  if (!text) return sendError(res, '缺少消息内容')

  const mentions = parseMentions(text)
  const agents = dsAgent.listByRoom(roomId)

  // Match mentions to agents
  const matchedAgents = []
  for (const m of mentions) {
    const agent = agents.find(a => a.name.toLowerCase() === m.name.toLowerCase())
    if (agent) {
      // Extract task text after the mention
      const afterMention = text.slice(m.index + m.full.length).trim()
      // If there are multiple mentions, split by next @
      const nextMention = mentions.find(m2 => m2.index > m.index)
      const taskText = nextMention
        ? afterMention.slice(0, nextMention.index - (m.index + m.full.length)).trim()
        : afterMention

      if (taskText) {
        matchedAgents.push({ agent, task: taskText })
      } else {
        // Just mentioned without task — agent acknowledges
        sendDsMessage(roomId, agent.name, '我在，有什么需要帮忙的？')
      }
    }
  }

  // Trigger tasks for matched agents (in parallel)
  const triggered = []
  for (const { agent, task } of matchedAgents) {
    if (!apiKey) {
      sendDsMessage(roomId, agent.name, '需要配置 API Key 才能执行任务。')
      continue
    }

    runDsTask({
      agentId: agent.id,
      task,
      apiKey,
      roomId,
      triggeredBy,
    }).catch(err => {
      console.error('[DS] Route task error:', err.message)
    })

    triggered.push({ agentName: agent.name, task })
  }

  sendSuccess(res, { triggered, mentions: mentions.map(m => m.name) })
}

// ─── Trigger parallel tasks for multiple agents ───
function parallelTrigger(req, res) {
  const { roomId } = req.params
  const { tasks, triggeredBy } = req.body
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']

  if (!apiKey) return sendError(res, '缺少 API Key')
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) return sendError(res, '缺少任务列表')

  // Validate all agents exist in this room
  const agents = dsAgent.listByRoom(roomId)
  const validTasks = tasks.filter(t => agents.find(a => a.id === t.agentId))
  if (validTasks.length === 0) return sendError(res, '没有有效的 Agent')

  // Run in background
  runParallelDsTasks({
    tasks: validTasks.map(t => ({ ...t, triggeredBy })),
    apiKey,
    roomId,
  }).catch(err => {
    console.error('[DS] Parallel tasks error:', err.message)
  })

  sendSuccess(res, { ok: true, count: validTasks.length, message: `${validTasks.length} 个 Agent 已启动并行任务` })
}

// ─── Run ambient check for a room ───
async function runAmbientCheck(req, res) {
  const { roomId } = req.params
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']
  const { sinceMinutes } = req.query

  if (!apiKey) return sendError(res, '缺少 API Key')

  try {
    const alerts = await ambientCheck(roomId, apiKey, {
      sinceMinutes: sinceMinutes ? parseInt(sinceMinutes, 10) : 30,
    })
    sendSuccess(res, { alerts: alerts || [] })
  } catch (err) {
    sendError(res, 'Ambient 检查失败: ' + err.message)
  }
}

// ─── Inter-agent communication ───
async function agentMessage(req, res) {
  const { roomId } = req.params
  const { fromAgentId, toAgentName, message } = req.body
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']

  if (!apiKey) return sendError(res, '缺少 API Key')
  if (!fromAgentId || !toAgentName || !message) return sendError(res, '缺少必要参数')

  try {
    await interAgentMessage(roomId, fromAgentId, toAgentName, message, apiKey)
    sendSuccess(res, { ok: true })
  } catch (err) {
    sendError(res, 'Agent 通信失败: ' + err.message)
  }
}

// ─── Get room context stats ───
function roomContextStats(req, res) {
  const roomId = req.params.roomId
  const stats = getRoomContextStats(roomId)
  sendSuccess(res, { stats })
}

// ─── Open a real file on the user's computer ───
function openFile(req, res) {
  const { path: filePath } = req.body
  if (!filePath) return sendError(res, '缺少文件路径')

  const { exec } = require('child_process')
  const os = require('os')

  try {
    let cmd
    if (process.platform === 'win32') {
      // Windows: 使用 start 命令
      cmd = `start "" "${filePath}"`
    } else if (process.platform === 'darwin') {
      // macOS: 使用 open 命令
      cmd = `open "${filePath}"`
    } else {
      // Linux: 使用 xdg-open
      cmd = `xdg-open "${filePath}"`
    }

    exec(cmd, (err) => {
      if (err) {
        sendError(res, '无法打开文件: ' + err.message)
      } else {
        sendSuccess(res, { ok: true, path: filePath })
      }
    })
  } catch (e) {
    sendError(res, '打开文件失败: ' + e.message)
  }
}

module.exports = {
  templates,
  listAgents,
  roomStatus,
  createAgent,
  updateAgent,
  deleteAgent,
  triggerTask,
  parallelTrigger,
  quickChat,
  abort,
  abortAgent,
  listSchedules,
  addSchedule,
  deleteSchedule,
  agentTasks,
  roomTasks,
  taskProgress,
  agentDetail,
  getMemory,
  setMemory,
  deleteMemory,
  routeMessage,
  runAmbientCheck,
  agentMessage,
  roomContextStats,
  openFile,
}
