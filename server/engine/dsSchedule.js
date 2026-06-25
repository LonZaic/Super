// ══════════════════════════════════════
// DS Schedule Runner — 定时任务调度器
// 每分钟检查数据库中的定时任务，到时间就触发对应 agent
// 支持：单次、每天、每周重复
// ══════════════════════════════════════

const { dsSchedule, dsAgent } = require('../db')
const { runDsTask, sendDsMessage } = require('./dsAgent')
const config = require('../config')

let schedulerInterval = null
const CHECK_INTERVAL = 60 * 1000 // 每分钟检查一次

// ─── 检查并触发到时间的任务 ───
async function checkAndRunSchedules() {
  let schedules = []
  try {
    schedules = dsSchedule.listAllEnabled()
  } catch (e) {
    console.error('[Schedule] List failed:', e.message)
    return
  }

  const now = new Date()
  const currentTime = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0')
  const todayStr = now.toISOString().slice(0, 10) // YYYY-MM-DD
  const dayOfWeek = now.getDay() // 0=Sunday, 1=Monday...

  for (const s of schedules) {
    try {
      // 时间匹配检查
      if (s.time !== currentTime) continue

      // 重复模式检查
      if (s.repeat === 'once') {
        // 单次任务：检查是否已运行过
        if (s.last_run) continue
      } else if (s.repeat === 'daily') {
        // 每天任务：检查今天是否已运行
        if (s.last_run && s.last_run.startsWith(todayStr)) continue
      } else if (s.repeat === 'weekly') {
        // 每周任务：检查今天星期几是否匹配，且本周是否已运行
        // 简化：每周一运行（dayOfWeek === 1）
        if (dayOfWeek !== 1) continue
        if (s.last_run && s.last_run.startsWith(todayStr)) continue
      }

      // ─── 触发任务 ───
      console.log(`[Schedule] Triggering: ${s.task} at ${s.time} (repeat: ${s.repeat})`)

      // 更新 last_run
      dsSchedule.updateLastRun(s.id, now.toISOString())

      // 发送通知到群聊
      sendDsMessage(s.room_id, s.agent_name || 'DS', `[定时任务] 开始执行: ${s.task}`)

      // 获取 API key
      const apiKey = config.getApiKey()
      if (!apiKey) {
        sendDsMessage(s.room_id, s.agent_name || 'DS', `[定时任务] 缺少 API Key，无法执行`)
        continue
      }

      // 如果指定了 agent，触发该 agent；否则选一个通用 agent
      let agentId = s.agent_id
      if (!agentId) {
        // 自动选择一个空闲 agent
        const agents = dsAgent.listByRoom(s.room_id)
        const idle = agents.find(a => a.status === 'idle')
        if (idle) {
          agentId = idle.id
        } else if (agents.length > 0) {
          agentId = agents[0].id
        }
      }

      if (agentId) {
        // 异步触发，不阻塞调度器
        runDsTask({
          agentId: Number(agentId),
          task: s.task,
          apiKey,
          roomId: s.room_id,
          triggeredBy: 'scheduler',
        }).catch(e => {
          console.error('[Schedule] Task failed:', e.message)
          sendDsMessage(s.room_id, s.agent_name || 'DS', `[定时任务] 执行失败: ${e.message}`)
        })
      } else {
        sendDsMessage(s.room_id, s.agent_name || 'DS', `[定时任务] 房间内没有可用 agent，无法执行`)
      }
    } catch (e) {
      console.error('[Schedule] Error processing schedule:', s.id, e.message)
    }
  }
}

// ─── 启动调度器 ───
function startScheduler() {
  if (schedulerInterval) {
    console.log('[Schedule] Scheduler already running')
    return
  }
  console.log('[Schedule] Starting scheduler (checks every 60s)')
  schedulerInterval = setInterval(checkAndRunSchedules, CHECK_INTERVAL)
  // 启动后立即检查一次（延迟 5 秒，避免启动时冲突）
  setTimeout(checkAndRunSchedules, 5000)
}

// ─── 停止调度器 ───
function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[Schedule] Scheduler stopped')
  }
}

module.exports = { startScheduler, stopScheduler, checkAndRunSchedules }
