const BASE = '/api'

function getToken() {
  return localStorage.getItem('bbot_token')
}

function getApiKey() {
  return localStorage.getItem('apikey') || ''
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...options.headers,
  }
  const res = await fetch(BASE + path, { ...options, headers })
  const body = await res.json()
  // Handle new unified response format {success, data/error}
  const data = body && typeof body === 'object' && 'success' in body ? body.data : body
  const errorMsg = body?.error?.message || body?.error
  if (res.status === 401) {
    localStorage.removeItem('bbot_token')
    localStorage.removeItem('bbot_user')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new Error(errorMsg || '登录已过期')
  }
  if (!res.ok) throw new Error(errorMsg || '请求失败')
  return data
}

// Auth
export const auth = {
  register(name, password) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, password })
    })
  },
  login(name, password) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ name, password })
    })
  },
  me() {
    return request('/auth/me')
  }
}

// Users
export const users = {
  search(q) {
    return request('/users/search?q=' + encodeURIComponent(q))
  },
  online() {
    return request('/users/online')
  }
}

// Friends
export const friends = {
  list() {
    return request('/friends')
  },
  add(friendName) {
    return request('/friends/add', {
      method: 'POST',
      body: JSON.stringify({ friendName })
    })
  },
  accept(friendId) {
    return request('/friends/accept', {
      method: 'POST',
      body: JSON.stringify({ friendId })
    })
  },
  reject(friendId) {
    return request('/friends/reject', {
      method: 'POST',
      body: JSON.stringify({ friendId })
    })
  },
  remove(friendId) {
    return request('/friends/' + friendId, { method: 'DELETE' })
  }
}

// DM
export const dm = {
  history(friendId, before) {
    let url = '/dm/' + friendId
    if (before) url += '?before=' + before
    return request(url)
  },
  send(friendId, text, aiReply) {
    return request('/dm/' + friendId, {
      method: 'POST',
      body: JSON.stringify({ text, aiReply: aiReply || null })
    })
  }
}

// Groups
export const groups = {
  myList() {
    return request('/groups')
  },
  all() {
    return request('/groups/all')
  },
  create(name) {
    return request('/groups', {
      method: 'POST',
      body: JSON.stringify({ name })
    })
  },
  join(code) {
    return request('/groups/join', {
      method: 'POST',
      body: JSON.stringify({ code })
    })
  },
  detail(id) {
    return request('/groups/' + id)
  },
  messages(id, before) {
    let url = '/groups/' + id + '/messages'
    if (before) url += '?before=' + before
    return request(url)
  },
  leave(id) {
    return request('/groups/' + id + '/leave', { method: 'POST' })
  }
}

// AI
export const ai = {
  async chat(messages, model) {
    const { getApiHeaders } = await import('../utils/apiHeaders.js')
    const res = await fetch(BASE + '/ai/chat', {
      method: 'POST',
      headers: getApiHeaders({
        'Authorization': 'Bearer ' + getToken(),
      }),
      body: JSON.stringify({ messages, model: model || 'deepseek-v4-flash' })
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body?.error?.message || body?.error || 'AI 请求失败')
    // Unwrap new unified format {success, data: {reply}}
    const data = body && typeof body === 'object' && 'success' in body ? body.data : body
    return data.reply
  },
  async chatStream(messages, model, onChunk, onDone, onError) {
    try {
      const { getApiHeaders } = await import('../utils/apiHeaders.js')
      const res = await fetch(BASE + '/ai/chat/stream', {
        method: 'POST',
        headers: getApiHeaders({
          'Authorization': 'Bearer ' + getToken(),
        }),
        body: JSON.stringify({ messages, model: model || 'deepseek-v4-flash' })
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'AI 请求失败')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) { onError && onError(new Error(parsed.error)); return }
            const delta = parsed.choices?.[0]?.delta
            // DeepSeek uses reasoning_content for actual text, content may be null
            const text = delta?.content || delta?.reasoning_content || ''
            if (text) {
              fullText += text
              onChunk && onChunk(fullText, text)
            }
          } catch {}
        }
      }
      onDone && onDone(fullText)
      return fullText
    } catch (e) {
      onError && onError(e)
    }
  }
}

