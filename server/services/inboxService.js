// ═══════════════════════════════════════════════════════════════════════
// Inbox Service — Unified information agent
//
// Aggregates messages from multiple sources so the AI can act as the user's
// information agent: read incoming messages, summarize, and reply.
//
// Supported sources:
//   - email     : IMAP receive + SMTP send (reuses nodemailer)
//   - feishu    : Lark/Feishu bot API (tenant_access_token)
//   - dingtalk  : DingTalk group webhook (send) + stream/callback (receive)
//   - wecom     : Enterprise WeChat (企业微信) webhook send
//   - github    : GitHub notifications / issues / PRs (personal token)
//   - rss       : RSS/Atom feed subscription
//
// All source configs are persisted in SQLite (inbox_sources table).
// ═══════════════════════════════════════════════════════════════════════

const fs = require('fs')
const path = require('path')
const Database = require('better-sqlite3')

const DB_PATH = path.join(__dirname, '..', 'db', 'inbox.sqlite')
let _db = null

function getDB() {
  if (_db) return _db
  const dir = path.dirname(DB_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.exec(`
    CREATE TABLE IF NOT EXISTS inbox_sources (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '未命名',
      config TEXT DEFAULT '{}',
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `)
  return _db
}

// ═══════════════════════════════════════════════════════════════════════
// Source type metadata (for frontend config UI)
// ═══════════════════════════════════════════════════════════════════════

const SOURCE_TYPES = {
  email: {
    name: '邮箱',
    icon: 'mail',
    description: 'IMAP 收件 + SMTP 发件，AI 可读取收件箱并代你回复',
    fields: [
      { key: 'imapHost', label: 'IMAP 服务器', placeholder: 'imap.qq.com', required: true },
      { key: 'imapPort', label: 'IMAP 端口', placeholder: '993', required: true, default: '993' },
      { key: 'smtpHost', label: 'SMTP 服务器', placeholder: 'smtp.qq.com', required: true },
      { key: 'smtpPort', label: 'SMTP 端口', placeholder: '465', required: true, default: '465' },
      { key: 'user', label: '邮箱地址', placeholder: 'you@example.com', required: true },
      { key: 'pass', label: '授权码/密码', type: 'password', required: true },
    ],
    capabilities: ['receive', 'send'],
  },
  feishu: {
    name: '飞书',
    icon: 'feishu',
    description: '飞书机器人，AI 可读取群消息并发送消息',
    fields: [
      { key: 'appId', label: 'App ID', placeholder: 'cli_xxx', required: true },
      { key: 'appSecret', label: 'App Secret', type: 'password', required: true },
      { key: 'chatId', label: '群 chat_id（可选，留空读全部）', placeholder: 'oc_xxx' },
    ],
    capabilities: ['receive', 'send'],
  },
  dingtalk: {
    name: '钉钉',
    icon: 'dingtalk',
    description: '钉钉群机器人 Webhook，AI 可向群发送消息',
    fields: [
      { key: 'webhook', label: 'Webhook 地址', placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=xxx', required: true },
      { key: 'secret', label: '加签密钥（可选）', type: 'password' },
    ],
    capabilities: ['send'],
  },
  wecom: {
    name: '企业微信',
    icon: 'wecom',
    description: '企业微信群机器人 Webhook，AI 可向群发送消息',
    fields: [
      { key: 'webhook', label: 'Webhook 地址', placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx', required: true },
    ],
    capabilities: ['send'],
  },
  github: {
    name: 'GitHub',
    icon: 'github',
    description: 'GitHub 通知、Issues、PRs，AI 可读取你的 GitHub 动态',
    fields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', required: true, placeholder: 'ghp_xxx' },
      { key: 'user', label: '用户名（可选）', placeholder: 'your-username' },
    ],
    capabilities: ['receive'],
  },
  rss: {
    name: 'RSS 订阅',
    icon: 'rss',
    description: '订阅任意 RSS/Atom 源，AI 可读取最新文章',
    fields: [
      { key: 'url', label: 'RSS/Atom 地址', placeholder: 'https://example.com/feed.xml', required: true },
    ],
    capabilities: ['receive'],
  },
}

// ═══════════════════════════════════════════════════════════════════════
// CRUD
// ═══════════════════════════════════════════════════════════════════════

function listSources() {
  const db = getDB()
  return db.prepare('SELECT id, type, name, config, enabled, created_at, updated_at FROM inbox_sources ORDER BY created_at DESC').all()
    .map(s => ({ ...s, config: safeParse(s.config), enabled: !!s.enabled }))
}

function getSource(id) {
  const db = getDB()
  const s = db.prepare('SELECT * FROM inbox_sources WHERE id = ?').get(id)
  if (!s) return null
  return { ...s, config: safeParse(s.config), enabled: !!s.enabled }
}

function saveSource(id, data) {
  const db = getDB()
  const existing = db.prepare('SELECT id FROM inbox_sources WHERE id = ?').get(id)
  const config = typeof data.config === 'string' ? data.config : JSON.stringify(data.config || {})
  const enabled = data.enabled === false ? 0 : 1
  if (existing) {
    db.prepare(`UPDATE inbox_sources SET type=?, name=?, config=?, enabled=?, updated_at=datetime('now','localtime') WHERE id=?`)
      .run(data.type, data.name || SOURCE_TYPES[data.type]?.name || '未命名', config, enabled, id)
  } else {
    db.prepare(`INSERT INTO inbox_sources (id, type, name, config, enabled) VALUES (?, ?, ?, ?, ?)`)
      .run(id, data.type, data.name || SOURCE_TYPES[data.type]?.name || '未命名', config, enabled)
  }
  return getSource(id)
}

function deleteSource(id) {
  const db = getDB()
  db.prepare('DELETE FROM inbox_sources WHERE id = ?').run(id)
  return true
}

function safeParse(s) {
  try { return typeof s === 'string' ? JSON.parse(s) : (s || {}) } catch { return {} }
}

// ═══════════════════════════════════════════════════════════════════════
// Unified message shape:
//   { source, sourceName, channel, id, from, to, subject, body, date, unread, raw }
// ═══════════════════════════════════════════════════════════════════════

// ─── Email: IMAP fetch recent messages ───
async function fetchEmail(source, opts = {}) {
  const { ImapFlow } = require('imapflow')
  const cfg = source.config || {}
  const limit = opts.limit || 10
  const client = new ImapFlow({
    host: cfg.imapHost,
    port: parseInt(cfg.imapPort) || 993,
    secure: (parseInt(cfg.imapPort) || 993) === 993,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  })
  await client.connect()
  let lock
  try {
    lock = await client.getMailboxLock('INBOX')
    const status = await client.status('INBOX', { messages: true, unseen: true })
    // Fetch last N messages (newest first)
    const total = status.messages || 0
    const start = Math.max(1, total - limit + 1)
    const messages = []
    for await (const msg of client.fetch(`${start}:${total}`, { envelope: true, source: true, flags: true, internalDate: true }, { uid: true })) {
      const env = msg.envelope || {}
      const from = env.from?.[0] ? `${env.from[0].name || ''} <${env.from[0].address}>` : ''
      const to = (env.to || []).map(a => a.address).join(', ')
      // Extract text body from raw source
      const raw = msg.source ? msg.source.toString('utf-8') : ''
      const body = extractEmailText(raw)
      messages.push({
        source: 'email',
        sourceName: source.name,
        channel: 'INBOX',
        id: String(msg.uid),
        from,
        to,
        subject: env.subject || '(无主题)',
        body,
        date: env.date || msg.internalDate || new Date().toISOString(),
        unread: msg.flags ? !msg.flags.has('\\Seen') : false,
        raw: { messageId: env.messageId, inReplyTo: env.inReplyTo },
      })
    }
    // Newest first
    messages.reverse()
    return { messages, stats: { total, unseen: status.unseen || 0 } }
  } finally {
    if (lock) lock.release()
    await client.logout().catch(() => {})
  }
}

// Extract plain text from raw email source (simple parser, no dependency)
function extractEmailText(raw) {
  // Try to find text/plain part
  const parts = raw.split(/\r?\n\r?\n/)
  if (parts.length < 2) return raw.slice(0, 2000)
  const headers = parts[0]
  const body = parts.slice(1).join('\n\n')
  // If multipart, find text/plain section
  const boundaryMatch = headers.match(/boundary="?([^\s"]+)"?/i)
  if (boundaryMatch) {
    const boundary = boundaryMatch[1]
    const sections = body.split('--' + boundary)
    for (const sec of sections) {
      if (/content-type:\s*text\/plain/i.test(sec)) {
        const secParts = sec.split(/\r?\n\r?\n/)
        return decodeEmailBody(secParts.slice(1).join('\n\n'), sec).slice(0, 4000)
      }
    }
    // Fallback: first non-header section
    for (const sec of sections) {
      if (sec.trim() && !sec.startsWith('--')) {
        const secParts = sec.split(/\r?\n\r?\n/)
        return decodeEmailBody(secParts.slice(1).join('\n\n'), sec).slice(0, 4000)
      }
    }
  }
  return decodeEmailBody(body, headers).slice(0, 4000)
}

function decodeEmailBody(text, headers) {
  let out = text
  // Quoted-printable
  if (/content-transfer-encoding:\s*quoted-printable/i.test(headers)) {
    out = out.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  }
  // Base64
  if (/content-transfer-encoding:\s*base64/i.test(headers)) {
    try {
      const cleaned = out.replace(/\s/g, '')
      out = Buffer.from(cleaned, 'base64').toString('utf-8')
    } catch {}
  }
  // Strip HTML tags if it looks like HTML
  if (/<html|<div|<p|<br/i.test(out)) {
    out = out.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\n{3,}/g, '\n\n').trim()
  }
  return out
}

