<template>
  <div class="mcp-form-overlay" @click.self="handleClose">
    <div class="mcp-form-modal">
      <div class="mfp-header">
        <h3>{{ editing ? '编辑 MCP 服务器' : '添加 MCP 服务器' }}</h3>
        <button class="mfp-close" @click="handleClose">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="mfp-body">
        <!-- ═══ Preset selector ═══ -->
        <div v-if="!editing" class="form-group">
          <label class="form-label">主流服务商预设 <span class="form-hint-inline">（选择后自动填充）</span></label>
          <div class="preset-grid">
            <button
              v-for="p in presets"
              :key="p.name"
              type="button"
              :class="['preset-chip', { active: activePreset === p.name }]"
              @click="applyPreset(p)"
            >
              <span class="preset-icon" v-html="p.icon"></span>
              <span class="preset-name">{{ p.name }}</span>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">服务器名称 <span class="form-required">*</span></label>
          <input v-model="form.name" class="form-input" placeholder="例如 github, filesystem, postgres" :disabled="editing" />
          <span v-if="nameError" class="form-err">{{ nameError }}</span>
        </div>

        <div class="form-group">
          <label class="form-label">传输类型</label>
          <select v-model="form.config.type" class="form-input">
            <option value="stdio">stdio (命令行启动)</option>
            <option value="http">HTTP (流式传输)</option>
            <option value="sse">SSE (服务端推送)</option>
          </select>
        </div>

        <template v-if="form.config.type === 'stdio' || !form.config.type">
          <div class="form-group">
            <label class="form-label">命令</label>
            <input v-model="form.config.command" class="form-input mono" placeholder="npx 或 uvx" />
          </div>
          <div class="form-group">
            <label class="form-label">参数</label>
            <input v-model="argsText" class="form-input mono" placeholder="-y @org/mcp-server-name" />
            <span class="form-hint">空格分隔的参数列表</span>
          </div>
        </template>

        <template v-if="form.config.type === 'http' || form.config.type === 'sse'">
          <div class="form-group">
            <label class="form-label">URL 地址</label>
            <input v-model="form.config.url" class="form-input mono" placeholder="https://mcp.example.com/mcp" />
          </div>
          <div class="form-group">
            <label class="form-label">请求头 (JSON)</label>
            <input v-model="headersText" class="form-input mono" placeholder='{"Authorization": "Bearer ..."}' />
          </div>
        </template>

        <div class="form-group">
          <label class="form-label">环境变量</label>
          <textarea v-model="envText" class="form-input env-area" placeholder="KEY1=value1&#10;KEY2=value2" rows="3"></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <input v-model="form.config.description" class="form-input" placeholder="此服务器提供什么能力" />
        </div>

        <div v-if="testResult" :class="['test-result', testResult.success ? 'ok' : 'fail']">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <template v-if="testResult.success">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
          </svg>
          <span>{{ testResult.success ? '连接成功！发现 ' + (testResult.toolCount || 0) + ' 个工具' : (testResult.error || '连接失败') }}</span>
        </div>

        <div v-if="saveResult" :class="['test-result', saveResult.success ? 'ok' : 'fail']">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <template v-if="saveResult.success">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 12l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </template>
            <template v-else>
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.3"/>
              <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </template>
          </svg>
          <span>{{ saveResult.message }}</span>
        </div>
      </div>

      <div class="mfp-actions">
        <button class="mfp-btn test" :disabled="testing" @click="testConn">
          <svg v-if="testing" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity=".25"/>
            <path d="M22 12a10 10 0 00-9-9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span>{{ testing ? '测试中...' : '测试连接' }}</span>
        </button>
        <div class="mfp-right-actions">
          <button class="mfp-btn cancel" :disabled="saving" @click="handleClose">取消</button>
          <button class="mfp-btn save" :disabled="saving" @click="save">
            <svg v-if="saving" class="spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" opacity=".25"/>
              <path d="M22 12a10 10 0 00-9-9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>{{ saving ? '保存中...' : (editing ? '更新' : '添加服务器') }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'

const props = defineProps({
  editing: { type: Boolean, default: false },
  initialName: { type: String, default: '' },
  initialConfig: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'saved'])

const form = reactive({
  name: props.initialName || '',
  config: reactive({
    type: props.initialConfig.type || 'stdio',
    command: props.initialConfig.command || '',
    args: props.initialConfig.args || [],
    url: props.initialConfig.url || '',
    headers: props.initialConfig.headers || {},
    env: props.initialConfig.env || {},
    description: props.initialConfig.description || '',
  }),
})

