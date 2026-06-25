// ════════════════════════════════════════════════════════════════════
// ccCore.js — Claude Code 核心逻辑移植
//
// 从 ccm2 (Claude Code 源码) 移植的核心机制，适配到 DeepSeek-Super：
//   1. 智能重试 (withRetry) — 529/429 指数退避 + Fast mode fallback + 持久重试
//   2. Token 预算管理 (tokenBudget) — 边际递减检测，避免无效循环
//   3. 并发安全分区 (partitionToolCalls) — 只读工具并行，写操作串行
//   4. 流式工具执行 (StreamingToolExecutor) — AI 输出时就开始执行工具
//   5. 微压缩 (microCompact) — 清理旧工具结果，保留最近
//   6. 自动压缩 (autoCompact) — 阈值触发，断路器保护
//
// 参考: E:\ccm2\cloud-code-master\claude-code-source\src\
// ════════════════════════════════════════════════════════════════════

const { DEEPSEEK_API_BASE } = require('../config/constants')

// ════════════════════════════════════════════════════════════════════
// 1. 智能重试 (withRetry) — 移植自 services/api/withRetry.ts
// ════════════════════════════════════════════════════════════════════

const DEFAULT_MAX_RETRIES = 10
const MAX_529_RETRIES = 3
const BASE_DELAY_MS = 500
const MAX_BACKOFF_MS = 32000
const FLOOR_OUTPUT_TOKENS = 3000

// 529 错误最多重试3次，然后回退到 fallback 模型
const FOREGROUND_RETRY = true // 群聊任务都是前台任务

/**
 * 智能重试 — 处理 429/529/网络错误
 *
 * 核心逻辑（移植自 withRetry.ts）：
 *   - 529 (Overloaded): 前台任务重试3次，然后回退到 fallback 模型
 *   - 429 (Rate Limit): 指数退避 + Retry-After 头
 *   - ECONNRESET/EPIPE: 禁用 keep-alive 重连
 *   - Max tokens 溢出: 自动调整 max_tokens
 *   - Fast mode: 429/529 时回退到标准速度
 *
 * @param {Function} operation - async () => result
 * @param {Object} options
 * @param {number} options.maxRetries - 默认 10
 * @param {string} options.model - 当前模型
 * @param {string} options.fallbackModel - 回退模型 (如 deepseek-v4-flash)
 * @param {AbortSignal} options.signal - 取消信号
 * @param {Function} options.onRetry - 重试回调 (attempt, delayMs, error)
 * @returns {Promise<{result, model, retried, fallbackTriggered}>}
 */
async function withRetry(operation, options = {}) {
  const maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES
  const model = options.model || 'deepseek-v4-pro'
  const fallbackModel = options.fallbackModel || 'deepseek-v4-flash'
  const signal = options.signal
  const onRetry = options.onRetry || (() => {})

  let consecutive529 = 0
  let lastError = null
  let currentModel = model
  let fallbackTriggered = false
  let maxTokensOverride = null
  let attempt = 0

  for (attempt = 1; attempt <= maxRetries + 1; attempt++) {
    if (signal?.aborted) {
      throw new Error('Aborted by user')
    }

    try {
      const result = await operation({
        model: currentModel,
        maxTokensOverride,
        attempt,
      })
      return {
        result,
        model: currentModel,
        retried: attempt - 1,
        fallbackTriggered,
      }
    } catch (error) {
      lastError = error
      const status = error.status || error.statusCode || 0
      const errMsg = error.message || String(error)

      // 529 Overloaded — 前台任务重试3次后回退
      if (status === 529 || (status === 429 && FOREGROUND_RETRY)) {
        consecutive529++

        if (consecutive529 >= MAX_529_RETRIES && currentModel !== fallbackModel) {
          // 回退到 fallback 模型
          currentModel = fallbackModel
          fallbackTriggered = true
          consecutive529 = 0
          onRetry({
            attempt,
            type: 'fallback',
            fromModel: model,
            toModel: fallbackModel,
            error: errMsg,
          })
          continue
        }

        // 指数退避
        const delayMs = getRetryDelay(attempt, error.headers?.['retry-after'])
        onRetry({ attempt, type: '529', delayMs, error: errMsg })
        await sleep(delayMs, signal)
        continue
      }

      // Max tokens 上下文溢出 — 自动调整
      if (status === 400 && errMsg.includes('context limit')) {
        const match = errMsg.match(/(\d+)\s*\+\s*(\d+)\s*>\s*(\d+)/)
        if (match) {
          const inputTokens = parseInt(match[1], 10)
          const contextLimit = parseInt(match[3], 10)
          const safetyBuffer = 1000
          const available = Math.max(0, contextLimit - inputTokens - safetyBuffer)
          if (available >= FLOOR_OUTPUT_TOKENS) {
            maxTokensOverride = Math.max(FLOOR_OUTPUT_TOKENS, available)
            onRetry({ attempt, type: 'max_tokens_adjust', maxTokens: maxTokensOverride })
            continue
          }
        }
      }

      // 网络错误 — 重试
      if (isTransientError(error) && attempt <= maxRetries) {
        const delayMs = getRetryDelay(attempt)
        onRetry({ attempt, type: 'network', delayMs, error: errMsg })
        await sleep(delayMs, signal)
        continue
      }

      // 不可重试的错误
      throw error
    }
  }

  throw lastError || new Error('Max retries exceeded')
}

