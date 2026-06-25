// ══════════════════════════════════════
// Route Aggregator — mount all route modules
// ══════════════════════════════════════
//
// Auth strategy (#3/#4 fix):
//   - /api/auth/*           → public (register/login/local)
//   - /api/weather/*        → public (free public data)
//   - /api/health           → public (already mounted in app.js)
//   - chat & data routes    → already apply authRequired/localAuth internally
//   - ALL other routes      → authRequired middleware applied at mount point
//
// This closes the critical hole where 9 route groups (ai/code/computer/
// files/mcp/skills/knowledge/workflow/inbox/ds/image-library/novel/agent/
// memory/search) were exposed without any authentication.

const { Router } = require('express')
const { authRequired } = require('../auth')

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

// ─── Public routes (no auth) ───
router.use('/api/auth', authRoutes)
router.use('/api/weather', weatherRoutes)

// ─── Chat & data routes (apply auth internally via localAuth/authRequired) ───
// Note: /api/auth/local (localLoginHandler) is the only public endpoint
// inside chatRoutes; everything else there is already guarded.
router.use('/api', chatRoutes)
router.use('/api', dataRoutes)

// ─── Protected routes (authRequired at mount point) ───
router.use('/api/ai', authRequired, aiRoutes)
router.use('/api/agent', authRequired, agentRoutes)
router.use('/api/agent', authRequired, memoryRoutes)
router.use('/api', authRequired, codeRoutes)
router.use('/api', authRequired, searchRoutes)
router.use('/api', authRequired, filesRoutes)
router.use('/api', authRequired, computerRoutes)
router.use('/api/mcp', authRequired, mcpRoutes)
router.use('/api/skills', authRequired, skillsRoutes)
router.use('/api/knowledge', authRequired, knowledgeRoutes)
router.use('/api/workflows', authRequired, workflowRoutes)
router.use('/api/inbox', authRequired, inboxRoutes)
router.use('/api/ds', authRequired, dsRoutes)
router.use('/api/image-library', authRequired, imageLibraryRoutes)
router.use('/api/novels', authRequired, novelRoutes)

module.exports = router
