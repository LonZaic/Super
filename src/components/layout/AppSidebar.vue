<template>
  <aside :class="['sidebar', { collapsed }]">
    <div class="sidebar-top">
      <div class="logo" @click="goHome" v-show="!collapsed">
        <svg width="28" height="28" viewBox="0 0 22 22" fill="none">
          <!-- Orbit ring -->
          <ellipse cx="11" cy="11" rx="9" ry="3.5" stroke="var(--accent)" stroke-width="0.8" stroke-dasharray="2 1.5" transform="rotate(-20 11 11)"/>
          <!-- Sun -->
          <circle cx="11" cy="11" r="3" fill="var(--accent)" opacity="0.15" stroke="var(--accent)" stroke-width="1"/>
          <circle cx="11" cy="11" r="1.2" fill="var(--accent)"/>
          <!-- Planet 1 -->
          <circle cx="6.8" cy="12" r="0.8" fill="var(--accent)" opacity="0.7"/>
          <!-- Planet 2 - smaller, farther -->
          <circle cx="15.2" cy="9.5" r="0.55" fill="var(--accent)" opacity="0.5"/>
        </svg>
        <span class="logo-text">{{ t('brand') }}</span>
      </div>
      <button class="collapse-toggle" @click="collapsed = !collapsed" :title="collapsed ? '展开侧栏' : '收起侧栏'">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2.5" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.3"/>
          <path d="M4.5 6h7M4.5 8.5h5M4.5 11h3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
          <path d="M12 6.5l2 1.5-2 1.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- ═══ Code Mode: header ═══ -->
    <div v-if="isCodeRoute" class="code-hdr">
      <button class="back-btn" @click="$router.push('/')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <span class="code-hdr-name">{{ codeProjectName || t('codeNoProj') }}</span>
    </div>

    <!-- ═══ Code Mode: File Tree (flex fills space) ═══ -->
    <div v-if="isCodeRoute && codeProjectPath" class="code-ft-wrap">
      <FileTree
        :tree="codeFileTree"
        :active-file="codeActiveFile"
        :selected-folder="codeSelectedFolder"
        @select-file="onCodeFileSelect"
        @select-folder="onCodeSelectFolder"
        @create-folder="onCodeCreateFolder"
        @create-file="onCodeCreateFile"
        @clear-selection="onCodeClearSelection"
      />
    </div>
    <div v-else-if="isCodeRoute && !codeProjectPath" class="code-ft-wrap">
      <div class="code-no-proj">{{ t('codeOpenHint') }}</div>
    </div>

    <!-- ═══ Workflow Editor Mode: header ═══ -->
    <div v-if="isWorkflowEditorRoute" class="code-hdr">
      <button class="back-btn" @click="$router.push('/workflow')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
      <span class="code-hdr-name">工作流</span>
    </div>

    <!-- ═══ Workflow Editor Mode: workflow list (flex fills space) ═══ -->
    <div v-if="isWorkflowEditorRoute" class="code-ft-wrap wf-side-list">
      <button class="wf-side-new" @click="createWorkflowFromSidebar">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span>新建工作流</span>
      </button>
      <div class="wf-side-items">
        <div
          v-for="wf in wfStore.workflows"
          :key="wf.id"
          :class="['wf-side-item', { active: wf.id === route.params.id }]"
          @click="$router.push('/workflow/' + wf.id)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" class="wf-side-item-icon">
            <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <circle cx="18" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8.5 6H14a2 2 0 0 1 2 2v1.5M8.5 18H14a2 2 0 0 0 2-2v-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span class="wf-side-item-name">{{ wf.name }}</span>
          <button class="wf-side-item-del" @click.stop="deleteWorkflowFromSidebar(wf)" title="删除">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div v-if="!wfStore.workflows.length" class="wf-side-empty">暂无工作流</div>
      </div>
    </div>

    <!-- New Chat button (collapsed-safe) -->
    <div v-if="!isCodeRoute && !isWorkflowEditorRoute" class="new-btns-row">
      <button class="new-chat-btn" @click="newChat" :title="t('newChat')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <span v-show="!collapsed">{{ t('newChat') }}</span>
      </button>
    </div>

    <div v-if="!isCodeRoute && !isWorkflowEditorRoute" class="nav-section">
      <button class="nav-item" :class="{ active: route.path === '/' }" @click="goHome" :title="collapsed ? t('home') : ''">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 6.5L7.5 2 13 6.5V13H9.5v-3.5h-4V13H2V6.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
        <span v-show="!collapsed">{{ t('home') }}</span>
      </button>
      <button class="nav-item" :class="{ active: route.path === '/code' }" @click="$router.push('/code')" :title="collapsed ? t('code') : ''">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M4 2h7l2 2v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/><path d="M5 6l2 2-2 2M8 10h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span v-show="!collapsed">{{ t('code') }}</span>
      </button>
      <button class="nav-item" :class="{ active: route.path === '/novels' }" @click="$router.push('/novels')" :title="collapsed ? '小说工坊' : ''">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5H6.5A2.5 2.5 0 0 0 4 19.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span v-show="!collapsed">小说</span>
      </button>
      <button class="nav-item" :class="{ active: route.path === '/mcp-skills' }" @click="$router.push('/mcp-skills')" :title="collapsed ? t('mcpSidebar') : ''">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.3"/>
          <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="18" cy="6" r="1.5" fill="currentColor" opacity=".5"/>
          <circle cx="18" cy="12" r="1.5" fill="currentColor" opacity=".5"/>
          <circle cx="18" cy="18" r="1.5" fill="currentColor" opacity=".5"/>
        </svg>
        <span v-show="!collapsed">{{ t('mcpSidebar') }}</span>
      </button>
      <button class="nav-item" :class="{ active: isSocialActive }" @click="$router.push('/social')" :title="collapsed ? t('social') : ''">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="5.5" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="11" cy="4" r="1.8" stroke="currentColor" stroke-width="1.3"/><path d="M1 13c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M11 8c1.7 0 3 1.2 3 2.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <span v-show="!collapsed">{{ t('social') }}</span>
      </button>
      <button class="nav-item" :class="{ active: route.path === '/collections' }" @click="$router.push('/collections')" :title="collapsed ? '收藏' : ''">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span v-show="!collapsed">收藏</span>
      </button>
      <button class="nav-item" :class="{ active: route.path === '/knowledge' }" @click="$router.push('/knowledge')" :title="collapsed ? '知识库' : ''">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M8 7h8M8 11h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span v-show="!collapsed">知识库</span>
      </button>
      <button class="nav-item" :class="{ active: route.path.startsWith('/workflow') }" @click="$router.push('/workflow')" :title="collapsed ? '工作流' : ''">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="6" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="6" cy="18" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="18" cy="12" r="2.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8.5 6H14a2 2 0 0 1 2 2v1.5M8.5 18H14a2 2 0 0 0 2-2v-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span v-show="!collapsed">工作流</span>
      </button>
      <button class="nav-item" :class="{ active: route.path === '/projects' }" @click="$router.push('/projects')" :title="collapsed ? '项目' : ''">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M3 7C3 5.9 3.9 5 5 5H9L11 7H19C20.1 7 21 7.9 21 9V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span v-show="!collapsed">项目</span>
      </button>
    </div>

    <!-- ═══ Conversation toggle button — moved to sidebar-bottom ═══ -->

    <!-- ═══ Conversation slide-out panel (teleported to body to escape sidebar overflow) ═══ -->
    <Teleport to="body">
      <transition name="conv-panel-slide">
        <div v-if="convPanelOpen && !isCodeRoute && !isWorkflowEditorRoute" class="conv-panel" ref="convPanelRef" @click.stop>
          <div class="conv-panel-header">
            <span class="conv-panel-title">对话管理</span>
            <button class="conv-panel-close" @click="convPanelOpen = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="conv-panel-search">
            <svg class="conv-panel-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.8"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
            <input v-model="searchQuery" class="conv-panel-search-input" :placeholder="t('searchConvs')" />
            <button v-if="searchQuery" class="conv-panel-search-clear" @click="searchQuery = ''">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="conv-panel-toolbar">
            <button class="conv-panel-tool-btn" @click.stop="newConversationInFolder(null)" title="新建对话">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
              <span>新对话</span>
            </button>
            <button class="conv-panel-tool-btn" @click.stop="newFolderInParent(null)" title="新建文件夹">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M12 11v6M9 14h6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              <span>新文件夹</span>
            </button>
          </div>
          <div class="conv-panel-list" @contextmenu.prevent="showRootCtxMenu">
            <div v-if="!loggedIn" class="conv-panel-empty">{{ t('signIn') }}</div>
            <ConversationsTree
              v-else
              :conversations="safeConversations"
              :folders="safeFolders"
              :current-id="store.currentId"
              :expanded-folders="expandedFolders"
              :selected-folder-id="selectedFolderId"
              :search-query="searchQuery"
              @select-conversation="openChat"
              @select-folder="selectFolder"
              @context-menu="showContextMenu"
              @drop-conversation="handleDrop"
              @toggle-folder="toggleFolder"
              @rename-node="onTreeRename"
              @delete-node="onTreeDelete"
            />
          </div>
        </div>
      </transition>
      <!-- Click-away overlay -->
      <div v-if="convPanelOpen && !isCodeRoute && !isWorkflowEditorRoute" class="conv-panel-overlay" @click="convPanelOpen = false"></div>
    </Teleport>

    <!-- Context Menu (right-click) -->
    <ContextMenu
      :visible="ctxMenu.visible"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :target-type="ctxMenu.targetType"
      :target-id="ctxMenu.targetId"
      :target-name="ctxMenu.targetName"
      @close="ctxMenu.visible = false"
      @new-folder="onCtxNewFolder"
      @new-conversation="onCtxNewConversation"
      @rename="onCtxRename"
      @delete="onCtxDelete"
    />

    <!-- Dialogs teleported to body for true page-center positioning -->
    <Teleport to="body">
      <!-- Delete confirm dialog -->
      <div v-if="deleting" class="side-dlg-overlay" @click="cancelDelete" @keydown.esc="cancelDelete">
        <div class="side-dlg-box" @click.stop>
          <p class="side-dlg-text">{{ t('confirmDeleteQ') }}「{{ deleting.title }}」？</p>
          <p class="side-dlg-sub">{{ t('cannotUndo') }}</p>
          <div class="side-dlg-actions">
            <button class="side-dlg-btn cancel" @click="cancelDelete">{{ t('cancel') }}</button>
            <button class="side-dlg-btn danger" @click="doDelete">{{ t('delete') }}</button>
          </div>
        </div>
      </div>

      <!-- Rename inline input -->
      <div v-if="renaming" class="side-dlg-overlay" @click="cancelRename">
        <div class="side-dlg-box" @click.stop>
          <input v-model="renameText" class="side-dlg-input" @keydown.enter="doRename" @keydown.esc="cancelRename" ref="renameRef" />
          <div class="side-dlg-actions">
            <button class="side-dlg-btn ok" @click="doRename">{{ t('ok') }}</button>
            <button class="side-dlg-btn" @click="cancelRename">{{ t('cancel') }}</button>
          </div>
        </div>
      </div>

      <!-- New item (folder/file) creation dialog -->
      <div v-if="creating" class="side-dlg-overlay" @click="cancelCreate" @keydown.esc="cancelCreate">
        <div class="side-dlg-box" @click.stop>
          <div class="side-dlg-hdr">
            <svg v-if="creating.type === 'folder'" width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v11z" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 11v6M9 14h6" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 2v6h6M12 18v-6M9 15h6" stroke="var(--accent)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>{{ creating.type === 'folder' ? '新建文件夹' : '新建文件' }}</span>
          </div>
          <input
            v-model="createText"
            class="side-dlg-input"
            :placeholder="creating.type === 'folder' ? '文件夹名称' : '文件名称'"
            @keydown.enter="doCreate"
            @keydown.esc="cancelCreate"
            ref="createRef"
            autofocus
          />
          <div class="side-dlg-actions">
            <button class="side-dlg-btn ok" :disabled="!createText.trim()" @click="doCreate">创建</button>
            <button class="side-dlg-btn" @click="cancelCreate">取消</button>
          </div>
        </div>
      </div>
    </Teleport>

    <div class="sidebar-bottom">
      <!-- ═══ Row 1: 对话管理 (top) ═══ -->
      <button v-if="!isCodeRoute && !isWorkflowEditorRoute" class="sb-row-btn" :class="{ active: convPanelOpen }" @click="toggleConvPanel" :title="collapsed ? '对话管理' : ''">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span v-show="!collapsed" class="sb-row-label">对话</span>
        <span v-if="!collapsed && loggedIn && safeConversations.length" class="sb-row-badge">{{ safeConversations.length }}</span>
      </button>

      <!-- Code Mode: history button (replaces conversation in code mode) -->
      <div v-if="isCodeRoute" style="position: relative;">
        <button class="sb-row-btn" @click="showCodeHist = !showCodeHist" :title="collapsed ? t('codeProjectConvs') : ''">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.1"/><path d="M7 4v3.5L9 9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
          <span v-show="!collapsed" class="sb-row-label">{{ t('codeProjectConvs') }}</span>
          <span v-show="!collapsed && projectConvs.length" class="sb-row-badge" style="margin-left:auto">{{ projectConvs.length }}</span>
        </button>
        <Transition name="hist-pop">
          <div v-if="showCodeHist" class="code-hist-popup">
            <div class="code-hist-list">
              <div v-for="conv in projectConvs" :key="conv.id"
                :class="['code-hist-item', { active: conv.id === codeStore.currentId }]"
                @click="openCodeConv(conv.id); showCodeHist = false">
                <span class="code-hist-title">{{ conv.title }}</span>
                <span class="code-hist-date">{{ formatDate(conv.created_at) }}</span>
                <button class="code-hist-del" @click.stop="deleteCodeConv(conv.id)">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
                </button>
              </div>
              <div v-if="!projectConvs.length" class="code-hist-empty">{{ t('noConvs') }}</div>
            </div>
          </div>
        </Transition>
      </div>

      <!-- ═══ Row 2: 设置 (middle) ═══ -->
      <button class="sb-row-btn" @click="openSettings()" :title="collapsed ? '设置' : ''">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" stroke="currentColor" stroke-width="1.3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <span v-show="!collapsed" class="sb-row-label">设置</span>
      </button>

      <!-- ═══ Row 3: 登录/用户 (bottom) ═══ -->
      <template v-if="loggedIn">
        <div class="user-row" :title="collapsed ? (userName || 'User') : ''">
          <div class="user-avatar">{{ userName?.charAt(0) || 'U' }}</div>
          <span v-show="!collapsed" class="user-name">{{ userName || 'User' }}</span>
          <button v-show="!collapsed" class="logout-btn" @click="doLogout" :title="t('signOut')">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M5 1.5H3a1 1 0 00-1 1v8a1 1 0 001 1h2M9 4l2.5 2.5L9 9M11.5 6.5H4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </template>
      <template v-else>
        <button class="login-prompt" @click="$router.push('/login')" :title="collapsed ? t('signIn') : ''">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="5" r="2.8" stroke="currentColor" stroke-width="1.3"/><path d="M2 13c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          <span v-show="!collapsed">{{ t('signIn') }}</span>
        </button>
      </template>
    </div>
  </aside>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, inject, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { useChatStore } from '../../store/chatStore.js'
