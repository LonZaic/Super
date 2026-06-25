<template>
    <!-- Hamburger button (mobile only) -->
    <button class="hamburger-btn" @click="toggleSidebar" title="菜单">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
    </button>

    <!-- Overlay for mobile -->
    <div :class="['sidebar-overlay', { show: mobileOpen }]" @click="closeSidebar"></div>

    <div :class="['sidebar', { open: mobileOpen }]">
        <div class="sidebar-header">
            <span class="logo">AI Chat</span>
            <button class="btn-close-mobile" @click="closeSidebar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </button>
        </div>

        <button class="btn-new" @click="newConversation">+ 新对话</button>

        <div class="nav-links">
          <router-link to="/" class="nav-link" @click="closeSidebar">首页</router-link>
          <router-link to="/friends" class="nav-link" @click="closeSidebar">好友</router-link>
          <router-link to="/groups" class="nav-link" @click="closeSidebar">群聊</router-link>
        </div>

        <!-- Spacer pushes icons to bottom -->
        <div class="sidebar-spacer"></div>

        <!-- Bottom icon dock -->
        <div class="sidebar-dock">
            <button class="dock-btn" :class="{ active: convPanelOpen }" @click="convPanelOpen = !convPanelOpen" title="对话管理">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span class="dock-label">对话</span>
                <span v-if="store.conversations.length" class="dock-badge">{{ store.conversations.length }}</span>
            </button>
            <router-link to="/novels" class="dock-btn" @click="closeSidebar" title="小说工坊">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                  <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5H6.5A2.5 2.5 0 0 0 4 19.5z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                </svg>
                <span class="dock-label">小说</span>
            </router-link>
            <button class="dock-btn" @click="theme.toggleTheme" :title="theme.isDark.value ? '切换亮色' : '切换暗色'">
                <svg v-if="theme.isDark.value" width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.6"/>
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                </svg>
                <span class="dock-label">{{ theme.isDark.value ? '亮色' : '暗色' }}</span>
            </button>
        </div>

        <!-- ═══ Conversation panel (slide-out drawer) ═══ -->
        <transition name="conv-panel">
            <div v-if="convPanelOpen" class="conv-panel">
                <div class="conv-panel-header">
                    <span class="conv-panel-title">对话管理</span>
                    <button class="conv-panel-close" @click="convPanelOpen = false">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="conv-search">
                    <svg class="conv-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/>
                      <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                    <input v-model="searchQuery" class="conv-search-input" placeholder="搜索对话..." />
                    <button v-if="searchQuery" class="conv-search-clear" @click="searchQuery = ''">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
                <div class="conv-panel-list">
                    <div v-if="!filteredConvs.length" class="conv-empty">
                        {{ searchQuery ? '未找到匹配的对话' : '暂无对话' }}
                    </div>
                    <div
                        v-for="conv in filteredConvs"
                        :key="conv.id"
                        :class="['conv-item', { active: conv.id === store.currentId }]"
                        @click="goToChat(conv.id)"
                    >
                        <span class="conv-title" :title="conv.title || '新对话'">{{ conv.title || '新对话' }}</span>
                        <button class="btn-rename" @click.stop="rename(conv)" title="改名">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="btn-delete" @click.stop="deleteChat(conv.id)" title="删除">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </transition>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { inject } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../store/chatStore.js'
import { confirmDelete } from '../utils/confirm.js'

const theme = inject('theme')
const router = useRouter()
const store = useChatStore()
const mobileOpen = ref(false)
const convPanelOpen = ref(false)
const searchQuery = ref('')

const filteredConvs = computed(() => {
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return store.conversations
    return store.conversations.filter(c => (c.title || '新对话').toLowerCase().includes(q))
})

function toggleSidebar() {
    mobileOpen.value = !mobileOpen.value
}
function closeSidebar() {
    mobileOpen.value = false
}

async function newConversation() {
    closeSidebar()
    if (!store.apikey) {
        alert('请先输入 API Key')
        return
    }
    const id = 'conv_' + Date.now()
    await store.createConversation(id)
    router.push('/chat/' + id)
    convPanelOpen.value = false
}

function goToChat(id) {
    closeSidebar()
    convPanelOpen.value = false
    if (id !== store.currentId) {
        store.switchTab(id)
        router.push('/chat/' + id)
    }
}

function rename(conv) {
    const newTitle = prompt('修改标题:', conv.title || '')
    if (newTitle && newTitle.trim() && newTitle.trim() !== conv.title) {
        store.updateConvTitle(conv.id, newTitle.trim())
    }
}

async function deleteChat(id) {
    const conv = store.conversations.find(c => c.id === id)
    const name = conv?.title || '对话'
    const ok1 = await confirmDelete({
        title: '删除对话',
        message: `确定要删除「${name}」吗？其中的所有消息都将被移除。`,
        step: 1,
    })
    if (!ok1) return
    const ok2 = await confirmDelete({
        title: '确认删除',
        message: `删除后无法恢复「${name}」的全部消息。确认继续？`,
        step: 2,
    })
    if (!ok2) return
    store.deleteConv(id)
}
</script>

