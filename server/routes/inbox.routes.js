// ══════════════════════════════════════
// Inbox Routes — /api/inbox/*
// Unified information agent: email/feishu/dingtalk/wecom/github/rss
// ══════════════════════════════════════

const { Router } = require('express')
const inbox = require('../services/inboxService')

const router = Router()

// List available source types (for frontend config UI)
router.get('/types', (req, res) => {
  res.json({ success: true, data: inbox.SOURCE_TYPES })
})

// List all configured sources
router.get('/sources', (req, res) => {
  try {
    res.json({ success: true, data: inbox.listSources() })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Get one source
router.get('/sources/:id', (req, res) => {
  try {
    const s = inbox.getSource(req.params.id)
    if (!s) return res.status(404).json({ success: false, error: { message: '信息源不存在' } })
    res.json({ success: true, data: s })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Create source
router.post('/sources', (req, res) => {
  try {
    const id = 'src_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const s = inbox.saveSource(id, req.body)
    res.json({ success: true, data: s })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Update source
router.put('/sources/:id', (req, res) => {
  try {
    const s = inbox.saveSource(req.params.id, { ...req.body, type: req.body.type })
    res.json({ success: true, data: s })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Delete source
router.delete('/sources/:id', (req, res) => {
  try {
    inbox.deleteSource(req.params.id)
    res.json({ success: true, data: { id: req.params.id } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Fetch messages (from one source or all enabled sources)
// POST /api/inbox/fetch  { sourceId?: string, limit?: number }
router.post('/fetch', async (req, res) => {
  try {
    const { sourceId, limit } = req.body || {}
    const result = await inbox.fetchMessages(sourceId, { limit: limit || 15 })
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Send message to a source
// POST /api/inbox/send  { sourceId, to, cc, subject, text, html, chatId, markdown, ... }
router.post('/send', async (req, res) => {
  try {
    const { sourceId, ...payload } = req.body || {}
    if (!sourceId) return res.status(400).json({ success: false, error: { message: '缺少 sourceId' } })
    const result = await inbox.sendMessage(sourceId, payload)
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

module.exports = router
