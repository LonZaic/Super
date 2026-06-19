// ══════════════════════════════════════
// Data Controller — Code, Agent, Collections, Folders
// ══════════════════════════════════════

const { codeConv, agentConv, collection, folder } = require('../db')

// ─── Code Conversations ───
function listCodeConversations(req, res) {
  try {
    const convs = codeConv.listForUser(req.user.id)
    res.json({ success: true, data: convs })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function createCodeConversation(req, res) {
  try {
    const { id, title, projectPath, projectName } = req.body
    codeConv.create(id, req.user.id, title, projectPath, projectName)
    res.json({ success: true, data: { id } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function getCodeConversation(req, res) {
  try {
    const conv = codeConv.findById(req.params.id, req.user.id)
    if (!conv) return res.status(404).json({ success: false, error: { message: '对话不存在' } })
    const messages = codeConv.getMessages(req.params.id, req.user.id)
    res.json({ success: true, data: { ...conv, messages } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function updateCodeConversation(req, res) {
  try {
    const { title, projectPath, projectName } = req.body
    if (title) codeConv.updateTitle(req.params.id, req.user.id, title)
    if (projectPath || projectName) codeConv.updateProject(req.params.id, req.user.id, projectPath, projectName)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function deleteCodeConversation(req, res) {
  try {
    codeConv.delete(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function listCodeMessages(req, res) {
  try {
    const msgs = codeConv.getMessages(req.params.id, req.user.id)
    res.json({ success: true, data: msgs })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function addCodeMessage(req, res) {
  try {
    const { role, text, html, thinking, tasksJson, eventsJson, done, error, timer } = req.body
    const rowId = codeConv.addMessage(req.params.id, req.user.id, role, text, html, thinking, tasksJson, eventsJson, done, error, timer)
    res.json({ success: true, data: { id: rowId } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function updateCodeMessage(req, res) {
  try {
    const { text, html, thinking, tasksJson, eventsJson, done, error, timer } = req.body
    codeConv.updateMessage(req.params.msgId, req.user.id, text, html, thinking, tasksJson, eventsJson, done, error, timer)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

// ─── Agent Conversations ───
function listAgentConversations(req, res) {
  try {
    const convs = agentConv.listForUser(req.user.id)
    res.json({ success: true, data: convs })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function createAgentConversation(req, res) {
  try {
    const { id, title } = req.body
    agentConv.create(id, req.user.id, title)
    res.json({ success: true, data: { id } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function getAgentConversation(req, res) {
  try {
    const conv = agentConv.findById(req.params.id, req.user.id)
    if (!conv) return res.status(404).json({ success: false, error: { message: '对话不存在' } })
    const messages = agentConv.getMessages(req.params.id, req.user.id)
    res.json({ success: true, data: { ...conv, messages } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function updateAgentConversation(req, res) {
  try {
    const { title } = req.body
    if (title) agentConv.updateTitle(req.params.id, req.user.id, title)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function deleteAgentConversation(req, res) {
  try {
    agentConv.delete(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function listAgentMessages(req, res) {
  try {
    const msgs = agentConv.getMessages(req.params.id, req.user.id)
    res.json({ success: true, data: msgs })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function addAgentMessage(req, res) {
  try {
    const { role, text, events } = req.body
    const rowId = agentConv.addMessage(req.params.id, req.user.id, role, text, events)
    res.json({ success: true, data: { id: rowId } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function updateAgentMessage(req, res) {
  try {
    const { text, events } = req.body
    agentConv.updateMessage(req.params.msgId, req.user.id, text, events)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

// ─── Collections ───
function listCollections(req, res) {
  try {
    const cols = collection.listForUser(req.user.id)
    res.json({ success: true, data: cols })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function createCollection(req, res) {
  try {
    const { id, name } = req.body
    collection.create(id, req.user.id, name)
    res.json({ success: true, data: { id } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function renameCollection(req, res) {
  try {
    const { name } = req.body
    collection.rename(req.params.id, req.user.id, name)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function deleteCollection(req, res) {
  try {
    collection.delete(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function findCollectionByName(req, res) {
  try {
    const col = collection.findByName(req.user.id, req.query.name)
    res.json({ success: true, data: col || null })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

// Collection Items
function listCollectionItems(req, res) {
  try {
    const items = collection.getItems(req.query.collection_id || null, req.user.id)
    res.json({ success: true, data: items })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function getAllCollectionItems(req, res) {
  try {
    const items = collection.getAllItems(req.user.id)
    res.json({ success: true, data: items })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function searchCollectionItems(req, res) {
  try {
    const items = collection.searchItems(req.user.id, req.query.q || '')
    res.json({ success: true, data: items })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function saveCollectionItem(req, res) {
  try {
    const { collection_id, msg_json, preview } = req.body
    const rowId = collection.saveItem(collection_id || null, req.user.id, msg_json, preview)
    res.json({ success: true, data: { id: rowId } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function isCollectionItemDuplicate(req, res) {
  try {
    const { collection_id, msg_json } = req.body
    const dup = collection.isDuplicate(collection_id || null, req.user.id, msg_json)
    res.json({ success: true, data: dup })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function updateCollectionItem(req, res) {
  try {
    const { msg_json, preview } = req.body
    collection.updateItemContent(req.params.itemId, req.user.id, msg_json, preview)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function deleteCollectionItem(req, res) {
  try {
    collection.deleteItem(req.params.itemId, req.user.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function moveCollectionItem(req, res) {
  try {
    const { new_collection_id } = req.body
    collection.moveItem(req.params.itemId, req.user.id, new_collection_id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

// ─── Folders ───
function listFolders(req, res) {
  try {
    const folders = folder.listForUser(req.user.id)
    res.json({ success: true, data: folders })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function createFolder(req, res) {
  try {
    const { id, name, parent_id } = req.body
    folder.create(id, req.user.id, name, parent_id)
    res.json({ success: true, data: { id } })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function renameFolder(req, res) {
  try {
    const { name } = req.body
    folder.rename(req.params.id, req.user.id, name)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function deleteFolder(req, res) {
  try {
    folder.delete(req.params.id, req.user.id)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

function moveFolder(req, res) {
  try {
    const { new_parent_id } = req.body
    folder.move(req.params.id, req.user.id, new_parent_id || null)
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, error: { message: e.message } })
  }
}

module.exports = {
  // Code
  listCodeConversations, createCodeConversation, getCodeConversation,
  updateCodeConversation, deleteCodeConversation,
  listCodeMessages, addCodeMessage, updateCodeMessage,
  // Agent
  listAgentConversations, createAgentConversation, getAgentConversation,
  updateAgentConversation, deleteAgentConversation,
  listAgentMessages, addAgentMessage, updateAgentMessage,
  // Collections
  listCollections, createCollection, renameCollection, deleteCollection, findCollectionByName,
  listCollectionItems, getAllCollectionItems, searchCollectionItems,
  saveCollectionItem, isCollectionItemDuplicate,
  updateCollectionItem, deleteCollectionItem, moveCollectionItem,
  // Folders
  listFolders, createFolder, renameFolder, deleteFolder, moveFolder,
}