// ─── Email: send via SMTP (supports multiple recipients) ───
async function sendEmail(source, { to, cc, subject, text, html, inReplyTo, attachments }) {
  const nodemailer = require('nodemailer')
  const cfg = source.config || {}
  // Normalize `to` to array
  const toList = Array.isArray(to) ? to : (to ? [to] : [])
  if (!toList.length) throw new Error('收件人为空')
  const transporter = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: parseInt(cfg.smtpPort) || 465,
    secure: (parseInt(cfg.smtpPort) || 465) === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  })
  const mailOpts = {
    from: cfg.user,
    to: toList.join(', '),
    subject: subject || '(无主题)',
    text: text || '',
  }
  if (cc) mailOpts.cc = Array.isArray(cc) ? cc.join(', ') : cc
  if (html) mailOpts.html = html
  if (inReplyTo) mailOpts.inReplyTo = inReplyTo
  if (Array.isArray(attachments) && attachments.length) mailOpts.attachments = attachments
  const info = await transporter.sendMail(mailOpts)
  return { success: true, messageId: info.messageId, recipients: toList.length }
}

// ─── Feishu: get tenant_access_token ───
let _feishuTokenCache = {} // appId → { token, expires }
async function getFeishuToken(cfg) {
  const now = Date.now()
  const cached = _feishuTokenCache[cfg.appId]
  if (cached && cached.expires > now + 60000) return cached.token
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: cfg.appId, app_secret: cfg.appSecret }),
  })
  const data = await res.json()
  if (data.code !== 0) throw new Error('飞书鉴权失败: ' + (data.msg || ''))
  const token = data.tenant_access_token
  _feishuTokenCache[cfg.appId] = { token, expires: now + (data.expire || 7200) * 1000 }
  return token
}

