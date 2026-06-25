<template>
  <div class="file-bubble" @click="openPreview">
    <div class="fb-icon" :class="fileType">
      <!-- 不同文件类型的 SVG 图标 -->
      <svg v-if="fileType === 'text'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
        <path d="M12 2v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M7 10h6M7 13h6M7 16h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
      </svg>
      <svg v-else-if="fileType === 'word'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
        <path d="M12 2v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M7 12l1.5 4 1.5-3 1.5 3 1.5-4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else-if="fileType === 'pdf'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
        <path d="M12 2v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <text x="10" y="15" font-size="4" fill="currentColor" text-anchor="middle" font-weight="600">PDF</text>
      </svg>
      <svg v-else-if="fileType === 'table'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
        <path d="M12 2v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="6.5" y="10" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
        <rect x="9" y="10" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
        <rect x="11.5" y="10" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
        <rect x="6.5" y="12.5" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
        <rect x="9" y="12.5" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
        <rect x="11.5" y="12.5" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
        <rect x="6.5" y="15" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
        <rect x="9" y="15" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
        <rect x="11.5" y="15" width="2" height="2" stroke="currentColor" stroke-width="0.8"/>
      </svg>
      <svg v-else-if="fileType === 'ppt'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
        <path d="M12 2v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <rect x="6.5" y="10" width="7" height="4" rx="0.5" stroke="currentColor" stroke-width="1"/>
        <path d="M8 14v1.5M12 14v1.5M7 16h6" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
      </svg>
      <svg v-else-if="fileType === 'code'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
        <path d="M12 2v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M8 10l-2 2 2 2M12 10l2 2-2 2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M5 2h7l5 5v11a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/>
        <path d="M12 2v5h5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
      </svg>
    </div>
    <div class="fb-info">
      <div class="fb-name">{{ name }}</div>
      <div class="fb-meta">
        <span class="fb-type">{{ typeLabel }}</span>
        <span v-if="size" class="fb-size">{{ size }}</span>
      </div>
    </div>
    <div class="fb-action">
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </div>

  <!-- 预览弹窗 -->
  <teleport to="body">
    <div v-if="showPreview" class="fb-modal-overlay" @click.self="showPreview = false">
      <div class="fb-modal">
        <div class="fb-modal-header">
          <div class="fb-modal-title">
            <span class="fb-modal-name">{{ name }}</span>
            <span class="fb-modal-type">{{ typeLabel }}</span>
          </div>
          <button class="fb-modal-close" @click="showPreview = false">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="fb-modal-body">
          <!-- 文本类内容：渲染 Markdown -->
          <div v-if="fileType === 'text' || fileType === 'word' || fileType === 'code'" class="fb-content-text" v-html="renderedContent"></div>
          <!-- 表格类内容：渲染 HTML 表格 -->
          <div v-else-if="fileType === 'table'" class="fb-content-table" v-html="renderedContent"></div>
          <!-- PDF 类内容：显示文本 -->
          <div v-else-if="fileType === 'pdf'" class="fb-content-text" v-html="renderedContent"></div>
          <!-- 其他 -->
          <div v-else class="fb-content-text" v-html="renderedContent"></div>
        </div>
        <div class="fb-modal-footer">
          <button class="fb-copy-btn" @click="copyContent">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M5 5h5v5H5" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
            <span>{{ copied ? '已复制' : '复制内容' }}</span>
          </button>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from '../../composables/useI18n.js'

const { t } = useI18n()

const props = defineProps({
  name: { type: String, required: true },
  type: { type: String, default: 'text' }, // text, word, pdf, table, code
  content: { type: String, default: '' },
  size: { type: String, default: '' },
  isRealFile: { type: Boolean, default: false }, // 真实电脑文件 vs 渲染形式
  filePath: { type: String, default: '' }, // 真实文件路径
})

const emit = defineEmits(['open-file'])

const showPreview = ref(false)
const copied = ref(false)

const fileType = computed(() => props.type || 'text')

const typeLabel = computed(() => {
  const labels = {
    text: 'TXT',
    word: 'DOC',
    pdf: 'PDF',
    table: 'XLSX',
    ppt: 'PPT',
    code: 'CODE',
  }
  return labels[fileType.value] || 'FILE'
})

// 简单的 Markdown 渲染
const renderedContent = computed(() => {
  let html = props.content || ''
  // 转义 HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // 斜体
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // 行内代码
  html = html.replace(/`(.+?)`/g, '<code>$1</code>')
  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
  // 列表
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
  // 段落（连续两个换行）
  html = html.replace(/\n\n/g, '</p><p>')
  html = '<p>' + html + '</p>'
  // 清理空段落
  html = html.replace(/<p>\s*<\/p>/g, '')
  return html
})

