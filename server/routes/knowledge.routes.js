// ══════════════════════════════════════
// Knowledge Base Routes — /api/knowledge/*
// ══════════════════════════════════════

const { Router } = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const os = require('os')
const kb = require('../services/knowledgeService')

const router = Router()

// ─── Multer for file uploads (temp storage) ───
const upload = multer({
  dest: path.join(os.tmpdir(), 'kb-uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
})

// List all documents
router.get('/documents', (req, res) => {
  try {
    const docs = kb.listDocuments()
    res.json({ success: true, data: docs })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Get document detail
router.get('/documents/:id', (req, res) => {
  try {
    const doc = kb.getDocument(req.params.id)
    if (!doc) return res.status(404).json({ success: false, error: { message: '文档不存在' } })
    res.json({ success: true, data: doc })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Upload and index a document
router.post('/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: { message: '未提供文件' } })
    const title = req.body.title || req.file.originalname
    const id = 'kb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const fileType = path.extname(req.file.originalname).slice(1)

    const result = await kb.addDocument({
      id,
      title,
      filePath: req.file.path,
      fileType,
      source: req.file.originalname,
    })

    // Clean up temp file
    try { fs.unlinkSync(req.file.path) } catch {}

    res.json({ success: true, data: result })
  } catch (e) {
    // Clean up temp file on error
    if (req.file) { try { fs.unlinkSync(req.file.path) } catch {} }
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Add raw text as a document
router.post('/documents/text', async (req, res) => {
  try {
    const { title, text, source } = req.body
    if (!text || !text.trim()) return res.status(400).json({ success: false, error: { message: '文本内容为空' } })
    const id = 'kb_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const result = await kb.addText({ id, title: title || '未命名文档', text, source })
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Delete a document
router.delete('/documents/:id', (req, res) => {
  try {
    kb.deleteDocument(req.params.id)
    res.json({ success: true, data: { id: req.params.id } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Search the knowledge base
router.post('/search', async (req, res) => {
  try {
    const { query, topK } = req.body
    if (!query) return res.status(400).json({ success: false, error: { message: '请提供查询' } })
    const results = await kb.search(query, topK || 4)
    res.json({ success: true, data: results })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Warm up the embedding model (pre-load)
router.post('/warmup', async (req, res) => {
  try {
    await kb.warmup()
    res.json({ success: true, data: { ready: kb.isReady() } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Status check
router.get('/status', (req, res) => {
  res.json({ success: true, data: { ready: kb.isReady() } })
})

module.exports = router
