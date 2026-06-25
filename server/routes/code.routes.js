// ══════════════════════════════════════
// Code Mode API Routes
// ══════════════════════════════════════

const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { executeCodeTask } = require('../codeAgent')
const { initFollow, readFollow, searchFollowBM25 } = require('../followManager')
const { initTask, readTask } = require('../taskManager')
const { validateFilePath } = require('../pathSanitizer')

const router = Router()
const WORKSPACE = process.env.AGENT_WORKSPACE || os.homedir()

// ─── Scan file tree ───
router.post('/code/filetree', (req, res) => {
  try {
    const { projectPath } = req.body
    const dir = projectPath || WORKSPACE
    const v = validateFilePath(dir)
    if (!v.ok) return res.status(403).json({ error: v.error })
    if (!fs.existsSync(v.resolved)) return res.json({ tree: [], error: 'Path not found' })
    const tree = scanDir(v.resolved, 3)
    res.json({ tree })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Read file content ───
router.post('/code/read-file', (req, res) => {
  try {
    let { filePath, projectPath } = req.body
    // Resolve relative paths against project root if provided
    const base = projectPath || undefined
    const v = validateFilePath(filePath, base)
    if (!v.ok) return res.status(403).json({ error: v.error })
    filePath = v.resolved
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found: ' + filePath })
    const content = fs.readFileSync(filePath, 'utf-8')
    const name = path.basename(filePath)
    res.json({ filePath, name, content, lines: content.split('\n').length })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Write file content (for diff revert) ───
router.post('/code/write-file', (req, res) => {
  try {
    const { filePath, content } = req.body
    if (!filePath) return res.status(400).json({ error: 'filePath required' })
    const v = validateFilePath(filePath)
    if (!v.ok) return res.status(403).json({ error: v.error })
    const fullPath = v.resolved
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(fullPath, content, 'utf-8')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Create a new folder ───
router.post('/code/create-folder', (req, res) => {
  try {
    let { folderPath, projectPath, parentPath } = req.body
    // Resolve relative path against project
    let fullPath = folderPath
    if (!path.isAbsolute(fullPath) && projectPath) {
      fullPath = path.resolve(projectPath, folderPath)
    }
    // If parentPath provided and folderPath is just a name, resolve
    if (parentPath && folderPath && !folderPath.includes(path.sep)) {
      fullPath = path.resolve(parentPath, folderPath)
    }
    const v = validateFilePath(fullPath)
    if (!v.ok) return res.status(403).json({ error: v.error })
    fullPath = v.resolved
    if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true })
    const tree = scanDir(path.dirname(fullPath), 3)
    res.json({ ok: true, path: fullPath, name: path.basename(fullPath), tree })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Create a new file ───
router.post('/code/create-file', (req, res) => {
  try {
    let { filePath, projectPath, parentPath } = req.body
    let fullPath = filePath
    if (!path.isAbsolute(fullPath) && projectPath) {
      fullPath = path.resolve(projectPath, filePath)
    }
    if (parentPath && filePath && !filePath.includes(path.sep)) {
      fullPath = path.resolve(parentPath, filePath)
    }
    const v = validateFilePath(fullPath)
    if (!v.ok) return res.status(403).json({ error: v.error })
    fullPath = v.resolved
    const dir = path.dirname(fullPath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    // Don't overwrite existing files
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, '', 'utf-8')
    }
    const tree = scanDir(dir, 3)
    res.json({ ok: true, path: fullPath, name: path.basename(fullPath), tree })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Create new project folder ───
router.post('/code/new-project', (req, res) => {
  try {
    const { projectPath, projectName } = req.body
    const fullPath = projectPath || path.join(WORKSPACE, projectName || 'NewProject')
    const v = validateFilePath(fullPath)
    if (!v.ok) return res.status(403).json({ error: v.error })
    const resolved = v.resolved
    if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true })
    initFollow(resolved)
    initTask(resolved)
    const tree = scanDir(resolved, 2)
    res.json({ projectPath: resolved, projectName: path.basename(resolved), tree })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Run code agent (SSE) ───
router.post('/code/run', async (req, res) => {
  const { task, projectPath, model = 'deepseek-v4-pro', existingTasks } = req.body
  const apiKey = req.headers['x-api-key'] || process.env.DEEPSEEK_API_KEY || ''

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (res.socket) res.socket.setNoDelay(true)
  res.flushHeaders()

  const send = (data) => {
    if (res.writableEnded) return
    res.write(`data: ${JSON.stringify(data)}\n\n`)
    // Force flush — critical for real-time streaming
    if (typeof res.flush === 'function') res.flush()
  }
  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  try {
    await executeCodeTask({
      projectPath, task, apiKey, model,
      onProgress: (event) => { send(event) },
      signal: abortController.signal,
      existingTasks: existingTasks || null
    })
  } catch (e) {
    send({ type: 'error', text: e.message })
  }
  send({ type: 'done', text: '' })
  res.end()
})

// ─── Pause / Resume ───
router.post('/code/pause', (req, res) => {
  try {
    const { pauseAgent } = require('../codeAgent')
    pauseAgent()
    res.json({ ok: true, status: 'paused' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.post('/code/resume', (req, res) => {
  try {
    const { resumeAgent } = require('../codeAgent')
    resumeAgent()
    res.json({ ok: true, status: 'resumed' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Get Follow.md ───
router.post('/code/follow', (req, res) => {
  try {
    const { projectPath } = req.body
    const content = readFollow(projectPath)
    res.json({ content })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Search Follow.md ───
router.post('/code/follow-search', (req, res) => {
  try {
    const { projectPath, query } = req.body
    const results = searchFollowBM25(projectPath, query)
    res.json({ results })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Resume / list sessions ───
const { listSessions, loadSession, deleteSession, buildRecoveryPrompt } = require('../sessionRecovery')

router.post('/code/sessions', (req, res) => {
  try {
    const { projectPath } = req.body
    const sessions = listSessions(projectPath)
    res.json({ sessions })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

router.post('/code/resume', (req, res) => {
  try {
    const { projectPath, sessionId, task } = req.body
    const prompt = buildRecoveryPrompt(projectPath, sessionId, task)
    res.json({ recoveryPrompt: prompt })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// ─── Get DeepSeek account balance ───
router.get('/code/balance', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || process.env.DEEPSEEK_API_KEY || ''
    const resp = await fetch('https://api.deepseek.com/user/balance', {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    })
    const data = await resp.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Get Task.md ───
router.post('/code/task', (req, res) => {
  try {
    const { projectPath } = req.body
    const content = readTask(projectPath)
    res.json({ content })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Helper: recursive directory scan ───
function scanDir(dir, maxDepth, depth = 0) {
  const results = []
  if (depth > maxDepth) return results
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true })
    for (const item of items) {
      if (item.name.startsWith('.') || item.name === 'node_modules') continue
      const fullPath = path.join(dir, item.name)
      results.push({
        name: item.name,
        path: fullPath,
        isDir: item.isDirectory(),
        depth,
      })
      if (item.isDirectory()) {
        results.push(...scanDir(fullPath, maxDepth, depth + 1))
      }
    }
  } catch {}
  return results
}

module.exports = router
