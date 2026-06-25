// ══════════════════════════════════════
// DS Agent Routes — /api/ds/*
// Multi-agent group chat management
// ══════════════════════════════════════

const { Router } = require('express')
const ctrl = require('../controllers/ds.controller')

const router = Router()

// Role templates
router.get('/templates', ctrl.templates)

// Room agents
router.get('/rooms/:roomId/agents', ctrl.listAgents)
router.get('/rooms/:roomId/status', ctrl.roomStatus)
router.get('/rooms/:roomId/context-stats', ctrl.roomContextStats)
router.post('/rooms/:roomId/agents', ctrl.createAgent)
router.post('/rooms/:roomId/route', ctrl.routeMessage)
router.post('/rooms/:roomId/parallel', ctrl.parallelTrigger)
router.post('/rooms/:roomId/ambient', ctrl.runAmbientCheck)
router.post('/rooms/:roomId/agent-message', ctrl.agentMessage)
router.get('/rooms/:roomId/tasks', ctrl.roomTasks)

// Memory
router.get('/rooms/:roomId/memory', ctrl.getMemory)
router.post('/rooms/:roomId/memory', ctrl.setMemory)

// Agent operations
router.get('/agents/:agentId', ctrl.agentDetail)
router.patch('/agents/:agentId', ctrl.updateAgent)
router.delete('/agents/:agentId', ctrl.deleteAgent)
router.post('/agents/:agentId/task', ctrl.triggerTask)
router.post('/agents/:agentId/chat', ctrl.quickChat)
router.get('/agents/:agentId/tasks', ctrl.agentTasks)
router.post('/agents/:agentId/abort', ctrl.abortAgent)

// Task operations
router.get('/tasks/:taskId/progress', ctrl.taskProgress)
router.post('/tasks/:taskId/abort', ctrl.abort)

// Memory delete
router.delete('/memory/:memoryId', ctrl.deleteMemory)

// ─── 定时任务 ───
router.get('/rooms/:roomId/schedules', ctrl.listSchedules)
router.post('/rooms/:roomId/schedules', ctrl.addSchedule)
router.delete('/schedules/:scheduleId', ctrl.deleteSchedule)

// Open real file on the computer
router.post('/open-file', ctrl.openFile)

module.exports = router