const argsText = ref((props.initialConfig.args || []).join(' '))
const headersText = ref('')
const envText = ref('')
const testing = ref(false)
const saving = ref(false)
const testResult = ref(null)
const saveResult = ref(null)
const nameError = ref('')
const activePreset = ref('')

// ═══ Mainstream MCP service presets ═══
const presets = [
  {
    name: 'GitHub',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6 0-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.7-5.5 6 .4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'], env: { GITHUB_PERSONAL_ACCESS_TOKEN: '<your-token>' }, description: 'GitHub 仓库、Issue、PR 管理' }
  },
  {
    name: 'Filesystem',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '/Users/username/Documents'], env: {}, description: '本地文件系统读写访问' }
  },
  {
    name: 'Postgres',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:pass@localhost:5432/db'], env: {}, description: 'PostgreSQL 数据库查询' }
  },
  {
    name: 'SQLite',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/></svg>',
    config: { type: 'stdio', command: 'uvx', args: ['mcp-server-sqlite', '--db-path', './data.db'], env: {}, description: 'SQLite 数据库操作' }
  },
  {
    name: 'Puppeteer',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="10" r="1.5" fill="currentColor"/><path d="M9 15c1 1 2 1.5 3 1.5s2-.5 3-1.5"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'], env: {}, description: '浏览器自动化、网页截图与抓取' }
  },
  {
    name: 'Brave Search',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.3 14.2c-.2 0-.4.1-.5.2l-.3.3-.2.4-.3.5-.2.4-.4.3-.5.2h-.5l-.5-.2-.4-.3-.3-.5-.2-.4-.3-.5-.2-.4-.4-.3-.5-.2c-.2 0-.4-.1-.6 0l-.5.2-.4.3-.3.4-.2.5v.6l.2.5.3.4.4.3.5.2h.6l.5-.2.4-.3.3-.4.2-.5v-.1l.3.4.4.3.5.2h.6l.5-.2.4-.3.3-.4.2-.5v-.6l-.2-.5-.3-.4-.4-.3-.5-.2h-.3M12 2l3 2.5 3.5-.5 1 3.5 3 2-1.5 3.3 1.5 3.3-3 2-1 3.5-3.5-.5L12 22l-3-2.5-3.5.5-1-3.5-3-2 1.5-3.3L1.5 8l3-2 1-3.5L9 3l3-1z"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'], env: { BRAVE_API_KEY: '<your-key>' }, description: 'Brave 搜索引擎查询' }
  },
  {
    name: 'Google Drive',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9.5 3h5L21 12l-3 5h-5l3-5-3-5H9.5l3 5-3 5h-5L1 12l3-5h5l-3 5h5l3-5z" opacity=".9"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-google-drive'], env: { GOOGLE_CLIENT_ID: '<id>', GOOGLE_CLIENT_SECRET: '<secret>' }, description: 'Google Drive 文件访问' }
  },
  {
    name: 'Slack',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 15a2 2 0 1 1-2-2h2v2zm1 0a2 2 0 1 1 4 0v5a2 2 0 1 1-4 0v-5zm2-8a2 2 0 1 1 2-2v2H8zm0 1a2 2 0 1 1 0 4H3a2 2 0 1 1 0-4h5zm8 2a2 2 0 1 1 2 2h-2v-2zm-1 0a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v7zm-2 8a2 2 0 1 1-2 2v-2h2zm0-1a2 2 0 1 1 0-4h5a2 2 0 1 1 0 4h-5z"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-slack'], env: { SLACK_BOT_TOKEN: '<xoxb-token>' }, description: 'Slack 频道消息管理' }
  },
  {
    name: 'Memory',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'], env: {}, description: '知识图谱记忆存储' }
  },
  {
    name: 'Fetch',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/><circle cx="12" cy="12" r="3"/></svg>',
    config: { type: 'stdio', command: 'uvx', args: ['mcp-server-fetch'], env: {}, description: '网页内容抓取与转换' }
  },
  {
    name: 'Sequential Thinking',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 4h6a2 2 0 0 1 2 2v2M9 20h6a2 2 0 0 0 2-2v-2M4 9v6M20 9v6"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sequential-thinking'], env: {}, description: '结构化逐步推理思考' }
  },
  {
    name: 'Pixso',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></svg>',
    config: { type: 'http', url: 'https://mcp.pixso.cn/mcp', headers: { 'Authorization': 'Bearer <your-pixso-token>' }, env: {}, description: 'Pixso 设计文件交互（需配置 Token）' }
  },
  {
    name: 'Figma',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 24a4 4 0 0 0 4-4v-4H8a4 4 0 1 0 0 8z"/><path d="M4 12a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z"/><path d="M4 4a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z"/><path d="M12 0h4a4 4 0 1 1 0 8h-4V0z"/><circle cx="16" cy="12" r="4"/></svg>',
    config: { type: 'http', url: 'https://mcp.figma.com/mcp', headers: { 'X-Figma-Token': '<your-figma-token>' }, env: {}, description: 'Figma 设计文件读取' }
  },
  {
    name: 'Notion',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8v8M8 8l8 8M16 8v8"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-notion'], env: { NOTION_API_KEY: '<your-integration-token>' }, description: 'Notion 文档与数据库访问' }
  },
  {
    name: 'Sentry',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M13.3 3L4 19h3.5l5.8-10 5.8 10H22L13.3 3zM12 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-sentry'], env: { SENTRY_AUTH_TOKEN: '<your-token>' }, description: 'Sentry 错误监控数据查询' }
  },
  {
    name: 'Linear',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M2 12l10 10h6L2 6v6zm0-6l18 18h4v-1L3 1H2v5zm10-5L2 11v6L21 2h-9z"/></svg>',
    config: { type: 'http', url: 'https://mcp.linear.app/mcp', headers: { 'Authorization': '<linear-api-key>' }, env: {}, description: 'Linear 项目管理' }
  },
  {
    name: 'GitLab',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.5l9-6.5-2-6-2 6h-10l-2-6-2 6 9 6.5zm0-2l-7-5 1 3 6 4 6-4 1-3-7 5z"/></svg>',
    config: { type: 'stdio', command: 'npx', args: ['-y', '@modelcontextprotocol/server-gitlab'], env: { GITLAB_PERSONAL_ACCESS_TOKEN: '<your-token>' }, description: 'GitLab 仓库与 CI 管理' }
  },
  {
    name: '自定义',
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 5v14M5 12h14"/></svg>',
    config: null
  }
]

