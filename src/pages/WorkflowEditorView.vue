<template>
  <div class="wf-page">
    <!-- Top bar -->
    <div class="wf-topbar">
      <div class="wf-topbar-left">
        <button class="wf-icon-btn" @click="backToList" title="返回列表">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <input v-model="workflowName" class="wf-name-input" @change="saveCurrent" placeholder="工作流名称" />
        <span v-if="saveStatus" class="wf-save-status">{{ saveStatus }}</span>
      </div>
      <div class="wf-topbar-right">
        <button class="wf-btn" @click="showRunPanel = true" :disabled="running">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
          {{ running ? '运行中...' : '运行' }}
        </button>
      </div>
    </div>

    <div class="wf-body">
      <!-- Left: Node palette -->
      <div class="wf-palette">
        <div class="wf-palette-title">节点库</div>
        <div v-if="wfStore.nodeTypesLoading" class="wf-palette-loading">
          <div class="wf-palette-spinner"></div>
          <span>加载节点中...</span>
        </div>
        <template v-else>
        <div v-for="(group, gname) in groupedNodeTypes" :key="gname" class="wf-palette-group">
          <div class="wf-palette-group-label">{{ groupLabel(gname) }}</div>
          <div
            v-for="nt in group"
            :key="nt[0]"
            class="wf-palette-item"
            draggable="true"
            @dragstart="onDragStart($event, nt[0])"
            :style="{ borderLeftColor: nt[1].color }"
          >
            <span class="wf-palette-icon" :style="{ background: nt[1].color + '20', color: nt[1].color }">
              <component :is="nodeIcon(nt[1].icon)" />
            </span>
            <div class="wf-palette-text">
              <span class="wf-palette-name">{{ nt[1].name }}</span>
              <span class="wf-palette-desc">{{ nt[1].description }}</span>
            </div>
          </div>
        </div>
        </template>
      </div>

      <!-- Center: Canvas -->
      <div
        class="wf-canvas"
        ref="canvasRef"
        @dragover.prevent
        @drop="onDrop"
        @mousedown="onCanvasMouseDown"
      >
        <svg class="wf-edges" :width="canvasSize.w" :height="canvasSize.h">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="var(--text4)" />
            </marker>
          </defs>
          <g v-for="edge in edges" :key="edge.id">
            <path
              :d="edgePath(edge)"
              stroke="var(--text4)"
              stroke-width="1.5"
              fill="none"
              marker-end="url(#arrowhead)"
              :class="{ 'edge-active': edge.source === connectingFrom || edge.target === connectingTo }"
            />
            <circle
              v-if="edge.source === selectedEdge?.source && edge.target === selectedEdge?.target"
              :cx="(nodePos(edge.source).x + nodePos(edge.target).x) / 2"
              :cy="(nodePos(edge.source).y + nodePos(edge.target).y) / 2"
              r="8"
              fill="var(--bg2)"
              stroke="#ef4444"
              stroke-width="1.5"
              class="edge-delete"
              @click="deleteEdge(edge)"
            />
            <text
              v-if="edge.source === selectedEdge?.source && edge.target === selectedEdge?.target"
              :x="(nodePos(edge.source).x + nodePos(edge.target).x) / 2"
              :y="(nodePos(edge.source).y + nodePos(edge.target).y) / 2 + 3"
              text-anchor="middle"
              fill="#ef4444"
              font-size="10"
              class="edge-delete-text"
              @click="deleteEdge(edge)"
            >×</text>
          </g>
          <!-- Temp edge while connecting -->
          <path
            v-if="tempEdge"
            :d="tempEdge"
            stroke="var(--accent)"
            stroke-width="2"
            stroke-dasharray="4 3"
            fill="none"
          />
        </svg>

        <!-- Nodes -->
        <div
          v-for="node in nodes"
          :key="node.id"
          :class="['wf-node', { selected: selectedNode === node.id }]"
          :style="{ left: node.x + 'px', top: node.y + 'px', borderLeftColor: nodeType(node.type)?.color }"
          @mousedown.stop="onNodeMouseDown($event, node)"
          @click.stop="selectedNode = node.id; selectedEdge = null"
        >
          <div class="wf-node-header" :style="{ background: (nodeType(node.type)?.color || '#666') + '15' }">
            <span class="wf-node-icon" :style="{ color: nodeType(node.type)?.color }">
              <component :is="nodeIcon(nodeType(node.type)?.icon)" />
            </span>
            <span class="wf-node-title">{{ nodeType(node.type)?.name || node.type }}</span>
            <button class="wf-node-del" @click.stop="deleteNode(node.id)" title="删除">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <!-- Input handles -->
          <div class="wf-node-handles-in">
            <div
              v-for="inp in (nodeType(node.type)?.inputs || [])"
              :key="inp.name"
              class="wf-handle wf-handle-in"
              :title="inp.description"
              @mouseup.stop="onHandleMouseUp($event, node.id, inp.name)"
            ></div>
          </div>
          <!-- Output handles -->
          <div class="wf-node-handles-out">
            <div
              v-for="out in (nodeType(node.type)?.outputs || [])"
              :key="out.name"
              class="wf-handle wf-handle-out"
              :title="out.description"
              @mousedown.stop="onHandleMouseDown($event, node.id, out.name)"
            ></div>
          </div>
          <!-- Config preview -->
          <div class="wf-node-config-preview">
            <span v-if="node.type === 'ai_text' && node.config?.prompt">{{ node.config.prompt.slice(0, 30) }}...</span>
            <span v-else-if="node.type === 'text_template' && node.config?.template">{{ node.config.template.slice(0, 30) }}...</span>
            <span v-else-if="node.type === 'condition' && node.config?.keyword">关键词: {{ node.config.keyword }}</span>
            <span v-else-if="node.type === 'start' && node.config?.defaultInput">输入: {{ node.config.defaultInput.slice(0, 20) }}</span>
          </div>
        </div>

        <!-- Empty hint -->
        <div v-if="!nodes.length" class="wf-canvas-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="10" width="14" height="10" rx="2" stroke="var(--text4)" stroke-width="1.5"/>
            <rect x="28" y="28" width="14" height="10" rx="2" stroke="var(--text4)" stroke-width="1.5"/>
            <path d="M20 15h8v23" stroke="var(--text4)" stroke-width="1.5" stroke-dasharray="3 2" fill="none"/>
          </svg>
          <span>从左侧拖拽节点到画布开始编排</span>
        </div>
      </div>

      <!-- Right: Node config panel -->
      <div class="wf-config" v-if="selectedNodeData">
        <div class="wf-config-title">
          {{ nodeType(selectedNodeData.type)?.name }} 配置
        </div>
        <div class="wf-config-body">
          <div v-for="field in (nodeType(selectedNodeData.type)?.config || [])" :key="field.name" class="wf-field">
            <label class="wf-field-label">
              {{ field.label }}
              <span v-if="field.required" class="wf-required">*</span>
            </label>
            <select v-if="field.type === 'select'" v-model="selectedNodeData.config[field.name]" class="wf-select" @change="saveCurrent">
              <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
            </select>
            <input v-else-if="field.type === 'text' || field.type === 'number'" :type="field.type" v-model="selectedNodeData.config[field.name]" :placeholder="field.placeholder" class="wf-input" @change="saveCurrent" />
            <textarea v-else-if="field.type === 'textarea'" v-model="selectedNodeData.config[field.name]" :placeholder="field.placeholder" class="wf-textarea" rows="4" @change="saveCurrent"></textarea>
          </div>
          <div class="wf-field" v-if="selectedNodeData.type !== 'start' && selectedNodeData.type !== 'end'">
            <label class="wf-field-label">节点 ID</label>
            <input :value="selectedNodeData.id" class="wf-input" readonly />
          </div>
        </div>
      </div>
      <div class="wf-config wf-config-empty" v-else>
        <span>选择节点查看配置</span>
      </div>
    </div>

    <!-- Run panel -->
    <Teleport to="body">
      <div v-if="showRunPanel" class="wf-run-overlay" @click="showRunPanel = false">
        <div class="wf-run-modal" @click.stop>
          <div class="wf-run-header">
            <span>运行工作流</span>
            <button class="wf-modal-close" @click="showRunPanel = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="wf-run-body">
            <div class="wf-field">
              <label class="wf-field-label">输入文本（开始节点的输入）</label>
              <textarea v-model="runInput" class="wf-textarea" rows="3" placeholder="输入工作流的起始内容..."></textarea>
            </div>
            <button class="wf-btn primary" @click="executeRun" :disabled="running">
              {{ running ? '运行中...' : '开始运行' }}
            </button>

            <!-- Execution logs -->
            <div v-if="runLogs.length" class="wf-run-logs">
              <div class="wf-run-logs-title">执行日志</div>
              <div v-for="(log, i) in runLogs" :key="i" class="wf-run-log-item">
                <span class="wf-log-time">{{ new Date(log.time).toLocaleTimeString('zh-CN') }}</span>
                <span class="wf-log-node">{{ log.message }}</span>
              </div>
            </div>

            <!-- Result -->
            <div v-if="runResult" class="wf-run-result">
              <div class="wf-run-result-title">结果</div>
              <pre class="wf-run-result-text">{{ typeof runResult === 'string' ? runResult : JSON.stringify(runResult, null, 2) }}</pre>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useWorkflowStore } from '../stores/workflowStore.js'