function openPreview() {
  // 如果是真实电脑文件，直接打开
  if (props.isRealFile && props.filePath) {
    emit('open-file', props.filePath)
    return
  }
  // 否则显示渲染弹窗
  showPreview.value = true
}

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.content || '')
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) {
    console.error('Copy failed:', e)
  }
}
</script>

<style scoped>
.file-bubble { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--bg2); cursor: pointer; transition: all .12s; max-width: 280px; min-width: 200px; }
.file-bubble:hover { border-color: var(--accent); background: var(--bg3); }

.fb-icon { flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: var(--radius-sm); }
.fb-icon.text { color: var(--text2); background: rgba(99,102,241,0.08); }
.fb-icon.word { color: #2b579a; background: rgba(43,87,154,0.08); }
.fb-icon.pdf { color: #dc2626; background: rgba(220,38,38,0.08); }
.fb-icon.table { color: #16a34a; background: rgba(22,163,74,0.08); }
.fb-icon.code { color: #6366f1; background: rgba(99,102,241,0.08); }

.fb-info { flex: 1; min-width: 0; }
.fb-name { font-size: 12px; color: var(--text); font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fb-meta { display: flex; gap: 6px; margin-top: 1px; }
.fb-type { font-size: 9px; color: var(--text3); font-weight: 500; }
.fb-size { font-size: 9px; color: var(--text3); }

.fb-action { flex-shrink: 0; color: var(--text3); display: flex; align-items: center; }
.file-bubble:hover .fb-action { color: var(--accent); }

/* ─── 预览弹窗 ─── */
.fb-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
.fb-modal { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); max-width: 720px; width: 100%; max-height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
.fb-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.fb-modal-title { display: flex; align-items: center; gap: 8px; }
.fb-modal-name { font-size: 14px; font-weight: 500; color: var(--text); }
.fb-modal-type { font-size: 10px; color: var(--text3); background: var(--bg3); padding: 2px 6px; border-radius: 4px; }
.fb-modal-close { width: 28px; height: 28px; border: none; background: transparent; color: var(--text3); cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); transition: all .12s; }
.fb-modal-close:hover { background: var(--bg3); color: var(--text); }

.fb-modal-body { flex: 1; overflow-y: auto; padding: 16px; }
.fb-content-text { font-size: 13px; line-height: 1.6; color: var(--text); word-break: break-word; }
.fb-content-text :deep(h1) { font-size: 18px; font-weight: 600; margin: 12px 0 8px; }
.fb-content-text :deep(h2) { font-size: 16px; font-weight: 600; margin: 10px 0 6px; }
.fb-content-text :deep(h3) { font-size: 14px; font-weight: 600; margin: 8px 0 4px; }
.fb-content-text :deep(p) { margin: 6px 0; }
.fb-content-text :deep(ul) { margin: 6px 0; padding-left: 20px; }
.fb-content-text :deep(li) { margin: 2px 0; }
.fb-content-text :deep(code) { font-family: var(--font-mono); font-size: 12px; background: var(--bg3); padding: 1px 4px; border-radius: 3px; }
.fb-content-text :deep(pre) { background: var(--bg3); padding: 8px 12px; border-radius: var(--radius-sm); overflow-x: auto; margin: 8px 0; }
.fb-content-text :deep(pre code) { background: transparent; padding: 0; }
.fb-content-text :deep(strong) { font-weight: 600; }
.fb-content-text :deep(em) { font-style: italic; }

.fb-content-table { font-size: 12px; }
.fb-content-table :deep(table) { width: 100%; border-collapse: collapse; }
.fb-content-table :deep(th), .fb-content-table :deep(td) { border: 1px solid var(--border); padding: 6px 10px; text-align: left; }
.fb-content-table :deep(th) { background: var(--bg3); font-weight: 600; }
.fb-content-table :deep(tr:nth-child(even)) { background: var(--bg2); }

.fb-modal-footer { display: flex; justify-content: flex-end; padding: 8px 16px; border-top: 1px solid var(--border); }
.fb-copy-btn { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: transparent; color: var(--text2); cursor: pointer; font-size: 11px; font-family: inherit; transition: all .12s; }
.fb-copy-btn:hover { border-color: var(--accent); color: var(--accent); }
</style>