function applyPreset(p) {
  activePreset.value = p.name
  if (!p.config) return // 自定义 - 不填
  form.config.type = p.config.type
  form.config.command = p.config.command || ''
  form.config.url = p.config.url || ''
  form.config.description = p.config.description || ''
  argsText.value = (p.config.args || []).join(' ')
  headersText.value = p.config.headers ? JSON.stringify(p.config.headers, null, 2) : ''
  envText.value = p.config.env && Object.keys(p.config.env).length
    ? Object.entries(p.config.env).map(([k, v]) => `${k}=${v}`).join('\n')
    : ''
  // 自动填充服务器名（小写英文）
  if (!form.name.trim()) {
    form.name = p.name.toLowerCase().replace(/\s+/g, '-')
  }
}

onMounted(() => {
  if (props.initialConfig.headers && Object.keys(props.initialConfig.headers).length) {
    try { headersText.value = JSON.stringify(props.initialConfig.headers, null, 2) } catch {}
  }
  if (props.initialConfig.env && Object.keys(props.initialConfig.env).length) {
    envText.value = Object.entries(props.initialConfig.env).map(([k, v]) => `${k}=${v}`).join('\n')
  }
})

watch(argsText, (v) => {
  form.config.args = v.trim() ? v.trim().split(/\s+/) : []
})

// Clear name error when user types
watch(() => form.name, () => { nameError.value = '' })

function handleClose() {
  if (saving.value) return
  emit('close')
}

async function testConn() {
  testing.value = true
  testResult.value = null
  saveResult.value = null
  try {
    const { useMcpStore } = await import('../../stores/mcpStore.js')
    const store = useMcpStore()
    testResult.value = await store.testConnection(form.name || 'test', getConfig())
  } catch (e) {
    testResult.value = { success: false, error: e.message || '测试连接失败，请检查网络和配置' }
  } finally {
    testing.value = false
  }
}

function getConfig() {
  const config = { ...form.config }
  if (headersText.value.trim()) {
    try { config.headers = JSON.parse(headersText.value) } catch { config.headers = {} }
  }
  if (envText.value.trim()) {
    const env = {}
    envText.value.split('\n').forEach(line => {
      const idx = line.indexOf('=')
      if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    })
    config.env = env
  }
  config.description = form.config.description
  return config
}