const route = useRoute()
const router = useRouter()
const wfStore = useWorkflowStore()

const canvasRef = ref(null)
const nodes = ref([])
const edges = ref([])
const workflowName = ref('未命名工作流')
const selectedNode = ref(null)
const selectedEdge = ref(null)
const saveStatus = ref('')
const canvasSize = ref({ w: 2000, h: 2000 })

// Drag state
let dragging = null // { node, offsetX, offsetY }
let connectingFrom = null // { nodeId, handle }
const tempEdge = ref(null)
const connectingTo = ref(null)

// Run panel
const showRunPanel = ref(false)
const runInput = ref('')
const running = computed(() => wfStore.running)
const runLogs = ref([])
const runResult = ref(null)

const nodeTypes = computed(() => wfStore.nodeTypes)
const currentWorkflowId = ref(null)

const selectedNodeData = computed(() => {
  if (!selectedNode.value) return null
  return nodes.value.find(n => n.id === selectedNode.value)
})

const groupedNodeTypes = computed(() => {
  const groups = {}
  for (const [key, val] of Object.entries(nodeTypes.value)) {
    const cat = val.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push([key, val])
  }
  return groups
})

function groupLabel(cat) {
  return { flow: '流程控制', ai: 'AI 节点', tool: '工具节点', util: '实用工具', other: '其他' }[cat] || cat
}