import { useCodeStore } from '../../stores/codeStore.js'
import { useWorkflowStore } from '../../stores/workflowStore.js'
import { isLoggedIn, logout } from '../../api/index.js'
import { disconnect } from '../../api/ws.js'
import { useI18n } from '../../composables/useI18n.js'
import FileTree from '../code/FileTree.vue'
import ConversationsTree from '../tree/ConversationsTree.vue'
import ContextMenu from '../tree/ContextMenu.vue'
import { createFolder, createFile, scanFileTree } from '../../api/code.api.js'

const router = useRouter()
const route = useRoute()
const store = useChatStore()
const codeStore = useCodeStore()
const wfStore = useWorkflowStore()
const { t } = useI18n()

const isCodeRoute = computed(() => route.path === '/code')
const isWorkflowEditorRoute = computed(() => route.path.startsWith('/workflow/') && route.params.id)
const { projectPath: codeProjectPath, fileTree: codeFileTree, projectName: codeProjectName, activeFilePath: codeActiveFile, selectedFolder: codeSelectedFolder } = storeToRefs(codeStore)
const loggedIn = ref(isLoggedIn())
const apiKeySet = ref(false)
const keyMode = ref('builtin')
const needKeyWarning = computed(() => keyMode.value === 'own' && !apiKeySet.value)
const openSettings = inject('openSettings')

