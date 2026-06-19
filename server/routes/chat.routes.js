// ══════════════════════════════════════
// Chat Routes — Users, Friends, DMs, Groups
// ══════════════════════════════════════

const { Router } = require('express')
const { authRequired, localAuth, localLoginHandler } = require('../auth')
const ctrl = require('../controllers/chat.controller')

const router = Router()

// Users
router.get('/users/search', authRequired, ctrl.searchUsers)
router.get('/users/online', authRequired, ctrl.onlineUsers)

// Friends
router.get('/friends', authRequired, ctrl.getFriends)
router.post('/friends/add', authRequired, ctrl.addFriend)
router.post('/friends/accept', authRequired, ctrl.acceptFriend)
router.post('/friends/reject', authRequired, ctrl.rejectFriend)
router.delete('/friends/:friendId', authRequired, ctrl.removeFriend)

// DMs
router.get('/dm/:friendId', authRequired, ctrl.getDmMessages)
router.post('/dm/:friendId', authRequired, ctrl.sendDmMessage)

// Groups
router.get('/groups', authRequired, ctrl.getUserGroups)
router.get('/groups/all', authRequired, ctrl.getAllGroups)
router.post('/groups', authRequired, ctrl.createGroup)
router.post('/groups/join', authRequired, ctrl.joinGroup)
router.get('/groups/:id', authRequired, ctrl.getGroupDetail)
router.get('/groups/:id/messages', authRequired, ctrl.getGroupMessages)
router.post('/groups/:id/leave', authRequired, ctrl.leaveGroup)

// ═══ Local Auth Endpoint ═══
router.post('/auth/local', localLoginHandler)

// ═══ AI Chat Conversations & Messages ═══
// NOTE: export/import must be BEFORE /:id routes to avoid path collision

// Export / Import
router.get('/conversations/export/all', localAuth, ctrl.exportData)
router.post('/conversations/import', localAuth, ctrl.importData)

// Conversations
router.get('/conversations', localAuth, ctrl.listConversations)
router.post('/conversations', localAuth, ctrl.createConversation)
router.get('/conversations/:id', localAuth, ctrl.getConversation)
router.patch('/conversations/:id', localAuth, ctrl.updateConversation)
router.delete('/conversations/:id', localAuth, ctrl.deleteConversation)

// Messages within a conversation
router.get('/conversations/:id/messages', localAuth, ctrl.listMessages)
router.post('/conversations/:id/messages', localAuth, ctrl.addMessage)
router.patch('/conversations/:id/messages/:msgId', localAuth, ctrl.updateMessage)
router.delete('/conversations/:id/messages/:msgId', localAuth, ctrl.deleteMessage)
router.post('/conversations/:id/truncate', localAuth, ctrl.truncateMessages)

module.exports = router