function nodeType(type) {
  return nodeTypes.value[type]
}

// Node icons (inline SVG components)
function nodeIcon(name) {
  const icons = {
    play: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'currentColor' }, [h('polygon', { points: '5 3 19 12 5 21 5 3' })]),
    stop: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'currentColor' }, [h('rect', { x: 5, y: 5, width: 14, height: 14, rx: 2 })]),
    brain: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('path', { d: 'M12 2a3 3 0 0 0-3 3v.5A3 3 0 0 0 6 8v1a3 3 0 0 0-1 5.83V17a3 3 0 0 0 3 3h.5a3 3 0 0 0 5 0H15a3 3 0 0 0 3-3v-2.17A3 3 0 0 0 17 9V8a3 3 0 0 0-3-2.5V5a3 3 0 0 0-3-3z', stroke: 'currentColor', 'stroke-width': 1.5 })]),
    search: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('circle', { cx: 11, cy: 11, r: 7, stroke: 'currentColor', 'stroke-width': 1.5 }), h('path', { d: 'M21 21l-4.3-4.3', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round' })]),
    globe: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('circle', { cx: 12, cy: 12, r: 10, stroke: 'currentColor', 'stroke-width': 1.5 }), h('path', { d: 'M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20', stroke: 'currentColor', 'stroke-width': 1.5 })]),
    cloud: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('path', { d: 'M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z', stroke: 'currentColor', 'stroke-width': 1.5 })]),
    book: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20', stroke: 'currentColor', 'stroke-width': 1.5 }), h('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', stroke: 'currentColor', 'stroke-width': 1.5 })]),
    save: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('path', { d: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', stroke: 'currentColor', 'stroke-width': 1.5 }), h('polyline', { points: '17 21 17 13 7 13 7 21', stroke: 'currentColor', 'stroke-width': 1.5 }), h('polyline', { points: '7 3 7 8 15 8', stroke: 'currentColor', 'stroke-width': 1.5 })]),
    mail: () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('rect', { x: 2, y: 4, width: 20, height: 16, rx: 2, stroke: 'currentColor', 'stroke-width': 1.5 }), h('path', { d: 'M2 6l10 7L22 6', stroke: 'currentColor', 'stroke-width': 1.5 })]),
    'file-text': () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z', stroke: 'currentColor', 'stroke-width': 1.5 }), h('path', { d: 'M14 2v6h6M9 13h6M9 17h4', stroke: 'currentColor', 'stroke-width': 1.5 })]),
    'git-branch': () => h('svg', { width: 12, height: 12, viewBox: '0 0 24 24', fill: 'none' }, [h('circle', { cx: 6, cy: 6, r: 2.5, stroke: 'currentColor', 'stroke-width': 1.5 }), h('circle', { cx: 6, cy: 18, r: 2.5, stroke: 'currentColor', 'stroke-width': 1.5 }), h('circle', { cx: 18, cy: 12, r: 2.5, stroke: 'currentColor', 'stroke-width': 1.5 }), h('path', { d: 'M8.5 6H14a2 2 0 0 1 2 2v1.5M8.5 18H14a2 2 0 0 0 2-2v-1.5', stroke: 'currentColor', 'stroke-width': 1.5 })]),
  }
  return icons[name] || icons['file-text']
}

