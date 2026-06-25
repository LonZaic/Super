// ══════════════════════════════════════════════════════
// DS Orchestrator — 并行 Agent 编排器
// ══════════════════════════════════════════════════════
// 这个模块负责管理"多个 DS Agent 同时工作"的场景。
//
// 三种使用场景:
//   A. parallelAgents() — 多角度并行分析（如: 安全审查 + 性能审查 + 正确性审查）
//      每个 Agent 从不同角度审查同一份代码，最后综合结果
//   B. spawnSubAgent() — 独立只读子 Agent（被主 Agent 派遣）
//      主 Agent 派子 Agent 去并行读取不同文件，提高效率
//   C. mapReduce() — 真正的分治并行（大任务拆成 N 个子任务并行执行）
//
// 为什么需要子 Agent？
//   主 Agent 一次只能串行读文件。如果有 5 个文件要读，
//   派 5 个子 Agent 并行读 = 5倍速度。
//   这是 Claude Code Agent Tool 的核心思路。
//
// DS 群聊增强:
//   - 群聊中 @多个 DS 时，自动用 parallelAgents 并行执行
//   - 每个 DS 完成后结果汇总到群聊
//   - 跨 Agent 结果综合（synthesis）
// ══════════════════════════════════════════════════════

const { DEEPSEEK_API_BASE } = require('../config/constants')

// ─── 类型定义（JSDoc） ───

/**
 * @typedef {Object} AgentSpec
 * @property {string} id - Agent ID
 * @property {string} name - Agent 名称（显示用）
 * @property {string} systemPrompt - 系统提示词
 * @property {string} [model] - 模型名称
 */

/**
 * @typedef {Object} AgentResult
 * @property {string} agentId
 * @property {string} text
 * @property {Array} toolCalls
 * @property {Array} toolResults
 */

/**
 * @typedef {Object} MapTask
 * @property {string} id
 * @property {string} task
 * @property {Array} [tools]
 */

/**
 * @typedef {Object} MapResult
 * @property {string} taskId
 * @property {string} text
 * @property {Array} toolCalls
 * @property {string} [error]
 */

// ══════════════════════════════════════════════════════
// A. 并行多 Agent 分析
// ══════════════════════════════════════════════════════

/**
 * 并行执行多个 Agent
 *
 * 所有 Agent 同时启动，各自独立工作。
 * 完成后再由"合成 Agent"综合所有结果。
 *
 * 使用场景: 群聊中 @多个 DS 同时做事
 *
 * @param {Object} params
 * @param {string} params.apiKey - API Key
 * @param {AgentSpec[]} params.agents - 子 Agent 列表
 * @param {string} params.query - 用户问题
 * @param {Object} [params.config] - 配置
 * @param {Function} [params.onProgress] - 进度回调
 * @returns {Promise<{results: AgentResult[], synthesis: string}>}
 */