function getRetryDelay(attempt, retryAfterHeader) {
  if (retryAfterHeader) {
    const seconds = parseInt(retryAfterHeader, 10)
    if (!isNaN(seconds)) return seconds * 1000
  }
  const baseDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt - 1), MAX_BACKOFF_MS)
  const jitter = Math.random() * 0.25 * baseDelay
  return baseDelay + jitter
}

function isTransientError(error) {
  const code = error.code || ''
  return (
    code === 'ECONNRESET' ||
    code === 'EPIPE' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    error.message?.includes('fetch failed') ||
    error.message?.includes('network')
  )
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Aborted'))
    const timer = setTimeout(resolve, ms)
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(new Error('Aborted'))
      }, { once: true })
    }
  })
}

// ════════════════════════════════════════════════════════════════════
// 2. Token 预算管理 (tokenBudget) — 移植自 query/tokenBudget.ts
// ════════════════════════════════════════════════════════════════════

const COMPLETION_THRESHOLD = 0.9 // 90% 预算使用时检查
const DIMINISHING_THRESHOLD = 500 // 连续3次 delta < 500 tokens = 边际递减

/**
 * Token 预算跟踪器
 *
 * 核心逻辑（移植自 tokenBudget.ts）：
 *   - 跟踪每轮的 token 增量
 *   - 检测边际递减（连续3次增量 < 500 tokens）
 *   - 边际递减时停止，避免无效循环
 *
 * 这解决了 "agent 一直转圈但不产出有效内容" 的问题
 */
class BudgetTracker {
  constructor(budget = null) {
    this.budget = budget
    this.continuationCount = 0
    this.lastDeltaTokens = 0
    this.lastGlobalTurnTokens = 0
    this.startedAt = Date.now()
  }

  /**
   * 检查是否应该继续
   * @param {number} globalTurnTokens - 当前轮次总 token
   * @returns {{action: 'continue'|'stop', reason?: string, pct?: number}}
   */
  check(globalTurnTokens) {
    if (!this.budget || this.budget <= 0) {
      return { action: 'stop', reason: 'no_budget' }
    }

    const turnTokens = globalTurnTokens
    const pct = Math.round((turnTokens / this.budget) * 100)
    const deltaSinceLastCheck = globalTurnTokens - this.lastGlobalTurnTokens

    // 边际递减检测：连续3次，每次增量 < 500 tokens
    const isDiminishing =
      this.continuationCount >= 3 &&
      deltaSinceLastCheck < DIMINISHING_THRESHOLD &&
      this.lastDeltaTokens < DIMINISHING_THRESHOLD

    if (!isDiminishing && turnTokens < this.budget * COMPLETION_THRESHOLD) {
      this.continuationCount++
      this.lastDeltaTokens = deltaSinceLastCheck
      this.lastGlobalTurnTokens = globalTurnTokens
      return {
        action: 'continue',
        pct,
        turnTokens,
        budget: this.budget,
      }
    }

    return {
      action: 'stop',
      reason: isDiminishing ? 'diminishing_returns' : 'budget_reached',
      pct,
      turnTokens,
      budget: this.budget,
      diminishingReturns: isDiminishing,
      durationMs: Date.now() - this.startedAt,
    }
  }