// ─── Feishu: list recent messages from chats ───
async function fetchFeishu(source, opts = {}) {
  const cfg = source.config || {}
  const limit = opts.limit || 20
  const token = await getFeishuToken(cfg)
  const messages = []
  // List chats the bot is in
  const chatRes = await fetch('https://open.feishu.cn/open-apis/im/v1/chats?page_size=50', {
    headers: { Authorization: 'Bearer ' + token },
  })
  const chatData = await chatRes.json()
  const chats = chatData.data?.items || []
  // If a specific chatId is configured, only fetch that one
  const targetChats = cfg.chatId
    ? chats.filter(c => c.chat_id === cfg.chatId)
    : chats.slice(0, 5) // limit to first 5 chats to avoid rate limits
  for (const chat of targetChats) {
    try {
      const msgRes = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?container_id_type=chat&container_id=${chat.chat_id}&page_size=${Math.min(limit, 20)}&sort_type=ByCreateTimeDesc`, {
        headers: { Authorization: 'Bearer ' + token },
      })
      const msgData = await msgRes.json()
      const items = msgData.data?.items || []
      for (const item of items) {
        let bodyText = ''
        try {
          const content = JSON.parse(item.body?.content || '{}')
          bodyText = content.text || content.content || JSON.stringify(content)
        } catch { bodyText = item.body?.content || '' }
        messages.push({
          source: 'feishu',
          sourceName: source.name,
          channel: chat.name || chat.chat_id,
          id: item.message_id,
          from: item.sender?.id || 'unknown',
          to: chat.name || '',
          subject: '',
          body: bodyText,
          date: new Date(parseInt(item.create_time) * 1000).toISOString(),
          unread: false,
          raw: { chatId: chat.chat_id, msgType: item.msg_type },
        })
      }
    } catch (e) {
      // skip chat on error
    }
  }
  return { messages, stats: { chats: targetChats.length } }
}

// ─── Feishu: send message to a chat ───
async function sendFeishu(source, { chatId, text, msgType }) {
  const cfg = source.config || {}
  const token = await getFeishuToken(cfg)
  const targetChat = chatId || cfg.chatId
  if (!targetChat) throw new Error('未指定飞书群 chat_id')
  const type = msgType || 'text'
  const content = type === 'text' ? JSON.stringify({ text: text || '' }) : text
  const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receive_id: targetChat, msg_type: type, content }),
  })
  const data = await res.json()
  if (data.code !== 0) throw new Error('飞书发送失败: ' + (data.msg || ''))
  return { success: true, messageId: data.data?.message_id }
}

// ─── DingTalk: send via webhook (with optional signing) ───
async function sendDingTalk(source, { text, title, markdown }) {
  const cfg = source.config || {}
  let url = cfg.webhook
  if (cfg.secret) {
    const crypto = require('crypto')
    const timestamp = Date.now()
    const stringToSign = timestamp + '\n' + cfg.secret
    const sign = crypto.createHmac('sha256', cfg.secret).update(stringToSign).digest('base64')
    url += `&timestamp=${timestamp}&sign=${encodeURIComponent(sign)}`
  }
  const body = markdown
    ? { msgtype: 'markdown', markdown: { title: title || '消息', text: markdown } }
    : { msgtype: 'text', text: { content: text || '' } }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.errcode) throw new Error('钉钉发送失败: ' + (data.errmsg || ''))
  return { success: true }
}

// ─── Enterprise WeChat: send via webhook ───
async function sendWeCom(source, { text, markdown }) {
  const cfg = source.config || {}
  const body = markdown
    ? { msgtype: 'markdown', markdown: { content: markdown } }
    : { msgtype: 'text', text: { content: text || '' } }
  const res = await fetch(cfg.webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (data.errcode) throw new Error('企业微信发送失败: ' + (data.errmsg || ''))
  return { success: true }
}

// ─── GitHub: fetch notifications + recent issues/PRs ───
async function fetchGitHub(source, opts = {}) {
  const cfg = source.config || {}
  const limit = opts.limit || 15
  const headers = {
    Authorization: 'Bearer ' + cfg.token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const messages = []
  // Notifications
  try {
    const res = await fetch('https://api.github.com/notifications?per_page=' + limit, { headers })
    if (res.ok) {
      const items = await res.json()
      for (const item of items) {
        messages.push({
          source: 'github',
          sourceName: source.name,
          channel: item.repository?.full_name || 'github',
          id: item.id,
          from: item.subject?.latest_comment_url ? '' : (item.repository?.full_name || ''),
          to: cfg.user || '',
          subject: item.subject?.title || '',
          body: `类型: ${item.subject?.type || 'notification'}\n仓库: ${item.repository?.full_name || ''}\n原因: ${item.reason || ''}`,
          date: item.updated_at,
          unread: item.unread,
          raw: { url: item.subject?.url, type: item.subject?.type },
        })
      }
    }
  } catch {}
  // If user specified, fetch their recent issues
  if (cfg.user) {
    try {
      const res = await fetch(`https://api.github.com/search/issues?q=author:${cfg.user}+is:issue&sort=updated&per_page=10`, { headers })
      if (res.ok) {
        const data = await res.json()
        for (const item of (data.items || [])) {
          messages.push({
            source: 'github',
            sourceName: source.name,
            channel: item.repository_url?.split('/').slice(-1)[0] || 'github',
            id: String(item.id),
            from: item.user?.login || '',
            to: cfg.user,
            subject: item.title || '',
            body: (item.body || '').slice(0, 1000),
            date: item.updated_at,
            unread: item.state === 'open',
            raw: { number: item.number, state: item.state, url: item.html_url },
          })
        }
      }
    } catch {}
  }
  // Sort by date desc
  messages.sort((a, b) => new Date(b.date) - new Date(a.date))
  return { messages, stats: { count: messages.length } }
}