async function parallelAgents({
  apiKey,
  agents,
  query,
  config = {},
  onProgress = null,
}) {
  const model = config.model || 'deepseek-v4-flash'
  const maxTokens = config.maxTokens || 2048
  const temperature = config.temperature ?? 0.3

  onProgress?.({ type: 'parallel_start', agentCount: agents.length })

  // ── 并行启动所有 Agent ──
  const agentPromises = agents.map(async (a) => {
    try {
      onProgress?.({ type: 'agent_start', agentId: a.id, agentName: a.name })

      const resp = await fetch(DEEPSEEK_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: a.model || model,
          messages: [
            { role: 'system', content: a.systemPrompt },
            { role: 'user', content: query },
          ],
          max_tokens: maxTokens,
          temperature,
        }),
      })

      if (!resp.ok) throw new Error(`API ${resp.status}`)
      const data = await resp.json()
      const text = data.choices?.[0]?.message?.content || ''

      onProgress?.({ type: 'agent_done', agentId: a.id, agentName: a.name, textLen: text.length })

      return {
        agentId: a.id,
        agentName: a.name,
        text,
        toolCalls: [],
        toolResults: [],
      }
    } catch (e) {
      onProgress?.({ type: 'agent_error', agentId: a.id, agentName: a.name, error: e.message })
      return {
        agentId: a.id,
        agentName: a.name,
        text: '',
        toolCalls: [],
        toolResults: [],
        error: e.message,
      }
    }
  })

  const results = await Promise.all(agentPromises)

  // ── 合成 Agent: 综合所有结果 ──
  onProgress?.({ type: 'synthesis_start' })

  const successResults = results.filter(r => !r.error)
  const allResultsText = successResults
    .map(r => `## ${r.agentName}\n${r.text}`)
    .join('\n\n---\n\n')

  const errorText = results.filter(r => r.error).length > 0
    ? '\n\n## 失败的 Agent\n' + results.filter(r => r.error).map(r => `- ${r.agentName}: ${r.error}`).join('\n')
    : ''

  let synthesis = ''
  if (successResults.length > 0) {
    const synthResp = await fetch(DEEPSEEK_API_BASE, {
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
            content: `你是综合分析师。综合以下多个 DS Agent 的结果，给出统一结论。
# 合成规则
1. 找出所有 Agent 结果中的共识点和矛盾点
2. 矛盾的地方标注出来，说明不同 Agent 的分歧
3. 按重要性排序
4. 引用具体的文件路径和行号
5. 用中文输出，结构清晰
- 不要逐个复述每个结果 — 做横向对比和综合
- 共识点合并说，矛盾点对比说，各自独有发现单独说
- 最终结论要先给 TL;DR（一句话总结），再展开细节`,
          },
          {
            role: 'user',
            content: `综合以下 ${successResults.length} 个 Agent 的并行结果:\n\n${allResultsText}${errorText}\n\n请综合给出最终结论。`,
          },
        ],
        max_tokens: config.maxTokens || 4096,
        temperature: 0.3,
      }),
    })

    if (synthResp.ok) {
      const synthData = await synthResp.json()
      synthesis = synthData.choices?.[0]?.message?.content || ''
    }
  }

  onProgress?.({ type: 'synthesis_done', synthesisLen: synthesis.length })

  return { results, synthesis }
}

// ══════════════════════════════════════════════════════
// B. 快速并行搜索 — 3个搜索 Agent 同时搜不同方向
// ══════════════════════════════════════════════════════

/**
 * 快速并行搜索 — 3个搜索 Agent 同时搜不同方向
 *
 * 方向:
 *   - 通用搜索: 返回关键信息
 *   - 技术搜索: 关注实现细节和最佳实践
 *   - 替代方案: 提出不同思路
 */
async function parallelSearch({ apiKey, query, config = {}, onProgress = null }) {
  const searchAngles = [
    {
      id: 'general',
      name: '通用搜索',
      prompt: `从通用角度搜索以下问题，返回关键信息和最佳答案。用中文回复，标注来源。问题: ${query}`,
    },
    {
      id: 'technical',
      name: '技术搜索',
      prompt: `从技术角度深入分析以下问题：关注实现细节、代码示例、性能考量、已知陷阱。问题: ${query}`,
    },
    {
      id: 'alternative',
      name: '替代方案',
      prompt: `针对以下问题，提出 2-3 个替代方案或不同思路。每个方案说明适用场景和利弊。问题: ${query}`,
    },
  ]

  const { results } = await parallelAgents({
    apiKey,
    agents: searchAngles.map(a => ({
      id: a.id,
      name: a.name,
      systemPrompt: a.prompt,
    })),
    query,
    config: { ...config, maxTokens: 2048 },
    onProgress,
  })

  return results
}

// ══════════════════════════════════════════════════════
// C. 独立只读子 Agent（被 spawn_agent 工具调用）
// ══════════════════════════════════════════════════════

/**
 * 启动一个只读子 Agent
 *
 * 子 Agent 的限制:
 *   - 只能调用传入的 readOnlyTools（只读工具）
 *   - 不能写文件、不能执行命令
 *   - 最多 3 轮工具调用
 *
 * @param {Object} opts
 * @param {string} opts.task - 子 Agent 要完成的任务
 * @param {string} opts.apiKey - API Key
 * @param {string} opts.model - 模型名称
 * @param {number} opts.maxTokens - 最大输出 token
 * @param {Function} [opts.onProgress] - 进度回调
 * @param {Array} [opts.readOnlyTools] - 子 Agent 可调用的只读工具
 * @returns {Promise<{text: string, toolCalls: Array}>}
 */