  reset() {
    this.continuationCount = 0
    this.lastDeltaTokens = 0
    this.lastGlobalTurnTokens = 0
    this.startedAt = Date.now()
  }
}

// ════════════════════════════════════════════════════════════════════
// 3. 并发安全分区 (partitionToolCalls) — 移植自 tools/toolOrchestration.ts
// ════════════════════════════════════════════════════════════════════

// 只读工具 — 可以并行执行
const READ_ONLY_TOOLS = new Set([
  'read_file', 'list_files', 'glob', 'grep', 'search_codebase',
  'web_search', 'web_fetch', 'list_directory',
  'get_diagnostics', 'git_status', 'git_diff', 'git_log',
])

// 写操作工具 — 必须串行执行
const WRITE_TOOLS = new Set([
  'write_file', 'edit_file', 'delete_file', 'run_command',
  'bash', 'execute', 'create_file',
])

/**
 * 判断工具是否并发安全（只读）
 */
function isConcurrencySafe(toolName) {
  return READ_ONLY_TOOLS.has(toolName)
}

/**
 * 分区工具调用 — 将连续的只读工具分到同一批次并行执行
 *
 * 核心逻辑（移植自 toolOrchestration.ts partitionToolCalls）：
 *   - 连续的只读工具 → 同一批次，并行执行
 *   - 写操作工具 → 单独批次，串行执行
 *
 * 例如: [read, read, grep, write, read] → [[read,read,grep], [write], [read]]
 *
 * @param {Array} toolCalls - [{ name, ... }]
 * @returns {Array<{isConcurrencySafe: boolean, blocks: Array}>}
 */
function partitionToolCalls(toolCalls) {
  return toolCalls.reduce((acc, toolUse) => {
    const safe = isConcurrencySafe(toolUse.name || toolUse.function?.name)
    if (safe && acc.length > 0 && acc[acc.length - 1].isConcurrencySafe) {
      acc[acc.length - 1].blocks.push(toolUse)
    } else {
      acc.push({ isConcurrencySafe: safe, blocks: [toolUse] })
    }
    return acc
  }, [])
}

/**
 * 并行执行只读工具批次
 */
async function runBatchConcurrently(blocks, executeFn, onProgress) {
  const promises = blocks.map(async (block) => {
    try {
      const result = await executeFn(block)
      onProgress?.({ type: 'tool_done', toolName: block.name, success: true })
      return result
    } catch (e) {
      onProgress?.({ type: 'tool_error', toolName: block.name, error: e.message })
      return { error: e.message, toolName: block.name }
    }
  })
  return Promise.all(promises)
}

/**
 * 串行执行写操作批次
 */
async function runBatchSerially(blocks, executeFn, onProgress) {
  const results = []
  for (const block of blocks) {
    try {
      const result = await executeFn(block)
      results.push(result)
      onProgress?.({ type: 'tool_done', toolName: block.name, success: true })
    } catch (e) {
      results.push({ error: e.message, toolName: block.name })
      onProgress?.({ type: 'tool_error', toolName: block.name, error: e.message })
    }
  }
  return results
}

/**
 * 智能工具编排 — 分区 + 并行/串行执行
 *
 * 这是 Claude Code 工具执行的核心：
 *   1. 将工具调用分区（只读并行，写操作串行）
 *   2. 并行执行只读批次
 *   3. 串行执行写操作批次
 *   4. 保持执行顺序
 *
 * @param {Array} toolCalls
 * @param {Function} executeFn - async (toolCall) => result
 * @param {Function} onProgress
 * @returns {Promise<Array>}
 */
