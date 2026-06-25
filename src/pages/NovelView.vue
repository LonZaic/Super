<template>
  <div class="nov-page">
    <!-- ═══ Header ═══ -->
    <div class="nov-header">
      <div class="nov-header-left">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="nov-header-icon">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5H6.5A2.5 2.5 0 0 0 4 19.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div>
          <h2 class="nov-title">{{ t('novTitle') }}</h2>
          <p class="nov-sub">{{ t('novSub') }}</p>
        </div>
      </div>
      <div class="nov-header-actions">
        <button class="nov-btn primary" @click="showCreate = true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          {{ t('novNew') }}
        </button>
      </div>
    </div>

    <!-- ═══ Bookshelf ═══ -->
    <div v-if="!novels.length && !showCreate" class="nov-empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" class="nov-empty-icon">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/>
      </svg>
      <p class="nov-empty-title">{{ t('novEmptyTitle') }}</p>
      <p class="nov-empty-desc">{{ t('novEmptyDesc') }}</p>
      <button class="nov-btn primary" @click="showCreate = true">{{ t('novCreateFirst') }}</button>
    </div>

    <div v-if="novels.length" class="nov-shelf">
      <div class="nov-shelf-row">
        <div
          v-for="n in novels"
          :key="n.id"
          class="nov-book"
          :style="{ '--book-color': genreColor(n.genre) }"
          @click="openNovel(n)"
        >
          <div class="nov-book-spine"></div>
          <div class="nov-book-cover" :style="{ background: genreGradient(n.genre, n.cover_seed) }">
            <div class="nov-book-title">{{ n.title }}</div>
            <div class="nov-book-author">{{ n.author }}</div>
            <div class="nov-book-genre">{{ n.genre }}</div>
          </div>
          <div class="nov-book-meta">
            <span class="nov-book-stat">{{ t('novChapters', n.chapters || 0) }}</span>
            <span class="nov-book-stat">{{ t('novWords', (n.words || 0)) }}</span>
          </div>
          <button class="nov-book-menu" @click.stop="openMenu($event, n)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>
          </button>
          <div v-if="n.status === 'writing'" class="nov-book-badge">{{ t('novWriting') }}</div>
        </div>
      </div>
    </div>

    <!-- ═══ Create Modal ═══ -->
    <div v-if="showCreate" class="nov-modal-mask" @click.self="closeModal">
      <div class="nov-modal">
        <div class="nov-modal-header">
          <h3>{{ t('novNewTitle') }}</h3>
          <button class="nov-modal-close" @click="closeModal">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div class="nov-modal-body">
          <div class="nov-field">
            <label>{{ t('novFieldName') }}</label>
            <input v-model="form.title" class="nov-input" :placeholder="t('novFieldNamePh')" />
          </div>
          <div class="nov-field">
            <label>{{ t('novFieldGenre') }}</label>
            <div class="nov-genres">
              <button
                v-for="g in genres"
                :key="g"
                :class="['nov-genre', { active: form.genre === g }]"
                @click="form.genre = g"
              >{{ g }}</button>
            </div>
          </div>
          <div class="nov-field">
            <label>{{ t('novFieldPaper') }}</label>
            <div class="nov-papers">
              <button
                v-for="p in paperStyles"
                :key="p.id"
                :class="['nov-paper', { active: form.paper_style === p.id }]"
                @click="form.paper_style = p.id"
              >
                <div :class="['nov-paper-preview', 'paper-' + p.id]"></div>
                <span>{{ p.name }}</span>
              </button>
            </div>
          </div>
          <div class="nov-field">
            <label>{{ t('novFieldSummary') }}</label>
            <textarea v-model="form.summary" class="nov-input nov-textarea" :placeholder="t('novFieldSummaryPh')" rows="3"></textarea>
          </div>
          <div class="nov-field">
            <label>{{ t('novFieldChapters') }}</label>
            <div class="nov-row">
              <input type="range" v-model.number="form.chapters" min="1" max="20" class="nov-range" />
              <span class="nov-range-val">{{ form.chapters }}</span>
            </div>
          </div>
          <div class="nov-field">
            <label>{{ t('novFieldWords') }}</label>
            <div class="nov-row">
              <input type="range" v-model.number="form.wordsPerChapter" min="500" max="5000" step="500" class="nov-range" />
              <span class="nov-range-val">{{ form.wordsPerChapter }}</span>
            </div>
          </div>
        </div>
        <div class="nov-modal-footer">
          <button class="nov-btn" @click="closeModal">{{ t('novCancel') }}</button>
          <button class="nov-btn primary" @click="saveNovel">{{ t('novCreate') }}</button>
        </div>
      </div>
    </div>

    <!-- ═══ Reader ═══ -->
    <div v-if="current" class="nov-reader" :class="'reader-paper-' + current.paper_style">
      <div class="nov-reader-header">
        <button class="nov-btn" @click="closeReader">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          {{ t('novBackShelf') }}
        </button>
        <div class="nov-reader-info">
          <h3>{{ current.title }}</h3>
          <span class="nov-reader-author">{{ current.author }} · {{ current.genre }}</span>
        </div>
        <div class="nov-reader-actions">
          <button v-if="current.status !== 'writing'" class="nov-btn primary" @click="openContinue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            {{ t('novContinue') }}
          </button>
          <button v-else class="nov-btn" @click="stopGenerate">{{ t('novStop') }}</button>
        </div>
      </div>

      <!-- Progress bar -->
      <div v-if="generating" class="nov-progress">
        <div class="nov-progress-text">
          <span v-if="progress.event === 'chapter_start'">{{ t('novWritingCh', progress.chapterNo) }}</span>
          <span v-else-if="progress.event === 'page_start'">{{ t('novWritingPage', progress.chapterNo, progress.pageNo) }}</span>
          <span v-else-if="progress.event === 'page_done'">{{ t('novPageDone', progress.chapterNo, progress.pageNo) }}</span>
          <span v-else-if="progress.event === 'chapter_done'">{{ t('novChDone', progress.chapterNo) }}</span>
          <span v-else-if="progress.event === 'progress'">{{ t('novProgress', progress.chapterNo, progress.pageNo, progress.words) }}</span>
          <span v-else-if="progress.event === 'final'">{{ t('novDone') }}</span>
          <span v-else>{{ t('novGenerating') }}</span>
        </div>
        <div class="nov-progress-bar">
          <div class="nov-progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
      </div>

      <!-- Chapter list -->
      <div class="nov-reader-body">
        <div class="nov-chapters">
          <div
            v-for="c in current.chapters || []"
            :key="c.id"
            :class="['nov-chapter-item', { active: activeChapter?.id === c.id }]"
            @click="selectChapter(c)"
          >
            <span class="nov-chapter-no">{{ c.chapter_no }}</span>
            <span class="nov-chapter-title">{{ c.title }}</span>
            <span class="nov-chapter-words">{{ c.words || 0 }}字</span>
          </div>
          <div v-if="!current.chapters?.length" class="nov-chapters-empty">
            {{ generating ? t('novGeneratingHint') : t('novNoChapters') }}
          </div>
        </div>

        <!-- Page reader -->
        <div class="nov-pages" v-if="activeChapter">
          <div class="nov-pages-header">
            <h4>{{ activeChapter.title }}</h4>
            <span class="nov-pages-count">{{ t('novPageOf', { n: activePageNo, t: totalPages }) }}</span>
          </div>
          <div class="nov-page-viewport">
            <transition :name="pageFlipDir" mode="out-in">
              <div :key="activePageNo" :class="['nov-page-sheet', 'paper-' + current.paper_style]">
                <div class="nov-page-content" v-html="renderPage(activePage)"></div>
              </div>
            </transition>
          </div>
          <div class="nov-pages-nav">
            <button class="nov-btn" :disabled="activePageNo <= 1" @click="prevPage">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              {{ t('novPrevPage') }}
            </button>
            <div class="nov-pages-slider">
              <input type="range" v-model.number="activePageNo" min="1" :max="totalPages" class="nov-elegant-slider" />
              <span class="nov-slider-label">{{ activePageNo }} / {{ totalPages }}</span>
            </div>
            <button class="nov-btn" :disabled="activePageNo >= totalPages" @click="nextPage">
              {{ t('novNextPage') }}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
        <div v-else class="nov-pages nov-pages-placeholder">
          <p>{{ t('novSelectChapter') }}</p>
        </div>
      </div>

      <!-- ═══ Continue / AI Write modal ═══ -->
      <div v-if="showContinue" class="nov-modal-mask" @click.self="showContinue = false">
        <div class="nov-modal nov-modal-sm">
          <div class="nov-modal-header">
            <h3>{{ t('novContinueTitle') }}</h3>
            <button class="nov-modal-close" @click="showContinue = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>
          <div class="nov-modal-body">
            <div class="nov-field">
              <label>{{ t('novContinueChapters') }}</label>
              <div class="nov-row">
                <input type="range" v-model.number="continueForm.chapters" min="1" max="10" class="nov-range" />
                <span class="nov-range-val">{{ continueForm.chapters }}</span>
              </div>
            </div>
            <div class="nov-field">
              <label>{{ t('novContinueWords') }}</label>
              <div class="nov-row">
                <input type="range" v-model.number="continueForm.wordsPerChapter" min="500" max="5000" step="500" class="nov-range" />
                <span class="nov-range-val">{{ continueForm.wordsPerChapter }}</span>
              </div>
            </div>
            <div class="nov-field">
              <label>{{ t('novContinueDirection') }}</label>
              <textarea v-model="continueForm.direction" class="nov-input nov-textarea" :placeholder="t('novContinueDirectionPh')" rows="3"></textarea>
            </div>
            <div class="nov-field">
              <label>{{ t('novContinueScope') }}</label>
              <div class="nov-genres">
                <button :class="['nov-genre', { active: continueForm.scope === 'overall' }]" @click="continueForm.scope = 'overall'">{{ t('novContinueScopeOverall') }}</button>
                <button :class="['nov-genre', { active: continueForm.scope === 'chapter' }]" @click="continueForm.scope = 'chapter'">{{ t('novContinueScopeChapter') }}</button>
              </div>
            </div>
            <div v-if="continueForm.scope === 'chapter' && current.chapters?.length" class="nov-field">
              <label>{{ t('novContinueFromCh') }}</label>
              <select v-model="continueForm.continueFromChapter" class="nov-input">
                <option :value="0">{{ t('novContinueFromLast') }}</option>
                <option v-for="c in current.chapters" :key="c.id" :value="c.chapter_no">{{ t('novContinueAfterCh', { n: c.chapter_no }) }}</option>
              </select>
            </div>
          </div>
          <div class="nov-modal-footer">
            <button class="nov-btn" @click="showContinue = false">{{ t('novCancel') }}</button>
            <button class="nov-btn primary" @click="startContinue">{{ t('novCreate') }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Context Menu ═══ -->
    <div v-if="menu.open" class="nov-menu" :style="{ top: menu.y + 'px', left: menu.x + 'px' }" @click.stop>
      <button class="nov-menu-item" @click="readNovel(menu.novel); closeMenu()">{{ t('novRead') }}</button>
      <button class="nov-menu-item danger" @click="confirmDelete(menu.novel); closeMenu()">{{ t('novDelete') }}</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { novels as novelApi } from '../api/index.js'
import { useI18n } from '../composables/useI18n.js'

const { t } = useI18n()

const novels = ref([])
const showCreate = ref(false)
const current = ref(null)
const activeChapter = ref(null)
const pages = ref([])
const activePageNo = ref(1)
const generating = ref(false)
const progress = ref({})
const abortCtrl = ref(null)
const pageFlipDir = ref('flip-next')
const showContinue = ref(false)

const genres = ['玄幻', '科幻', '都市', '历史', '悬疑', '言情', '武侠', '奇幻']

const paperStyles = [
  { id: 'lined', name: '横线纸' },
  { id: 'kraft', name: '牛皮纸' },
  { id: 'grid', name: '网格纸' },
  { id: 'blank', name: '空白纸' },
  { id: 'rice', name: '宣纸' },
  { id: 'aged', name: '泛黄旧纸' },
]

const form = reactive({
  title: '',
  genre: '玄幻',
  paper_style: 'lined',
  summary: '',
  chapters: 3,
  wordsPerChapter: 2000,
})

const continueForm = reactive({
  chapters: 2,
  wordsPerChapter: 2000,
  direction: '',
  scope: 'overall',
  continueFromChapter: 0,
})

const menu = reactive({ open: false, x: 0, y: 0, novel: null })

const totalPages = computed(() => pages.value.length)
const activePage = computed(() => pages.value[activePageNo.value - 1] || null)
const progressPct = computed(() => {
  if (!generating.value || !current.value) return 0
  const totalChapters = form.chapters || 3
  const ch = progress.value.chapterNo || 0
  const pg = progress.value.pageNo || 0
  const estPages = Math.ceil((form.wordsPerChapter || 2000) / 400)
  const done = (ch - 1) * estPages + pg
  const total = totalChapters * estPages
  return Math.min(100, Math.round((done / total) * 100))
})

function genreColor(genre) {
  const map = { '玄幻': '#7c3aed', '科幻': '#0ea5e9', '都市': '#10b981', '历史': '#a16207', '悬疑': '#475569', '言情': '#ec4899', '武侠': '#b45309', '奇幻': '#8b5cf6' }
  return map[genre] || '#5b8def'
}

function genreGradient(genre, seed) {
  const c = genreColor(genre)
  const h = (seed || 0) % 60
  return `linear-gradient(135deg, ${c}, ${c}dd 60%, hsl(${h + 200}, 60%, 30%))`
}

function renderPage(page) {
  if (!page?.content) return '<p style="color:#999;text-align:center">— 空白页 —</p>'
  return page.content.split(/\n+/).filter(Boolean).map(p => `<p>${escapeHtml(p)}</p>`).join('')
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function loadNovels() {
  try {
    novels.value = await novelApi.list() || []
  } catch (e) {
    console.error('[novel] load failed:', e)
  }
}

function openNovel(n) { readNovel(n) }

async function readNovel(n) {
  current.value = n
  activeChapter.value = null
  pages.value = []
  activePageNo.value = 1
  try {
    const full = await novelApi.get(n.id)
    current.value = full
  } catch (e) { console.error(e) }
}

function closeReader() {
  current.value = null
  activeChapter.value = null
  pages.value = []
}

async function selectChapter(c) {
  activeChapter.value = c
  activePageNo.value = 1
  try {
    pages.value = await novelApi.listPages(c.id) || []
    if (!pages.value.length) pages.value = [{ content: c.content || '', page_no: 1 }]
  } catch (e) { console.error(e) }
}

function prevPage() {
  if (activePageNo.value > 1) {
    pageFlipDir.value = 'flip-prev'
    activePageNo.value--
  }
}
function nextPage() {
  if (activePageNo.value < totalPages.value) {
    pageFlipDir.value = 'flip-next'
    activePageNo.value++
  }
}

// Keyboard navigation
function onKeydown(e) {
  if (!current.value || !activeChapter.value) return
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
  if (e.key === 'ArrowLeft') { e.preventDefault(); prevPage() }
  else if (e.key === 'ArrowRight') { e.preventDefault(); nextPage() }
}

function closeModal() {
  showCreate.value = false
  form.title = ''
  form.genre = '玄幻'
  form.paper_style = 'lined'
  form.summary = ''
  form.chapters = 3
  form.wordsPerChapter = 2000
}

async function saveNovel() {
  if (!form.title.trim()) { alert(t('novEnterTitle')); return }
  try {
    const n = await novelApi.create({
      title: form.title.trim(),
      genre: form.genre,
      paper_style: form.paper_style,
      summary: form.summary.trim(),
    })
    novels.value.unshift(n)
    closeModal()
    readNovel(n)
    setTimeout(() => openContinue(), 300)
  } catch (e) { alert('创建失败: ' + e.message) }
}

function openContinue() {
  continueForm.chapters = 2
  continueForm.wordsPerChapter = form.wordsPerChapter || 2000
  continueForm.direction = ''
  continueForm.scope = 'overall'
  continueForm.continueFromChapter = 0
  showContinue.value = true
}

async function startContinue() {
  if (!current.value) return
  showContinue.value = false
  generating.value = true
  progress.value = { event: 'start' }
  abortCtrl.value = new AbortController()
  try {
    const direction = continueForm.scope === 'chapter' && continueForm.continueFromChapter > 0
      ? `从第${continueForm.continueFromChapter}章之后开始续写。${continueForm.direction}`
      : continueForm.direction
    await novelApi.generate(current.value.id, {
      chapters: continueForm.chapters,
      wordsPerChapter: continueForm.wordsPerChapter,
      model: 'deepseek-v4-flash',
      direction,
      continueFromChapter: continueForm.continueFromChapter,
    }, (evt) => {
      progress.value = { ...evt, event: evt.type }
      if (evt.type === 'chapter_start' || evt.type === 'chapter_done' || evt.type === 'final') {
        refreshCurrent()
      }
      if (evt.type === 'page_done' && activeChapter.value?.id === evt.chapterId) {
        refreshPages()
      }
    }, abortCtrl.value.signal)
  } catch (e) {
    if (e.name !== 'AbortError') alert('生成失败: ' + e.message)
  } finally {
    generating.value = false
    refreshCurrent()
  }
}

async function startGenerate() {
  openContinue()
}

function stopGenerate() {
  if (abortCtrl.value) abortCtrl.value.abort()
  generating.value = false
}

async function refreshCurrent() {
  if (!current.value) return
  try {
    const full = await novelApi.get(current.value.id)
    current.value = full
  } catch {}
}

async function refreshPages() {
  if (!activeChapter.value) return
  try {
    pages.value = await novelApi.listPages(activeChapter.value.id) || []
  } catch {}
}

function openMenu(e, n) {
  menu.open = true
  menu.x = e.clientX
  menu.y = e.clientY
  menu.novel = n
}

function closeMenu() { menu.open = false }

async function confirmDelete(n) {
  if (!confirm(t('novDeleteConfirm', { name: n.title }))) return
  try {
    await novelApi.delete(n.id)
    novels.value = novels.value.filter(x => x.id !== n.id)
    if (current.value?.id === n.id) closeReader()
  } catch (e) { alert('删除失败: ' + e.message) }
}

onMounted(() => {
  loadNovels()
  document.addEventListener('click', closeMenu)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
  window.removeEventListener('keydown', onKeydown)
  if (abortCtrl.value) abortCtrl.value.abort()
})
</script>

<style scoped>
.nov-page {
  height: 100vh;
  overflow-y: auto;
  background: var(--bg);
  padding: 32px 40px;
}

/* Header */
.nov-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 28px;
}
.nov-header-left { display: flex; gap: 14px; align-items: flex-start; }
.nov-header-icon { color: var(--text2); flex-shrink: 0; margin-top: 2px; }
.nov-title { margin: 0; font-size: 20px; font-weight: 600; color: var(--text); }
.nov-sub { margin: 4px 0 0; font-size: 13px; color: var(--text3); }
.nov-header-actions { display: flex; gap: 8px; }

.nov-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--bg2);
  color: var(--text2);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.nov-btn:hover { background: var(--bg3); color: var(--text); }