// ─── RSS: fetch and parse feed ───
async function fetchRSS(source, opts = {}) {
  const cfg = source.config || {}
  const limit = opts.limit || 15
  const res = await fetch(cfg.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InboxBot/1.0)' },
  })
  if (!res.ok) throw new Error('RSS 获取失败: HTTP ' + res.status)
  const xml = await res.text()
  const items = parseRSS(xml, limit)
  const messages = items.map(item => ({
    source: 'rss',
    sourceName: source.name,
    channel: source.name,
    id: item.guid || item.link || item.title,
    from: item.author || source.name,
    to: '',
    subject: item.title || '(无标题)',
    body: (item.description || item.content || '').replace(/<[^>]+>/g, '').slice(0, 2000),
    date: item.pubDate || new Date().toISOString(),
    unread: false,
    raw: { link: item.link },
  }))
  return { messages, stats: { count: messages.length } }
}

// Minimal RSS/Atom XML parser (no dependency)
function parseRSS(xml, limit = 15) {
  const items = []
  // RSS 2.0: <item>...</item>
  const itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || []
  for (const block of itemMatches.slice(0, limit)) {
    items.push({
      title: extractTag(block, 'title'),
      link: extractTag(block, 'link'),
      description: extractTag(block, 'description'),
      pubDate: extractTag(block, 'pubDate'),
      author: extractTag(block, 'author') || extractTag(block, 'dc:creator'),
      guid: extractTag(block, 'guid'),
      content: extractTag(block, 'content:encoded'),
    })
  }
  if (items.length) return items
  // Atom: <entry>...</entry>
  const entryMatches = xml.match(/<entry[\s\S]*?<\/entry>/gi) || []
  for (const block of entryMatches.slice(0, limit)) {
    items.push({
      title: extractTag(block, 'title'),
      link: extractAttr(block, 'link', 'href'),
      description: extractTag(block, 'summary') || extractTag(block, 'content'),
      pubDate: extractTag(block, 'published') || extractTag(block, 'updated'),
      author: extractTag(block, 'name'),
      guid: extractTag(block, 'id'),
      content: extractTag(block, 'content'),
    })
  }
  return items
}

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'i'))
  if (!m) return ''
  // Strip CDATA
  let v = m[1].trim()
  v = v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  return v
}

