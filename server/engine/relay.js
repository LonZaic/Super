// ══════════════════════════════════════════════════════
// DS Relay Engine — 上下文接力模式
// ══════════════════════════════════════════════════════
// 这是 DeepSeek-Super 最核心的创新之一，灵感来自 forgemeteor
// 的接力模式 + Claude Code 的上下文压缩。
//
// 问题: AI 对话越来越长，上下文窗口（1M tokens）虽然大但不是无限的。
//       当上下文接近满时，AI 会"健忘"——注意力被分散到太多旧消息上。
//
// 方案: 两阶段上下文管理
//   阶段1 — 压缩 (35% 阈值): 把旧消息压缩成摘要，保留最近30条
//   阶段2 — 接力 (45% 阈值): 让当前 AI 写一份"9段结构化摘要"，
//           然后"交接"给一个新 AI 实例继续。用户完全无感。
//
// 为什么叫"接力"？
//   就像接力赛跑: 当前 AI 跑到 45% 就把"接力棒"(HandoffPackage)
//   交给下一个 AI，下一个 AI 从停下的地方继续跑。
//
// DS 多 Agent 增强:
//   - 接力包可共享给同群其他 DS Agent（跨 agent 上下文互通）
//   - Ambient 记忆提取：接力时自动提取关键事实存入共享记忆
//   - 任务延续：接力后新实例自动继续未完成任务
// ══════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const { estimateTokenCount } = require('./context')
const { dsMemory } = require('../db')

// ─── 配置 ───
const CONTEXT_CONFIG = {
  windowTokens: 1_000_000,        // DeepSeek V4 上下文窗口
  compactThreshold: 0.35,         // 35% → 触发压缩
  relayThreshold: 0.45,           // 45% → 触发接力
  maxRecentMessages: 30,          // 压缩时保留最近消息数
  maxMessageChars: 2000,          // 单条消息最大字符
  summaryMaxChars: 2000,          // 早期消息摘要最大字符
  olderSliceChars: 150,           // 每条早期消息截取字符数
}

// ─── DeepSeek API 配置 ───
const { DEEPSEEK_API_BASE } = require('../config/constants')

// ══════════════════════════════════════════════════════
// 阶段1: 压缩对话历史
// ══════════════════════════════════════════════════════

/**
 * 压缩对话历史 — 阶段1: 精简上下文
 *
 * 策略（和 CC 一样）:
 *   1. 保留所有 system 消息（它们是最重要的"规则"）
 *   2. 保留最近 30 条 user/assistant 消息（最近的对话最重要）
 *   3. 较早的消息 → 每条截取前 150 字符做成摘要
 *   4. 长消息截断到 2000 字符
 *   5. 确保总字符数不超过 maxTokens（默认40000 ≈ 16000 tokens）
 *   6. 超了就从前面删（保留 system 和最新的）
 */
function compressMessages(messages, maxTokens = 40000) {
  const compressed = []

  // 1. 始终保留 system 消息（截断到500字符，保留核心规则）
  for (const m of messages) {
    if (m.role === 'system') {
      compressed.push({ role: m.role, content: String(m.content).slice(0, 500) })
    }
  }

  // 2. 分离 user/assistant 消息
  const conversationMsgs = messages.filter(
    m => m.role === 'user' || m.role === 'assistant'
  )
  const recent = conversationMsgs.slice(-CONTEXT_CONFIG.maxRecentMessages)
  const older = conversationMsgs.slice(0, -CONTEXT_CONFIG.maxRecentMessages)

  // 3. 较早消息 → 批量做成摘要
  if (older.length > 0) {
    const olderSummary = older
      .filter(m => String(m.content).length > 20)
      .map(m => `[${m.role === 'user' ? '用户' : 'AI'}]: ${String(m.content).slice(0, CONTEXT_CONFIG.olderSliceChars)}`)
      .join('\n')

    if (olderSummary) {
      compressed.push({
        role: 'user',
        content: `[以下为较早对话的摘要]\n${olderSummary.slice(0, CONTEXT_CONFIG.summaryMaxChars)}`,
      })
    }
  }

  // 4. 加入最近的消息（长消息截断）
  for (const m of recent) {
    let content = String(m.content)
    if (content.length > CONTEXT_CONFIG.maxMessageChars) {
      content = content.slice(0, CONTEXT_CONFIG.maxMessageChars) + '...(已截断)'
    }
    compressed.push({ role: m.role, content })
  }

  // 5. 确保不超过 maxTokens
  let totalChars = compressed.reduce((s, m) => s + m.content.length, 0)
  while (totalChars > maxTokens && compressed.length > 5) {
    const removed = compressed.splice(1, 1)[0]
    totalChars -= removed.content.length
  }

  return compressed
}