// ─── Drag from palette ───
function onDragStart(e, nodeType) {
  e.dataTransfer.setData('nodeType', nodeType)
}

function onDrop(e) {
  e.preventDefault()
  const type = e.dataTransfer.getData('nodeType')
  if (!type) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left + canvasRef.value.scrollLeft - 80
  const y = e.clientY - rect.top + canvasRef.value.scrollTop - 30
  addNode(type, x, y)
}

function addNode(type, x, y) {
  const id = type + '_' + Date.now().toString(36)
  const nt = nodeType(type)
  const config = {}
  // Initialize config defaults
  for (const f of (nt?.config || [])) {
    if (f.default != null) config[f.name] = f.default
  }
  nodes.value.push({ id, type, x, y, config })
  selectedNode.value = id
  saveCurrent()
}

function deleteNode(id) {
  nodes.value = nodes.value.filter(n => n.id !== id)
  edges.value = edges.value.filter(e => e.source !== id && e.target !== id)
  if (selectedNode.value === id) selectedNode.value = null
  saveCurrent()
}

// ─── Node dragging ───
function onNodeMouseDown(e, node) {
  selectedNode.value = node.id
  selectedEdge.value = null
  const rect = canvasRef.value.getBoundingClientRect()
  dragging = {
    node,
    offsetX: e.clientX - rect.left - node.x + canvasRef.value.scrollLeft,
    offsetY: e.clientY - rect.top - node.y + canvasRef.value.scrollTop,
  }
  document.addEventListener('mousemove', onNodeMouseMove)
  document.addEventListener('mouseup', onNodeMouseUp)
}

function onNodeMouseMove(e) {
  if (!dragging) return
  const rect = canvasRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left - dragging.offsetX + canvasRef.value.scrollLeft
  const y = e.clientY - rect.top - dragging.offsetY + canvasRef.value.scrollTop
  dragging.node.x = Math.max(0, x)
  dragging.node.y = Math.max(0, y)
}

function onNodeMouseUp() {
  if (dragging) {
    saveCurrent()
    dragging = null
  }
  document.removeEventListener('mousemove', onNodeMouseMove)
  document.removeEventListener('mouseup', onNodeMouseUp)
}