// Watch route changes to update loggedIn state immediately after login
watch(() => route.path, () => {
  const now = isLoggedIn()
  if (now !== loggedIn.value) {
    loggedIn.value = now
    if (now) {
      // Reload conversations on fresh login
      store.loadConversations()
    }
  }
})

const collapsed = ref(localStorage.getItem('sidebar_collapsed') === '1')
const searchFocused = ref(false)
const convPanelOpen = ref(false)
const searchInputRef = ref(null)
const searchQuery = ref('')
const renaming = ref(false)
const renameId = ref(null)
const renameText = ref('')
const renameRef = ref(null)
const renameIsFolder = ref(false)
const deleting = ref(null)  // { id, title, isFolder } or null
const creating = ref(null)  // { type: 'folder'|'file', parentId?: string, parentPath?: string, context: 'chat'|'code' }
const createText = ref('')
const createRef = ref(null)

// Context menu state
const ctxMenu = reactive({ visible: false, x: 0, y: 0, targetType: 'root', targetId: null, targetName: '' })

const isSocialActive = computed(() => ['/social','/friends','/groups','/dm','/group'].some(p => route.path.startsWith(p)))

const userName = computed(() => { try { return JSON.parse(localStorage.getItem('bbot_user')).name } catch { return null } })

// ─── Security: never expose conversations when not logged in ───
const safeConversations = computed(() => {
  if (!loggedIn.value) return []
  return isCodeRoute.value ? (codeStore.conversations || []) : (store.conversations || [])
})
const safeFolders = computed(() => {
  if (!loggedIn.value) return []
  return isCodeRoute.value ? [] : (store.folders || [])
})

// Folder expand/collapse state
const expandedFolders = ref({})
// Selected folder — new conversations and folders go here
const selectedFolderId = ref(null)

function toggleFolder(folderId) {
  expandedFolders.value = {
    ...expandedFolders.value,
    [folderId]: !expandedFolders.value[folderId],
  }
}

function selectFolder(folderId) {
  selectedFolderId.value = folderId === selectedFolderId.value ? null : folderId
}

function goHome() {
  store.currentId = null
  store._saveSession()
  router.push('/')
}

// Get or create the "Chat" folder (deduplicate if multiple exist)
function getChatFolderId() {
  const folders = store.folders || []
  const chatFolders = folders.filter(f => f.name === 'Chat' && !f.parent_id)
  if (chatFolders.length > 1) {
    // Keep first, delete duplicates
    for (let i = 1; i < chatFolders.length; i++) {
      store.deleteFolder(chatFolders[i].id)
    }
  }
  return chatFolders[0]?.id || null
}