// ══════════════════════════════════════════════════════
// 阶段2: 创建接力包 — 9段结构化摘要
// ══════════════════════════════════════════════════════

/**
 * 创建接力包 — 阶段2: 用当前 AI 生成结构化摘要
 *
 * <summary> 必须包含 9 段（抄 CC 的 9 段结构）:
 *   1. 主要请求和意图
 *   2. 关键技术概念
 *   3. 文件和代码段
 *   4. 错误和修复
 *   5. 问题解决
 *   6. 所有用户消息
 *   7. 待完成任务
 *   8. 当前工作
 *   9. 可选的下一步
 *
 * @param {Object} params
 * @param {Array} params.messages - 对话消息列表
 * @param {string} params.apiKey - API Key
 * @param {string} params.model - 模型名称
 * @param {string} params.roomId - 群聊ID（用于共享记忆）
 * @param {string} params.agentId - Agent ID
 * @param {string} params.agentName - Agent 名称
 * @param {Object} params.plan - 当前计划（可选）
 * @param {Object} params.memoryDoc - 记忆文档（可选）
 * @returns {Promise<HandoffPackage>}
 */
async function createHandoffPackage({
  messages,
  apiKey,
  model = 'deepseek-v4-flash',
  roomId = null,
  agentId = null,
  agentName = 'DS',
  plan = null,
  memoryDoc = null,
}) {
  // 1. 先压缩对话
  const compressedMessages = compressMessages(messages)

  // 2. 搜索相关共享记忆（跨 agent 互通）
  let sharedMemories = []
  if (roomId) {
    try {
      sharedMemories = dsMemory.listByRoom(roomId).slice(0, 10)
    } catch {}
  }

  // 3. 构建历史文本
  const historyText = compressedMessages
    .map(m => `[${m.role.toUpperCase()}]: ${String(m.content).slice(0, 500)}`)
    .join('\n')

  // 未完成的计划步骤
  const unfinishedSteps = plan?.steps
    ? plan.steps.filter(s => s.status !== 'done').map(s => s.description).join('、')
    : '无'

  // 4. 构建接力 prompt — CC-style 9段摘要模板
  const compactPrompt = `CRITICAL: 只输出文本，不要调用工具。

你的任务是创建一个详细的对话摘要，注意用户的明确请求和之前的操作。
摘要需要彻底捕捉技术细节、代码模式、架构决策，确保不丢失上下文。

在输出最终摘要前，先写 <analysis> 块组织思路：
1. 按时间顺序分析每条消息
2. 识别用户请求、你的方法、关键决策、代码细节
3. 特别关注用户反馈（尤其是纠正你的地方）

然后输出 <summary> 块，包含以下 9 段：

1. 主要请求和意图
2. 关键技术概念
3. 文件和代码段（包含完整路径、改动摘要、关键代码片段）
4. 错误和修复（包含用户纠正）
5. 问题解决（已解决 + 进行中）
6. 所有用户消息（非工具结果的）
7. 待完成任务
8. 当前工作（中断前正在做什么，包含文件和代码）
9. 可选的下一步（直接引用最近的对话作为依据）

## 对话历史
${historyText.slice(0, 6000)}

## 未完成的计划步骤
${unfinishedSteps}

## 项目记忆
- 目标：${memoryDoc?.projectGoal || '未设定'}
- 警告：${(memoryDoc?.userWarnings || []).join('；') || '无'}
- 技术栈：${memoryDoc?.techStack || '未设定'}
- 偏好：${memoryDoc?.preferences || '无'}
- 规范：${(memoryDoc?.conventions || []).join('；') || '无'}

## 共享记忆（来自群聊其他 Agent）
${sharedMemories.map(m => `- ${m.key}: ${m.value}`).join('\n') || '无'}

提醒: 不要调用工具。只输出 <analysis> 块和 <summary> 块。`

  // 5. 调用 AI 生成摘要（不带工具）
  const resp = await fetch(DEEPSEEK_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `你是 ${agentName} 的任务交接助手。你的摘要将用于新 AI 实例无缝继续工作。

## 质量标准
- 技术细节必须准确：文件路径、函数名、行号不能错
- 错误和修复要记录原因，不只是"修了XX"
- 用户反馈要高亮 — 这是最重要的上下文
- 未完成的任务要说清楚卡在哪里，不只是"未完成"
- 代码片段要精简但完整 — 给新 AI 足够上下文理解改动`,
        },
        { role: 'user', content: compactPrompt },
      ],
      max_tokens: 4096,
      temperature: 0.2,
    }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}))
    throw new Error(`Relay summary failed: ${err.error?.message || resp.status}`)
  }

  const data = await resp.json()
  const rawText = data.choices?.[0]?.message?.content || ''

  // 6. 清洗: 去掉 <analysis> 草稿，只保留 <summary> 块
  let formattedSummary = rawText
    .replace(/<analysis>[\s\S]*?<\/analysis>/g, '')
    .replace(/<summary>([\s\S]*?)<\/summary>/g, (_, s) => s.trim())
    .trim()

  // 模型没输出 XML 标签 → 直接用原文
  if (!formattedSummary) formattedSummary = rawText

  // 7. 取第一行作为简短摘要（显示在 UI 中）
  const firstLine = formattedSummary.split('\n').filter(l => l.trim())[0] || ''
  const conversationSummary = firstLine.length > 20
    ? firstLine.slice(0, 200)
    : '对话交接: ' + formattedSummary.slice(0, 200)

  // 8. 记录计划执行进度
  const planProgress = plan
    ? {
        total: plan.steps.length,
        done: plan.steps.filter(s => s.status === 'done').length,
        doing: plan.steps.find(s => s.status === 'doing')?.description || null,
        pending: plan.steps.filter(s => s.status === 'pending').map(s => s.description),
      }
    : undefined

  // 9. 构建接力系统提示词 — CC 风格
  const systemPrompt = `This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

${formattedSummary}

Continue the conversation from where it left off without asking the user any further questions. Resume directly — do not acknowledge the summary, do not recap what was happening, do not preface with "I'll continue" or similar. Pick up the last task as if the break never happened.`

  // 10. Ambient 记忆提取 — 自动保存关键事实到共享记忆
  if (roomId && agentId) {
    try {
      extractAmbientMemory(roomId, agentId, agentName, formattedSummary)
    } catch (e) {
      console.error('[Relay] ambient memory extract failed:', e.message)
    }
  }

  return {
    systemPrompt,
    conversationSummary,
    compressedMessages,
    unfinishedPlan: plan
      ? { ...plan, steps: plan.steps.filter(s => s.status !== 'done') }
      : null,
    planProgress,
    memoryDoc,
    sharedMemories,
    relayedAt: Date.now(),
    tokenCount: compressedMessages.reduce((s, m) => s + m.content.length, 0),
    agentId,
    agentName,
  }
}

