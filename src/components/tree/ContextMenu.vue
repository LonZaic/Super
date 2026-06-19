<template>
  <Teleport to="body">
    <div v-if="visible" class="ctx-overlay" @click.self="close" @contextmenu.prevent="close">
      <div class="ctx-menu" :style="{ left: posX + 'px', top: posY + 'px' }" @click.stop>
        <!-- Root / empty area -->
        <template v-if="targetType === 'root'">
          <button class="ctx-item" @click="emit('new-folder')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11v6M9 14h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            <span>新建文件夹</span>
          </button>
          <button class="ctx-item" @click="emit('new-conversation')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v6M9 11h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            <span>新建对话</span>
          </button>
        </template>

        <!-- Folder context menu -->
        <template v-else-if="targetType === 'folder'">
          <button class="ctx-item" @click="emit('new-folder', targetId)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11v6M9 14h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            <span>新建子文件夹</span>
          </button>
          <button class="ctx-item" @click="emit('new-conversation', targetId)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 8v6M9 11h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            <span>新建对话</span>
          </button>
          <div class="ctx-sep"></div>
          <button class="ctx-item" @click="emit('rename', targetId, targetName)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>重命名</span>
          </button>
          <div class="ctx-sep"></div>
          <button class="ctx-item danger" @click="emit('delete', targetId, targetName)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>删除文件夹</span>
          </button>
        </template>

        <!-- Conversation context menu -->
        <template v-else-if="targetType === 'conversation'">
          <button class="ctx-item" @click="emit('rename', targetId, targetName)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>重命名</span>
          </button>
          <div class="ctx-sep"></div>
          <button class="ctx-item danger" @click="emit('delete', targetId, targetName)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>删除对话</span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  visible: Boolean,
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  targetType: { type: String, default: 'root' },  // 'root' | 'folder' | 'conversation'
  targetId: { type: String, default: null },
  targetName: { type: String, default: '' },
})

const emit = defineEmits(['close', 'new-folder', 'new-conversation', 'rename', 'delete'])

// Clamp position to stay within viewport
const MARGIN = 8
const MENU_W = 200
const posX = computed(() => Math.min(props.x, window.innerWidth - MENU_W - MARGIN))
const posY = computed(() => Math.min(props.y, window.innerHeight - 280 - MARGIN))

function close() {
  emit('close')
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.ctx-overlay {
  position: fixed;
  inset: 0;
  z-index: 280;
}
.ctx-menu {
  position: fixed;
  z-index: 281;
  background: var(--bg2);
  border: 1px solid var(--border2);
  border-radius: var(--radius);
  box-shadow: 0 8px 32px rgba(0,0,0,0.45);
  padding: 4px;
  min-width: 180px;
  animation: ctxIn .12s ease both;
}
@keyframes ctxIn {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text2);
  font-size: 12px;
  font-family: inherit;
  font-weight: 300;
  cursor: pointer;
  transition: background .1s, color .1s;
  text-align: left;
}
.ctx-item:hover {
  background: var(--bg3);
  color: var(--text);
}
.ctx-item.danger {
  color: var(--red);
}
.ctx-item.danger:hover {
  background: rgba(248,81,73,0.12);
}
.ctx-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
}
</style>
