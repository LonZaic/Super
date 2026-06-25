// ═══════════════════════════════════════════════════════════════════════
// Workflow Service — Execute multi-step AI task pipelines
//
// Nodes: start → [tool nodes] → end
// Each node has: type, config, inputs (from previous nodes), outputs
// Execution: sequential, with variable substitution {{nodeId.field}}
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')
const https = require('https')
const http = require('http')
const serverConfig = require('../config')

const DB_PATH = path.join(__dirname, '..', 'db', 'workflows.sqlite')
let _db = null

function getDB() {
  if (_db) return _db
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '未命名工作流',
      description TEXT DEFAULT '',
      nodes TEXT DEFAULT '[]',
      edges TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS workflow_runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      inputs TEXT DEFAULT '{}',
      outputs TEXT DEFAULT '{}',
      logs TEXT DEFAULT '[]',
      started_at TEXT DEFAULT (datetime('now','localtime')),
      finished_at TEXT,
      FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
    );
  `)
  return _db
}

// ═══════════════════════════════════════════════════════════════════════
// Available node types — wraps existing tools
// ═══════════════════════════════════════════════════════════════════════

const NODE_TYPES = {
  start: {
    name: '开始',
    icon: 'play',
    color: '#22c55e',
    category: 'flow',
    description: '工作流起点，接收用户输入',
    inputs: [],
    outputs: [{ name: 'input', type: 'string', description: '用户输入文本' }],
    config: [{ name: 'defaultInput', label: '默认输入', type: 'text', required: false }],
  },
  end: {
    name: '结束',
    icon: 'stop',
    color: '#ef4444',
    category: 'flow',
    description: '工作流终点，输出最终结果',
    inputs: [{ name: 'result', type: 'any', description: '最终结果' }],
    outputs: [],
    config: [{ name: 'outputTemplate', label: '输出模板', type: 'textarea', required: false, placeholder: '使用 {{变量}} 引用上游节点输出' }],
  },
  ai_text: {
    name: 'AI 文本处理',
    icon: 'brain',
    color: '#6366f1',
    category: 'ai',
    description: '调用 AI 处理文本（总结、翻译、改写、分析等）',
    inputs: [{ name: 'text', type: 'string', description: '输入文本' }],
    outputs: [{ name: 'result', type: 'string', description: 'AI 处理结果' }],
    config: [
      { name: 'prompt', label: '处理指令', type: 'textarea', required: true, placeholder: '如：总结以下内容 / 翻译成英文 / 提取关键信息' },
      { name: 'model', label: '模型', type: 'select', options: ['deepseek-chat', 'deepseek-v4-flash', 'deepseek-v4-pro'], default: 'deepseek-chat' },
    ],
  },
  web_search: {
    name: '网络搜索',
    icon: 'search',
    color: '#0ea5e9',
    category: 'tool',
    description: '搜索互联网获取信息',
    inputs: [{ name: 'query', type: 'string', description: '搜索关键词' }],
    outputs: [{ name: 'results', type: 'string', description: '搜索结果摘要' }],
    config: [],
  },
  web_fetch: {
    name: '网页抓取',
    icon: 'globe',
    color: '#0ea5e9',
    category: 'tool',
    description: '抓取指定 URL 的网页内容',
    inputs: [{ name: 'url', type: 'string', description: '网页 URL' }],
    outputs: [{ name: 'content', type: 'string', description: '网页文本内容' }],
    config: [],
  },
  get_weather: {
    name: '天气查询',
    icon: 'cloud',
    color: '#0ea5e9',
    category: 'tool',
    description: '查询城市天气预报',
    inputs: [{ name: 'city', type: 'string', description: '城市名' }],
    outputs: [{ name: 'weather', type: 'string', description: '天气信息' }],
    config: [],
  },
  knowledge_search: {
    name: '知识库检索',
    icon: 'book',
    color: '#f59e0b',
    category: 'tool',
    description: '从知识库检索相关内容',
    inputs: [{ name: 'query', type: 'string', description: '检索问题' }],
    outputs: [{ name: 'context', type: 'string', description: '检索到的知识片段' }],
    config: [{ name: 'topK', label: '返回片段数', type: 'number', default: 4 }],
  },
  save_file: {
    name: '保存文件',
    icon: 'save',
    color: '#10b981',
    category: 'tool',
    description: '保存文本为可下载文件',
    inputs: [
      { name: 'filename', type: 'string', description: '文件名' },
      { name: 'content', type: 'string', description: '文件内容' },
    ],
    outputs: [{ name: 'file', type: 'object', description: '文件信息 { name, url, size }' }],
    config: [],
  },
  send_email: {
    name: '发送邮件',
    icon: 'mail',
    color: '#8b5cf6',
    category: 'tool',
    description: '通过 SMTP 发送邮件',
    inputs: [
      { name: 'to', type: 'string', description: '收件人邮箱' },
      { name: 'subject', type: 'string', description: '邮件主题' },
      { name: 'body', type: 'string', description: '邮件正文' },
    ],
    outputs: [{ name: 'status', type: 'string', description: '发送状态' }],
    config: [],
  },
  text_template: {
    name: '文本模板',
    icon: 'file-text',
    color: '#64748b',
    category: 'util',
    description: '拼接文本，用 {{变量}} 引用上游输出',
    inputs: [],
    outputs: [{ name: 'text', type: 'string', description: '拼接结果' }],
    config: [{ name: 'template', label: '模板内容', type: 'textarea', required: true, placeholder: '如：搜索结果：{{search.results}}\n总结：{{summary.result}}' }],
  },
  condition: {
    name: '条件判断',
    icon: 'git-branch',
    color: '#f59e0b',
    category: 'flow',
    description: '根据条件选择分支（包含关键词则走 true 分支）',
    inputs: [{ name: 'text', type: 'string', description: '判断文本' }],
    outputs: [
      { name: 'true', type: 'any', description: '条件成立时输出' },
      { name: 'false', type: 'any', description: '条件不成立时输出' },
    ],
    config: [{ name: 'keyword', label: '关键词', type: 'text', required: true, placeholder: '文本包含此关键词则走 true 分支' }],
  },
}

// ═══════════════════════════════════════════════════════════════════════
// Variable substitution: {{nodeId.field}} → value
// ═══════════════════════════════════════════════════════════════════════

function substituteVars(text, context) {
  if (!text || typeof text !== 'string') return text
  return text.replace(/\{\{(\w+)\.(\w+)\}\}/g, (match, nodeId, field) => {
    const nodeOutput = context[nodeId]
    if (!nodeOutput) return ''
    const val = nodeOutput[field]
    if (val == null) return ''
    return typeof val === 'object' ? JSON.stringify(val) : String(val)
  })
}

// ═══════════════════════════════════════════════════════════════════════
// Node executors
// ═══════════════════════════════════════════════════════════════════════

async function executeNode(node, inputs, context, runId, apiKey, token) {
  const config = node.config || {}
  const log = (msg) => {
    try {
      const db = getDB()
      const run = db.prepare('SELECT logs FROM workflow_runs WHERE id = ?').get(runId)
      const logs = run?.logs ? JSON.parse(run.logs) : []
      logs.push({ time: new Date().toISOString(), node: node.id, type: node.type, message: msg })
      db.prepare('UPDATE workflow_runs SET logs = ? WHERE id = ?').run(JSON.stringify(logs), runId)
    } catch {}
  }

  log(`节点开始: ${NODE_TYPES[node.type]?.name || node.type}`)

  let output = {}

  switch (node.type) {
    case 'start': {
      output = { input: inputs.input || config.defaultInput || '' }
      break
    }

    case 'end': {
      const template = config.outputTemplate || '{{start.input}}'
      output = { result: substituteVars(template, context) }
      break
    }

    case 'ai_text': {
      const prompt = substituteVars(config.prompt || '', context)
      const inputText = inputs.text || ''
      const model = config.model || 'deepseek-chat'
      log(`AI 处理: ${prompt.slice(0, 50)}...`)
      const res = await fetch('http://localhost:' + serverConfig.port + '/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey || '',
          'Authorization': 'Bearer ' + (token || ''),
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: inputText },
          ],
          stream: false,
        }),
      })
      const data = await res.json()
      output = { result: data?.reply || data?.data?.reply || '' }
      break
    }

    case 'web_search': {
      const query = inputs.query || ''
      log(`搜索: ${query}`)
      const res = await fetch('http://localhost:' + serverConfig.port + '/api/search/dual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey || '' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      const results = (data?.results || data?.data?.results || []).slice(0, 5)
      const summary = results.map(r => `【${r.title}】${r.snippet || r.content || ''}`).join('\n\n')
      output = { results: summary || '未找到相关结果' }
      break
    }

    case 'web_fetch': {
      const url = inputs.url || ''
      log(`抓取: ${url}`)
      const isCodeHost = /github\.com|gitee\.com|gitlab\.com/i.test(url)
      const endpoint = isCodeHost ? 'deep-crawl' : 'direct-crawl'
      const res = await fetch(`http://localhost:' + serverConfig.port + '/api/search/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey || '' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      output = { content: data?.content || data?.data?.content || data?.text || '' }
      break
    }

    case 'get_weather': {
      const city = inputs.city || ''
      log(`天气: ${city}`)
      const res = await fetch(`http://localhost:' + serverConfig.port + '/api/weather?city=${encodeURIComponent(city)}&days=3`, {
        headers: { 'x-api-key': apiKey || '' },
      })
      const data = await res.json()
      output = { weather: JSON.stringify(data?.data || data || {}) }
      break
    }

    case 'knowledge_search': {
      const query = inputs.query || ''
      const topK = config.topK || 4
      log(`知识库检索: ${query}`)
      try {
        const kb = require('./knowledgeService')
        const results = await kb.search(query, topK)
        const context = results.map(r => `【${r.docTitle}】${r.text}`).join('\n\n---\n\n')
        output = { context: context || '知识库中未找到相关内容' }
      } catch (e) {
        output = { context: '知识库未就绪: ' + e.message }
      }
      break
    }

    case 'save_file': {
      const filename = inputs.filename || `workflow_${Date.now()}.txt`
      const content = inputs.content || ''
      log(`保存文件: ${filename}`)
      const res = await fetch('http://localhost:' + serverConfig.port + '/api/files/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey || '' },
        body: JSON.stringify({ filename, content, base64: false }),
      })
      const data = await res.json()
      output = { file: data?.data || data || {} }
      break
    }

    case 'send_email': {
      const to = inputs.to || ''
      const subject = inputs.subject || '工作流邮件'
      const body = inputs.body || ''
      log(`发送邮件到: ${to}`)
      // SMTP config is stored in browser localStorage; workflow runs server-side.
      // We try to read from config file if present, otherwise return a helpful message.
      let smtpConfig = {}
      try {
        const smtpPath = path.join(__dirname, '..', 'config', 'smtp.json')
        if (fs.existsSync(smtpPath)) {
          smtpConfig = JSON.parse(fs.readFileSync(smtpPath, 'utf-8'))
        }
      } catch {}
      if (!smtpConfig.host) {
        output = { status: 'SMTP 未配置（工作流需在 server/config/smtp.json 配置 SMTP）' }
        break
      }
      const nodemailer = (() => { try { return require('nodemailer') } catch { return null } })()
      if (!nodemailer) {
        output = { status: 'nodemailer 未安装' }
        break
      }
      try {
        const transporter = nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port || 465,
          secure: (smtpConfig.port || 465) === 465,
          auth: { user: smtpConfig.user, pass: smtpConfig.pass },
        })
        const info = await transporter.sendMail({
          from: smtpConfig.user,
          to, subject, text: body,
        })
        output = { status: '发送成功: ' + (info.messageId || '') }
      } catch (e) {
        output = { status: '发送失败: ' + e.message }
      }
      break
    }

    case 'text_template': {
      const template = config.template || ''
      output = { text: substituteVars(template, context) }
      break
    }

    case 'condition': {
      const text = inputs.text || ''
      const keyword = config.keyword || ''
      const matched = text.includes(keyword)
      log(`条件判断: ${matched ? 'true' : 'false'} (关键词: ${keyword})`)
      output = matched
        ? { true: text, false: null }
        : { true: null, false: text }
      break
    }

    default:
      throw new Error(`未知节点类型: ${node.type}`)
  }

  log(`节点完成: ${NODE_TYPES[node.type]?.name || node.type}`)
  return output
}