// ══════════════════════════════════════════════════════
// Ambient 记忆提取 — 从接力摘要中自动提取关键事实
// ══════════════════════════════════════════════════════

/**
 * 从接力摘要中提取关键事实，存入共享记忆
 * 让其他 DS Agent 也能感知到这个 Agent 学到了什么
 */
function extractAmbientMemory(roomId, agentId, agentName, summary) {
  // 提取"关键技术概念"和"错误和修复"段落
  const conceptsMatch = summary.match(/2\.\s*关键技术概念[\s\S]*?(?=\n\d\.)/)
  const errorsMatch = summary.match(/4\.\s*错误和修复[\s\S]*?(?=\n\d\.)/)
  const pendingMatch = summary.match(/7\.\s*待完成任务[\s\S]*?(?=\n\d\.)/)

  if (conceptsMatch) {
    const concepts = conceptsMatch[0].slice(0, 300)
    dsMemory.set(roomId, `${agentName}_concepts_${Date.now()}`, concepts, agentId)
  }

  if (errorsMatch) {
    const errors = errorsMatch[0].slice(0, 300)
    dsMemory.set(roomId, `${agentName}_errors_${Date.now()}`, errors, agentId)
  }

  if (pendingMatch) {
    const pending = pendingMatch[0].slice(0, 300)
    dsMemory.set(roomId, `${agentName}_pending_${Date.now()}`, pending, agentId)
  }
}

// ══════════════════════════════════════════════════════
// 执行接力 — 用 HandoffPackage 构建新的消息列表
// ══════════════════════════════════════════════════════