async function runToolsOrchestrated(toolCalls, executeFn, onProgress) {
  const batches = partitionToolCalls(toolCalls)
  const allResults = []

  for (const batch of batches) {
    onProgress?.({
      type: 'batch_start',
      isConcurrencySafe: batch.isConcurrencySafe,
      count: batch.blocks.length,
      tools: batch.blocks.map(b => b.name || b.function?.name),
    })

    let results
    if (batch.isConcurrencySafe) {
      // 并行执行
      results = await runBatchConcurrently(batch.blocks, executeFn, onProgress)
    } else {
      // 串行执行
      results = await runBatchSerially(batch.blocks, executeFn, onProgress)
    }

    allResults.push(...results)

    onProgress?.({
      type: 'batch_done',
      isConcurrencySafe: batch.isConcurrencySafe,
      count: batch.blocks.length,
    })
  }

  return allResults
}

// ════════════════════════════════════════════════════════════════════
// 4. 流式工具执行 (StreamingToolExecutor) — 移植自 tools/StreamingToolExecutor.ts
// ════════════════════════════════════════════════════════════════════

/**
 * 流式工具执行器
 *
 * 核心逻辑（移植自 StreamingToolExecutor.ts）：
 *   - AI 还在输出时就开始执行已完整的工具调用
 *   - 只读工具可以并行执行
 *   - 写操作工具排队等待
 *   - 结果按接收顺序返回
 *
 * 这大幅减少等待时间：传统方式是 AI 输出完所有工具 → 逐个执行
 * 流式方式是 AI 输出工具A → 立即执行A → AI 继续输出工具B → A还在跑 → B排队
 */
class StreamingToolExecutor {
  constructor(toolDefinitions, canUseTool, context = {}) {
    this.tools = toolDefinitions || []
    this.canUseTool = canUseTool || (() => true)
    this.context = context
    this.queue = []
    this.executing = new Map()
    this.completed = []
    this.hasErrored = false
    this.siblingAbortController = new AbortController()
  }

  /**
   * 添加工具到执行队列
   * 如果是只读工具且没有写操作在执行，立即开始执行
   */
  addTool(block, assistantMessage) {
    const toolName = block.name || block.function?.name
    const safe = isConcurrencySafe(toolName)

    const tracked = {
      id: block.id || Math.random().toString(36),
      block,
      status: 'queued',
      isConcurrencySafe: safe,
      promise: null,
      results: null,
      pendingProgress: [],
    }

    this.queue.push(tracked)

    // 如果是只读工具，立即开始执行（并行）
    if (safe && !this.hasWriteExecuting()) {
      this._startExecution(tracked)
    }

    return tracked
  }

  /**
   * 检查是否有写操作正在执行
   */
  hasWriteExecuting() {
    for (const [, t] of this.executing) {
      if (!t.isConcurrencySafe) return true
    }
    return false
  }

  /**
   * 开始执行工具
   */
  _startExecution(tracked) {
    tracked.status = 'executing'
    this.executing.set(tracked.id, tracked)

    tracked.promise = (async () => {
      try {
        const result = await this._executeTool(tracked.block)
        tracked.results = result
        tracked.status = 'completed'
      } catch (e) {
        tracked.results = { error: e.message }
        tracked.status = 'completed'
        if (!tracked.isConcurrencySafe) {
          // 写操作出错，取消兄弟进程
          this.siblingAbortController.abort()
        }
      } finally {
        this.executing.delete(tracked.id)
        // 检查队列中是否有可以开始执行的工具
        this._processQueue()
      }
    })()
  }

  /**
   * 执行单个工具
   */
  async _executeTool(block) {
    const toolName = block.name || block.function?.name
    const toolDef = this.tools.find(t => t.name === toolName)

    if (!toolDef) {
      return { error: `No such tool: ${toolName}` }
    }

    // 权限检查
    const allowed = await this.canUseTool(toolName, block.input || block.arguments)
    if (!allowed) {
      return { error: 'Permission denied' }
    }

    // 执行
    if (toolDef.execute) {
      return await toolDef.execute(block.input || block.arguments, this.context)
    }
    return { error: `Tool ${toolName} has no execute function` }
  }