async function newChat() {
  if (!loggedIn.value) { router.push('/login'); return }
  if (isCodeRoute.value) {
    codeStore.createConversation(t('codeDefaultConv'))
  } else {
    const folderId = selectedFolderId.value || getChatFolderId()
    const id = 'conv_' + Date.now()
    await store.createConversation(id, folderId)
    if (folderId) expandedFolders.value = { ...expandedFolders.value, [folderId]: true }
    router.push('/chat/' + id)
  }
}
function openChat(id) {
  if (isCodeRoute.value) {
    codeStore.switchTab(id)
  } else {
    store.switchTab(id); router.push('/chat/' + id)
  }
}

// ═══ Workflow sidebar actions ═══
async function createWorkflowFromSidebar() {
  try {
    const w = await wfStore.createWorkflow()
    if (w && w.id) router.push('/workflow/' + w.id)
  } catch (e) {
    console.error('[Sidebar] create workflow failed:', e)
  }
}

async function deleteWorkflowFromSidebar(wf) {
  if (!confirm(`确定删除工作流「${wf.name}」吗？`)) return
  try {
    await wfStore.deleteWorkflow(wf.id)
    // If deleting current, go back to list
    if (route.params.id === wf.id) router.push('/workflow')
  } catch (e) {
    console.error('[Sidebar] delete workflow failed:', e)
  }
}

// Load workflows when entering workflow editor mode
watch(isWorkflowEditorRoute, (v) => {
  if (v) wfStore.loadWorkflows()
}, { immediate: true })

function onCodeFileSelect(item) {
  codeStore.openFile(item.path, item.name, '')
}

function onCodeSelectFolder(folderPath) {
  codeStore.selectedFolder = folderPath || ''
}

function onCodeClearSelection() {
  codeStore.selectedFolder = ''
}

function onCodeCreateFolder(parentPath) {
  if (!codeProjectPath.value) return
  creating.value = { type: 'folder', parentPath: parentPath || codeProjectPath.value, context: 'code' }
  createText.value = '新文件夹'
  setTimeout(() => createRef.value?.focus(), 60)
  setTimeout(() => createRef.value?.select(), 70)
}

function onCodeCreateFile(parentPath) {
  if (!codeProjectPath.value) return
  creating.value = { type: 'file', parentPath: parentPath || codeProjectPath.value, context: 'code' }
  createText.value = '新文件.txt'
  setTimeout(() => createRef.value?.focus(), 60)
  setTimeout(() => createRef.value?.select(), 70)
}

// ─── Code history popup ───
const showCodeHist = ref(false)
const projectConvs = computed(() => {
  if (!codeProjectPath.value) return []
  return (codeStore.conversations || []).filter(c => c.project_path === codeProjectPath.value)
})

function openCodeConv(id) {
  codeStore.openConversation(id)
}

function deleteCodeConv(id) {
  codeStore.deleteConversation(id)
}

