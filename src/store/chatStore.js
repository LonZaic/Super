import { defineStore } from 'pinia'
import {
    createConversation as dbCreateConv,
    getMessages, addMessage, getConversations,
    deleteConversation, updateConversationTitle,
    updateMessage, deleteMessage, deleteMessagesSince,
    updateMessageSideQuest,
    getFolders, createFolder as dbCreateFolder,
    renameFolder as dbRenameFolder, deleteFolder as dbDeleteFolder,
    moveConversation as dbMoveConversation, moveFolder as dbMoveFolder
} from '../db/database.js'
import { conversations as convApi, foldersApi } from '../api/index.js'
import { sanitizeReasoning } from '../utils/reasoningGuard.js'

const _abortMap = {}  // per-conversation abort controllers

export const useChatStore = defineStore('chat', {
    state: () => ({
        conversations: [],
        currentId: null,
        messagesMap: {},        // { [convId]: message[] } — keep all open convs in memory
        branchStateMap: {},     // { [convId]: { parentId: msgId } }
        openTabs: [],           // [convId, ...] ordered by open time
        folders: [],            // [{ id, name, parent_id, sort_order, created_at }]
        expandedFolders: {},    // { [folderId]: boolean }
        apikey: '',
        model: 'deepseek-v4-flash',
        permissionMode: 'default',   // 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'
        loadingMap: {},         // { [convId]: boolean } — per-conversation loading state
        streamingId: null,
        streamingConvId: null,  // which conversation owns the active stream
    }),

    getters: {
        messages(state) {
            return state.messagesMap[state.currentId] || []
        },

        currentBranch(state) {
            return state.branchStateMap[state.currentId] || {}
        },

        visibleMessages(state) {
            const msgs = state.messagesMap[state.currentId] || []
            const bs = state.branchStateMap[state.currentId] || {}
            const result = []
            for (const msg of msgs) {
                if (msg.role === 'user') {
                    result.push(msg)
                } else if (msg.role === 'ai') {
                    const pid = msg.parent_id
                    if (pid != null) {
                        if (msg.streaming || bs[pid] === msg.id) {
                            result.push(msg)
                        }
                    } else {
                        result.push(msg)
                    }
                }
            }
            return result
        },

        openTabList(state) {
            return state.openTabs.map(id => {
                const conv = state.conversations.find(c => c.id === id)
                return { id, title: conv?.title || '新对话' }
            })
        },

        hasApikey: (state) => state.apikey.length > 0,

        rootConversations(state) {
            return (state.conversations || []).filter(c => !c.folder_id)
        },

        topLevelFolders(state) {
            return (state.folders || []).filter(f => !f.parent_id)
        },

        folderChildren(state) {
            return (parentId) => ({
                folders: (state.folders || []).filter(f => f.parent_id === parentId),
                conversations: (state.conversations || []).filter(c => c.folder_id === parentId),
            })
        },
    },

    actions: {
        // ─── helpers ───
        _useServerApi() {
            // Data stored on server disk (bbot.db) via API.
            // Local sql.js is the fallback if server is unreachable.
            return true
        },

        _hydrateMsg(m) {
            let files = []
            let designs = []
            let downloadFiles = []
            let sideQuest = null
            if (m.files && m.files !== '[]') {
                try { files = JSON.parse(m.files) } catch {}
            }
            if (m.designs && m.designs !== '[]') {
                try { designs = JSON.parse(m.designs) } catch {}
            }
            // Support both download_files (DB column) and downloadFiles (API response)
            const dlRaw = m.download_files || m.downloadFiles || '[]'
            if (dlRaw && dlRaw !== '[]') {
                try { downloadFiles = JSON.parse(dlRaw) } catch {}
            }
            // Parse side_quest (persisted follow-up Q&A)
            if (m.side_quest && m.side_quest !== '' && m.side_quest !== 'null') {
                try { sideQuest = JSON.parse(m.side_quest) } catch {}
            }
            return { ...m, files, designs, _downloadFiles: downloadFiles, reasoning: m.reasoning || '', _sideQuest: sideQuest }
        },

        _initBranch(msgs) {
            const bs = {}
            for (const m of msgs) {
                if (m.role === 'ai' && m.parent_id != null) {
                    bs[m.parent_id] = m.id
                }
            }
            return bs
        },

        // ─── session persistence ───
        _saveSession() {
            try {
                const data = {
                    currentId: this.currentId,
                    openTabs: this.openTabs,
                    branchStateMap: this.branchStateMap,
                    expandedFolders: this.expandedFolders,
                }
                localStorage.setItem('ds_session', JSON.stringify(data))
            } catch {}
        },

        async _restoreSession() {
            try {
                const raw = localStorage.getItem('ds_session')
                const data = raw ? JSON.parse(raw) : {}
                if (data.branchStateMap) this.branchStateMap = data.branchStateMap
                if (data.expandedFolders) this.expandedFolders = data.expandedFolders

                // Try server API first, fallback to local sql.js
                let localConvs = []
                if (this._useServerApi()) {
                    try {
                        localConvs = await convApi.list() || []
                        this.conversations = localConvs
                    } catch (e) {
                        console.warn('[Session] Server load failed, using local:', e.message)
                        localConvs = getConversations()
                        if (localConvs.length) this.conversations = localConvs
                    }
                } else {
                    localConvs = getConversations()
                    if (localConvs.length) this.conversations = localConvs
                }

                // Restore tabs from session
                if (data.openTabs && data.openTabs.length) {
                    const ids = this.conversations.map(c => c.id)
                    this.openTabs = data.openTabs.filter(id => ids.includes(id))
                }
                if (data.currentId && this.conversations.some(c => c.id === data.currentId)) {
                    this.currentId = data.currentId
                    await this._loadConvMessages(data.currentId)
                }
                for (const tid of this.openTabs) {
                    if (!this.messagesMap[tid]) {
                        await this._loadConvMessages(tid)
                    }
                }
            } catch (e) {
                console.warn('[Session] restore failed:', e.message)
            }
        },

        async _loadConvMessages(convId) {
            if (this._useServerApi()) {
                try {
                    const msgs = await convApi.messages(convId) || []
                    this.messagesMap[convId] = msgs.map(m => this._hydrateMsg(m))
                    this.branchStateMap[convId] = this._initBranch(msgs)
                    return
                } catch (e) {
                    console.warn('[Session] API messages load failed:', e.message)
                }
            }
            // Fallback to local sql.js
            const msgs = getMessages(convId).map(m => this._hydrateMsg(m))
            this.messagesMap[convId] = msgs
            this.branchStateMap[convId] = this._initBranch(msgs)
        },

        // ─── conversation ───
        async createConversation(id, folderId = null) {
            if (!this.apikey) this.loadApiKey()
            if (this._useServerApi()) {
                try {
                    await convApi.create(id, this.model)
                } catch (e) {
                    console.warn('[Store] API create conv failed, using local:', e.message)
                    dbCreateConv(id, this.model, folderId)
                }
            } else {
                dbCreateConv(id, this.model, folderId)
            }
            this.currentId = id
            await this._loadConvMessages(id)
            this.conversations = this._useServerApi()
                ? ((await convApi.list().catch(() => getConversations())) || [])
                : getConversations()
            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
            this._saveSession()
        },

        async loadMessages(id) {
            const existing = this.messagesMap[id]
            if (existing && existing.length > 0) {
                this.currentId = id
                if (!this.openTabs.includes(id)) {
                    this.openTabs.push(id)
                }
                this._saveSession()
                return
            }
            await this._loadConvMessages(id)
            this.currentId = id
            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
            this._saveSession()
        },

        async loadConversations() {
            if (this._useServerApi()) {
                try {
                    this.conversations = await convApi.list() || []
                    this.folders = await foldersApi.list().catch(() => getFolders())
                    return
                } catch (e) {
                    console.warn('[Store] API load convs failed:', e.message)
                }
            }
            this.conversations = getConversations()
            this.folders = getFolders()
        },

        async deleteConv(id) {
            if (this._useServerApi()) {
                try { await convApi.delete(id) } catch {}
            }
            deleteConversation(id)
            delete this.messagesMap[id]
            delete this.branchStateMap[id]
            this.openTabs = this.openTabs.filter(t => t !== id)
            if (this.currentId === id) {
                this.currentId = null
            }
            this.conversations = this._useServerApi()
                ? ((await convApi.list().catch(() => getConversations())) || [])
                : getConversations()
            this._saveSession()
        },

        updateConvTitle(id, title) {
            updateConversationTitle(id, title)
            const conv = this.conversations.find(c => c.id === id)
            if (conv) {
                conv.title = title
            }
            this.conversations = [...this.conversations]
            if (id === this.currentId) {
                document.title = title + ' - Agent Chat'
            }
            // Also update on server
            if (this._useServerApi()) {
                convApi.updateTitle(id, title).catch(() => {})
            }
        },

        // ─── tabs ───
        async switchTab(id) {
            if (id === this.currentId) return
            if (!this.messagesMap[id]) {
                await this._loadConvMessages(id)
            }
            this.currentId = id
            if (!this.openTabs.includes(id)) {
                this.openTabs.push(id)
            }
            const conv = this.conversations.find(c => c.id === id)
            document.title = (conv?.title || '新对话') + ' - Agent Chat'
            this._saveSession()
        },

        closeTab(id) {
            this.openTabs = this.openTabs.filter(t => t !== id)
            if (this.currentId === id) {
                const next = this.openTabs.length > 0 ? this.openTabs[0] : null
                if (next) {
                    this.switchTab(next)
                } else {
                    this.currentId = null
                }
            }
            this._saveSession()
        },

        // ─── messages ───
        async addUserMessage(text, files = []) {
            if (!this.currentId) return null
            const filesJson = JSON.stringify(files)

            // ALWAYS use local sql.js first — synchronous, gets real ID immediately.
            // This is critical: ChatView calls addUserMessage() without await,
            // then immediately calls startStreamReply() which must find this message.
            const newId = addMessage(this.currentId, 'user', text, null, filesJson)
            const msg = { role: 'user', text, id: newId, files }
            const msgs = this.messagesMap[this.currentId] || []
            msgs.push(msg)
            this.messagesMap[this.currentId] = msgs
            this._saveSession()

            // Sync to server API in background (don't block the UI)
            if (this._useServerApi()) {
                convApi.addMessage(this.currentId, {
                    role: 'user', text, parent_id: null, files: filesJson
                }).catch(() => {})
            }

            return msg
        },

        startStreamReply(convId) {
            const cid = convId || this.currentId
            const tempId = 'stream_' + Date.now()
            this.streamingConvId = cid
            let parentId = null
            const msgs = this.messagesMap[cid] || []
            for (let i = msgs.length - 1; i >= 0; i--) {
                if (msgs[i].role === 'user') {
                    parentId = msgs[i].id
                    break
                }
            }
            msgs.push({
                role: 'ai', text: '', reasoning: '', id: tempId,
                streaming: true, parent_id: parentId,
                _liveSvg: '', _rawText: '', designs: [], _agentEvents: [],
                _downloadFiles: [], _devicePicker: false, _designSummary: '',
                _sideQuest: null,
            })
            this.messagesMap[cid] = msgs
            this.streamingId = tempId
            return tempId
        },

        _findStreamMsg(tempId) {
            for (const convId of Object.keys(this.messagesMap)) {
                const msgs = this.messagesMap[convId]
                const found = msgs.find(m => m.id === tempId)
                if (found) return { msg: found, msgs, convId }
            }
            return null
        },

        appendStreamText(tempId, fullText) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.text = fullText
        },

        appendStreamReasoning(tempId, text) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.reasoning = sanitizeReasoning(text)
        },

        appendStreamDesignProgress(tempId, pct) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.designProgress = pct
        },

        updateStreamDesign(tempId, designs) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.designs = [...designs]
        },

        updateStreamRawText(tempId, raw) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg._rawText = raw
        },

        updateStreamCleanText(tempId, cleanText) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg.text = cleanText
        },

        // Live SVG rendering during streaming — "一笔一笔画" box
        updateStreamLiveSvg(tempId, svgContent) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg._liveSvg = svgContent
        },

        updateStreamAgentEvents(tempId, events) {
            const r = this._findStreamMsg(tempId)
            if (r) r.msg._agentEvents = [...events]
        },

        async finishStreamReply(tempId) {
            const r = this._findStreamMsg(tempId)
            if (!r) {
                this.streamingId = null
                this.streamingConvId = null
                return null
            }
            const { msg, msgs, convId } = r
            const designsJson = JSON.stringify(msg.designs || [])
            const reasoning = msg.reasoning || ''
            const sideQuestJson = JSON.stringify(msg._sideQuest || null)
            const downloadFilesJson = JSON.stringify(msg._downloadFiles || [])

            // ALWAYS save locally first (synchronous, gets real ID immediately)
            const realId = addMessage(convId, 'ai', msg.text, msg.parent_id, '[]', designsJson, reasoning, downloadFilesJson, sideQuestJson)

            // Sync to server API in background
            if (this._useServerApi()) {
                convApi.addMessage(convId, {
                    role: 'ai', text: msg.text, parent_id: msg.parent_id,
                    files: '[]', designs: designsJson, reasoning,
                    downloadFiles: downloadFilesJson, sideQuest: sideQuestJson
                }).catch(() => {})
            }

            const idx = msgs.findIndex(m => m.id === tempId)
            const finalMsg = {
                role: 'ai', text: msg.text, reasoning,
                id: realId, parent_id: msg.parent_id,
                designs: msg.designs || [],
                _rawText: msg._rawText || '',
                _agentEvents: msg._agentEvents || [],
                _downloadFiles: msg._downloadFiles || [],
                _devicePicker: msg._devicePicker || false,
                _designSummary: msg._designSummary || '',
                _isSystemFallback: msg._isSystemFallback || false,
                _liveSvg: msg._liveSvg || '',
                _sideQuest: msg._sideQuest || null,
            }
            if (idx !== -1) {
                msgs[idx] = finalMsg
            }
            this.messagesMap[convId] = [...msgs]
            if (msg.parent_id != null) {
                const bs = this.branchStateMap[convId] || {}
                bs[msg.parent_id] = realId
                this.branchStateMap[convId] = { ...bs }
            }
            this.streamingId = null
            this.streamingConvId = null
            this._lastFinishedId = realId
            this._lastFinishedMsg = finalMsg
            this._saveSession()
            return realId
        },

        // ─── Side Quest (侧边提问) ───
        setSideQuest(msgId, data) {
            const convId = this.currentId
            const msgs = this.messagesMap[convId] || []
            const msg = msgs.find(m => m.id === msgId)
            if (!msg) return
            msg._sideQuest = data
            const json = data ? JSON.stringify(data) : ''
            updateMessageSideQuest(msgId, json)
        },

        // ─── branch navigation ───
        siblingInfo(parentId, msgId) {
            if (parentId == null) return { count: 1, index: 1 }
            const msgs = this.messagesMap[this.currentId] || []
            const siblings = msgs
                .filter(m => m.role === 'ai' && m.parent_id === parentId && !m.streaming)
                .sort((a, b) => a.id - b.id)
            if (siblings.length <= 1) return { count: 1, index: 1 }
            const idx = siblings.findIndex(s => s.id === msgId)
            return { count: siblings.length, index: idx >= 0 ? idx + 1 : 1 }
        },

        switchBranch(parentId, direction) {
            if (parentId == null) return
            const msgs = this.messagesMap[this.currentId] || []
            const siblings = msgs
                .filter(m => m.role === 'ai' && m.parent_id === parentId)
                .sort((a, b) => a.id - b.id)
            if (siblings.length <= 1) return
            const bs = this.branchStateMap[this.currentId] || {}
            const current = bs[parentId]
            const idx = siblings.findIndex(s => s.id === current)
            const newIdx = direction === 'next'
                ? (idx + 1) % siblings.length
                : (idx - 1 + siblings.length) % siblings.length
            bs[parentId] = siblings[newIdx].id
            this.branchStateMap[this.currentId] = { ...bs }
            this._saveSession()
        },

        // ─── message operations ───
        appendToMessage(id, text) {
            const msgs = this.messagesMap[this.currentId] || []
            const msg = msgs.find(m => m.id === id)
            if (msg) msg.text += text
        },

        updateMessageText(id, text) {
            const msgs = this.messagesMap[this.currentId] || []
            const msg = msgs.find(m => m.id === id)
            if (msg) msg.text = text
        },

        editMessage(id, text) {
            updateMessage(id, text)
            if (this._useServerApi() && this.currentId) {
                convApi.updateMessage(this.currentId, id, text).catch(() => {})
            }
            const msgs = this.messagesMap[this.currentId] || []
            const msg = msgs.find(m => m.id === id)
            if (msg) msg.text = text
        },

        removeMessage(id) {
            deleteMessage(id)
            if (this._useServerApi() && this.currentId) {
                convApi.deleteMessage(this.currentId, id).catch(() => {})
            }
            const msgs = this.messagesMap[this.currentId] || []
            this.messagesMap[this.currentId] = msgs.filter(m => m.id !== id)
            const bs = { ...(this.branchStateMap[this.currentId] || {}) }
            let changed = false
            for (const [pid, mid] of Object.entries(bs)) {
                if (mid === id) { delete bs[pid]; changed = true }
            }
            if (changed) this.branchStateMap[this.currentId] = bs
            this._saveSession()
        },

        truncateAfter(messageId) {
            if (!this.currentId) return
            deleteMessagesSince(this.currentId, messageId)
            if (this._useServerApi()) {
                convApi.truncate(this.currentId, messageId).catch(() => {})
            }
            const msgs = this.messagesMap[this.currentId] || []
            const idx = msgs.findIndex(m => m.id === messageId)
            if (idx !== -1) {
                this.messagesMap[this.currentId] = msgs.slice(0, idx + 1)
            }
        },

        // ─── loading (per-conversation) ───
        setLoading(val, convId) {
            const cid = convId || this.currentId
            this.loadingMap = { ...this.loadingMap, [cid]: val }
        },
        isLoadingFor(convId) {
            return !!this.loadingMap[convId || this.currentId]
        },

        // ─── API key & model ───
        setApiKey(key) {
            this.apikey = key
            localStorage.setItem('apikey', key)
        },

        loadApiKey() {
            const savedKey = localStorage.getItem('apikey')
            this.apikey = savedKey || ''
            const savedModel = localStorage.getItem('model')
            if (savedModel) this.model = savedModel
            const savedMode = localStorage.getItem('permissionMode')
            if (savedMode) this.permissionMode = savedMode
        },

        setModel(model) {
            this.model = model
            localStorage.setItem('model', model)
        },

        setPermissionMode(mode) {
            this.permissionMode = mode
            localStorage.setItem('permissionMode', mode)
        },

        // ─── folder CRUD ───
        async loadFolders() {
            this.folders = getFolders()
        },

        async createFolder(name, parentId = null) {
            const id = 'folder_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
            dbCreateFolder(id, name, parentId)
            if (this._useServerApi()) {
                foldersApi.create(name, parentId).catch(() => {})
            }
            this.folders = getFolders()
            if (parentId) {
                this.expandedFolders[parentId] = true
            }
            this._saveSession()
            return id
        },

        renameFolder(id, name) {
            dbRenameFolder(id, name)
            if (this._useServerApi()) {
                foldersApi.rename(id, name).catch(() => {})
            }
            const f = this.folders.find(x => x.id === id)
            if (f) f.name = name
            this.folders = [...this.folders]
            this._saveSession()
        },

        deleteFolder(id) {
            const getDescendants = (pid) => {
                const children = this.folders.filter(f => f.parent_id === pid)
                let ids = children.map(f => f.id)
                for (const c of children) {
                    ids = ids.concat(getDescendants(c.id))
                }
                return ids
            }
            const descIds = getDescendants(id)

            dbDeleteFolder(id)
            if (this._useServerApi()) {
                foldersApi.delete(id).catch(() => {})
            }
            this.folders = getFolders()
            this.conversations = getConversations()
            delete this.expandedFolders[id]
            for (const did of descIds) {
                delete this.expandedFolders[did]
            }
            this._saveSession()
        },

        moveConversation(convId, folderId) {
            dbMoveConversation(convId, folderId)
            const conv = this.conversations.find(c => c.id === convId)
            if (conv) {
                conv.folder_id = folderId || null
            }
            this.conversations = [...this.conversations]
            this._saveSession()
        },

        moveFolder(folderId, newParentId) {
            dbMoveFolder(folderId, newParentId)
            if (this._useServerApi()) {
                foldersApi.move(folderId, newParentId).catch(() => {})
            }
            const f = this.folders.find(x => x.id === folderId)
            if (f) {
                f.parent_id = newParentId || null
            }
            this.folders = [...this.folders]
            this._saveSession()
        },

        toggleFolderExpanded(id) {
            this.expandedFolders = {
                ...this.expandedFolders,
                [id]: !this.expandedFolders[id]
            }
            this._saveSession()
        },

        // ─── abort controller (per-conversation) ───
        setAbortController(ctrl, convId) {
            const cid = convId || this.currentId
            _abortMap[cid] = ctrl
        },

        abort(convId) {
            const cid = convId || this.currentId
            const ctrl = _abortMap[cid]
            if (ctrl) {
                ctrl.abort()
                delete _abortMap[cid]
            }
        },
    }
})
