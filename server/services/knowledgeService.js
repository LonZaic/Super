// ═══════════════════════════════════════════════════════════════════════
// Knowledge Base RAG Service — Local Embedding + Vector Search
//
// Uses @xenova/transformers (all-MiniLM-L6-v2) for embeddings.
// Stores documents + vectors in better-sqlite3.
// Supports: PDF, Word, TXT, MD, code files.
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

// ─── Lazy-loaded pipeline (transformers is heavy) ───
let _pipeline = null
let _loadingPromise = null
let _useFallback = false

// Configure HF mirror for CN network compatibility.
// huggingface.co is often unreachable from CN due to TLS/connect timeouts,
// while hf-mirror.com works reliably. We set this BEFORE importing transformers.
// Allow override via env: HF_ENDPOINT=https://huggingface.co
if (!process.env.HF_ENDPOINT) {
  process.env.HF_ENDPOINT = 'https://hf-mirror.com'
}

async function getPipeline() {
  if (_pipeline) return _pipeline
  if (_loadingPromise) return _loadingPromise
  _loadingPromise = (async () => {
    try {
      const { pipeline, env } = await import('@xenova/transformers')
      // Point transformers.js at the mirror
      env.remoteHost = process.env.HF_ENDPOINT
      env.allowLocalModels = true
      env.useBrowserCache = false
      // all-MiniLM-L6-v2: 384-dim, fast, multilingual-ish, ~23MB
      _pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true,
      })
      console.log('[knowledge] embedding model loaded successfully from', env.remoteHost)
      return _pipeline
    } catch (e) {
      console.warn('[knowledge] transformers pipeline load failed, using fallback hashing embedder:', e.message)
      _useFallback = true
      return null
    }
  })()
  return _loadingPromise
}

// ─── Fallback hash-based embedder (no network required) ───
// Produces a 384-dim normalized vector via character/word hashing.
// Quality is lower than MiniLM but keeps RAG functional offline.
function hashEmbed(text, dim = 384) {
  const vec = new Float32Array(dim)
  const tokens = text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter(Boolean)
  for (const tok of tokens) {
    // djb2 hash per token, then distribute across several dims
    let h = 5381
    for (let i = 0; i < tok.length; i++) {
      h = ((h << 5) + h + tok.charCodeAt(i)) | 0
    }
    // Spread across 3 dims to reduce collisions
    for (let k = 0; k < 3; k++) {
      const idx = Math.abs((h ^ (k * 0x9e3779b9)) >>> 0) % dim
      vec[idx] += 1
    }
    // Also add char-level n-gram hashing for short tokens
    if (tok.length <= 3) {
      for (let i = 0; i < tok.length; i++) {
        const idx = (tok.charCodeAt(i) * 31) % dim
        vec[idx] += 0.5
      }
    }
  }
  // L2 normalize
  let norm = 0
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i]
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < dim; i++) vec[i] /= norm
  return Array.from(vec)
}

// ─── Embedding helper ───
async function embed(text) {
  await getPipeline()
  if (_useFallback || !_pipeline) {
    return hashEmbed(text)
  }
  const output = await _pipeline(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data) // Float32Array → Array
}

// ─── Cosine similarity (vectors are normalized, so dot product = cosine) ───
function cosine(a, b) {
  let dot = 0
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
  return dot
}

// ─── DB path ───
const DB_PATH = path.join(__dirname, '..', 'db', 'knowledge.sqlite')
let _db = null