function formatDate(d) {
  if (!d) return ''
  try { return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}
function doLogout() { logout(); disconnect(); loggedIn.value = false; router.push('/') }


// ─── Rename ───
function startRename(conv) {
  renaming.value = true
  renameId.value = conv.id
  renameText.value = conv.title || ''
  setTimeout(() => renameRef.value?.focus(), 50)
}
function doRename() {
  if (renameText.value.trim() && renameId.value) {
    if (renameIsFolder.value) {
      store.renameFolder(renameId.value, renameText.value.trim())
    } else if (isCodeRoute.value) {
      const conv = codeStore.conversations.find(c => c.id === renameId.value)
      if (conv) conv.title = renameText.value.trim()
    } else {
      store.updateConvTitle(renameId.value, renameText.value.trim())
    }
  }
  renaming.value = false; renameId.value = null; renameText.value = ''; renameIsFolder.value = false
}
function cancelRename() { renaming.value = false; renameId.value = null; renameText.value = '' }

// ─── Delete ───
function confirmDelete(conv) {
  deleting.value = { id: conv.id, title: conv.title || '新对话' }
}
function cancelDelete() { deleting.value = null }
async function doDelete() {
  if (!deleting.value) return
  const id = deleting.value.id
  if (deleting.value.isFolder) {
    store.deleteFolder(id)
  } else if (isCodeRoute.value) {
    codeStore.closeTab(id)
    router.push('/code')
  } else {
    const wasCurrent = store.currentId === id
    await store.deleteConv(id)
    if (wasCurrent) {
      if (store.openTabs.length) { router.push('/chat/' + store.openTabs[0]) }
      else { router.push('/'); store.currentId = null }
    }
  }
  deleting.value = null
}

// ─── Collapse & Search ───
function focusSearch() { searchFocused.value = true; setTimeout(() => searchInputRef.value?.focus(), 50) }
function onSearchBlur() { if (!searchQuery.value) searchFocused.value = false }
function toggleConvPanel() {
  convPanelOpen.value = !convPanelOpen.value
  if (convPanelOpen.value && collapsed.value) {
    collapsed.value = false
  }
}
watch(collapsed, (v) => { localStorage.setItem('sidebar_collapsed', v ? '1' : '0') })

// ─── Context menu ───
function openCtxMenu(e, conv) { /* deprecated: replaced by showContextMenu */ }

function showContextMenu(e, type, id, name) {
  ctxMenu.visible = true
  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.targetType = type
  ctxMenu.targetId = id
  ctxMenu.targetName = name || ''
}

function showRootCtxMenu(e) {
  // Only show root menu on empty area
  if (e.target.closest('.tree-node')) return
  showContextMenu(e, 'root', null, '')
}

// Tree events
function onTreeSelect(convId) {
  if (!convId) return
  openChat(convId)
}

function handleDrop(convId, folderId) {
  store.moveConversation(convId, folderId || null)
}

// VS Code–style: new folder via dialog, in given parent folder
function newFolderInParent(parentId) {
  if (!loggedIn.value) { router.push('/login'); return }
  const target = parentId !== null ? parentId : selectedFolderId.value
  creating.value = { type: 'folder', parentId: target, context: 'chat' }
  createText.value = '新文件夹'
  setTimeout(() => createRef.value?.focus(), 60)
  setTimeout(() => createRef.value?.select(), 70)
}

async function doCreate() {
  const name = createText.value.trim()
  if (!name || !creating.value) return
  const { type, parentId, parentPath, context } = creating.value

  if (context === 'chat') {
    // Conversation folder
    await store.createFolder(name, parentId || null)
    if (parentId) expandedFolders.value = { ...expandedFolders.value, [parentId]: true }
  } else if (context === 'code') {
    // Code mode file/folder
    if (!codeProjectPath.value) return
    try {
      const targetParent = parentPath || codeProjectPath.value
      if (type === 'folder') {
        const result = await createFolder(name, codeProjectPath.value, targetParent)
        if (result.tree) {
          codeStore.setFileTree(result.tree)
        } else {
          const { tree } = await scanFileTree(codeProjectPath.value)
          codeStore.setFileTree(tree || [])
        }
      } else {
        const result = await createFile(name, codeProjectPath.value, targetParent)
        if (result.tree) {
          codeStore.setFileTree(result.tree)
        } else {
          const { tree } = await scanFileTree(codeProjectPath.value)
          codeStore.setFileTree(tree || [])
        }
      }
    } catch (e) {
      alert(`创建${type === 'folder' ? '文件夹' : '文件'}失败: ` + (e.message || ''))
    }
  }

  creating.value = null
  createText.value = ''
}

function cancelCreate() {
  creating.value = null
  createText.value = ''
}

// VS Code–style: new conversation in given folder
async function newConversationInFolder(folderId) {
  if (!loggedIn.value) { router.push('/login'); return }
  if (isCodeRoute.value) {
    codeStore.createConversation(t('codeDefaultConv'))
  } else {
    const targetFolder = folderId !== null ? folderId : (selectedFolderId.value || getChatFolderId())
    const id = 'conv_' + Date.now()
    await store.createConversation(id, targetFolder)
    if (targetFolder) expandedFolders.value = { ...expandedFolders.value, [targetFolder]: true }
    router.push('/chat/' + id)
  }
}

// ─── Inline tree actions (hover buttons) ───
function onTreeRename(type, id, name) {
  if (type === 'folder') {
    startRenameFolder({ id, name })
  } else {
    startRename({ id, title: name })
  }
}

function onTreeDelete(type, id, name) {
  if (type === 'folder') {
    confirmDeleteFolder({ id, name })
  } else {
    // Find the conversation object for proper delete
    const convList = isCodeRoute.value ? codeStore.conversations : store.conversations
    const conv = (convList || []).find(c => c.id === id)
    confirmDelete(conv || { id, title: name })
  }
}

// Context menu actions
function onCtxNewFolder(parentFolderId) {
  ctxMenu.visible = false
  newFolderInParent(parentFolderId || null)
}

function onCtxNewConversation(folderId) {
  ctxMenu.visible = false
  newConversationInFolder(folderId || null)
}

function onCtxRename(id, name) {
  ctxMenu.visible = false
  if (ctxMenu.targetType === 'folder') {
    startRenameFolder({ id, name })
  } else {
    startRename({ id, title: name })
  }
}

function onCtxDelete(id, name) {
  ctxMenu.visible = false
  if (ctxMenu.targetType === 'folder') {
    confirmDeleteFolder({ id, name })
  } else {
    const conv = store.conversations.find(c => c.id === id)
    confirmDelete(conv || { id, title: name })
  }
}

// ─── Folder rename ───
function startRenameFolder(folder) {
  renaming.value = true
  renameId.value = folder.id
  renameIsFolder.value = true
  renameText.value = folder.name || ''
  setTimeout(() => renameRef.value?.focus(), 50)
}

function doRenameFolder() {
  if (renameText.value.trim() && renameId.value) {
    store.renameFolder(renameId.value, renameText.value.trim())
  }
  renaming.value = false
  renameId.value = null
  renameText.value = ''
  renameIsFolder.value = false
}

// ─── Folder delete ───
function confirmDeleteFolder(folder) {
  deleting.value = { id: folder.id, title: folder.name || '新文件夹', isFolder: true }
}

function doDeleteFolder() {
  if (!deleting.value) return
  store.deleteFolder(deleting.value.id)
  deleting.value = null
}

onMounted(async () => {
  store.loadApiKey()
  await store.loadConversations()
  apiKeySet.value = store.apikey.length > 0
  keyMode.value = localStorage.getItem('key_mode') || 'builtin'
  loggedIn.value = isLoggedIn()

  // Ensure "Chat" folder exists (for new conversations), but don't move historical ones
  {
    const folders = store.folders || []
    const chatFolder = folders.find(f => f.name === 'Chat' && !f.parent_id)
    if (!chatFolder) {
      await store.createFolder('Chat', null)
    }
  }

  setInterval(() => { loggedIn.value = isLoggedIn(); apiKeySet.value = store.apikey.length > 0; keyMode.value = localStorage.getItem('key_mode') || 'builtin' }, 2000)
})

</script>

<style scoped>
.sidebar {
  width: var(--sidebar-w); height: 100vh; height: 100dvh;
  background: color-mix(in srgb, var(--bg2) 80%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex; flex-direction: column; flex-shrink: 0; overflow: hidden;
  transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  will-change: width, background;
}
.sidebar.collapsed { width: 56px; }
.sidebar-top { padding: 16px 12px 8px; display: flex; align-items: center; justify-content: space-between; }
.logo { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 500; color: var(--text); letter-spacing: -0.3px; cursor: pointer; user-select: none; overflow: hidden; }
.logo-text { white-space: nowrap; transition: opacity 0.2s; }

/* Collapse toggle — minimal, refined */
.collapse-toggle {
  width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: color 0.2s, transform 0.2s;
}
.collapse-toggle:hover { color: var(--text); transform: scale(1.08); }
.collapse-toggle:active { transform: scale(0.92); }
/* When collapsed, toggle moves to center */
.collapsed .sidebar-top { justify-content: center; padding: 12px 0 4px; }
.sidebar-top { transition: padding 0.25s cubic-bezier(0.16, 1, 0.3, 1); }

.new-btns-row {
  display: flex;
  gap: 6px;
  margin: 4px 12px 10px;
  width: calc(100% - 24px);
}
.new-chat-btn {
  flex: 1;
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-radius: var(--radius);
  border: 1px solid var(--border2); background: transparent;
  color: var(--text2); cursor: pointer; font-size: 14px;
  font-family: inherit; font-weight: 300;
  transition: background .15s, color .15s, border-color .15s, padding .25s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; overflow: hidden;
}
.new-chat-btn:hover { background: var(--bg3); color: var(--text); border-color: var(--border2); }
.collapsed .new-btns-row { justify-content: center; width: auto; margin: 4px 12px 10px; }
.collapsed .new-chat-btn { padding: 8px; flex: 0; justify-content: center; border-color: transparent; background: transparent; }
.collapsed .new-chat-btn:hover { background: var(--bg3); border-color: var(--border); }

/* ═══ Tree toolbar ═══ */
.tree-toolbar {
  display: flex; align-items: center; justify-content: flex-end; gap: 2px;
  padding: 2px 12px 6px;
}
.tree-act-btn {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 5px;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; transition: all .12s;
}
.tree-act-btn:hover { background: var(--bg3); color: var(--text); }

.back-btn {
  width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
  border: none; background: transparent; color: var(--text2); cursor: pointer;
  display: flex; align-items: center; justify-content: center; transition: all .12s;
}
.back-btn:hover { background: var(--bg3); color: var(--text); }

/* Code mode header */
.code-hdr {
  display: flex; align-items: center; gap: 8px; padding: 12px 12px 8px;
}
.code-hdr-name {
  font-size: 13px; font-weight: 500; color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
}
.code-ft-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.code-no-proj { padding: 16px; text-align: center; font-size: 11px; color: var(--text3); font-weight: 300; }

/* ═══ Workflow sidebar list ═══ */
.wf-side-list { padding: 8px 8px 0; gap: 8px; }
.wf-side-new {
  display: flex; align-items: center; gap: 6px; width: 100%;
  padding: 8px 10px; border-radius: 8px; border: 1px dashed var(--border2);
  background: transparent; color: var(--accent); cursor: pointer;
  font-size: 12px; font-weight: 500; transition: all .15s;
}
.wf-side-new:hover { background: var(--accent-muted); border-color: var(--accent); }
.wf-side-items { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding-bottom: 8px; }
.wf-side-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  border-radius: 8px; cursor: pointer; transition: background .12s;
  color: var(--text2); font-size: 12px;
}
.wf-side-item:hover { background: var(--bg3); }
.wf-side-item.active { background: var(--accent-muted); color: var(--accent); }
.wf-side-item-icon { flex-shrink: 0; opacity: .7; }
.wf-side-item.active .wf-side-item-icon { opacity: 1; }
.wf-side-item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wf-side-item-del {
  width: 20px; height: 20px; border-radius: 4px; border: none;
  background: transparent; color: var(--text4); cursor: pointer;
  display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .12s;
}
.wf-side-item:hover .wf-side-item-del { opacity: 1; }
.wf-side-item-del:hover { background: rgba(239,68,68,.15); color: #ef4444; }
.wf-side-empty { padding: 16px; text-align: center; font-size: 11px; color: var(--text4); }

/* Code history */
.code-hist-wrap { position: relative; }
.code-hist-count {
  font-size: 10px; padding: 1px 6px;
  border-radius: var(--radius-full); background: var(--accent-muted); color: var(--accent);
  flex-shrink: 0;
}
.code-hist-popup {
  position: absolute; bottom: 100%; left: 4px; right: 4px; margin-bottom: 4px;
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,.35);
  z-index: var(--z-dropdown); max-height: 240px; overflow-y: auto;
}
.code-hist-list { padding: 4px; }
.code-hist-item {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 8px; border-radius: 6px; cursor: pointer;
  font-size: 12px; color: var(--text2); transition: background .1s;
}
.code-hist-item:hover { background: var(--bg3); }
.code-hist-item.active { background: rgba(79,125,255,.08); color: var(--accent); }
.code-hist-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 300; }
.code-hist-date { font-size: 10px; color: var(--text3); flex-shrink: 0; }
.code-hist-del {
  width: 18px; height: 18px; border-radius: 3px; flex-shrink: 0;
  border: none; background: transparent; color: var(--text3); cursor: pointer;
  display: flex; align-items: center; justify-content: center; opacity: 0; transition: all .1s;
}
.code-hist-item:hover .code-hist-del { opacity: 1; }
.code-hist-del:hover { background: rgba(248,81,73,.1); color: var(--red); }
.code-hist-empty { padding: 12px; text-align: center; font-size: 11px; color: var(--text3); }

