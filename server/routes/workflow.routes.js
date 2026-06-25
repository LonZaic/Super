// ══════════════════════════════════════
// Workflow Routes — /api/workflows/*
// ══════════════════════════════════════

const { Router } = require('express')
const wf = require('../services/workflowService')

const router = Router()

// List all workflows
router.get('/', (req, res) => {
  try {
    const list = wf.listWorkflows()
    res.json({ success: true, data: list })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Get node types (for frontend palette)
router.get('/node-types', (req, res) => {
  res.json({ success: true, data: wf.NODE_TYPES })
})

// Get workflow detail
router.get('/:id', (req, res) => {
  try {
    const w = wf.getWorkflow(req.params.id)
    if (!w) return res.status(404).json({ success: false, error: { message: '工作流不存在' } })
    res.json({ success: true, data: w })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Create or update workflow
router.put('/:id', (req, res) => {
  try {
    const saved = wf.saveWorkflow(req.params.id, req.body)
    res.json({ success: true, data: saved })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Create new workflow
router.post('/', (req, res) => {
  try {
    const id = 'wf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const saved = wf.saveWorkflow(id, req.body)
    res.json({ success: true, data: saved })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Delete workflow
router.delete('/:id', (req, res) => {
  try {
    wf.deleteWorkflow(req.params.id)
    res.json({ success: true, data: { id: req.params.id } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Execute workflow
router.post('/:id/run', async (req, res) => {
  try {
    const workflow = wf.getWorkflow(req.params.id)
    if (!workflow) return res.status(404).json({ success: false, error: { message: '工作流不存在' } })
    const apiKey = req.headers['x-api-key'] || ''
    const token = (req.headers.authorization || '').replace('Bearer ', '')
    const inputs = req.body?.inputs || {}
    const result = await wf.executeWorkflow(workflow, inputs, apiKey, token)
    res.json({ success: true, data: result })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// List runs for a workflow
router.get('/:id/runs', (req, res) => {
  try {
    const runs = wf.listRuns(req.params.id)
    res.json({ success: true, data: runs })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

// Get run detail (logs + outputs)
router.get('/runs/:runId', (req, res) => {
  try {
    const run = wf.getRun(req.params.runId)
    if (!run) return res.status(404).json({ success: false, error: { message: '运行记录不存在' } })
    res.json({ success: true, data: run })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
})

module.exports = router
