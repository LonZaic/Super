// ══════════════════════════════════════
// Novel Controller — AI-written novels with chapters & pages
// ══════════════════════════════════════

const { v4: uuid } = require('uuid')
const { novel } = require('../db')
const config = require('../config')
const { sendSuccess, sendError } = require('../middleware/errorHandler')
const { broadcastNovelEvent } = require('../ws')

// ─── Novel CRUD ───

function listNovels(req, res) {
  const list = novel.listForUser(req.user.id)
  // Attach stats
  for (const n of list) {
    Object.assign(n, novel.getStats(n.id, req.user.id))
  }
  sendSuccess(res, list)
}

function getNovel(req, res) {
  const n = novel.findById(req.params.id, req.user.id)
  if (!n) return sendError(res, '小说不存在', 'NOT_FOUND', 404)
  Object.assign(n, novel.getStats(n.id, req.user.id))
  n.chapters = novel.listChapters(n.id, req.user.id)
  sendSuccess(res, n)
}

function createNovel(req, res) {
  const { title, author, summary, genre, paper_style } = req.body || {}
  if (!title) return sendError(res, '缺少标题', 'BAD_REQUEST', 400)
  const id = uuid()
  novel.create(id, req.user.id, { title, author, summary, genre, paper_style })
  const n = novel.findById(id, req.user.id)
  sendSuccess(res, n, 201)
}

function updateNovel(req, res) {
  const n = novel.findById(req.params.id, req.user.id)
  if (!n) return sendError(res, '小说不存在', 'NOT_FOUND', 404)
  novel.update(req.params.id, req.user.id, req.body || {})
  sendSuccess(res, novel.findById(req.params.id, req.user.id))
}

function deleteNovel(req, res) {
  const n = novel.findById(req.params.id, req.user.id)
  if (!n) return sendError(res, '小说不存在', 'NOT_FOUND', 404)
  novel.delete(req.params.id, req.user.id)
  sendSuccess(res, { ok: true })
}

// ─── Chapters ───

function listChapters(req, res) {
  const list = novel.listChapters(req.params.novelId, req.user.id)
  sendSuccess(res, list)
}

function createChapter(req, res) {
  const { title, chapter_no } = req.body || {}
  const n = novel.findById(req.params.novelId, req.user.id)
  if (!n) return sendError(res, '小说不存在', 'NOT_FOUND', 404)
  const existing = novel.listChapters(n.id, req.user.id)
  const no = chapter_no || (existing.length + 1)
  const id = uuid()
  novel.createChapter(id, n.id, req.user.id, title, no)
  sendSuccess(res, novel.findChapter(id, req.user.id), 201)
}

function updateChapter(req, res) {
  const c = novel.findChapter(req.params.id, req.user.id)
  if (!c) return sendError(res, '章节不存在', 'NOT_FOUND', 404)
  const data = { ...req.body }
  if (data.content !== undefined) data.words = (data.content || '').length
  novel.updateChapter(req.params.id, req.user.id, data)
  sendSuccess(res, novel.findChapter(req.params.id, req.user.id))
}

function deleteChapter(req, res) {
  const c = novel.findChapter(req.params.id, req.user.id)
  if (!c) return sendError(res, '章节不存在', 'NOT_FOUND', 404)
  novel.deleteChapter(req.params.id, req.user.id)
  sendSuccess(res, { ok: true })
}

// ─── Pages ───

function listPages(req, res) {
  const list = novel.listPages(req.params.chapterId, req.user.id)
  sendSuccess(res, list)
}

// ─── AI Generation (SSE stream) ───
// The AI writes the novel chapter-by-chapter, page-by-page, reporting
// progress in real time so the frontend can show "正在写第3章第2页…".

const PAGE_WORDS = 400  // ~400 chars per page (handwriting feel)

