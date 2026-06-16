// ══════════════════════════════════════
// AI Controller — DeepSeek API proxy with web_search tool
// Chat mode now supports web search: model can call web_search, server executes it
// ══════════════════════════════════════

const { sendSuccess, sendError } = require('../middleware/errorHandler')
const { DEEPSEEK_API_BASE } = require('../config/constants')
const config = require('../config')
const { webSearchVerified } = require('../search')

function getApiKey(req) {
  return config.deepseekApiKey || req.headers['x-api-key'] || ''
}

// ─── Web search tool definition (shared) ───
const SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the web for current information. Use for news, facts, documentation, or anything you are unsure about. Returns verified results with source credibility scores.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query or URL to crawl' }
      },
      required: ['query']
    }
  }
}

const MAX_TOOL_ROUNDS = 5

// ─── Execute a single tool call ───
async function executeSearchTool(tc) {
  let args = {}
  try { args = JSON.parse(tc.function?.arguments || '{}') } catch {}
  const query = args.query || ''
  if (!query) return 'No search query provided'
  return await webSearchVerified(query, 5)
}

// ─── Non-streaming chat ───
async function chat(req, res) {
  const { messages, model, ...rest } = req.body
  const apiKey = getApiKey(req)

  if (!apiKey) return sendError(res, '缺少 API Key，请在 .env 中设置 DEEPSEEK_API_KEY')

  try {
    let currentMessages = [...messages]
    let finalReply = ''

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const isLastRound = round === MAX_TOOL_ROUNDS - 1
      const response = await fetch(DEEPSEEK_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model: model || 'deepseek-v4-flash',
          messages: currentMessages,
          tools: [SEARCH_TOOL],
          tool_choice: isLastRound ? 'none' : 'auto',
          ...(rest.max_tokens ? { max_tokens: rest.max_tokens } : {}),
          ...(rest.temperature != null ? { temperature: rest.temperature } : {}),
          stream: false,
        }),
      })

      if (!response.ok) {
        const err = await response.text()
        console.error('[AI Chat] API error:', response.status, err.slice(0, 500))
        return sendError(res, 'AI API 错误', 'AI_API_ERROR', response.status, err)
      }

      const data = await response.json()
      const msg = data.choices?.[0]?.message
      if (!msg) { finalReply = '(无响应)'; break }

      // No tool calls → done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        finalReply = msg.content || '(无响应)'
        break
      }

      // Has tool calls → execute and feed back
      currentMessages.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls
      })

      for (const tc of msg.tool_calls) {
        if (tc.function?.name === 'web_search') {
          const result = await executeSearchTool(tc)
          currentMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: result
          })
        }
      }
    }

    sendSuccess(res, { reply: finalReply })
  } catch (e) {
    sendError(res, e.message, 'AI_API_ERROR', 500)
  }
}

// ─── Helper: stream response from DeepSeek (passthrough mode) ───
async function streamFromDeepSeek(messages, model, tools, apiKey, rest, res) {
  const body = {
    model: model || 'deepseek-v4-flash',
    messages,
    stream: true,
    ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
    ...(rest.max_tokens ? { max_tokens: rest.max_tokens } : {}),
    ...(rest.temperature != null ? { temperature: rest.temperature } : {}),
  }
  if (rest.thinking) body.thinking = rest.thinking

  const dsRes = await fetch(DEEPSEEK_API_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!dsRes.ok) {
    const err = await dsRes.text()
    console.error('[AI Stream] DeepSeek error:', dsRes.status, err.slice(0, 500))
    res.write(`data: ${JSON.stringify({ error: 'API error ' + dsRes.status })}\n\n`)
    res.end()
    return
  }

  // Pipe SSE chunks from DeepSeek directly to client
  const reader = dsRes.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        res.write(trimmed + '\n\n')
      }
    }
    if (buffer.trim()) {
      res.write(buffer.trim() + '\n\n')
    }
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: 'Stream interrupted: ' + e.message })}\n\n`)
  }

  res.write('data: [DONE]\n\n')
  res.end()
}

// ─── Streaming chat ───
async function chatStream(req, res) {
  const { messages, model, tools, ...rest } = req.body
  const apiKey = getApiKey(req)

  if (!apiKey) return sendError(res, '缺少 API Key，请在 .env 中设置 DEEPSEEK_API_KEY')

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (res.socket) res.socket.setNoDelay(true)
  res.flushHeaders()

  try {
    // Passthrough mode: stream directly to DeepSeek with client's tools.
    // The client handles tool execution — server just proxies.
    await streamFromDeepSeek(messages, model, tools, apiKey, rest, res)
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
  }
}

module.exports = { chat, chatStream }