// ═══════════════════════════════════════════════════════════════════════
// Workflow execution engine
// ═══════════════════════════════════════════════════════════════════════

async function executeWorkflow(workflow, inputs, apiKey, token) {
  const db = getDB()
  const runId = 'run_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
  // NOTE: token is passed to executeNode as a parameter — NOT stored globally.
  // The previous global._workflowToken caused a race condition when two
  // workflows ran concurrently (they'd overwrite each other's token).

  db.prepare(`INSERT INTO workflow_runs (id, workflow_id, status, inputs, outputs, logs) VALUES (?, ?, 'running', ?, '{}', '[]')`)
    .run(runId, workflow.id, JSON.stringify(inputs || {}))

  try {
    const nodes = typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : (workflow.nodes || [])
    const edges = typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : (workflow.edges || [])

    // Build adjacency: target → source edges
    const incoming = {} // nodeId → [{ source, sourceHandle, targetHandle }]
    const outgoing = {} // nodeId → [{ target, sourceHandle, targetHandle }]
    for (const e of edges) {
      if (!incoming[e.target]) incoming[e.target] = []
      incoming[e.target].push(e)
      if (!outgoing[e.source]) outgoing[e.source] = []
      outgoing[e.source].push(e)
    }

    // Find start node
    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) throw new Error('工作流缺少开始节点')

    // Topological execution (simple sequential for now, follows edges)
    const context = {} // nodeId → output object
    const executed = new Set()
    const queue = [startNode]

    while (queue.length > 0) {
      const node = queue.shift()
      if (executed.has(node.id)) continue
      executed.add(node.id)

      // Gather inputs from incoming edges
      const nodeInputs = {}
      const inEdges = incoming[node.id] || []
      for (const e of inEdges) {
        const sourceOutput = context[e.source]
        if (!sourceOutput) continue
        // Map source output field → target input field
        const sourceField = e.sourceHandle || Object.keys(sourceOutput)[0]
        const targetField = e.targetHandle || sourceField
        if (sourceOutput[sourceField] != null) {
          nodeInputs[targetField] = sourceOutput[sourceField]
        }
      }

      // Execute node
      const output = await executeNode(node, nodeInputs, context, runId, apiKey, token)
      context[node.id] = output

      // Find next nodes
      const outEdges = outgoing[node.id] || []
      for (const e of outEdges) {
        // For condition nodes, only follow the matching branch
        if (node.type === 'condition') {
          const branchValue = output[e.sourceHandle]
          if (branchValue == null) continue // skip non-matching branch
        }
        const nextNode = nodes.find(n => n.id === e.target)
        if (nextNode && !executed.has(nextNode.id)) {
          queue.push(nextNode)
        }
      }
    }

    // Collect final output from end node
    const endNode = nodes.find(n => n.type === 'end')
    const finalOutput = endNode ? (context[endNode.id] || {}) : {}

    db.prepare(`UPDATE workflow_runs SET status = 'completed', outputs = ?, finished_at = datetime('now','localtime') WHERE id = ?`)
      .run(JSON.stringify(finalOutput), runId)

    return { runId, status: 'completed', output: finalOutput, context }
  } catch (e) {
    db.prepare(`UPDATE workflow_runs SET status = 'failed', outputs = ?, finished_at = datetime('now','localtime') WHERE id = ?`)
      .run(JSON.stringify({ error: e.message }), runId)
    return { runId, status: 'failed', error: e.message }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════

function listWorkflows() {
  const db = getDB()
  return db.prepare('SELECT id, name, description, created_at, updated_at FROM workflows ORDER BY updated_at DESC').all()
}

function getWorkflow(id) {
  const db = getDB()
  return db.prepare('SELECT * FROM workflows WHERE id = ?').get(id)
}

function saveWorkflow(id, data) {
  const db = getDB()
  const existing = db.prepare('SELECT id FROM workflows WHERE id = ?').get(id)
  const nodes = typeof data.nodes === 'string' ? data.nodes : JSON.stringify(data.nodes || [])
  const edges = typeof data.edges === 'string' ? data.edges : JSON.stringify(data.edges || [])
  if (existing) {
    db.prepare(`UPDATE workflows SET name = ?, description = ?, nodes = ?, edges = ?, updated_at = datetime('now','localtime') WHERE id = ?`)
      .run(data.name || '未命名工作流', data.description || '', nodes, edges, id)
  } else {
    db.prepare(`INSERT INTO workflows (id, name, description, nodes, edges) VALUES (?, ?, ?, ?, ?)`)
      .run(id, data.name || '未命名工作流', data.description || '', nodes, edges)
  }
  return getWorkflow(id)
}

function deleteWorkflow(id) {
  const db = getDB()
  db.prepare('DELETE FROM workflow_runs WHERE workflow_id = ?').run(id)
  db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
  return true
}

function listRuns(workflowId) {
  const db = getDB()
  return db.prepare('SELECT id, workflow_id, status, started_at, finished_at FROM workflow_runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT 20').all(workflowId)
}

function getRun(runId) {
  const db = getDB()
  return db.prepare('SELECT * FROM workflow_runs WHERE id = ?').get(runId)
}

module.exports = {
  NODE_TYPES,
  executeWorkflow,
  listWorkflows,
  getWorkflow,
  saveWorkflow,
  deleteWorkflow,
  listRuns,
  getRun,
}
