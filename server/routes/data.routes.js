// ══════════════════════════════════════
// Data Routes — Code, Agent, Collections, Folders
// ══════════════════════════════════════

const { Router } = require('express')
const { localAuth } = require('../auth')
const ctrl = require('../controllers/data.controller')

const router = Router()

// ─── Code Conversations ───
router.get('/code-conversations', localAuth, ctrl.listCodeConversations)
router.post('/code-conversations', localAuth, ctrl.createCodeConversation)
router.get('/code-conversations/:id', localAuth, ctrl.getCodeConversation)
router.patch('/code-conversations/:id', localAuth, ctrl.updateCodeConversation)
router.delete('/code-conversations/:id', localAuth, ctrl.deleteCodeConversation)
router.get('/code-conversations/:id/messages', localAuth, ctrl.listCodeMessages)
router.post('/code-conversations/:id/messages', localAuth, ctrl.addCodeMessage)
router.patch('/code-conversations/:id/messages/:msgId', localAuth, ctrl.updateCodeMessage)

// ─── Agent Conversations ───
router.get('/agent-conversations', localAuth, ctrl.listAgentConversations)
router.post('/agent-conversations', localAuth, ctrl.createAgentConversation)
router.get('/agent-conversations/:id', localAuth, ctrl.getAgentConversation)
router.patch('/agent-conversations/:id', localAuth, ctrl.updateAgentConversation)
router.delete('/agent-conversations/:id', localAuth, ctrl.deleteAgentConversation)
router.get('/agent-conversations/:id/messages', localAuth, ctrl.listAgentMessages)
router.post('/agent-conversations/:id/messages', localAuth, ctrl.addAgentMessage)
router.patch('/agent-conversations/:id/messages/:msgId', localAuth, ctrl.updateAgentMessage)

// ─── Collections ───
router.get('/collections', localAuth, ctrl.listCollections)
router.post('/collections', localAuth, ctrl.createCollection)
router.patch('/collections/:id', localAuth, ctrl.renameCollection)
router.delete('/collections/:id', localAuth, ctrl.deleteCollection)
router.get('/collections/find-by-name', localAuth, ctrl.findCollectionByName)

// Collection Items
router.get('/collection-items', localAuth, ctrl.listCollectionItems)
router.get('/collection-items/all', localAuth, ctrl.getAllCollectionItems)
router.get('/collection-items/search', localAuth, ctrl.searchCollectionItems)
router.post('/collection-items', localAuth, ctrl.saveCollectionItem)
router.post('/collection-items/check-duplicate', localAuth, ctrl.isCollectionItemDuplicate)
router.patch('/collection-items/:itemId', localAuth, ctrl.updateCollectionItem)
router.delete('/collection-items/:itemId', localAuth, ctrl.deleteCollectionItem)
router.post('/collection-items/:itemId/move', localAuth, ctrl.moveCollectionItem)

// ─── Folders ───
router.get('/folders', localAuth, ctrl.listFolders)
router.post('/folders', localAuth, ctrl.createFolder)
router.patch('/folders/:id', localAuth, ctrl.renameFolder)
router.delete('/folders/:id', localAuth, ctrl.deleteFolder)
router.post('/folders/:id/move', localAuth, ctrl.moveFolder)

module.exports = router