async function spawnSubAgent({
  task,
  apiKey,
  model = 'deepseek-v4-flash',
  maxTokens = 4096,
  onProgress = null,
  readOnlyTools = [],
}) {
  onProgress?.({ type: 'subagent_start', text: task.slice(0, 60) })

  // ── 子 Agent 的专属工具（由调用方提供，只读）──
  const toolMap = new Map()
  const tools = readOnlyTools.map(t => {
    toolMap.set(t.name, t)
    return {
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }
  })

  const messages = [{ role: 'user', content: task }]
  let finalText = ''
  const allToolCalls = []

  // ── 最多 3 轮工具调用 ──
  for (let round = 0; round < 3; round++) {
    try {
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
              content: `你是 DeepSeek-Super 的只读探索子 Agent。你的任务是快速、准确地完成主 Agent 交给你的文件读取和分析任务。

# 核心规则
1. 只读操作：你只能用 read_file 和 glob 工具。不能写文件、不能改文件、不能执行命令。
2. 用中文回复。
3. 禁止 emoji。
4. 读完文件后自己总结关键信息，不要原样返回全部内容——主 Agent 需要的是你的分析，不是文件 dump。
5. 如果 glob 返回空，尝试不同 pattern 或检查路径拼写。
6. read_file 失败时，报告具体路径和错误信息，不要沉默。
7. 完成了就返回最终分析，不要等待更多指令。

# 效率要求
- 需要读多个文件时，在同一轮中尽可能并行调用 read_file
- 读完了立刻返回分析，不要"再想想"
- 只返回和任务相关的信息，不要列举无关内容

# 输出格式
- 用简短的 markdown 报告返回结果
- 引用关键代码位置（文件名:行号）
- 如果有发现问题（bug、不一致、缺失），标注严重程度

## 工作策略（节约主Agent时间）
- 一次性读完所有需要的文件 → 再写分析。不要读一个分析一个
- 如果任务说"读 X 文件"，先读 X，然后想想 X 里 import 了什么关键的、和任务相关的 → 也读了
- 分析的粒度：不要太细（不要逐行解释），不要太粗（不要只说"有登录功能"），要说出关键的函数名、参数、返回类型、调用关系
- 发现文件不存在 → 立刻报告，不要反复尝试
- 发现和任务无关的内容 → 跳过不提，节省上下文`,
            },
            ...messages,
          ],
          max_tokens: maxTokens,
          tools: round < 2 ? tools : undefined,
          temperature: 0.3,
        }),
      })

      if (!resp.ok) throw new Error(`API ${resp.status}`)
      const data = await resp.json()
      const msg = data.choices?.[0]?.message
      if (!msg) break

      finalText = msg.content || ''
      const tcs = msg.tool_calls || []

      // 没有工具调用 → 子 Agent 完成了
      if (tcs.length === 0) break

      // ── 并行执行工具调用 ──
      const parsedCalls = tcs.map(tc => ({
        tc,
        toolName: tc.function?.name,
        args: (() => {
          try { return JSON.parse(tc.function?.arguments || '{}') } catch { return {} }
        })(),
      }))

      for (const { toolName, args } of parsedCalls) {
        const detail = args.path || args.pattern || args.command || JSON.stringify(args).slice(0, 40)
        onProgress?.({ type: 'tool_start', tool: toolName, detail })
      }

      const toolResults = await Promise.all(parsedCalls.map(async ({ tc, toolName, args }) => {
        allToolCalls.push({ name: toolName, args })
        const tool = toolMap.get(toolName)

        let result = ''
        if (tool) {
          try {
            result = await tool.handler(args)
            if (result.length > 4000) {
              result = result.slice(0, 4000) + '\n...(已截断，共 ' + result.length + ' 字符)'
            }
          } catch (e) {
            result = `错误: ${e.message || String(e)}`
          }
        } else {
          result = `不支持: ${toolName}`
        }

        return { tc, result }
      }))

      for (const { tc, result } of toolResults) {
        onProgress?.({
          type: 'tool_end',
          tool: tc.function?.name,
          ok: !result.startsWith('错误:') && !result.startsWith('不支持:'),
        })
      }

      // 把结果加入对话 → 下一轮 AI 可以看到
      for (const { tc, result } of toolResults) {
        messages.push({ role: 'assistant', content: finalText, tool_calls: [tc] })
        messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
      }
    } catch (e) {
      onProgress?.({ type: 'error', error: e.message })
      break
    }
  }

  onProgress?.({
    type: 'subagent_done',
    text: finalText.slice(0, 100),
    hasTools: allToolCalls.length > 0,
  })

  return { text: finalText, toolCalls: allToolCalls }
}