/**
 * 执行接力 — 用 HandoffPackage 构建新的消息列表
 *
 * 新的消息列表包含:
 *   1. 接力系统提示词（给新 AI 的上下文说明）
 *   2. 交接通知（UI 分隔线）
 *   3. 压缩后的消息
 *   4. 未完成计划提醒
 *   5. 相关记忆
 */
function autoRelay(handoff) {
  const newMessages = []

  // 1. 接力系统提示词 — 最重要的部分
  newMessages.push({
    role: 'system',
    content: handoff.systemPrompt,
  })

  // 2. 交接通知 — 在 UI 中显示分隔线
  newMessages.push({
    role: 'user',
    content: `[上下文接力完成] 对话摘要: ${handoff.conversationSummary}`,
  })

  // 3. 压缩后的消息
  newMessages.push(...handoff.compressedMessages)

  // 4. 未完成计划提醒
  if (handoff.unfinishedPlan && handoff.unfinishedPlan.steps.length > 0) {
    newMessages.push({
      role: 'user',
      content: `[未完成计划]: ${handoff.unfinishedPlan.steps.map(s => s.description).join(' → ')}`,
    })
  }

  // 5. 共享记忆
  if (handoff.sharedMemories && handoff.sharedMemories.length > 0) {
    newMessages.push({
      role: 'user',
      content: `[共享记忆]:\n${handoff.sharedMemories.map(m => `- ${m.key}: ${m.value}`).join('\n')}`,
    })
  }

  return newMessages
}

// ══════════════════════════════════════════════════════
// 上下文统计 & 阈值检查
// ══════════════════════════════════════════════════════

/**
 * 检查是否需要压缩（阶段1）
 */
function shouldCompact(messages) {
  const estimated = estimateTokenCount(messages)
  return {
    shouldCompact: estimated >= CONTEXT_CONFIG.windowTokens * CONTEXT_CONFIG.compactThreshold,
    estimatedTokens: estimated,
    percentUsed: Math.round((estimated / CONTEXT_CONFIG.windowTokens) * 100),
  }
}

/**
 * 检查是否需要接力（阶段2）
 */
function shouldRelay(messages) {
  const estimated = estimateTokenCount(messages)
  return {
    shouldRelay: estimated >= CONTEXT_CONFIG.windowTokens * CONTEXT_CONFIG.relayThreshold,
    estimatedTokens: estimated,
    percentUsed: Math.round((estimated / CONTEXT_CONFIG.windowTokens) * 100),
  }
}

/**
 * 获取上下文统计 — 显示用
 */
function getContextStats(messages) {
  const totalChars = messages.reduce((s, m) => s + String(m.content || '').length, 0)
  const estimatedTokens = estimateTokenCount(messages)
  const messageCount = messages.length
  const percentUsed = Math.round((estimatedTokens / CONTEXT_CONFIG.windowTokens) * 100)
  return { totalChars, estimatedTokens, messageCount, percentUsed }
}

/**
 * 计算新实例的初始上下文使用率
 */
function estimateInitialContext(handoff) {
  const promptTokens = handoff.systemPrompt.length
  const memoryTokens = handoff.memoryDoc ? JSON.stringify(handoff.memoryDoc).length : 0
  const planTokens = handoff.unfinishedPlan ? JSON.stringify(handoff.unfinishedPlan).length : 0
  const msgTokens = handoff.compressedMessages.reduce((s, m) => s + m.content.length, 0)
  const usedTokens = promptTokens + memoryTokens + planTokens + msgTokens
  return Math.round((usedTokens / CONTEXT_CONFIG.windowTokens) * 100)
}

// ══════════════════════════════════════════════════════
// 跨 Agent 上下文共享 — 让其他 DS 看到接力摘要
// ══════════════════════════════════════════════════════

/**
 * 广播接力事件到群聊
 * 让用户和其他 Agent 知道发生了上下文接力
 */
function broadcastRelayEvent(roomId, handoff, broadcastFn) {
  if (!broadcastFn) return
  broadcastFn(roomId, {
    type: 'ds_relay',
    agentId: handoff.agentId,
    agentName: handoff.agentName,
    conversationSummary: handoff.conversationSummary,
    tokenCount: handoff.tokenCount,
    relayedAt: handoff.relayedAt,
  })
}

module.exports = {
  CONTEXT_CONFIG,
  compressMessages,
  createHandoffPackage,
  autoRelay,
  shouldCompact,
  shouldRelay,
  getContextStats,
  estimateInitialContext,
  broadcastRelayEvent,
  extractAmbientMemory,
}