// ─── Edge connecting ───
function onHandleMouseDown(e, nodeId, handleName) {
  e.stopPropagation()
  connectingFrom = { nodeId, handle: handleName }
  document.addEventListener('mousemove', onConnectMouseMove)
  document.addEventListener('mouseup', onConnectMouseUp)
}

function onConnectMouseMove(e) {
  if (!connectingFrom) return
  const rect = canvasRef.value.getBoundingClientRect()
  const fromPos = nodePos(connectingFrom.nodeId)
  const toX = e.clientX - rect.left + canvasRef.value.scrollLeft
  const toY = e.clientY - rect.top + canvasRef.value.scrollTop
  tempEdge.value = `M ${fromPos.x + 160} ${fromPos.y + 20} C ${fromPos.x + 200} ${fromPos.y + 20}, ${toX - 40} ${toY}, ${toX} ${toY}`
}

function onConnectMouseUp(e) {
  document.removeEventListener('mousemove', onConnectMouseMove)
  document.removeEventListener('mouseup', onConnectMouseUp)
  tempEdge.value = null
  connectingFrom = null
}

function onHandleMouseUp(e, targetNodeId, targetHandle) {
  e.stopPropagation()
  if (!connectingFrom) return
  if (connectingFrom.nodeId === targetNodeId) {
    connectingFrom = null
    return
  }
  // Check if edge already exists
  const exists = edges.value.some(e =>
    e.source === connectingFrom.nodeId && e.target === targetNodeId
  )
  if (!exists) {
    edges.value.push({
      id: 'e_' + Date.now().toString(36),
      source: connectingFrom.nodeId,
      target: targetNodeId,
      sourceHandle: connectingFrom.handle,
      targetHandle,
    })
    saveCurrent()
  }
  connectingFrom = null
}

function onCanvasMouseDown(e) {
  if (e.target === canvasRef.value || e.target.classList?.contains('wf-edges')) {
    selectedNode.value = null
    selectedEdge.value = null
  }
}

function deleteEdge(edge) {
  edges.value = edges.value.filter(e => e !== edge)
  selectedEdge.value = null
  saveCurrent()
}

// ─── Edge path calculation ───
function nodePos(nodeId) {
  const n = nodes.value.find(n => n.id === nodeId)
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 }
}

function edgePath(edge) {
  const s = nodePos(edge.source)
  const t = nodePos(edge.target)
  const sx = s.x + 160, sy = s.y + 20
  const tx = t.x, ty = t.y + 20
  const dx = Math.abs(tx - sx) * 0.5
  return `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`
}

// ─── Save ───
let _saveTimer = null
function saveCurrent() {
  if (!currentWorkflowId.value) return
  if (_saveTimer) clearTimeout(_saveTimer)
  saveStatus.value = '保存中...'
  _saveTimer = setTimeout(async () => {
    try {
      await wfStore.saveWorkflow(currentWorkflowId.value, {
        name: workflowName.value,
        nodes: nodes.value,
        edges: edges.value,
      })
      saveStatus.value = '已保存'
      setTimeout(() => { saveStatus.value = '' }, 1500)
    } catch (e) {
      saveStatus.value = '保存失败'
    }
  }, 500)
}

// ─── Run ───
async function executeRun() {
  runLogs.value = []
  runResult.value = null
  try {
    const result = await wfStore.runWorkflow(currentWorkflowId.value, { input: runInput.value })
    if (result?.status === 'completed') {
      runResult.value = result.output?.result || result.output || '完成'
    } else {
      runResult.value = '失败: ' + (result?.error || '未知错误')
    }
    // Load logs
    if (result?.runId) {
      const run = await wfStore.getRun(result.runId)
      if (run?.logs) {
        try { runLogs.value = JSON.parse(run.logs) } catch {}
      }
    }
  } catch (e) {
    runResult.value = '运行失败: ' + e.message
  }
}

// ─── Navigation ───
function backToList() {
  router.push('/workflow')
}

