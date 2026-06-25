// ══════════════════════════════════════
// AI Controller — DeepSeek API proxy with web_search tool
// Chat mode now supports web search: model can call web_search, server executes it
// ══════════════════════════════════════

const { sendSuccess, sendError } = require('../errorHandler')
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

// ─── Helper: accumulate streaming tool_calls from DeepSeek SSE chunks ───
// Industry best practice: parse tool_calls deltas from SSE, execute tools server-side,
// send only clean content + structured tool_call events to the client.
async function streamWithToolHandling(messages, model, providedTools, apiKey, rest, res) {
  const MAX_ROUNDS = 5
  let currentMessages = [...messages]
  // Merge server search tool with client-provided tools
  const allTools = providedTools?.length ? providedTools : [SEARCH_TOOL]

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const isLastRound = round === MAX_ROUNDS - 1
    const body = {
      model: model || 'deepseek-v4-flash',
      messages: currentMessages,
      stream: true,
      tools: allTools,
      tool_choice: isLastRound ? 'none' : 'auto',
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
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    // ─── Parse SSE, accumulate content + tool_calls deltas ───
    const reader = dsRes.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let contentText = ''
    let reasoningText = ''
    const toolCallAccum = {}  // { index: { id, name, arguments } }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload)
            const delta = parsed.choices?.[0]?.delta
            if (!delta) continue

            // Accumulate content delta
            if (delta.content) {
              contentText += delta.content
              res.write(`data: ${JSON.stringify({ content: delta.content })}\n\n`)
            }
            // Accumulate reasoning delta
            if (delta.reasoning_content) {
              reasoningText += delta.reasoning_content
              res.write(`data: ${JSON.stringify({ reasoning: delta.reasoning_content })}\n\n`)
            }
            // Accumulate tool_call deltas (structured, NOT in content!)
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0
                if (!toolCallAccum[idx]) toolCallAccum[idx] = { id: '', name: '', arguments: '' }
                if (tc.id) toolCallAccum[idx].id = tc.id
                if (tc.function?.name) toolCallAccum[idx].name = tc.function.name
                if (tc.function?.arguments) toolCallAccum[idx].arguments += tc.function.arguments
              }
            }

            const finishReason = parsed.choices?.[0]?.finish_reason
            if (finishReason === 'tool_calls' || finishReason === 'stop') {
              // Stream done for this round
            }
          } catch { /* skip parse errors on partial chunks */ }
        }
      }
      if (buffer.trim() && buffer.trim().startsWith('data:')) {
        // Process remaining buffer
      }
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: 'Stream interrupted: ' + e.message })}\n\n`)
    }

    // ─── Process accumulated result ───
    const toolCalls = Object.values(toolCallAccum).filter(tc => tc.name)
    if (toolCalls.length === 0) {
      // No tool calls — done! Send the full accumulated text as final
      res.write(`data: ${JSON.stringify({ final: contentText })}\n\n`)
      res.write('data: [DONE]\n\n')
      res.end()
      return
    }

    // ─── Send tool_call event to client so it knows what's happening ───
    for (const tc of toolCalls) {
      res.write(`data: ${JSON.stringify({ tool_call: { name: tc.name, arguments: tc.arguments } })}\n\n`)
    }

    // ─── Execute tools server-side ───
    currentMessages.push({
      role: 'assistant',
      content: contentText || null,
      tool_calls: toolCalls.map((tc, i) => ({
        id: tc.id || ('call_' + i),
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments }
      }))
    })

    for (const tc of toolCalls) {
      let result = ''
      if (tc.name === 'web_search' || tc.name === 'web_fetch') {
        let args = {}
        try { args = JSON.parse(tc.arguments || '{}') } catch {}
        const query = args.query || args.url || ''
        if (query) {
          res.write(`data: ${JSON.stringify({ searching: query })}\n\n`)
          result = await webSearchVerified(query, 5)
        } else {
          result = 'No search query provided'
        }
      } else {
        // For other tools (file gen, weather, etc.), tell client to handle locally
        res.write(`data: ${JSON.stringify({ client_tool: { name: tc.name, arguments: tc.arguments } })}\n\n`)
        // Client handles these — we're done for now
        res.write('data: [DONE]\n\n')
        res.end()
        return
      }
      currentMessages.push({
        role: 'tool',
        // (#11 fix) tool_call_id must match the id the AI used when it
        // emitted the tool_call. Previously this used indexOf(tc.id) over
        // toolCallAccum's keys — but those keys are numeric indices, not
        // ids, so it always returned -1. Use tc.id directly, or fall back
        // to a deterministic 'call_<index>' only if id is missing.
        tool_call_id: tc.id || ('call_' + (tc.index ?? 0)),
        content: result
      })
      // Send tool result to client
      res.write(`data: ${JSON.stringify({ tool_result: { query: tc.arguments, result } })}\n\n`)
    }
    // Loop back for next round — AI will process tool results and may call more tools or give final answer
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
    await streamWithToolHandling(messages, model, tools, apiKey, rest, res)
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`)
    res.end()
  }
}

module.exports = { chat, chatStream }
