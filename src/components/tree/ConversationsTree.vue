<template>
  <div class="tree-root">
    <!-- Empty state -->
    <div v-if="!hasContent && !searchQuery" class="tree-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" opacity="0.3">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>暂无对话</span>
    </div>
    <div v-else-if="!hasContent && searchQuery" class="tree-empty">
      <span>无匹配结果</span>
    </div>

    <!-- Flat display list -->
    <template v-else>
      <TreeNode
        v-for="node in displayNodes"
        :key="node._key"
        :node="node"
        :is-folder="node._type === 'folder'"
        :depth="node._depth"
        :expanded="node._type === 'folder' ? !!expandedFolders[node.id] : false"
        :active="node._type === 'conv' && node.id === currentId"
        :draggable="node._type === 'conv'"
        :selected="node._type === 'folder' && node.id === selectedFolderId"
        @toggle="emit('toggle-folder', node.id); node._type === 'folder' && emit('select-folder', node.id)"
        @click="node._type === 'folder' ? (emit('toggle-folder', node.id), emit('select-folder', node.id)) : emit('select-conversation', node.id)"
        @contextmenu.prevent.stop="node._type === 'folder'
          ? emit('context-menu', $event, 'folder', node.id, node.name)
          : emit('context-menu', $event, 'conversation', node.id, node.title || '新对话')"
        @rename="emit('rename-node', node._type, node.id, node.name || node.title || '')"
        @delete="emit('delete-node', node._type, node.id, node.name || node.title || '')"
        @dragenter.prevent="node._type === 'folder' ? onDragEnter($event, node.id) : undefined"
        @dragleave="node._type === 'folder' ? onDragLeave($event) : undefined"
        @dragover.prevent="node._type === 'folder' ? undefined : undefined"
        @drop.prevent="node._type === 'folder' ? onDrop($event, node.id) : undefined"
        @dragstart="node._type === 'conv' ? onDragStart($event, node.id) : undefined"
        @dragend="onDragEnd"
      />

      <!-- Root drop zone (when dragging) -->
      <div
        v-if="draggingId"
        class="tree-drop-root"
        @dragover.prevent
        @dragenter.prevent="dropRootHover = true"
        @dragleave="dropRootHover = false"
        @drop.prevent="onDropRoot"
        :class="{ active: dropRootHover }"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <span>移到根目录</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import TreeNode from './TreeNode.vue'

const props = defineProps({
  conversations: { type: Array, default: () => [] },
  folders: { type: Array, default: () => [] },
  currentId: { type: String, default: null },
  expandedFolders: { type: Object, default: () => ({}) },
  selectedFolderId: { type: String, default: null },
  searchQuery: { type: String, default: '' },
})

const emit = defineEmits(['select-conversation', 'select-folder', 'context-menu', 'drop-conversation', 'toggle-folder', 'rename-node', 'delete-node'])

const draggingId = ref(null)
const dropTargetId = ref(null)
const dropRootHover = ref(false)

const hasContent = computed(() => {
  return (props.conversations || []).length > 0 || (props.folders || []).length > 0
})

const q = computed(() => (props.searchQuery || '').trim().toLowerCase())

const matchesSearch = (text) => {
  if (!q.value) return true
  return (text || '').toLowerCase().includes(q.value)
}

// Check if a folder or any of its descendants match the search
function folderTreeHasMatch(folderId) {
  const childFolders = (props.folders || []).filter(f => f.parent_id === folderId)
  const childConvs = (props.conversations || []).filter(c => c.folder_id === folderId)
  for (const c of childConvs) {
    if (matchesSearch(c.title)) return true
  }
  for (const f of childFolders) {
    if (matchesSearch(f.name)) return true
    if (folderTreeHasMatch(f.id)) return true
  }
  return false
}

// Build flat display list — skip children of collapsed folders
const displayNodes = computed(() => {
  const result = []
  const folders = props.folders || []
  const convs = props.conversations || []

  // Get direct children of a folder (folders + convs), sorted
  const getChildren = (parentId) => {
    const items = []
    const cf = folders.filter(f => f.parent_id === parentId)
    const cc = convs.filter(c => c.folder_id === parentId)
    for (const f of cf) {
      if (!q.value || matchesSearch(f.name) || folderTreeHasMatch(f.id)) {
        items.push({ ...f, _type: 'folder', _sort: f.name || '' })
      }
    }
    for (const c of cc) {
      if (!q.value || matchesSearch(c.title)) {
        items.push({ ...c, _type: 'conv', _sort: c.title || '' })
      }
    }
    items.sort((a, b) => {
      if (a._type !== b._type) return a._type === 'folder' ? -1 : 1
      return a._sort.localeCompare(b._sort)
    })
    return items
  }

  // Recursive walk
  const walk = (parentId, depth) => {
    const children = getChildren(parentId)
    for (const item of children) {
      result.push({
        ...item,
        _key: (item._type === 'folder' ? 'f_' : 'c_') + item.id + '_d' + depth,
        _type: item._type,
        _depth: depth,
      })
      // Recurse into expanded folders
      if (item._type === 'folder' && props.expandedFolders[item.id]) {
        walk(item.id, depth + 1)
      }
    }
  }

  walk(null, 0)
  return result
})

// ─── Drag & drop ───
function onDragStart(e, convId) {
  draggingId.value = convId
  e.dataTransfer.setData('text/plain', convId)
  e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  draggingId.value = null
  dropTargetId.value = null
  dropRootHover.value = false
}

function onDragEnter(e, folderId) {
  dropTargetId.value = folderId
  if (e.currentTarget) e.currentTarget.classList.add('tree-drop-target')
}

function onDragLeave(e) {
  dropTargetId.value = null
  if (e.currentTarget) e.currentTarget.classList.remove('tree-drop-target')
}

function onDrop(e, folderId) {
  if (e.currentTarget) e.currentTarget.classList.remove('tree-drop-target')
  const convId = e.dataTransfer.getData('text/plain')
  if (convId && convId !== folderId) {
    emit('drop-conversation', convId, folderId)
  }
  draggingId.value = null
  dropTargetId.value = null
}

function onDropRoot() {
  dropRootHover.value = false
  if (draggingId.value) {
    emit('drop-conversation', draggingId.value, null)
  }
  draggingId.value = null
}
</script>

<style scoped>
.tree-root {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
  min-height: 0;
}
.tree-root::-webkit-scrollbar { width: 3px; }
.tree-root::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }

.tree-empty {
  padding: 16px 10px;
  text-align: center;
  font-size: 11px;
  color: var(--text3);
  font-weight: 300;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.tree-drop-root {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  margin: 0;
  border: 1px dashed var(--border2);
  color: var(--text3);
  font-size: 11px;
  font-weight: 300;
  transition: all .08s;
}
.tree-drop-root.active {
  border-color: var(--accent);
  background: rgba(79,125,255,.06);
  color: var(--accent);
}
</style>
