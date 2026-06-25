// ═══════════════════════════════════════════════════════════════════════
// Workflow Store — Pinia
// Manages workflow CRUD, node types, and execution
// ═══════════════════════════════════════════════════════════════════════

import { defineStore } from 'pinia'
import { ref } from 'vue'

const BASE = '/api/workflows'

async function api(path, options = {}) {
  const token = localStorage.getItem('bbot_token')
  const apiKey = localStorage.getItem('apikey') || ''
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
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

export const useWorkflowStore = defineStore('workflow', () => {
  const workflows = ref([])
  const nodeTypes = ref({})
  const nodeTypesLoading = ref(false)
  const currentWorkflow = ref(null)
  const loading = ref(false)
  const running = ref(false)
  const lastRunResult = ref(null)

  async function loadNodeTypes(force = false) {
    // Skip if already loaded (cache) unless forced
    if (!force && Object.keys(nodeTypes.value).length > 0) return
    if (nodeTypesLoading.value) return  // prevent duplicate concurrent loads
    nodeTypesLoading.value = true
    try {
      nodeTypes.value = await api('/node-types')
    } catch (e) {
      console.error('[WF] loadNodeTypes failed:', e.message)
    } finally {
      nodeTypesLoading.value = false
    }
  }

  async function loadWorkflows() {
    loading.value = true
    try {
      workflows.value = await api('/')
    } catch (e) {
      console.error('[WF] loadWorkflows failed:', e.message)
      workflows.value = []
    } finally {
      loading.value = false
    }
  }

  async function getWorkflow(id) {
    try {
      const w = await api('/' + id)
      currentWorkflow.value = w
      return w
    } catch (e) {
      console.error('[WF] getWorkflow failed:', e.message)
      return null
    }
  }

  async function createWorkflow(name = '未命名工作流') {
    const id = 'wf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
    const w = await api('/', {
      method: 'POST',
      body: JSON.stringify({
        name,
        nodes: [
          { id: 'start_1', type: 'start', x: 100, y: 200, config: {} },
          { id: 'end_1', type: 'end', x: 600, y: 200, config: {} },
        ],
        edges: [{ id: 'e1', source: 'start_1', target: 'end_1' }],
      }),
    })
    await loadWorkflows()
    return w
  }

  async function saveWorkflow(id, data) {
    const w = await api('/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    await loadWorkflows()
    return w
  }

  async function deleteWorkflow(id) {
    await api('/' + id, { method: 'DELETE' })
    await loadWorkflows()
  }

  async function runWorkflow(id, inputs = {}) {
    running.value = true
    lastRunResult.value = null
    try {
      const result = await api('/' + id + '/run', {
        method: 'POST',
        body: JSON.stringify({ inputs }),
      })
      lastRunResult.value = result
      return result
    } finally {
      running.value = false
    }
  }

  async function listRuns(id) {
    try {
      return await api('/' + id + '/runs')
    } catch {
      return []
    }
  }

  async function getRun(runId) {
    try {
      return await api('/runs/' + runId)
    } catch {
      return null
    }
  }

  return {
    workflows,
    nodeTypes,
    nodeTypesLoading,
    currentWorkflow,
    loading,
    running,
    lastRunResult,
    loadNodeTypes,
    loadWorkflows,
    getWorkflow,
    createWorkflow,
    saveWorkflow,
    deleteWorkflow,
    runWorkflow,
    listRuns,
    getRun,
  }
})