// ─── Load workflow ───
async function loadWorkflow(id) {
  const w = await wfStore.getWorkflow(id)
  if (!w) return
  currentWorkflowId.value = id
  workflowName.value = w.name || '未命名工作流'
  try {
    nodes.value = typeof w.nodes === 'string' ? JSON.parse(w.nodes) : (w.nodes || [])
    edges.value = typeof w.edges === 'string' ? JSON.parse(w.edges) : (w.edges || [])
  } catch {
    nodes.value = []
    edges.value = []
  }
}

onMounted(async () => {
  await wfStore.loadNodeTypes()
  const id = route.params.id
  if (id) {
    await loadWorkflow(id)
  }
})

watch(() => route.params.id, async (id) => {
  if (id) await loadWorkflow(id)
})
</script>

<style scoped>
.wf-page { height: 100vh; height: 100dvh; display: flex; flex-direction: column; overflow: hidden; }

.wf-topbar { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg2); flex-shrink: 0; }
.wf-topbar-left { display: flex; align-items: center; gap: 10px; }
.wf-icon-btn { width: 32px; height: 32px; border-radius: 6px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.wf-icon-btn:hover { background: var(--bg3); color: var(--text); }
.wf-name-input { border: 1px solid transparent; background: transparent; color: var(--text); font-size: 15px; font-family: inherit; padding: 4px 8px; border-radius: 6px; min-width: 200px; }
.wf-name-input:hover, .wf-name-input:focus { border-color: var(--border2); background: var(--bg3); outline: none; }
.wf-save-status { font-size: 11px; color: var(--text4); }
.wf-topbar-right { display: flex; gap: 8px; }
.wf-btn { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border2); background: var(--bg3); color: var(--text2); font-size: 13px; font-family: inherit; cursor: pointer; transition: all .15s; }
.wf-btn:hover:not(:disabled) { background: var(--bg4); color: var(--text); }
.wf-btn:disabled { opacity: .5; cursor: not-allowed; }
.wf-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }

.wf-body { flex: 1; display: flex; overflow: hidden; }