.nov-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.nov-btn.primary { background: #5b8def; color: #fff; border-color: #5b8def; }
.nov-btn.primary:hover { opacity: 0.88; }

/* Empty state */
.nov-empty {
  text-align: center;
  padding: 80px 20px;
  color: var(--text3);
}
.nov-empty-icon { color: var(--text3); opacity: 0.4; margin-bottom: 16px; }
.nov-empty-title { font-size: 16px; color: var(--text2); margin: 0 0 8px; }
.nov-empty-desc { font-size: 13px; margin: 0 0 20px; }

/* ═══ Bookshelf ═══ */
.nov-shelf {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
}
.nov-shelf-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 120px));
  gap: 20px;
  justify-content: start;
}
.nov-book {
  position: relative;
  cursor: pointer;
  transition: transform 0.2s;
  width: 120px;
}
.nov-book:hover { transform: translateY(-4px); }
.nov-book-spine {
  position: absolute;
  left: 0; top: 3px; bottom: 3px;
  width: 5px;
  background: var(--book-color, #5b8def);
  border-radius: 2px 0 0 2px;
  box-shadow: inset -2px 0 4px rgba(0,0,0,0.2);
}
.nov-book-cover {
  margin-left: 5px;
  height: 168px;
  border-radius: 0 5px 5px 0;
  padding: 14px 10px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: #fff;
  box-shadow: 3px 4px 12px rgba(0,0,0,0.3);
  position: relative;
  overflow: hidden;
}
.nov-book-cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(0,0,0,0.2) 0%, transparent 6px);
  pointer-events: none;
}
.nov-book-title {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  text-shadow: 0 1px 3px rgba(0,0,0,0.5);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.nov-book-author { font-size: 10px; opacity: 0.85; }
.nov-book-genre {
  font-size: 9px;
  padding: 1px 7px;
  background: rgba(255,255,255,0.2);
  border-radius: 8px;
  align-self: flex-start;
}
.nov-book-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 10px;
  color: var(--text3);
}
.nov-book-menu {
  position: absolute;
  top: 6px; right: 6px;
  background: rgba(0,0,0,0.3);
  border: none;
  color: #fff;
  width: 20px; height: 20px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s;
}
.nov-book:hover .nov-book-menu { opacity: 1; }
.nov-book-badge {
  position: absolute;
  top: 6px; left: 10px;
  background: #f59e0b;
  color: #fff;
  font-size: 9px;
  padding: 1px 7px;
  border-radius: 8px;
  animation: pulse 1.5s infinite;
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }

/* ═══ Modal ═══ */
.nov-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nov-modal {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 560px;
  max-width: 92vw;
  max-height: 88vh;
  overflow-y: auto;
}
.nov-modal-sm {
  width: 440px;
}
.nov-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}
.nov-modal-header h3 { margin: 0; font-size: 16px; color: var(--text); }
.nov-modal-close {
  background: none; border: none; color: var(--text3);
  cursor: pointer; padding: 4px;
}
.nov-modal-body { padding: 20px; }
.nov-modal-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.nov-field { margin-bottom: 16px; }
.nov-field label {
  display: block;
  font-size: 12px;
  color: var(--text3);
  margin-bottom: 6px;
}
.nov-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  font-size: 14px;
}
.nov-input:focus { outline: none; border-color: #5b8def; }
.nov-textarea { resize: vertical; font-family: inherit; }
.nov-row { display: flex; align-items: center; gap: 12px; }
.nov-range { flex: 1; }
.nov-range-val { font-size: 14px; color: var(--text2); min-width: 50px; text-align: right; }

.nov-genres { display: flex; flex-wrap: wrap; gap: 6px; }
.nov-genre {
  padding: 5px 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  font-size: 12px;
  color: var(--text2);
  cursor: pointer;
}
.nov-genre.active { background: #5b8def; color: #fff; border-color: #5b8def; }

.nov-papers { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.nov-paper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px;
  background: var(--bg);
  border: 2px solid var(--border);
  border-radius: 6px;
  cursor: pointer;
  font-size: 11px;
  color: var(--text2);
}
.nov-paper.active { border-color: #5b8def; }
.nov-paper-preview {
  width: 100%;
  height: 40px;
  border-radius: 3px;
}

/* Paper styles */
.paper-lined {
  background: #fff;
  background-image: repeating-linear-gradient(transparent, transparent 23px, #c8d4e0 24px);
}
.paper-kraft {
  background: #d4b896;
  background-image: radial-gradient(rgba(120,80,40,0.08) 1px, transparent 1px);
  background-size: 4px 4px;
}
.paper-grid {
  background: #fff;
  background-image:
    linear-gradient(#e0e0e0 1px, transparent 1px),
    linear-gradient(90deg, #e0e0e0 1px, transparent 1px);
  background-size: 20px 20px;
}
.paper-blank { background: #fff; }
.paper-rice {
  background: #f4ecd8;
  background-image: radial-gradient(rgba(180,150,100,0.1) 1px, transparent 1px);
  background-size: 6px 6px;
}
.paper-aged {
  background: #ede0c8;
  background-image:
    radial-gradient(ellipse at 20% 30%, rgba(160,120,60,0.15) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, rgba(140,100,50,0.12) 0%, transparent 50%);
}

/* ═══ Reader ═══ */
.nov-reader {
  position: fixed;
  inset: 0;
  z-index: 150;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}
.nov-reader-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
}
.nov-reader-info { text-align: center; }
.nov-reader-info h3 { margin: 0; font-size: 16px; color: var(--text); }
.nov-reader-author { font-size: 12px; color: var(--text3); }
.nov-reader-actions { display: flex; gap: 8px; }

.nov-progress {
  padding: 10px 24px;
  background: var(--bg2);
  border-bottom: 1px solid var(--border);
}
.nov-progress-text { font-size: 13px; color: var(--text2); margin-bottom: 6px; }
.nov-progress-bar {
  height: 4px;
  background: var(--bg);
  border-radius: 2px;
  overflow: hidden;
}
.nov-progress-fill {
  height: 100%;
  background: #5b8def;
  transition: width 0.3s;
}

.nov-reader-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.nov-chapters {
  width: 240px;
  border-right: 1px solid var(--border);
  overflow-y: auto;
  background: var(--bg2);
}
.nov-chapter-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid var(--border);
  transition: background 0.15s;
}
.nov-chapter-item:hover { background: var(--bg3); }
.nov-chapter-item.active { background: var(--bg3); border-left: 3px solid #5b8def; }
.nov-chapter-no {
  font-size: 11px;
  color: var(--text3);
  background: var(--bg);
  border-radius: 3px;
  padding: 1px 6px;
}
.nov-chapter-title { flex: 1; font-size: 13px; color: var(--text); }
.nov-chapter-words { font-size: 11px; color: var(--text3); }
.nov-chapters-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text3);
  font-size: 13px;
}

.nov-pages {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 32px;
  overflow: hidden;
  min-width: 0;
}
.nov-pages-placeholder {
  align-items: center;
  justify-content: center;
  color: var(--text3);
}
.nov-pages-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.nov-pages-header h4 { margin: 0; font-size: 15px; color: var(--text); }
.nov-pages-count { font-size: 12px; color: var(--text3); }

/* Page viewport - holds the sheet, no scroll */
.nov-page-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
}
.nov-page-sheet {
  width: 100%;
  max-width: 720px;
  padding: 40px 56px;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  font-family: 'KaiTi', 'STKaiti', '楷体', serif;
  font-size: 16px;
  line-height: 32px;
  color: #2c2416;
  letter-spacing: 0.5px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.nov-page-content {
  flex: 1;
  overflow: hidden;
}
.nov-page-content p {
  margin: 0 0 16px;
  text-indent: 2em;
}

/* ═══ Page flip animations ═══ */
.flip-next-enter-active,
.flip-next-leave-active,
.flip-prev-enter-active,
.flip-prev-leave-active {
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s;
}
.flip-next-enter-from {
  transform: translateX(40px) rotateY(-8deg);
  opacity: 0;
}
.flip-next-leave-to {
  transform: translateX(-40px) rotateY(8deg);
  opacity: 0;
}
.flip-prev-enter-from {
  transform: translateX(-40px) rotateY(8deg);
  opacity: 0;
}
.flip-prev-leave-to {
  transform: translateX(40px) rotateY(-8deg);
  opacity: 0;
}

.nov-pages-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  flex-shrink: 0;
}

/* ═══ Elegant slider ═══ */
.nov-pages-slider {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  max-width: 320px;
}
.nov-elegant-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  height: 4px;
  background: var(--bg3);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
  position: relative;
}
.nov-elegant-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #5b8def;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(91,141,239,0.4);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.nov-elegant-slider::-webkit-slider-thumb:hover {
  transform: scale(1.2);
  box-shadow: 0 3px 10px rgba(91,141,239,0.6);
}
.nov-elegant-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #5b8def;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(91,141,239,0.4);
  cursor: pointer;
}
.nov-slider-label {
  font-size: 12px;
  color: var(--text3);
  min-width: 50px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* ═══ Context menu ═══ */
.nov-menu {
  position: fixed;
  z-index: 300;
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.35);
  padding: 4px;
  min-width: 120px;
}
.nov-menu-item {
  display: block;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  color: var(--text2);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: 4px;
}
.nov-menu-item:hover { background: var(--bg3); color: var(--text); }
.nov-menu-item.danger { color: #ef4444; }
.nov-menu-item.danger:hover { background: rgba(239,68,68,0.1); }
</style>