// Conversations (AI chat history)
export const conversations = {
  list() {
    return request('/conversations')
  },
  create(id, model) {
    return request('/conversations', {
      method: 'POST',
      body: JSON.stringify({ id, model })
    })
  },
  get(id) {
    return request('/conversations/' + id)
  },
  updateTitle(id, title) {
    return request('/conversations/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ title })
    })
  },
  moveToFolder(id, folderId) {
    return request('/conversations/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ folderId })
    })
  },
  delete(id) {
    return request('/conversations/' + id, { method: 'DELETE' })
  },
  messages(id) {
    return request('/conversations/' + id + '/messages')
  },
  addMessage(convId, data) {
    return request('/conversations/' + convId + '/messages', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  updateMessage(convId, msgId, text) {
    return request('/conversations/' + convId + '/messages/' + msgId, {
      method: 'PATCH',
      body: JSON.stringify({ text })
    })
  },
  deleteMessage(convId, msgId) {
    return request('/conversations/' + convId + '/messages/' + msgId, { method: 'DELETE' })
  },
  truncate(convId, sinceId) {
    return request('/conversations/' + convId + '/truncate', {
      method: 'POST',
      body: JSON.stringify({ sinceId })
    })
  },
  exportAll() {
    return request('/conversations/export/all')
  },
  importAll(data) {
    return request('/conversations/import', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }
}

// Code Conversations
export const codeConversations = {
  list() {
    return request('/code-conversations')
  },
  create(id, title, projectPath, projectName) {
    return request('/code-conversations', {
      method: 'POST',
      body: JSON.stringify({ id, title, projectPath, projectName })
    })
  },
  get(id) {
    return request('/code-conversations/' + id)
  },
  update(id, data) {
    return request('/code-conversations/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
  delete(id) {
    return request('/code-conversations/' + id, { method: 'DELETE' })
  },
  messages(id) {
    return request('/code-conversations/' + id + '/messages')
  },
  addMessage(convId, data) {
    return request('/code-conversations/' + convId + '/messages', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  updateMessage(convId, msgId, data) {
    return request('/code-conversations/' + convId + '/messages/' + msgId, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
}

// Agent Conversations
export const agentConversations = {
  list() {
    return request('/agent-conversations')
  },
  create(id, title) {
    return request('/agent-conversations', {
      method: 'POST',
      body: JSON.stringify({ id, title })
    })
  },
  get(id) {
    return request('/agent-conversations/' + id)
  },
  update(id, data) {
    return request('/agent-conversations/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
  delete(id) {
    return request('/agent-conversations/' + id, { method: 'DELETE' })
  },
  messages(id) {
    return request('/agent-conversations/' + id + '/messages')
  },
  addMessage(convId, data) {
    return request('/agent-conversations/' + convId + '/messages', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  updateMessage(convId, msgId, data) {
    return request('/agent-conversations/' + convId + '/messages/' + msgId, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
}

// Collections (server API)
export const collectionsApi = {
  list() {
    return request('/collections')
  },
  create(name) {
    const id = 'col_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    return request('/collections', {
      method: 'POST',
      body: JSON.stringify({ id, name })
    })
  },
  rename(id, name) {
    return request('/collections/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    })
  },
  delete(id) {
    return request('/collections/' + id, { method: 'DELETE' })
  },
  findByName(name) {
    return request('/collections/find-by-name?name=' + encodeURIComponent(name))
  },
  // Items
  getItems(collectionId) {
    const qs = collectionId ? '?collection_id=' + collectionId : ''
    return request('/collection-items' + qs)
  },
  getAllItems() {
    return request('/collection-items/all')
  },
  searchItems(q) {
    return request('/collection-items/search?q=' + encodeURIComponent(q))
  },
  saveItem(collectionId, msgJson, preview) {
    return request('/collection-items', {
      method: 'POST',
      body: JSON.stringify({ collection_id: collectionId || null, msg_json: msgJson, preview })
    })
  },
  isDuplicate(collectionId, msgJson) {
    return request('/collection-items/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ collection_id: collectionId || null, msg_json: msgJson })
    })
  },
  updateItem(itemId, msgJson, preview) {
    return request('/collection-items/' + itemId, {
      method: 'PATCH',
      body: JSON.stringify({ msg_json: msgJson, preview })
    })
  },
  deleteItem(itemId) {
    return request('/collection-items/' + itemId, { method: 'DELETE' })
  },
  moveItem(itemId, newCollectionId) {
    return request('/collection-items/' + itemId + '/move', {
      method: 'POST',
      body: JSON.stringify({ new_collection_id: newCollectionId })
    })
  },
}

// Folders
export const foldersApi = {
  list() {
    return request('/folders')
  },
  create(name, parentId) {
    const id = 'fld_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
    return request('/folders', {
      method: 'POST',
      body: JSON.stringify({ id, name, parent_id: parentId || null })
    })
  },
  rename(id, name) {
    return request('/folders/' + id, {
      method: 'PATCH',
      body: JSON.stringify({ name })
    })
  },
  delete(id) {
    return request('/folders/' + id, { method: 'DELETE' })
  },
  move(id, newParentId) {
    return request('/folders/' + id + '/move', {
      method: 'POST',
      body: JSON.stringify({ new_parent_id: newParentId || null })
    })
  },
}

// Local Auth
export const localAuth = {
  async login() {
    const res = await fetch('/api/auth/local', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    const body = await res.json()
    if (!res.ok) throw new Error(body?.error?.message || body?.error || '本地登录失败')
    const data = body && typeof body === 'object' && 'success' in body ? body.data : body
    if (data.token) {
      localStorage.setItem('bbot_token', data.token)
      localStorage.setItem('bbot_user', JSON.stringify(data.user || { id: 'local-user', name: '本地用户' }))
    }
    return data
  }
}

export function isLoggedIn() {
  // (#17 fix) apikey is an API key for the upstream model provider, NOT an
  // auth token — having an apikey set does not mean the user is logged in.
  // Only the JWT token (bbot_token) proves authentication.
  return !!getToken()
}

export function logout() {
  localStorage.removeItem('bbot_token')
  localStorage.removeItem('bbot_user')
}

export function saveAuth(token, user) {
  localStorage.setItem('bbot_token', token)
  localStorage.setItem('bbot_user', JSON.stringify(user))
}

export function getSavedUser() {
  try {
    const raw = localStorage.getItem('bbot_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

// ═══════════════════════════════════════════
// Novels — AI-written novels with chapters & pages
// ═══════════════════════════════════════════
export const novels = {
  list() {
    return request('/novels')
  },
  get(id) {
    return request('/novels/' + id)
  },
  create(data) {
    return request('/novels', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  update(id, data) {
    return request('/novels/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
  delete(id) {
    return request('/novels/' + id, { method: 'DELETE' })
  },
  listChapters(novelId) {
    return request('/novels/' + novelId + '/chapters')
  },
  createChapter(novelId, data) {
    return request('/novels/' + novelId + '/chapters', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  updateChapter(id, data) {
    return request('/novels/chapters/' + id, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
  deleteChapter(id) {
    return request('/novels/chapters/' + id, { method: 'DELETE' })
  },
  listPages(chapterId) {
    return request('/novels/chapters/' + chapterId + '/pages')
  },
  /**
   * Generate novel via SSE stream.
   * @param {string} novelId
   * @param {object} opts { chapters, wordsPerChapter, model, prompt }
   * @param {function} onEvent callback(event)
   * @param {AbortSignal} signal
   */
  async generate(novelId, opts, onEvent, signal) {
    const token = getToken()
    const res = await fetch(BASE + '/novels/' + novelId + '/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      body: JSON.stringify(opts || {}),
      signal,
    })
    if (!res.ok) throw new Error('生成失败: ' + res.status)
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const t = line.trim()
        if (t.startsWith('data:')) {
          try { onEvent(JSON.parse(t.slice(5).trim())) } catch {}
        }
      }
    }
  },
}

// ═══════════════════════════════════════════
// DS Agents — Multi-agent group chat
// ═══════════════════════════════════════════
export const dsAgents = {
  templates() {
    return request('/ds/templates')
  },
  listByRoom(roomId) {
    return request('/ds/rooms/' + roomId + '/agents')
  },
  roomStatus(roomId) {
    return request('/ds/rooms/' + roomId + '/status')
  },
  create(roomId, data) {
    return request('/ds/rooms/' + roomId + '/agents', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  routeMessage(roomId, text, triggeredBy) {
    return request('/ds/rooms/' + roomId + '/route', {
      method: 'POST',
      body: JSON.stringify({ text, triggeredBy })
    })
  },
  roomTasks(roomId) {
    return request('/ds/rooms/' + roomId + '/tasks')
  },
  getMemory(roomId) {
    return request('/ds/rooms/' + roomId + '/memory')
  },
  setMemory(roomId, key, value, agentId) {
    return request('/ds/rooms/' + roomId + '/memory', {
      method: 'POST',
      body: JSON.stringify({ key, value, agentId })
    })
  },
  agentDetail(agentId) {
    return request('/ds/agents/' + agentId)
  },
  updateAgent(agentId, data) {
    return request('/ds/agents/' + agentId, {
      method: 'PATCH',
      body: JSON.stringify(data)
    })
  },
  deleteAgent(agentId) {
    return request('/ds/agents/' + agentId, { method: 'DELETE' })
  },
  triggerTask(agentId, task, triggeredBy) {
    return request('/ds/agents/' + agentId + '/task', {
      method: 'POST',
      body: JSON.stringify({ task, triggeredBy })
    })
  },
  agentTasks(agentId) {
    return request('/ds/agents/' + agentId + '/tasks')
  },
  taskProgress(taskId) {
    return request('/ds/tasks/' + taskId + '/progress')
  },
  abortTask(taskId) {
    return request('/ds/tasks/' + taskId + '/abort', { method: 'POST' })
  },
  abortAgent(agentId) {
    return request('/ds/agents/' + agentId + '/abort', { method: 'POST' })
  },
  // ─── 定时任务 ───
  listSchedules(roomId) {
    return request('/ds/rooms/' + roomId + '/schedules')
  },
  addSchedule(roomId, data) {
    return request('/ds/rooms/' + roomId + '/schedules', { method: 'POST', body: JSON.stringify(data) })
  },
  deleteSchedule(scheduleId) {
    return request('/ds/schedules/' + scheduleId, { method: 'DELETE' })
  },
  deleteMemory(memoryId) {
    return request('/ds/memory/' + memoryId, { method: 'DELETE' })
  },
}