// ══════════════════════════════════════════════════════
// D. Map-Reduce 编排 — 真正的分治并行
// ══════════════════════════════════════════════════════

/**
 * Map-Reduce 编排器 — 分治并行 + 智能综合
 *
 * 三个阶段:
 *   MAP 阶段: 把大任务拆成 N 个独立子任务，每个子 Agent 并行执行
 *   SHUFFLE 阶段: 收集所有子 Agent 结果，去重，按主题分组
 *   REDUCE 阶段: 合成 Agent 综合所有 MAP 结果，输出统一结论
 *
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {MapTask[]} params.tasks
 * @param {Object} [params.config]
 * @param {Function} [params.onProgress]
 * @returns {Promise<{mapResults: MapResult[], synthesis: string, stats: Object}>}
 */
async function mapReduce({
  apiKey,
  tasks,
  config = {},
  onProgress = null,
}) {
  const startTime = Date.now()
  const concurrency = config.concurrency || 4
  const model = config.model || 'deepseek-v4-flash'

  // ═══ MAP 阶段: 并行执行所有子任务 ═══
  onProgress?.({ type: 'map_start', taskCount: tasks.length, concurrency })

  const runner = async (t) => {
    try {
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
              content: `你是 Map-Reduce 的 MAP 子 Agent。你的任务是独立完成分配给你的子任务。
只分析你的那部分，不要试图理解全局。用中文返回分析结果。
返回格式: 简洁的 markdown，引用关键代码位置（文件名:行号）。

## MAP 阶段最佳实践
- 只关心分配给你的范围 — 不要尝试分析全局
- 实事求是 — 不确定的地方标注"推测"
- 引用必须精确到文件名:行号 — 方便主 Agent 定位
- 如果有严重问题（安全漏洞、逻辑错误、数据丢失风险）→ 明确标出严重程度
- 如果分配给你的范围没有发现问题 → 诚实说"未发现问题"即可，不要硬找
- 不要重复任务描述 — 直接给分析结果`,
            },
            { role: 'user', content: t.task },
          ],
          max_tokens: config.maxTokens || 4096,
          temperature: config.temperature ?? 0.3,
        }),
      })

      if (!resp.ok) throw new Error(`API ${resp.status}`)
      const data = await resp.json()
      return {
        taskId: t.id,
        text: data.choices?.[0]?.message?.content || '',
        toolCalls: [],
      }
    } catch (e) {
      return { taskId: t.id, text: '', toolCalls: [], error: e.message || String(e) }
    }
  }

  // 分批并行执行（控制并发数）
  const mapResults = []
  for (let i = 0; i < tasks.length; i += concurrency) {
    const batch = tasks.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(runner))
    mapResults.push(...batchResults)

    onProgress?.({
      type: 'map_batch_done',
      completed: mapResults.length,
      total: tasks.length,
    })
  }

  const successCount = mapResults.filter(r => !r.error).length
  const failedCount = mapResults.filter(r => r.error).length
  const totalToolCalls = mapResults.reduce((s, r) => s + r.toolCalls.length, 0)

  onProgress?.({
    type: 'map_done',
    success: successCount,
    failed: failedCount,
    totalToolCalls,
  })

  // ═══ SHUFFLE 阶段: 分组 & 去重 ═══
  onProgress?.({ type: 'shuffle_start', resultCount: mapResults.length })

  const successResults = mapResults.filter(r => !r.error)
  const errorResults = mapResults.filter(r => r.error)

  // 去重: 相似度 > 0.8 的结果只保留最长那个
  const deduped = deduplicateResults(successResults)

  onProgress?.({
    type: 'shuffle_done',
    before: successResults.length,
    after: deduped.length,
    errors: errorResults.length,
  })

  // ═══ REDUCE 阶段: 合成所有结果 ═══
  onProgress?.({ type: 'reduce_start', inputCount: deduped.length })

  const allMapText = deduped
    .map(r => `## ${r.taskId}\n${r.text.slice(0, 2000)}`)
    .join('\n\n---\n\n')

  const errorText = errorResults.length > 0
    ? '\n\n## 失败的任务\n' + errorResults.map(r => `- ${r.taskId}: ${r.error}`).join('\n')
    : ''

  const reduceSystemPrompt = config.reducePrompt || `你是 Map-Reduce 的 REDUCE 合成 Agent。
综合以下所有 MAP 子 Agent 的分析结果，给出统一、连贯的最终结论。

# 合成规则
1. 找出所有 MAP 结果中的共识点和矛盾点
2. 矛盾的地方标注出来，说明不同 Agent 的分歧
3. 按重要性排序
4. 引用具体的文件路径和行号
5. 用中文输出，结构清晰

## REDUCE 阶段最佳实践
- 不要逐个复述每个 MAP 结果 — 做横向对比和综合
- 共识点合并说，矛盾点对比说，各自独有发现单独说
- 失败的任务标注但不略过 — 失败可能意味着该范围未被覆盖
- 最终结论要先给 TL;DR（一句话总结），再展开细节
- 如果所有 MAP 结果都指向同一个结论 — 说明置信度高，明确标注
- 如果 MAP 结果互相矛盾 — 说明置信度低，标注需要人工判断`

  let synthesis = ''
  try {
    const synthResp = await fetch(DEEPSEEK_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: reduceSystemPrompt },
          {
            role: 'user',
            content: `以下 ${deduped.length} 个 MAP 子 Agent 的并行分析结果:\n\n${allMapText}${errorText}\n\n请综合给出最终结论。`,
          },
        ],
        max_tokens: config.maxTokens || 8192,
        temperature: 0.3,
      }),
    })

    if (synthResp.ok) {
      const synthData = await synthResp.json()
      synthesis = synthData.choices?.[0]?.message?.content || ''
    }
  } catch (e) {
    synthesis = `合成失败: ${e.message}`
  }

  onProgress?.({ type: 'reduce_done', synthesisLen: synthesis.length })

  return {
    mapResults,
    synthesis,
    stats: {
      total: tasks.length,
      success: successCount,
      failed: failedCount,
      totalToolCalls,
      durationMs: Date.now() - startTime,
    },
  }
}

