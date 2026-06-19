// ══════════════════════════════════════
// Agent Conversation Store — persistence + tabs
// ══════════════════════════════════════

import { defineStore } from 'pinia'
import {
  createAgentConversation as dbCreate,
  getAgentConversations,
  getAgentMessages,
  addAgentMessage,
  updateAgentMessage,
  updateAgentConversationTitle,
  deleteAgentConversation,
} from '../db/database.js'
import { agentConversations as agentApi } from '../api/index.js'

let _serverAvailable = true

export const useAgentConversationStore = defineStore('agentConversation', {
  state: () => ({
    conversations: [],       // [{ id, title, created_at }] — all conversations
    currentId: null,         // active conversation id
    openTabs: [],            // [id, ...] — ordered list of open tabs
    messagesMap: {},         // { [id]: message[] } — cached messages per conversation
  }),

  getters: {
    messages(state) {
      return state.messagesMap[state.currentId] || []
    },

    openTabList(state) {
      return state.openTabs.map(id => {
        const conv = state.conversations.find(c => c.id === id)
        return { id, title: conv?.title || 'Agent 对话' }
      })
    },
  },

  actions: {
    // ─── Load conversation list ───
    loadConversations() {
      this.conversations = getAgentConversations()
    },

    // ─── Create new conversation ───
    async createConversation(title) {
      const id = 'ag_' + Date.now()
      dbCreate(id, title || 'Agent 对话')
      if (_serverAvailable) {
        agentApi.create(id, title || 'Agent 对话').catch(() => { _serverAvailable = false })
      }
      this.conversations = getAgentConversations()
      this.currentId = id
      this.messagesMap[id] = []
      if (!this.openTabs.includes(id)) this.openTabs.push(id)
      this._saveSession()
      return id
    },

    // ─── Open existing conversation ───
    openConversation(id) {
      if (this.messagesMap[id]) {
        // Already cached
      } else {
        const rows = getAgentMessages(id)
        this.messagesMap[id] = rows.map(r => ({
          id: r.id,
          _id: r.role + '_' + r.id,
          role: r.role,
          text: r.text || '',
          html: r.text || '',
          events: safeParse(r.events),
          finalOutput: r.role === 'agent-progress' ? (r.text || '') : '',
          running: false,
          startTime: 0,
          thinking: '',
          thinkingOpen: false,
        }))
      }
      this.currentId = id
      if (!this.openTabs.includes(id)) this.openTabs.push(id)
      this._saveSession()
    },

    // ─── Switch tab ───
    switchTab(id) {
      if (id === this.currentId) return
      if (!this.messagesMap[id]) this.openConversation(id)
      this.currentId = id
      this._saveSession()
    },

    // ─── Mark conversation as interrupted ───
    markInterrupted(id) {
      const msgs = this.messagesMap[id] || []
      for (const m of msgs) {
        if (m.role === 'agent-progress' && m.running !== false) {
          m.running = false
          m.interrupted = true
        }
      }
      this.messagesMap[id] = [...msgs]
    },

    // ─── Close tab ───
    closeTab(id) {
      this.openTabs = this.openTabs.filter(t => t !== id)
      if (this.currentId === id) {
        this.currentId = this.openTabs.length ? this.openTabs[0] : null
      }
      this._saveSession()
    },

    // ─── Push message to current conversation ───
    pushMessage(msg) {
      if (!this.currentId) return
      const msgs = this.messagesMap[this.currentId] || []
      msgs.push(msg)
      this.messagesMap[this.currentId] = [...msgs]
    },

    // ─── Add user message and persist ───
    addUserMessage(text) {
      if (!this.currentId) return -1
      addAgentMessage(this.currentId, 'user', text, '[]')
      if (_serverAvailable) {
        agentApi.addMessage(this.currentId, { role: 'user', text, events: '[]' }).catch(() => { _serverAvailable = false })
      }
      const rows = getAgentMessages(this.currentId)
      const last = rows[rows.length - 1]
      return last ? last.id : -1
    },

    addProgressMessage(events) {
      if (!this.currentId) return -1
      addAgentMessage(this.currentId, 'agent-progress', '', JSON.stringify(events || []))
      if (_serverAvailable) {
        agentApi.addMessage(this.currentId, { role: 'agent-progress', text: '', events: JSON.stringify(events || []) }).catch(() => { _serverAvailable = false })
      }
      const rows = getAgentMessages(this.currentId)
      const last = rows[rows.length - 1]
      return last ? last.id : -1
    },

    addAiMessage(text) {
      if (!this.currentId) return -1
      addAgentMessage(this.currentId, 'ai', text, '[]')
      if (_serverAvailable) {
        agentApi.addMessage(this.currentId, { role: 'ai', text, events: '[]' }).catch(() => { _serverAvailable = false })
      }
      const rows = getAgentMessages(this.currentId)
      const last = rows[rows.length - 1]
      return last ? last.id : -1
    },

    updateMessageText(dbId, text, events) {
      if (!dbId || dbId < 0) return
      updateAgentMessage(dbId, text, events || '[]')
      if (_serverAvailable) {
        agentApi.updateMessage(this.currentId, dbId, { text, events: events || '[]' }).catch(() => { _serverAvailable = false })
      }
    },

    renameConversation(id, title) {
      updateAgentConversationTitle(id, title)
      if (_serverAvailable) {
        agentApi.update(id, { title }).catch(() => { _serverAvailable = false })
      }
      this.conversations = getAgentConversations()
    },

    deleteConversation(id) {
      deleteAgentConversation(id)
      if (_serverAvailable) {
        agentApi.delete(id).catch(() => { _serverAvailable = false })
      }
      this.conversations = getAgentConversations()
      delete this.messagesMap[id]
      this.openTabs = this.openTabs.filter(t => t !== id)
      if (this.currentId === id) {
        this.currentId = this.openTabs.length ? this.openTabs[0] : null
      }
      this._saveSession()
    },

    // ─── Session persistence (tabs/currentId survive refresh) ───
    _saveSession() {
      try {
        localStorage.setItem('ag_session', JSON.stringify({
          currentId: this.currentId,
          openTabs: this.openTabs,
        }))
      } catch { /* ignore */ }
    },

    restoreSession() {
      try {
        const raw = localStorage.getItem('ag_session')
        if (!raw) return
        const data = JSON.parse(raw)
        this.conversations = getAgentConversations()
        if (data.openTabs?.length) {
          // Restore tabs — only keep ones that still exist in DB
          const existing = this.conversations.map(c => c.id)
          this.openTabs = data.openTabs.filter(id => existing.includes(id))
        }
        if (data.currentId && this.openTabs.length) {
          const exists = this.conversations.some(c => c.id === data.currentId)
          if (exists) {
            this.openConversation(data.currentId)
          } else if (this.openTabs.length) {
            this.openConversation(this.openTabs[0])
          }
        }
      } catch { /* ignore */ }
    },
  },
})

function safeParse(s) {
  try { return JSON.parse(s) } catch { return [] }
}
