<template>
  <div class="ft-root">
    <!-- Toolbar -->
    <div class="ft-toolbar">
      <button class="ft-tool-btn" @click.stop="emit('create-folder', selectedFolder)" title="新建文件夹">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M12 11v6M9 14h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
      </button>
      <button class="ft-tool-btn" @click.stop="emit('create-file', selectedFolder)" title="新建文件">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 2v6h6M12 18v-6M9 15h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button v-if="selectedFolder" class="ft-tool-btn ft-tool-btn-clear" @click.stop="emit('clear-selection')" title="取消选择文件夹">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>

    <!-- File tree list -->
    <div class="ft-list" ref="listRef">
      <template v-for="node in displayTree" :key="node.path">
        <div
          class="ft-item"
          :class="{
            active: activeFile === node.path,
            dir: node.isDir,
            'dir-selected': node.isDir && selectedFolder === node.path,
          }"
          :style="{ paddingLeft: (node.depth * 14 + 8) + 'px' }"
          @click="onClick(node)"
        >
          <!-- Folder: chevron + icon -->
          <template v-if="node.isDir">
            <svg class="ft-chev" :class="{ open: node._open }" width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-if="node._open" width="14" height="14" viewBox="0 0 14 14" fill="none" class="ft-icon">
              <path d="M1.5 3.5h4.5L7.3 5H12.5V11H1.5V3.5z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
              <path d="M3 7.5h9" stroke="currentColor" stroke-width="0.7" stroke-linecap="round" opacity="0.4"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" class="ft-icon">
              <path d="M2 3h3.8L7 4.5H12V11H2V3z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
            </svg>
          </template>
          <!-- File icon -->
          <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" class="ft-icon">
            <path d="M3 2h5l1.5 1.5H12v8H3V2z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
            <path d="M4.5 6h5M4.5 8.5h3" stroke="currentColor" stroke-width=".7" stroke-linecap="round" opacity=".5"/>
          </svg>
          <span class="ft-name">{{ node.name }}</span>
        </div>
      </template>
      <div v-if="!tree || !tree.length" class="ft-empty">加载中...</div>
      <div v-else-if="!displayTree.length && tree.length" class="ft-empty">空目录</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  tree: { type: Array, default: () => [] },
  activeFile: { type: String, default: '' },
  selectedFolder: { type: String, default: '' },
})

const emit = defineEmits(['selectFile', 'create-folder', 'create-file', 'clear-selection', 'select-folder'])

const expanded = ref({})

// Build visible tree: only show expanded directories' children
const displayTree = computed(() => {
  const treeData = props.tree || []
  if (!treeData.length) return []

  const result = []
  const hidden = new Set()

  // Mark hidden nodes: children of collapsed directories and their descendants
  for (const node of treeData) {
    if (!node.isDir) continue
    if (!expanded.value[node.path]) {
      const prefix = node.path + '\\'
      for (const child of treeData) {
        if (child.path !== node.path && child.path.startsWith(prefix)) {
          hidden.add(child.path)
        }
      }
    }
  }

  for (const node of treeData) {
    if (hidden.has(node.path)) continue
    result.push({ ...node, _open: expanded.value[node.path] || false })
  }

  return result
})

// Auto-expand depth-0 directories on tree load
watch(() => props.tree, (tree) => {
  if (tree && tree.length) {
    const ex = { ...expanded.value }
    for (const node of tree) {
      if (node.isDir && node.depth === 0) ex[node.path] = true
    }
    expanded.value = ex
  }
}, { immediate: true, deep: true })

function onClick(node) {
  if (node.isDir) {
    // Toggle expand
    expanded.value = { ...expanded.value, [node.path]: !expanded.value[node.path] }
    // Select folder
    if (props.selectedFolder === node.path) {
      emit('select-folder', '')
    } else {
      emit('select-folder', node.path)
    }
  } else {
    emit('selectFile', node)
  }
}
</script>

<style scoped>
.ft-root { display: flex; flex-direction: column; overflow: hidden; flex: 1; min-height: 0; }

/* Toolbar */
.ft-toolbar {
  display: flex; align-items: center; gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ft-tool-btn {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; border-radius: 5px;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; transition: all .12s;
}
.ft-tool-btn:hover { background: var(--bg3); color: var(--text); }
.ft-tool-btn-clear { margin-left: auto; }
.ft-tool-btn-clear:hover { background: rgba(248,81,73,0.1); color: var(--red); }

/* File list */
.ft-list { flex: 1; overflow-y: auto; padding: 4px 0; }
.ft-list::-webkit-scrollbar { width: 3px; }
.ft-list::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }
.ft-item {
  display: flex; align-items: center; gap: 5px;
  padding: 3px 10px; cursor: pointer;
  font-size: 12px; font-weight: 300; color: var(--text2);
  transition: background .08s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  user-select: none;
}
.ft-item:hover { background: var(--bg3); }
.ft-item.active { background: rgba(79,125,255,.1); color: var(--accent); }
.ft-item.dir-selected {
  background: rgba(79,125,255,.06);
  outline: 1px solid rgba(79,125,255,.25);
  outline-offset: -1px;
}
.ft-chev { flex-shrink: 0; color: var(--text3); transition: transform .12s; }
.ft-chev.open { transform: rotate(90deg); }
.ft-icon { flex-shrink: 0; color: var(--text3); }
.ft-item.active .ft-icon { color: var(--accent); }
.ft-item.dir { font-weight: 400; }
.ft-name { overflow: hidden; text-overflow: ellipsis; }
.ft-empty { padding: 16px 10px; font-size: 11px; color: var(--text3); font-weight: 300; text-align: center; }
</style>