async function save() {
  // Validate
  nameError.value = ''
  saveResult.value = null

  if (!form.name.trim()) {
    nameError.value = '请输入服务器名称'
    return
  }

  const cfg = getConfig()
  const isStdio = cfg.type === 'stdio' || !cfg.type

  if (isStdio && !cfg.command?.trim()) {
    saveResult.value = { success: false, message: '请填写命令（如 npx 或 uvx）' }
    return
  }

  saving.value = true
  try {
    const { useMcpStore } = await import('../../stores/mcpStore.js')
    const store = useMcpStore()

    if (props.editing) {
      await store.updateServer(form.name.trim(), cfg, null)
      saveResult.value = { success: true, message: '服务器 "' + form.name.trim() + '" 已更新' }
    } else {
      await store.addServer(form.name.trim(), cfg, null)
      saveResult.value = { success: true, message: '服务器 "' + form.name.trim() + '" 已添加' }
    }

    // Brief delay so user can see success, then close
    setTimeout(() => {
      emit('saved')
    }, 800)
  } catch (e) {
    saveResult.value = { success: false, message: e?.message || '保存失败，请检查网络连接' }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.mcp-form-overlay {
  position: fixed; inset: 0; z-index: var(--z-modal);
  background: rgba(0,0,0,.65);
  display: flex; align-items: center; justify-content: center;
  animation: fadeIn .2s ease;
}
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }

.mcp-form-modal {
  background: var(--bg2); border: 1px solid var(--border2);
  border-radius: var(--radius-lg); padding: 0;
  width: 500px; max-width: 92vw; max-height: 85vh;
  overflow: hidden; display: flex; flex-direction: column;
}
.mfp-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: 1px solid var(--border);
}
.mfp-header h3 { font-size: 15px; font-weight: 500; color: var(--text); }
.mfp-close {
  width: 28px; height: 28px; border-radius: 6px;
  border: none; background: transparent; color: var(--text3);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all .12s;
}
.mfp-close:hover { background: var(--bg3); color: var(--text2); }
.mfp-body { padding: 16px 20px; overflow-y: auto; flex: 1; }

.form-group { margin-bottom: 12px; }
.form-label { display: block; font-size: 11px; color: var(--text2); margin-bottom: 4px; font-family: inherit; }
.form-required { color: var(--red); }
.form-hint-inline { color: var(--text3); font-weight: 300; margin-left: 4px; }
.form-input {
  width: 100%; background: var(--bg3); border: 1px solid var(--border);
  border-radius: 8px; padding: 8px 10px; color: var(--text);
  font-size: 13px; font-family: inherit; font-weight: 300; outline: none;
  transition: border-color .15s; box-sizing: border-box;
}
.form-input:focus { border-color: var(--accent); }
.form-input.mono { font-family: var(--font-mono); font-size: 12px; }
.form-hint { font-size: 10px; color: var(--text3); margin-top: 4px; display: block; }
.form-err { font-size: 11px; color: var(--red); margin-top: 4px; display: block; }
.env-area { font-family: var(--font-mono); font-size: 11px; resize: vertical; }

/* ═══ Preset chips ═══ */
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 6px;
  margin-top: 4px;
}
.preset-chip {
  display: flex; align-items: center; gap: 6px;
  padding: 7px 10px; border-radius: 8px;
  border: 1px solid var(--border); background: var(--bg3);
  color: var(--text2); font-size: 12px; font-family: inherit;
  cursor: pointer; transition: all .12s;
  text-align: left;
}
.preset-chip:hover {
  border-color: var(--accent); color: var(--text);
  background: var(--bg4);
}
.preset-chip.active {
  border-color: var(--accent); background: rgba(91,141,239,0.12);
  color: var(--accent);
}
.preset-icon {
  display: flex; align-items: center; justify-content: center;
  width: 16px; height: 16px; flex-shrink: 0;
}
.preset-name {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.test-result {
  display: flex; align-items: flex-start; gap: 8px;
  padding: 10px 14px; border-radius: var(--radius-sm);
  font-size: 12px; font-weight: 300; margin-top: 8px; line-height: 1.5;
}
.test-result.ok { color: var(--green); background: rgba(63,185,80,0.08); }
.test-result.fail { color: var(--red); background: rgba(248,81,73,0.08); }
.test-result svg { flex-shrink: 0; margin-top: 1px; }

.mfp-actions {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; border-top: 1px solid var(--border); gap: 8px;
}
.mfp-right-actions { display: flex; gap: 8px; }

.mfp-btn {
  padding: 8px 16px; border-radius: var(--radius-sm);
  border: 1px solid var(--border); background: var(--bg3);
  color: var(--text2); font-size: 13px; font-family: inherit; font-weight: 400;
  cursor: pointer; transition: all .12s; display: flex; align-items: center; gap: 6px;
}
.mfp-btn:hover { background: var(--bg4); color: var(--text); }
.mfp-btn:disabled { opacity: .5; cursor: not-allowed; }
.mfp-btn.save { background: var(--accent); color: #fff; border-color: var(--accent); }
.mfp-btn.save:hover:not(:disabled) { background: var(--accent-hover); }
.mfp-btn.test { gap: 8px; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
</style>
