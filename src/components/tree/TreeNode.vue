<template>
  <div
    :class="['tn-item', {
      active: active,
      selected: selected,
      dragging: dragging,
      'is-folder': isFolder,
    }]"
    :style="{ paddingLeft: (depth * 14 + 8) + 'px' }"
    :draggable="draggable && !isFolder"
    @click="$emit('click')"
    @contextmenu="$emit('contextmenu', $event)"
    @dragstart="onDragStart"
    @dragend="$emit('dragend', $event)"
    @dragenter="$emit('dragenter', $event)"
    @dragleave="$emit('dragleave', $event)"
    @dragover="$emit('dragover', $event)"
    @drop="$emit('drop', $event)"
  >
    <!-- Folder: chevron + icon -->
    <template v-if="isFolder">
      <svg class="tn-chev" :class="{ open: expanded }" width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-if="expanded" width="14" height="14" viewBox="0 0 14 14" fill="none" class="tn-icon">
        <path d="M1.5 3.5h4.5L7.3 5H12.5V11H1.5V3.5z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="none" class="tn-icon">
        <path d="M2 3h3.8L7 4.5H12V11H2V3z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
      </svg>
      <span class="tn-name">{{ node.name || '新文件夹' }}</span>

      <!-- Hover actions -->
      <div class="tn-actions">
        <button class="tn-act" title="重命名" @click.stop="$emit('rename', node)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="tn-act tn-act-del" title="删除" @click.stop="$emit('delete', node)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </template>

    <!-- Conversation leaf -->
    <template v-else>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="tn-icon">
        <path d="M3 2h5l1.5 1.5H12v8H3V2z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>
        <path d="M4.5 6h5M4.5 8.5h3" stroke="currentColor" stroke-width=".7" stroke-linecap="round" opacity=".5"/>
      </svg>
      <span class="tn-name">{{ node.title || '新对话' }}</span>

      <!-- Hover actions -->
      <div class="tn-actions">
        <button class="tn-act" title="重命名" @click.stop="$emit('rename', node)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <button class="tn-act tn-act-del" title="删除" @click.stop="$emit('delete', node)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  node: { type: Object, required: true },
  isFolder: { type: Boolean, default: false },
  depth: { type: Number, default: 0 },
  expanded: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  draggable: { type: Boolean, default: false },
})

defineEmits(['click', 'contextmenu', 'toggle', 'dragstart', 'dragend', 'dragenter', 'dragleave', 'dragover', 'drop', 'rename', 'delete'])

const dragging = ref(false)

function onDragStart(e) {
  dragging.value = true
  e.dataTransfer.setData('text/plain', props.node.id)
  e.dataTransfer.effectAllowed = 'move'
}
</script>

<style scoped>
.tn-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  padding-right: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 300;
  color: var(--text2);
  transition: background .08s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}
.tn-item:hover {
  background: var(--bg3);
}
.tn-item.active {
  background: rgba(79,125,255,.1);
  color: var(--accent);
}
.tn-item.active .tn-icon {
  color: var(--accent);
}
.tn-item.selected {
  background: rgba(79,125,255,.06);
  outline: 1px solid rgba(79,125,255,.2);
  outline-offset: -1px;
}
.tn-item.dragging {
  opacity: 0.4;
}
.tn-item.is-folder {
  font-weight: 400;
}

/* Chevron */
.tn-chev {
  flex-shrink: 0;
  color: var(--text3);
  transition: transform .12s;
}
.tn-chev.open {
  transform: rotate(90deg);
}

/* Icons */
.tn-icon {
  flex-shrink: 0;
  color: var(--text3);
}

/* Name */
.tn-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Hover actions — like VS Code */
.tn-actions {
  display: flex;
  align-items: center;
  gap: 1px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity .1s;
}
.tn-item:hover .tn-actions {
  opacity: 1;
}
.tn-act {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px; height: 20px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text3);
  cursor: pointer;
  transition: all .1s;
}
.tn-act:hover {
  background: var(--bg4);
  color: var(--text);
}
.tn-act-del:hover {
  background: rgba(248,81,73,.12);
  color: var(--red);
}
</style>