<style scoped>
.sidebar {
    width: 72px;
    min-width: 72px;
    height: 100vh;
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
    transition: background 0.2s, border-color 0.2s, transform 0.25s ease;
    position: relative;
}
.sidebar-header {
    height: 48px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    transition: border-color 0.2s;
}
.logo {
    font-size: 11px;
    font-weight: 700;
    color: var(--text);
    letter-spacing: 1px;
    writing-mode: vertical-rl;
    text-orientation: upright;
}
.btn-close-mobile {
    display: none;
    border: 1px solid var(--border-light);
    background: transparent;
    color: var(--text-muted);
    width: 28px; height: 28px;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    padding: 0;
}
.btn-new {
    margin: 10px 8px;
    border: 1px solid var(--primary);
    background: var(--primary);
    color: #fff;
    padding: 8px 0;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    text-align: center;
    flex-shrink: 0;
    border-radius: 6px;
    transition: background 0.15s;
}
.btn-new:hover {
    background: var(--primary-hover);
}
.nav-links {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 0 8px;
    margin-bottom: 8px;
}
.nav-link {
    text-align: center;
    padding: 7px 0;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-decoration: none;
    border: 1px solid transparent;
    border-radius: 6px;
    transition: background 0.1s, color 0.1s;
}
.nav-link:hover {
    background: var(--bg-hover);
    color: var(--text);
}
.nav-link.router-link-active {
    color: var(--primary);
    background: var(--primary-bg);
}
.sidebar-spacer {
    flex: 1;
    min-height: 8px;
}

/* ═══ Bottom dock ═══ */
.sidebar-dock {
    border-top: 1px solid var(--border);
    padding: 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex-shrink: 0;
}
.dock-btn {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none;
    transition: background 0.15s, color 0.15s;
}
.dock-btn:hover {
    background: var(--bg-hover);
    color: var(--text);
}
.dock-btn.active {
    background: var(--primary-bg);
    color: var(--primary);
}
.dock-btn.router-link-active {
    background: var(--primary-bg);
    color: var(--primary);
}
.dock-label {
    font-size: 10px;
    font-weight: 500;
}
.dock-badge {
    position: absolute;
    top: 2px;
    right: 6px;
    background: var(--primary);
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 8px;
    min-width: 14px;
    text-align: center;
    line-height: 1.3;
}

/* ═══ Conversation panel (slide-out) ═══ */
.conv-panel {
    position: absolute;
    left: 100%;
    top: 0;
    bottom: 0;
    width: 280px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    border-left: 1px solid var(--border);
    box-shadow: 4px 0 24px rgba(0,0,0,0.12);
    display: flex;
    flex-direction: column;
    z-index: 50;
}
.conv-panel-header {
    height: 48px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}
.conv-panel-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
}
.conv-panel-close {
    border: none;
    background: transparent;
    color: var(--text-muted);
    width: 24px; height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 4px;
}
.conv-panel-close:hover {
    background: var(--bg-hover);
    color: var(--text);
}
.conv-search {
    position: relative;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}
.conv-search-icon {
    position: absolute;
    left: 22px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
    pointer-events: none;
}
.conv-search-input {
    width: 100%;
    padding: 7px 28px 7px 30px;
    border: 1px solid var(--border-light);
    background: var(--bg);
    color: var(--text);
    font-size: 12px;
    border-radius: 6px;
    outline: none;
    transition: border-color 0.15s;
}
.conv-search-input:focus {
    border-color: var(--primary);
}
.conv-search-clear {
    position: absolute;
    right: 18px;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: transparent;
    color: var(--text-muted);
    width: 20px; height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 4px;
}
.conv-search-clear:hover {
    background: var(--bg-hover);
    color: var(--text);
}
.conv-panel-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 12px;
    min-height: 0;
}
.conv-empty {
    padding: 32px 12px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
}
.conv-item {
    border: 1px solid var(--border-light);
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    margin-bottom: 6px;
    border-radius: 6px;
    transition: background 0.1s, border-color 0.1s;
}
.conv-item:hover {
    background: var(--bg-hover);
}
.conv-item.active {
    border-color: var(--primary);
    background: var(--primary-bg);
}
.conv-title {
    font-size: 12px;
    color: var(--text);
    font-weight: 500;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.btn-rename {
    border: none;
    background: transparent;
    width: 20px;
    height: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-muted);
    opacity: 0;
    transition: opacity 0.1s, color 0.1s;
    border-radius: 3px;
}
.conv-item:hover .btn-rename { opacity: 1; }
.btn-rename:hover { color: var(--primary); }
.btn-delete {
    border: none;
    background: transparent;
    width: 20px;
    height: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text-muted);
    transition: color 0.1s, background 0.1s;
    border-radius: 3px;
}
.btn-delete:hover {
    color: var(--red);
    background: var(--bg-hover);
}

/* Slide animation */
.conv-panel-enter-active,
.conv-panel-leave-active {
    transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s;
}
.conv-panel-enter-from,
.conv-panel-leave-to {
    transform: translateX(-12px);
    opacity: 0;
}

/* ═══ Mobile ═══ */
@media (max-width: 768px) {
    .sidebar {
        position: fixed;
        top: 0; left: 0;
        z-index: 1000;
        height: 100vh;
        height: 100dvh;
        transform: translateX(-100%);
        width: 72px;
        min-width: 72px;
    }
    .sidebar.open {
        transform: translateX(0);
    }
    .sidebar-header {
        padding-top: env(safe-area-inset-top, 0px);
        min-height: 44px;
    }
    .btn-close-mobile {
        display: flex;
    }
    .btn-new {
        margin: 8px 8px;
        padding: 10px 0;
        font-size: 11px;
    }
    .nav-link {
        padding: 9px 0;
        font-size: 11px;
    }
    .conv-panel {
        width: 240px;
    }
}
</style>