.hist-pop-enter-active { animation: histIn .15s ease both; transform-origin: bottom center; }
.hist-pop-leave-active { animation: histOut .1s ease both; transform-origin: bottom center; }
@keyframes histIn { from { opacity: 0; transform: translateY(6px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes histOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(6px) scale(.96); } }
.nav-section { padding: 0 8px 4px; }
.nav-item {
  display: flex; align-items: center; gap: 10px; padding: 7px 10px;
  border-radius: 8px; cursor: pointer; color: var(--text2);
  font-size: 14px; font-weight: 300;
  transition: background .12s, color .12s, padding .25s cubic-bezier(0.16,1,0.3,1);
  border: none; background: transparent; width: 100%;
  font-family: inherit; text-align: left; white-space: nowrap; overflow: hidden;
}
.nav-item:hover { background: var(--bg3); color: var(--text); }
.nav-item.active { background: var(--bg3); color: var(--text); }
.collapsed .nav-item { padding: 8px; justify-content: center; gap: 0; position: relative; background: transparent !important; }
.collapsed .nav-item svg { flex-shrink: 0; }
.collapsed .nav-item:hover { background: var(--bg3) !important; }
.collapsed .nav-item.active { background: transparent !important; }
.collapsed .nav-item.active::before {
  content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
  width: 3px; height: 16px; border-radius: 0 3px 3px 0;
  background: var(--accent);
}
.nav-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-left: auto; }
.api-warn { font-size: 10px; color: var(--red); margin-left: auto; font-weight: 400; }
.api-ok { font-size: 10px; color: var(--green); margin-left: auto; font-weight: 400; }
.nav-item.disabled { opacity: .4; cursor: not-allowed; pointer-events: none; }
.nav-badge { font-size: 9px; font-weight: 500; letter-spacing: .5px; padding: 1px 5px; border-radius: var(--radius-full); background: var(--accent-muted); color: var(--accent); margin-left: auto; }
.recents-header { padding: 10px 12px 6px; transition: padding .25s cubic-bezier(0.16,1,0.3,1); }
.collapsed .recents-header { padding: 6px 10px; }
.search-box {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px;
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: border-color .15s, padding .25s cubic-bezier(0.16,1,0.3,1);
  position: relative;
}
.search-box:focus-within { border-color: var(--border2); }
.search-box svg { color: var(--text3); flex-shrink: 0; }
.search-collapsed {
  padding: 7px; justify-content: center; border-color: transparent !important;
  background: transparent !important;
}
.search-collapsed .search-input { width: 0 !important; flex: 0 0 0 !important; padding: 0 !important; position: absolute; opacity: 0; pointer-events: none; }
.search-collapsed .search-icon { display: none; }
.search-trigger { cursor: pointer; border-radius: 4px; transition: color .12s, transform 0.15s; flex-shrink: 0; }
.search-trigger:hover { color: var(--text); transform: scale(1.15); }
.search-icon { flex-shrink: 0; }
.search-input {
  flex: 1; background: transparent; border: none; outline: none;
  color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 300;
  transition: width .25s cubic-bezier(0.16,1,0.3,1);
}
.search-input::placeholder { color: var(--text3); }
.search-clear {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; border-radius: 50%;
  border: none; background: var(--bg4); color: var(--text3); cursor: pointer;
  flex-shrink: 0; padding: 0;
}
.search-clear:hover { background: var(--text3); color: var(--bg); }

