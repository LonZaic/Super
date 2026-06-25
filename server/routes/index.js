// ══════════════════════════════════════
// Route Aggregator — mount all route modules
// ══════════════════════════════════════

const { Router } = require('express')

const authRoutes = require('./auth.routes')
const chatRoutes = require('./chat.routes')
const aiRoutes = require('./ai.routes')
const agentRoutes = require('./agent.routes')
const memoryRoutes = require('./memory.routes')
const codeRoutes = require('./code.routes')
const searchRoutes = require('./search.routes')
const weatherRoutes = require('./weather.routes')
const filesRoutes = require('./files.routes')
const computerRoutes = require('./computer.routes')
const mcpRoutes = require('./mcp.routes')
const skillsRoutes = require('./skills.routes')
const dataRoutes = require('./data.routes')
const knowledgeRoutes = require('./knowledge.routes')
const workflowRoutes = require('./workflow.routes')
const inboxRoutes = require('./inbox.routes')
const dsRoutes = require('./ds.routes')
const imageLibraryRoutes = require('./imageLibrary.routes')
const novelRoutes = require('./novel.routes')

const router = Router()

router.use('/api/auth', authRoutes)
router.use('/api', chatRoutes)
router.use('/api/ai', aiRoutes)
router.use('/api/agent', agentRoutes)
router.use('/api/agent', memoryRoutes)
router.use('/api', codeRoutes)
router.use('/api', dataRoutes)
router.use('/api', searchRoutes)
router.use('/api', weatherRoutes)
router.use('/api', filesRoutes)
router.use('/api', computerRoutes)
router.use('/api/mcp', mcpRoutes)
router.use('/api/skills', skillsRoutes)
router.use('/api/knowledge', knowledgeRoutes)
router.use('/api/workflows', workflowRoutes)
router.use('/api/inbox', inboxRoutes)
router.use('/api/ds', dsRoutes)
router.use('/api/image-library', imageLibraryRoutes)
router.use('/api/novels', novelRoutes)

module.exports = router