  /**
   * 处理队列 — 启动可以执行的工具
   */
  _processQueue() {
    const queued = this.queue.filter(t => t.status === 'queued')
    for (const tracked of queued) {
      if (tracked.isConcurrencySafe && !this.hasWriteExecuting()) {
        this._startExecution(tracked)
      } else if (!tracked.isConcurrencySafe && this.executing.size === 0) {
        // 写操作：等待所有其他工具完成
        this._startExecution(tracked)
      }
    }
  }

  /**
   * 等待所有工具完成
   */
  async waitForAll() {
    const all = this.queue.map(t => t.promise).filter(Boolean)
    await Promise.all(all)
    return this.queue.map(t => ({
      id: t.id,
      toolName: t.block.name || t.block.function?.name,
      results: t.results,
      status: t.status,
    }))
  }

  /**
   * 丢弃所有待执行工具
   */
  discard() {
    this.siblingAbortController.abort()
    for (const tracked of this.queue) {
      if (tracked.status === 'queued') {
        tracked.status = 'completed'
        tracked.results = { error: 'Discarded' }
      }
    }
  }
}

// ════════════════════════════════════════════════════════════════════
// 5. 微压缩 (microCompact) — 移植自 compact/microCompact.ts
// ════════════════════════════════════════════════════════════════════

// 可压缩的工具结果（旧的工具结果可以清理）
const COMPACTABLE_TOOLS = new Set([
  'read_file', 'list_files', 'glob', 'grep', 'search_codebase',
  'web_search', 'web_fetch', 'list_directory',
  'run_command', 'bash', 'execute',
  'edit_file', 'write_file',
])

const TIME_BASED_MC_CLEARED_MESSAGE = '[旧工具结果已清理以节省上下文]'

/**
 * 微压缩 — 清理旧的工具结果，保留最近的
 *
 * 核心逻辑（移植自 microCompact.ts）：
 *   - 只清理工具结果，不清理对话
 *   - 保留最近 N 条消息的工具结果
 *   - 旧的工具结果替换为占位符
 *
 * 这比全量压缩更轻量，不会丢失对话上下文
 *
 * @param {Array} messages - 消息列表
 * @param {Object} options
 * @param {number} options.keepRecent - 保留最近几条消息的工具结果（默认10）
 * @returns {Array} 压缩后的消息
 */
function microCompact(messages, options = {}) {
  const keepRecent = options.keepRecent || 10
  if (messages.length <= keepRecent) return messages

  const result = [...messages]
  const cutoff = result.length - keepRecent

  for (let i = 0; i < cutoff; i++) {
    const msg = result[i]
    // 如果是工具结果消息，且工具在可压缩列表中
    if (msg && msg.role === 'tool' && msg.name && COMPACTABLE_TOOLS.has(msg.name)) {
      // 替换为占位符，保留工具名但清理内容
      result[i] = {
        ...msg,
        content: TIME_BASED_MC_CLEARED_MESSAGE,
        _microCompacted: true,
      }
    }
  }

  return result
}

// ════════════════════════════════════════════════════════════════════
// 6. 自动压缩 (autoCompact) — 移植自 compact/autoCompact.ts
// ════════════════════════════════════════════════════════════════════

const AUTOCOMPACT_BUFFER_TOKENS = 13000
const WARNING_THRESHOLD_BUFFER = 20000
const MAX_CONSECUTIVE_FAILURES = 3 // 断路器：连续失败3次后停止

/**
 * 自动压缩状态跟踪
 */
class AutoCompactState {
  constructor() {
    this.compacted = false
    this.turnCounter = 0
    this.turnId = ''
    this.consecutiveFailures = 0
  }

  reset() {
    this.compacted = false
    this.turnCounter = 0
    this.consecutiveFailures = 0
  }

  incrementTurn() {
    this.turnCounter++
    this.turnId = Math.random().toString(36).slice(2)
  }

  recordFailure() {
    this.consecutiveFailures++
  }

  recordSuccess() {
    this.consecutiveFailures = 0
    this.compacted = true
  }

  shouldStop() {
    return this.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES
  }
}

/**
 * 计算 token 警告状态
 *
 * 移植自 autoCompact.ts calculateTokenWarningState
 */