.recents-list { flex: 1; overflow-y: auto; padding: 0; min-height: 0; display: flex; flex-direction: column; }
.collapsed .recents-list { padding: 0 4px; }
.recents-list::-webkit-scrollbar { width: 3px; }
.recents-list::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }
.recent-item {
  display: flex; align-items: center; gap: 4px;
  padding: 6px 10px; border-radius: 8px; cursor: pointer;
  color: var(--text3); font-size: 13px; font-weight: 300;
  transition: background .12s, color .12s, padding .25s cubic-bezier(0.16,1,0.3,1);
  border: none; background: transparent; width: 100%; font-family: inherit;
}
.recent-item:hover { background: var(--bg3); color: var(--text2); }
.recent-item:hover .recent-actions { opacity: 1; }
.recent-item.active { background: var(--bg3); color: var(--text); }
.collapsed .recent-item {
  padding: 8px; justify-content: center; position: relative;
}
/* Single collapsed bubble — clean, no bg initially */
.collapsed-bubble {
  padding: 10px !important; margin: 4px auto; width: 40px; height: 40px;
  border-radius: 10px !important; background: transparent !important;
  transition: all 0.15s;
}
.collapsed-bubble:hover {
  background: var(--bg3) !important; color: var(--text);
}

.recent-icon { flex-shrink: 0; color: inherit; opacity: 0.65; transition: opacity 0.15s; }
.recent-item:hover .recent-icon { opacity: 1; }
.recent-item.active .recent-icon { opacity: 1; color: var(--text); }
.recent-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.recent-actions { display: flex; gap: 1px; opacity: 0; transition: opacity .12s; flex-shrink: 0; }
.recent-act {
  display: flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 5px;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; transition: all .1s;
}
.recent-act:hover { background: var(--bg4); color: var(--text2); }
.recent-act.del:hover { background: rgba(248,81,73,0.12); color: var(--red); }
.recents-empty {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  font-size: 12px; color: var(--text3); font-weight: 300; text-align: center;
}
.collapsed .recents-empty { font-size: 10px; }

