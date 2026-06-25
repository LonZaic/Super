// ═══════════════════════════════════════════════════════════════════════
// Knowledge Base Store — Pinia
// Manages documents, search, and RAG context injection
// ═══════════════════════════════════════════════════════════════════════

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const BASE = '/api/knowledge'

async function api(path, options = {}) {
  const token = localStorage.getItem('bbot_token')
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...options.headers,
  }
  const res = await fetch(BASE + path, { ...options, headers })
  const body = await res.json()
  const data = body && typeof body === 'object' && 'success' in body ? body.data : body
  if (!res.ok || (body && body.success === false)) {
    throw new Error(body?.error?.message || body?.error || '请求失败')
  }
  return data
}

export const useKnowledgeStore = defineStore('knowledge', () => {
  const documents = ref([])
  const loading = ref(false)
  const uploading = ref(false)
  const modelReady = ref(false)
  const ragEnabled = ref(localStorage.getItem('rag_enabled') !== 'false') // default ON
  const lastSearchResults = ref([])

  const documentCount = computed(() => documents.value.length)
  const totalChunks = computed(() => documents.value.reduce((sum, d) => sum + (d.chunk_count || 0), 0))

  function setRagEnabled(v) {
    ragEnabled.value = v
    localStorage.setItem('rag_enabled', v ? 'true' : 'false')
  }

  async function loadDocuments() {
    loading.value = true
    try {
      documents.value = await api('/documents')
    } catch (e) {
      console.error('[KB] loadDocuments failed:', e.message)
      documents.value = []
    } finally {
      loading.value = false
    }
  }

  async function uploadDocument(file, title) {
    // Generate a temp ID for immediate display
    const tempId = 'tmp_' + Date.now()
    const fileType = (file.name.split('.').pop() || '').toLowerCase()
    const tempDoc = {
      id: tempId,
      title: title || file.name,
      source: file.name,
      file_type: fileType,
      char_count: 0,
      chunk_count: 0,
      created_at: new Date().toISOString(),
      _status: 'processing',
    }
    // Add to list immediately so user sees it without refreshing
    documents.value = [tempDoc, ...documents.value]
    uploading.value = true
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (title) formData.append('title', title)
      const result = await api('/documents', { method: 'POST', body: formData })
      // Replace temp doc with real one
      documents.value = documents.value.map(d => d.id === tempId ? { ...result, _status: 'ready' } : d)
      // Also reload to ensure consistency
      await loadDocuments()
      return result
    } catch (err) {
      // Mark as failed so user can see the error
      documents.value = documents.value.map(d => d.id === tempId ? { ...d, _status: 'failed', _error: err.message } : d)
      throw err
    } finally {
      uploading.value = false
    }
  }

  async function addText(title, text, source) {
    const tempId = 'tmp_' + Date.now()
    const tempDoc = {
      id: tempId,
      title: title || '未命名文档',
      source: source || '手动输入',
      file_type: 'text',
      char_count: text.length,
      chunk_count: 0,
      created_at: new Date().toISOString(),
      _status: 'processing',
    }
    documents.value = [tempDoc, ...documents.value]
    uploading.value = true
    try {
      const result = await api('/documents/text', {
        method: 'POST',
        body: JSON.stringify({ title, text, source }),
      })
      documents.value = documents.value.map(d => d.id === tempId ? { ...result, _status: 'ready' } : d)
      await loadDocuments()
      return result
    } catch (err) {
      documents.value = documents.value.map(d => d.id === tempId ? { ...d, _status: 'failed', _error: err.message } : d)
      throw err
    } finally {
      uploading.value = false
    }
  }

  async function deleteDocument(id) {
    await api('/documents/' + id, { method: 'DELETE' })
    await loadDocuments()
  }

  async function search(query, topK = 4) {
    if (!query.trim()) return []
    try {
      const results = await api('/search', {
        method: 'POST',
        body: JSON.stringify({ query, topK }),
      })
      lastSearchResults.value = results || []
      return results || []
    } catch (e) {
      console.error('[KB] search failed:', e.message)
      return []
    }
  }

  async function warmup() {
    try {
      const data = await api('/warmup', { method: 'POST' })
      modelReady.value = !!data?.ready
      return modelReady.value
    } catch {
      return false
    }
  }

  async function checkStatus() {
    try {
      const data = await api('/status')
      modelReady.value = !!data?.ready
      return modelReady.value
    } catch {
      return false
    }
  }

  /**
   * Build RAG context string from search results.
   * Returns empty string if RAG disabled or no results.
   */
  function buildContext(results) {
    if (!ragEnabled.value || !results || !results.length) return ''
    const blocks = results.map((r, i) => {
      return `【知识库片段 ${i + 1}】(来源: ${r.docTitle}, 相关度: ${(r.score * 100).toFixed(0)}%)\n${r.text}`
    })
    return '\n\n## 知识库检索结果（用户上传的资料，优先参考）\n以下是从用户知识库中检索到的相关内容。**回答时优先基于这些资料**，如果资料中没有相关信息再用自己的知识回答。引用资料内容时自然融入，不要生硬地标注"根据知识库片段"。\n\n' + blocks.join('\n\n---\n\n')
  }

  return {
    documents,
    loading,
    uploading,
    modelReady,
    ragEnabled,
    lastSearchResults,
    documentCount,
    totalChunks,
    setRagEnabled,
    loadDocuments,
    uploadDocument,
    addText,
    deleteDocument,
    search,
    warmup,
    checkStatus,
    buildContext,
  }
})