function calculateTokenWarningState(tokenUsage, contextWindow) {
  const autoCompactThreshold = contextWindow - AUTOCOMPACT_BUFFER_TOKENS
  const warningThreshold = contextWindow - WARNING_THRESHOLD_BUFFER

  const percentLeft = Math.max(
    0,
    Math.round(((autoCompactThreshold - tokenUsage) / autoCompactThreshold) * 100)
  )

  return {
    percentLeft,
    isAboveWarningThreshold: tokenUsage >= warningThreshold,
    isAboveAutoCompactThreshold: tokenUsage >= autoCompactThreshold,
    isAtBlockingLimit: tokenUsage >= contextWindow - 3000,
    autoCompactThreshold,
  }
}

// ════════════════════════════════════════════════════════════════════
// 7. 循环检测器 — 防止 agent 陷入死循环
// ════════════════════════════════════════════════════════════════════

/**
 * 循环检测器
 *
 * 检测 agent 是否在重复相同的操作：
 *   - 相同的工具调用连续出现3次
 *   - 相同的思考内容连续出现2次
 *   - 相同的错误连续出现3次
 */
class LoopDetector {
  constructor() {
    this.toolCallHistory = []
    this.thinkingHistory = []
    this.errorHistory = []
    this.maxHistory = 20
  }

  recordToolCall(toolName, input) {
    const sig = `${toolName}:${JSON.stringify(input).slice(0, 200)}`
    this.toolCallHistory.push(sig)
    if (this.toolCallHistory.length > this.maxHistory) {
      this.toolCallHistory.shift()
    }
  }

  recordThinking(text) {
    const sig = text.slice(0, 200)
    this.thinkingHistory.push(sig)
    if (this.thinkingHistory.length > this.maxHistory) {
      this.thinkingHistory.shift()
    }
  }

  recordError(error) {
    this.errorHistory.push(error.slice(0, 200))
    if (this.errorHistory.length > this.maxHistory) {
      this.errorHistory.shift()
    }
  }

  isLooping() {
    // 检测工具调用循环
    if (this.toolCallHistory.length >= 3) {
      const last3 = this.toolCallHistory.slice(-3)
      if (last3[0] === last3[1] && last3[1] === last3[2]) {
        return { looping: true, type: 'tool_repeat', signature: last3[0] }
      }
    }

    // 检测思考循环
    if (this.thinkingHistory.length >= 2) {
      const last2 = this.thinkingHistory.slice(-2)
      if (last2[0] === last2[1]) {
        return { looping: true, type: 'thinking_repeat', signature: last2[0] }
      }
    }

    // 检测错误循环
    if (this.errorHistory.length >= 3) {
      const last3 = this.errorHistory.slice(-3)
      if (last3[0] === last3[1] && last3[1] === last3[2]) {
        return { looping: true, type: 'error_repeat', signature: last3[0] }
      }
    }

    return { looping: false }
  }

  reset() {
    this.toolCallHistory = []
    this.thinkingHistory = []
    this.errorHistory = []
  }
}

// ════════════════════════════════════════════════════════════════════
// 8. DeepSeek API 调用（带智能重试）
// ════════════════════════════════════════════════════════════════════

/**
 * 调用 DeepSeek API — 带智能重试
 *
 * 集成了 withRetry 的所有逻辑：
 *   - 529/429 指数退避
 *   - Fast mode fallback
 *   - Max tokens 自动调整
 *   - 网络错误重试
 *
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {Array} params.messages
 * @param {Object} params.options - max_tokens, temperature, tools, stream
 * @param {AbortSignal} params.signal
 * @param {Function} params.onRetry
 */
