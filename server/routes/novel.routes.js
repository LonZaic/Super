// ══════════════════════════════════════
// Novel Routes — AI-written novels
// ══════════════════════════════════════

const { Router } = require('express')
const { localAuth } = require('../auth')
const ctrl = require('../controllers/novel.controller')

const router = Router()

// All novel routes require authentication
router.use(localAuth)

// ─── Novel CRUD ───
router.get('/', ctrl.listNovels)
router.post('/', ctrl.createNovel)
router.get('/:id', ctrl.getNovel)
router.patch('/:id', ctrl.updateNovel)
router.delete('/:id', ctrl.deleteNovel)

// ─── Chapters ───
router.get('/:novelId/chapters', ctrl.listChapters)
router.post('/:novelId/chapters', ctrl.createChapter)
router.patch('/chapters/:id', ctrl.updateChapter)
router.delete('/chapters/:id', ctrl.deleteChapter)

// ─── Pages ───
router.get('/chapters/:chapterId/pages', ctrl.listPages)

// ─── AI Generation (SSE stream) ───
router.post('/:novelId/generate', ctrl.generateNovel)

module.exports = router