/* Palette */
.wf-palette { width: 220px; border-right: 1px solid var(--border); background: var(--bg2); overflow-y: auto; flex-shrink: 0; }
.wf-palette-title { font-size: 12px; font-weight: 600; color: var(--text3); padding: 14px 16px 8px; text-transform: uppercase; letter-spacing: .5px; }
.wf-palette-loading { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 40px 16px; color: var(--text4); font-size: 12px; }
.wf-palette-spinner { width: 24px; height: 24px; border: 2px solid var(--border2); border-top-color: var(--accent); border-radius: 50%; animation: wf-spin .8s linear infinite; }
@keyframes wf-spin { to { transform: rotate(360deg); } }
.wf-palette-group { margin-bottom: 8px; }
.wf-palette-group-label { font-size: 10px; color: var(--text4); padding: 6px 16px 4px; font-weight: 600; }
.wf-palette-item { display: flex; align-items: center; gap: 8px; padding: 8px 12px; margin: 2px 8px; border-radius: 8px; cursor: grab; border-left: 3px solid transparent; transition: background .12s; }
.wf-palette-item:hover { background: var(--bg3); }
.wf-palette-item:active { cursor: grabbing; }
.wf-palette-icon { width: 26px; height: 26px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.wf-palette-text { display: flex; flex-direction: column; min-width: 0; }
.wf-palette-name { font-size: 12px; font-weight: 500; color: var(--text); }
.wf-palette-desc { font-size: 10px; color: var(--text4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Canvas */
.wf-canvas { flex: 1; position: relative; overflow: auto; background: var(--bg); background-image: radial-gradient(circle, var(--border) 1px, transparent 1px); background-size: 20px 20px; }
.wf-edges { position: absolute; top: 0; left: 0; pointer-events: none; }
.wf-edges g { pointer-events: all; }
.edge-active { stroke: var(--accent); }
.edge-delete, .edge-delete-text { cursor: pointer; }
.edge-delete:hover + .edge-delete-text, .edge-delete-text:hover { fill: #ef4444; }

.wf-node { position: absolute; width: 160px; background: var(--bg2); border: 1px solid var(--border2); border-left: 3px solid #666; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.1); cursor: move; user-select: none; }
.wf-node.selected { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent), 0 4px 12px rgba(0,0,0,.15); }
.wf-node-header { display: flex; align-items: center; gap: 6px; padding: 8px 10px; border-radius: 5px 5px 0 0; }
.wf-node-icon { display: flex; align-items: center; justify-content: center; }
.wf-node-title { font-size: 12px; font-weight: 500; color: var(--text); flex: 1; }
.wf-node-del { width: 18px; height: 18px; border-radius: 4px; border: none; background: transparent; color: var(--text4); cursor: pointer; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .12s; }
.wf-node:hover .wf-node-del { opacity: 1; }
.wf-node-del:hover { background: rgba(239,68,68,.15); color: #ef4444; }
.wf-node-config-preview { padding: 6px 10px; font-size: 10px; color: var(--text3); border-top: 1px solid var(--border); min-height: 24px; }

.wf-node-handles-in { position: absolute; left: -6px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 4px; }
.wf-node-handles-out { position: absolute; right: -6px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 4px; }
.wf-handle { width: 12px; height: 12px; border-radius: 50%; background: var(--bg2); border: 2px solid var(--text4); cursor: crosshair; transition: all .12s; }
.wf-handle:hover { border-color: var(--accent); background: var(--accent); transform: scale(1.2); }
.wf-handle-in { border-color: #0ea5e9; }
.wf-handle-out { border-color: var(--accent); }

.wf-canvas-empty { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--text4); font-size: 13px; pointer-events: none; }

/* Config panel */
.wf-config { width: 280px; border-left: 1px solid var(--border); background: var(--bg2); overflow-y: auto; flex-shrink: 0; }
.wf-config-empty { display: flex; align-items: center; justify-content: center; color: var(--text4); font-size: 13px; }
.wf-config-title { font-size: 13px; font-weight: 600; color: var(--text); padding: 14px 16px; border-bottom: 1px solid var(--border); }
.wf-config-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.wf-field { display: flex; flex-direction: column; gap: 6px; }
.wf-field-label { font-size: 12px; color: var(--text2); font-weight: 500; }
.wf-required { color: #ef4444; }
.wf-input, .wf-select, .wf-textarea { width: 100%; padding: 8px 10px; border: 1px solid var(--border2); border-radius: 6px; background: var(--bg3); color: var(--text); font-size: 13px; font-family: inherit; }
.wf-input:focus, .wf-select:focus, .wf-textarea:focus { outline: none; border-color: var(--accent); }
.wf-textarea { resize: vertical; min-height: 60px; line-height: 1.5; }

/* Run modal */
.wf-run-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
.wf-run-modal { background: var(--bg2); border: 1px solid var(--border); border-radius: 14px; width: 100%; max-width: 600px; max-height: 80vh; display: flex; flex-direction: column; }
.wf-run-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border); font-size: 15px; font-weight: 500; }
.wf-modal-close { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.wf-modal-close:hover { background: var(--bg3); color: var(--text); }
.wf-run-body { padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.wf-run-logs { border: 1px solid var(--border); border-radius: 8px; padding: 12px; background: var(--bg3); max-height: 200px; overflow-y: auto; }
.wf-run-logs-title { font-size: 12px; font-weight: 600; color: var(--text3); margin-bottom: 8px; }
.wf-run-log-item { display: flex; gap: 10px; font-size: 11px; padding: 3px 0; }
.wf-log-time { color: var(--text4); flex-shrink: 0; }
.wf-log-node { color: var(--text2); }
.wf-run-result { border: 1px solid var(--accent); border-radius: 8px; padding: 12px; background: var(--bg3); }
.wf-run-result-title { font-size: 12px; font-weight: 600; color: var(--accent); margin-bottom: 8px; }
.wf-run-result-text { font-size: 12px; color: var(--text); white-space: pre-wrap; word-break: break-word; margin: 0; max-height: 300px; overflow-y: auto; }
</style>