// ══════════════════════════════════════════════════════
// 辅助函数
// ══════════════════════════════════════════════════════

/**
 * 去重: 相似度 > 0.8 的结果只保留最长那个
 * 简单的 Jaccard 相似度
 */
function deduplicateResults(results) {
  if (results.length <= 1) return results

  const deduped = []
  const used = new Set()

  for (let i = 0; i < results.length; i++) {
    if (used.has(i)) continue

    const current = results[i]
    const currentWords = new Set(tokenize(current.text))

    for (let j = i + 1; j < results.length; j++) {
      if (used.has(j)) continue

      const other = results[j]
      const otherWords = new Set(tokenize(other.text))

      const intersection = [...currentWords].filter(w => otherWords.has(w)).length
      const union = new Set([...currentWords, ...otherWords]).size
      const similarity = union > 0 ? intersection / union : 0

      if (similarity > 0.8) {
        // 保留更长的那个
        if (other.text.length > current.text.length) {
          used.add(i)
          break
        } else {
          used.add(j)
        }
      }
    }

    if (!used.has(i)) deduped.push(current)
  }

  return deduped
}

/**
 * 简单分词 — 中文按字，英文按词
 */
function tokenize(text) {
  if (!text) return []
  const tokens = []
  // 英文单词
  const enWords = text.match(/[a-zA-Z]+/g) || []
  tokens.push(...enWords.map(w => w.toLowerCase()))
  // 中文字符（2-gram）
  const cnChars = text.match(/[\u4e00-\u9fa5]/g) || []
  for (let i = 0; i < cnChars.length - 1; i++) {
    tokens.push(cnChars[i] + cnChars[i + 1])
  }
  return tokens
}

module.exports = {
  parallelAgents,
  parallelSearch,
  spawnSubAgent,
  mapReduce,
  deduplicateResults,
}