function extractAttr(xml, tag, attr) {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*${attr}="([^"]*)"`, 'i'))
  return m ? m[1] : ''
}

// ═══════════════════════════════════════════════════════════════════════
// Unified fetch: pull from one or all sources
// ═══════════════════════════════════════════════════════════════════════

async function fetchMessages(sourceId, opts = {}) {
  const sources = sourceId
    ? [getSource(sourceId)].filter(Boolean)
    : listSources().filter(s => s.enabled)
  const all = []
  const errors = []
  for (const s of sources) {
    if (!SOURCE_TYPES[s.type]?.capabilities?.includes('receive')) continue
    try {
      let result
      switch (s.type) {
        case 'email': result = await fetchEmail(s, opts); break
        case 'feishu': result = await fetchFeishu(s, opts); break
        case 'github': result = await fetchGitHub(s, opts); break
        case 'rss': result = await fetchRSS(s, opts); break
        default: continue
      }
      all.push(...(result.messages || []))
    } catch (e) {
      errors.push({ source: s.name, type: s.type, error: e.message })
    }
  }
  // Sort all by date desc
  all.sort((a, b) => new Date(b.date) - new Date(a.date))
  return { messages: all, errors }
}

// ═══════════════════════════════════════════════════════════════════════
// Unified send: route to the right channel
// ═══════════════════════════════════════════════════════════════════════

async function sendMessage(sourceId, payload) {
  const source = getSource(sourceId)
  if (!source) throw new Error('信息源不存在: ' + sourceId)
  switch (source.type) {
    case 'email': return sendEmail(source, payload)
    case 'feishu': return sendFeishu(source, payload)
    case 'dingtalk': return sendDingTalk(source, payload)
    case 'wecom': return sendWeCom(source, payload)
    default: throw new Error('不支持发送的类型: ' + source.type)
  }
}

module.exports = {
  SOURCE_TYPES,
  listSources,
  getSource,
  saveSource,
  deleteSource,
  fetchMessages,
  sendMessage,
  fetchEmail,
  sendEmail,
}