/* Confirm dialog */
/* ═══ Dialogs (teleported to body, truly page-centered) ═══ */
.side-dlg-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,.5);
  display: flex; align-items: center; justify-content: center;
}
.side-dlg-box {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); padding: 24px;
  width: 340px; box-shadow: 0 12px 40px rgba(0,0,0,.5);
}
.side-dlg-hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-size: 15px; font-weight: 400; color: var(--text); }
.side-dlg-text { font-size: 15px; color: var(--text); font-weight: 400; margin: 0 0 6px; }
.side-dlg-sub { font-size: 12px; color: var(--text3); font-weight: 300; margin: 0 0 18px; }
.side-dlg-actions { display: flex; gap: 10px; justify-content: flex-end; }
.side-dlg-btn {
  padding: 7px 20px; border-radius: var(--radius-sm);
  font-size: 13px; font-family: inherit; font-weight: 400;
  border: 1px solid var(--border); background: var(--bg3);
  color: var(--text2); cursor: pointer; transition: all .12s;
}
.side-dlg-btn:hover { background: var(--bg4); color: var(--text); }
.side-dlg-btn.danger { background: var(--red); color: #fff; border-color: var(--red); }
.side-dlg-btn.danger:hover { opacity: .85; }
.side-dlg-btn.ok { background: var(--accent); color: #fff; border-color: var(--accent); }
.side-dlg-btn.ok:hover { background: var(--accent-hover); }

.side-dlg-input {
  width: 100%; padding: 8px 10px;
  background: var(--bg3); border: 1px solid var(--border);
  border-radius: var(--radius-sm); outline: none;
  color: var(--text); font-size: 14px; font-family: inherit; font-weight: 300;
}
.side-dlg-input:focus { border-color: var(--accent); }

/* ═══ Conversation toggle button ═══ */
.conv-toggle-row { flex-shrink: 0; margin-bottom: 4px; }
.collapsed .conv-toggle-row { padding: 0; margin-bottom: 4px; }
.conv-toggle-btn {
  display: flex; align-items: center; gap: 8px;
  width: 100%; padding: 8px 10px;
  border: 1px solid var(--border); border-radius: 8px;
  background: var(--bg2); color: var(--text2);
  font-size: 12px; font-family: inherit; font-weight: 500;
  cursor: pointer; transition: all .15s;
}
.collapsed .conv-toggle-btn { justify-content: center; padding: 8px; }
.conv-toggle-btn:hover { background: var(--bg3); color: var(--text); border-color: var(--border2); }
.conv-toggle-btn.active { background: var(--accent-bg, rgba(91,141,239,0.12)); color: var(--accent); border-color: var(--accent); }
.conv-toggle-count {
  margin-left: auto; background: var(--bg4); color: var(--text3);
  font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 10px;
  min-width: 18px; text-align: center;
}
.conv-toggle-btn.active .conv-toggle-count { background: var(--accent); color: #fff; }

/* ═══ Conversation slide-out panel (teleported to body) — Apple-style frosted glass ═══ */
.conv-panel-overlay {
  position: fixed; inset: 0; z-index: 45;
  background: transparent;
}
.conv-panel {
  position: fixed; top: 12px; bottom: 12px; left: calc(var(--sidebar-w, 260px) + 8px);
  width: 320px; z-index: 50;
  background: color-mix(in srgb, var(--bg2) 72%, transparent);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.40), 0 0 0 0.5px rgba(255,255,255,0.05) inset;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.conv-panel-header {
  height: 48px; padding: 0 16px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.conv-panel-title { font-size: 14px; font-weight: 600; color: var(--text); letter-spacing: -0.2px; }
.conv-panel-close {
  border: none; background: transparent; color: var(--text3);
  width: 28px; height: 28px; cursor: pointer; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.conv-panel-close:hover { background: rgba(255,255,255,0.08); color: var(--text); }
.conv-panel-search {
  position: relative; padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.conv-panel-search-icon {
  position: absolute; left: 26px; top: 50%; transform: translateY(-50%);
  color: var(--text3); pointer-events: none;
}
.conv-panel-search-input {
  width: 100%; padding: 8px 28px 8px 32px;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
  background: rgba(0,0,0,0.20); color: var(--text);
  font-size: 12px; font-family: inherit; outline: none;
  transition: all .15s; box-sizing: border-box;
}
.conv-panel-search-input:focus { border-color: var(--accent); background: rgba(0,0,0,0.30); }
.conv-panel-search-input::placeholder { color: var(--text3); }
.conv-panel-search-clear {
  position: absolute; right: 22px; top: 50%; transform: translateY(-50%);
  border: none; background: transparent; color: var(--text3);
  width: 20px; height: 20px; cursor: pointer; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.conv-panel-search-clear:hover { background: rgba(255,255,255,0.08); color: var(--text); }
.conv-panel-toolbar {
  display: flex; gap: 8px; padding: 10px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0;
}
.conv-panel-tool-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 12px; border: 1px solid rgba(255,255,255,0.08); border-radius: 9px;
  background: rgba(255,255,255,0.04); color: var(--text2);
  font-size: 11px; font-family: inherit; cursor: pointer;
  transition: all .12s;
}
.conv-panel-tool-btn:hover { background: rgba(255,255,255,0.10); color: var(--text); border-color: rgba(255,255,255,0.14); }
.conv-panel-list { flex: 1; overflow-y: auto; min-height: 0; padding: 6px 8px; }
.conv-panel-list::-webkit-scrollbar { width: 4px; }
.conv-panel-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 4px; }
.conv-panel-list::-webkit-scrollbar-track { background: transparent; }
.conv-panel-empty { padding: 32px 12px; text-align: center; color: var(--text3); font-size: 12px; }

/* Slide animation */
.conv-panel-slide-enter-active, .conv-panel-slide-leave-active {
  transition: transform .25s cubic-bezier(0.4, 0, 0.2, 1), opacity .25s;
}
.conv-panel-slide-enter-from, .conv-panel-slide-leave-to {
  transform: translateX(-16px); opacity: 0;
}

.sidebar-bottom { padding: 8px; border-top: 1px solid var(--border); display: flex; flex-direction: column; gap: 4px; transition: padding .25s cubic-bezier(0.16,1,0.3,1); }
.collapsed .sidebar-bottom { padding: 6px 4px; border-top-color: transparent; gap: 4px; }

/* ═══ Sidebar row buttons (one per line: 对话 / 设置 / 登录) ═══ */
.sb-row-btn {
  display: flex; align-items: center; gap: 10px;
  width: 100%; padding: 9px 12px;
  border: 1px solid transparent; border-radius: 10px;
  background: transparent; color: var(--text2);
  font-size: 13px; font-family: inherit; font-weight: 500;
  cursor: pointer; transition: all .15s;
}
.collapsed .sb-row-btn { justify-content: center; padding: 9px; }
.sb-row-btn:hover { background: var(--bg3); color: var(--text); }
.sb-row-btn.active { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
.sb-row-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; text-align: left; }
.sb-row-badge {
  padding: 1px 7px;
  background: var(--bg4); color: var(--text2);
  border-radius: 10px; font-size: 10px; font-weight: 600;
  flex-shrink: 0;
}
.collapsed .sb-row-badge { display: none; }
.collapsed .lang-btn { background: transparent !important; border-color: transparent !important; padding: 8px; justify-content: center; }
.collapsed .lang-btn:hover { background: var(--bg3) !important; }
.collapsed .login-prompt { background: transparent !important; padding: 8px; justify-content: center; }
.collapsed .login-prompt:hover { background: var(--bg3) !important; }
.collapsed .user-row { background: transparent !important; }

/* ═══ Language Switcher ═══ */
.lang-switcher { position: relative; }
.lang-btn {
  display: flex; align-items: center; gap: 7px;
  width: 100%; padding: 6px 9px;
  border-radius: 8px; border: 1px solid transparent;
  background: transparent; color: var(--text2);
  font-size: 12px; font-family: inherit; font-weight: 300;
  cursor: pointer; transition: all .12s, padding .25s cubic-bezier(0.16,1,0.3,1);
  white-space: nowrap; overflow: hidden;
}
.lang-btn:hover { background: var(--bg3); color: var(--text); border-color: var(--border2); }
.lang-label { flex: 1; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lang-chevron { color: var(--text3); flex-shrink: 0; transition: transform .18s ease; }
.lang-chevron.open { transform: rotate(180deg); }

.lang-menu {
  position: absolute; bottom: 100%; left: 0; right: 0;
  margin-bottom: 4px;
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius); box-shadow: 0 8px 32px rgba(0,0,0,.35);
  padding: 4px; z-index: var(--z-dropdown);
  min-width: 180px;
}

.lang-option {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 7px 10px; border-radius: 6px;
  border: none; background: transparent;
  color: var(--text2); font-size: 12px; font-family: inherit; font-weight: 300;
  cursor: pointer; transition: all .1s; text-align: left;
}
.lang-option:hover { background: var(--bg3); color: var(--text); }
.lang-option.active { background: var(--accent-muted); color: var(--accent); font-weight: 400; }
.lang-option-name { flex: 1; }
.lang-check { color: var(--accent); flex-shrink: 0; }

/* Dropdown transitions */
.lang-drop-enter-active { animation: langIn .18s ease both; transform-origin: bottom center; }
.lang-drop-leave-active { animation: langOut .12s ease both; transform-origin: bottom center; }
@keyframes langIn { from { opacity: 0; transform: translateY(6px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
@keyframes langOut { from { opacity: 1; transform: translateY(0) scale(1); } to { opacity: 0; transform: translateY(6px) scale(.96); } }

.user-row { display: flex; align-items: center; gap: 8px; padding: 4px 2px; transition: padding .25s cubic-bezier(0.16,1,0.3,1); }
.collapsed .user-row { padding: 4px; justify-content: center; }
.user-avatar { width: 28px; height: 28px; border-radius: 50%; background: var(--accent-muted); color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 500; flex-shrink: 0; }
.user-name { flex: 1; font-size: 13px; color: var(--text2); font-weight: 300; }
.logout-btn { width: 28px; height: 28px; border-radius: 6px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background .12s, color .12s; }
.logout-btn:hover { background: var(--bg3); color: var(--red); }
.login-prompt {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  border-radius: 8px; cursor: pointer; color: var(--text3);
  font-size: 13px; font-weight: 300;
  transition: background .12s, color .12s, padding .25s cubic-bezier(0.16,1,0.3,1);
  border: none; background: transparent; width: 100%;
  font-family: inherit; white-space: nowrap; overflow: hidden;
}
.login-prompt:hover { background: var(--bg3); color: var(--text); }
</style>