function getDB() {
  if (_db) return _db
  // Ensure db dir exists
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS kb_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      source TEXT DEFAULT '',
      file_type TEXT DEFAULT '',
      char_count INTEGER DEFAULT 0,
      chunk_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS kb_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doc_id TEXT NOT NULL,
      chunk_index INTEGER DEFAULT 0,
      text TEXT NOT NULL,
      embedding TEXT,        -- JSON array of floats
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (doc_id) REFERENCES kb_documents(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_kb_chunks_doc ON kb_chunks(doc_id);
  `)
  return _db
}

// ─── Text chunking (sliding window, overlap for context continuity) ───
function chunkText(text, chunkSize = 500, overlap = 80) {
  if (!text) return []
  // Normalize whitespace but keep paragraph breaks
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim()
  if (normalized.length <= chunkSize) return [normalized]

  const chunks = []
  // Split by paragraphs first, then merge to target size
  const paragraphs = normalized.split(/\n{2,}/)
  let current = ''
  for (const para of paragraphs) {
    if ((current + '\n\n' + para).length <= chunkSize) {
      current = current ? current + '\n\n' + para : para
    } else {
      if (current) chunks.push(current)
      // If single paragraph > chunkSize, hard-split with overlap
      if (para.length > chunkSize) {
        for (let i = 0; i < para.length; i += chunkSize - overlap) {
          chunks.push(para.slice(i, i + chunkSize))
        }
        current = ''
      } else {
        current = para
      }
    }
  }
  if (current) chunks.push(current)
  return chunks
}

// ─── File content extraction ───
async function extractText(filePath, fileType) {
  const ext = (fileType || path.extname(filePath)).toLowerCase().replace(/^\./, '')
  // Plain text formats
  if (['txt', 'md', 'markdown', 'json', 'csv', 'log', 'js', 'ts', 'py', 'java', 'c', 'cpp', 'go', 'rs', 'rb', 'php', 'sh', 'yml', 'yaml', 'xml', 'html', 'css', 'sql'].includes(ext)) {
    return fs.readFileSync(filePath, 'utf-8')
  }
  // PDF
  if (ext === 'pdf') {
    try {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const data = new Uint8Array(fs.readFileSync(filePath))
      const doc = await pdfjs.getDocument({ data }).promise
      let text = ''
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map(it => it.str).join(' ') + '\n\n'
      }
      return text
    } catch (e) { throw new Error('PDF 解析失败: ' + e.message) }
  }
  // Word .docx
  if (ext === 'docx') {
    try {
      const mammoth = require('mammoth')
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value || ''
    } catch {
      // Fallback: docxtemplater unzip approach
      try {
        const PizZip = require('pizzip')
        const zip = new PizZip(fs.readFileSync(filePath))
        const docXml = zip.file('word/document.xml')
        if (docXml) {
          const xml = docXml.asText()
          return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        }
      } catch {}
      throw new Error('Word 文档解析失败，请安装 mammoth 或检查文件格式')
    }
  }
  throw new Error(`不支持的文件格式: .${ext}`)
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Add a document to the knowledge base.
 * @param {Object} opts { id, title, filePath, fileType, source }
 * @returns {Object} { id, chunkCount, charCount }
 */
async function addDocument({ id, title, filePath, fileType, source }) {
  const db = getDB()
  const text = await extractText(filePath, fileType)
  const chunks = chunkText(text)

  // Insert document
  db.prepare(`INSERT INTO kb_documents (id, title, source, file_type, char_count, chunk_count) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, title, source || '', fileType || '', text.length, chunks.length)

  // Insert chunks with embeddings
  const insertChunk = db.prepare(`INSERT INTO kb_chunks (doc_id, chunk_index, text, embedding) VALUES (?, ?, ?, ?)`)
  const insertMany = db.transaction((items) => {
    for (const item of items) insertChunk.run(...item)
  })

  const batch = []
  for (let i = 0; i < chunks.length; i++) {
    const emb = await embed(chunks[i])
    batch.push([id, i, chunks[i], JSON.stringify(emb)])
  }
  insertMany(batch)

  return { id, chunkCount: chunks.length, charCount: text.length }
}

/**
 * Add raw text directly (no file).
 */
async function addText({ id, title, text, source }) {
  const db = getDB()
  const chunks = chunkText(text)
  db.prepare(`INSERT INTO kb_documents (id, title, source, file_type, char_count, chunk_count) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, title, source || '', 'text', text.length, chunks.length)

  const insertChunk = db.prepare(`INSERT INTO kb_chunks (doc_id, chunk_index, text, embedding) VALUES (?, ?, ?, ?)`)
  for (let i = 0; i < chunks.length; i++) {
    const emb = await embed(chunks[i])
    insertChunk.run(id, i, chunks[i], JSON.stringify(emb))
  }
  return { id, chunkCount: chunks.length, charCount: text.length }
}

/**
 * Search the knowledge base for relevant chunks.
 * @param {string} query - Natural language query
 * @param {number} topK - Number of results
 * @returns {Array} [{ docId, docTitle, text, score, chunkIndex }]
 */
async function search(query, topK = 4) {
  const db = getDB()
  const queryEmb = await embed(query)

  const rows = db.prepare(`SELECT c.id, c.doc_id, c.chunk_index, c.text, c.embedding, d.title as doc_title
                           FROM kb_chunks c JOIN kb_documents d ON c.doc_id = d.id`).all()

  if (!rows.length) return []

  const scored = rows.map(r => {
    let emb
    try { emb = JSON.parse(r.embedding) } catch { return null }
    return {
      docId: r.doc_id,
      docTitle: r.doc_title,
      chunkIndex: r.chunk_index,
      text: r.text,
      score: cosine(queryEmb, emb),
    }
  }).filter(Boolean)

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}

/**
 * List all documents.
 */
function listDocuments() {
  const db = getDB()
  return db.prepare(`SELECT id, title, source, file_type, char_count, chunk_count, created_at FROM kb_documents ORDER BY created_at DESC`).all()
}

/**
 * Delete a document and its chunks.
 */
function deleteDocument(id) {
  const db = getDB()
  db.prepare(`DELETE FROM kb_chunks WHERE doc_id = ?`).run(id)
  db.prepare(`DELETE FROM kb_documents WHERE id = ?`).run(id)
  return true
}

/**
 * Get document detail with chunks (for preview).
 */
function getDocument(id) {
  const db = getDB()
  const doc = db.prepare(`SELECT * FROM kb_documents WHERE id = ?`).get(id)
  if (!doc) return null
  const chunks = db.prepare(`SELECT chunk_index, text FROM kb_chunks WHERE doc_id = ? ORDER BY chunk_index ASC`).all(id)
  return { ...doc, chunks }
}

/**
 * Check if pipeline is loaded (or fallback is active).
 */
function isReady() {
  return _pipeline !== null || _useFallback
}

module.exports = {
  addDocument,
  addText,
  search,
  listDocuments,
  deleteDocument,
  getDocument,
  isReady,
  // For warm-up
  warmup: () => getPipeline().catch(() => {}),
}