async function callDeepSeekWithRetry({ apiKey, model, messages, options = {}, signal, onRetry }) {
  return withRetry(
    async (ctx) => {
      const body = {
        model: ctx.model,
        messages,
        max_tokens: ctx.maxTokensOverride || options.maxTokens || 4096,
        temperature: options.temperature ?? 0.3,
        ...(options.tools && { tools: options.tools }),
        ...(options.stream && { stream: true }),
      }

      const resp = await fetch(DEEPSEEK_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal,
      })

      if (!resp.ok) {
        const err = new Error(`API ${resp.status}: ${await resp.text()}`)
        err.status = resp.status
        err.headers = Object.fromEntries(resp.headers.entries())
        throw err
      }

      if (options.stream) {
        return resp.body // 返回流
      }

      const data = await resp.json()

      // 附加 token 使用信息
      if (data.usage) {
        ctx._lastUsage = data.usage
      }

      return data
    },
    {
      model,
      fallbackModel: 'deepseek-v4-flash',
      signal,
      onRetry,
      maxRetries: 5,
    }
  )
}

// ════════════════════════════════════════════════════════════════════
// 9. 流式 API 调用 — 实时输出（关键性能优化）
// ════════════════════════════════════════════════════════════════════

/**
 * 流式调用 DeepSeek API — 实时输出 token
 *
 * 这是解决"做事慢"和"输出不显示"的关键：
 *   - 传统方式：等整个响应完成才返回（可能要10-30秒）
 *   - 流式方式：AI 每生成一个 token 就立即推送，用户实时看到输出
 *
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {Array} params.messages
 * @param {Object} params.options - max_tokens, temperature, tools
 * @param {AbortSignal} params.signal
 * @param {Function} params.onToken - (text) => void  每收到一段文本就调用
 * @param {Function} params.onToolCall - (toolCall) => void  检测到工具调用
 * @param {Function} params.onDone - (fullResponse) => void  完成
 * @returns {Promise<Object>} 完整响应
 */
async function callDeepSeekStream({ apiKey, model, messages, options = {}, signal, onToken, onToolCall, onDone }) {
  const body = {
    model,
    messages,
    max_tokens: options.maxTokens || 32768,
    temperature: options.temperature ?? 0.3,
    stream: true,
    ...(options.tools && { tools: options.tools, tool_choice: 'auto' }),
  }

  const resp = await fetch(DEEPSEEK_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    const errText = await resp.text()
    const err = new Error(`API ${resp.status}: ${errText.slice(0, 200)}`)
    err.status = resp.status
    throw err
  }

  // 解析 SSE 流
  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let toolCalls = []
  let usage = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || '' // 保留最后不完整的行

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data: ')) continue

      const data = trimmed.slice(6)
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta

        if (delta?.content) {
          fullContent += delta.content
          onToken?.(delta.content)
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            // 累积工具调用
            const idx = tc.index || 0
            if (!toolCalls[idx]) {
              toolCalls[idx] = {
                id: tc.id,
                type: 'function',
                function: { name: '', arguments: '' },
              }
            }
            if (tc.function?.name) {
              toolCalls[idx].function.name += tc.function.name
              onToolCall?.(toolCalls[idx])
            }
            if (tc.function?.arguments) {
              toolCalls[idx].function.arguments += tc.function.arguments
            }
          }
        }

        if (parsed.usage) {
          usage = parsed.usage
        }
      } catch {}
    }
  }

  const result = {
    choices: [{
      message: {
        role: 'assistant',
        content: fullContent || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    }],
    usage,
    model,
  }

  onDone?.(result)
  return result
}

// ════════════════════════════════════════════════════════════════════
// 导出
// ════════════════════════════════════════════════════════════════════

module.exports = {
  // 智能重试
  withRetry,
  getRetryDelay,
  isTransientError,

  // Token 预算
  BudgetTracker,
  COMPLETION_THRESHOLD,
  DIMINISHING_THRESHOLD,

  // 工具编排
  partitionToolCalls,
  runToolsOrchestrated,
  isConcurrencySafe,
  READ_ONLY_TOOLS,
  WRITE_TOOLS,

  // 流式工具执行
  StreamingToolExecutor,

  // 微压缩
  microCompact,
  COMPACTABLE_TOOLS,

  // 自动压缩
  AutoCompactState,
  calculateTokenWarningState,
  AUTOCOMPACT_BUFFER_TOKENS,

  // 循环检测
  LoopDetector,

  // API 调用
  callDeepSeekWithRetry,
  callDeepSeekStream,
}