function generateNovel(req, res) {
  const novelId = req.params.novelId
  const { chapters = 3, wordsPerChapter = 2000, model, prompt, direction, continueFromChapter } = req.body || {}
  const apiKey = config.deepseekApiKey || req.headers['x-api-key']
  if (!apiKey) return sendError(res, '缺少 API Key', 'BAD_REQUEST', 400)

  const n = novel.findById(novelId, req.user.id)
  if (!n) return sendError(res, '小说不存在', 'NOT_FOUND', 404)

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (res.socket) res.socket.setNoDelay(true)
  res.flushHeaders()

  const emit = (event) => {
    if (!res.destroyed && res.writable) {
      res.write(`data: ${JSON.stringify(event)}\n\n`)
    }
    // Also broadcast via WebSocket so other tabs see progress
    broadcastNovelEvent(req.user.id, { novelId, ...event })
  }

  const abortController = new AbortController()
  res.on('close', () => abortController.abort())

  ;(async () => {
    try {
      emit({ type: 'start', novelId, title: n.title })
      novel.update(novelId, req.user.id, { status: 'writing' })

      const existingChapters = novel.listChapters(novelId, req.user.id)
      let startNo = existingChapters.length + 1

      for (let ch = 0; ch < chapters; ch++) {
        const chapterNo = startNo + ch
        const chapterId = uuid()
        const chapterTitle = `第${chapterNo}章`
        novel.createChapter(chapterId, novelId, req.user.id, chapterTitle, chapterNo)
        emit({ type: 'chapter_start', chapterId, chapterNo, title: chapterTitle })

        // ── Build prompt for this chapter ──
        const sysPrompt = `你是一位才华横溢的小说家。正在创作一部${n.genre}题材的小说《${n.title}》。
${n.summary ? '故事简介：' + n.summary : ''}
${direction ? '创作导向：' + direction : ''}
要求：
- 每章约${wordsPerChapter}字
- 文笔优美，情节引人入胜
- 保持人物和情节连贯
- 只输出小说正文，不要输出章节标题、不要输出任何说明
- 用中文写作`

        const prevChapters = novel.listChapters(novelId, req.user.id)
          .filter(c => c.chapter_no < chapterNo)
          .slice(-2)  // last 2 chapters for context
        const context = prevChapters.map(c => c.content).join('\n\n').slice(-2000)

        const userPrompt = `${prompt ? '用户要求：' + prompt + '\n' : ''}${context ? '上一章结尾：\n' + context.slice(-800) + '\n' : ''}请写第${chapterNo}章，约${wordsPerChapter}字。直接输出正文。`

        // ── Call DeepSeek ──
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
          },
          body: JSON.stringify({
            model: model || 'deepseek-v4-flash',
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: userPrompt }
            ],
            stream: true,
            max_tokens: Math.min(wordsPerChapter * 2, 8192),
          }),
          signal: abortController.signal,
        })

        if (!response.ok) {
          const errText = await response.text()
          emit({ type: 'error', message: `API错误: ${response.status} ${errText.slice(0, 200)}` })
          break
        }

        // ── Stream the chapter, splitting into pages ──
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullContent = ''
        let buffer = ''
        let pageNo = 1
        let currentPageId = uuid()
        novel.createPage(currentPageId, chapterId, novelId, req.user.id, pageNo, '')
        emit({ type: 'page_start', chapterId, chapterNo, pageNo, pageId: currentPageId })

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            const t = line.trim()
            if (!t.startsWith('data:')) continue
            const data = t.slice(5).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta || {}
              // deepseek-v4-flash emits reasoning_content first, then content.
              // For the novel body we only want the final `content`.
              if (delta.content) {
                fullContent += delta.content
                // Check if we have enough for a page
                while (fullContent.length >= pageNo * PAGE_WORDS) {
                  const pageContent = fullContent.slice((pageNo - 1) * PAGE_WORDS, pageNo * PAGE_WORDS)
                  novel.updatePage(currentPageId, req.user.id, { content: pageContent, status: 'done' })
                  emit({ type: 'page_done', chapterId, chapterNo, pageNo, pageId: currentPageId, words: pageContent.length })
                  pageNo++
                  currentPageId = uuid()
                  novel.createPage(currentPageId, chapterId, novelId, req.user.id, pageNo, '')
                  emit({ type: 'page_start', chapterId, chapterNo, pageNo, pageId: currentPageId })
                }
                emit({ type: 'progress', chapterId, chapterNo, pageNo, words: fullContent.length })
              }
            } catch {}
          }
        }

        // ── Finalize last page ──
        const lastPageContent = fullContent.slice((pageNo - 1) * PAGE_WORDS)
        if (lastPageContent) {
          novel.updatePage(currentPageId, req.user.id, { content: lastPageContent, status: 'done' })
          emit({ type: 'page_done', chapterId, chapterNo, pageNo, pageId: currentPageId, words: lastPageContent.length })
        } else {
          // Empty last page — remove it
          novel.deletePage(currentPageId, req.user.id)
        }

        // ── Save chapter ──
        novel.updateChapter(chapterId, req.user.id, {
          content: fullContent,
          words: fullContent.length,
          status: 'done'
        })
        emit({ type: 'chapter_done', chapterId, chapterNo, words: fullContent.length, pages: pageNo })
      }

      novel.update(novelId, req.user.id, { status: 'done' })
      emit({ type: 'final', novelId, message: '小说生成完成' })
      if (!res.destroyed && res.writable) res.end()
    } catch (e) {
      novel.update(novelId, req.user.id, { status: 'error' })
      emit({ type: 'error', message: e.message })
      if (!res.destroyed && res.writable) {
        res.write(`data: ${JSON.stringify({ type: 'error', text: e.message })}\n\n`)
        res.end()
      }
    }
  })()
}

module.exports = {
  listNovels, getNovel, createNovel, updateNovel, deleteNovel,
  listChapters, createChapter, updateChapter, deleteChapter,
  listPages,
  generateNovel,
}
