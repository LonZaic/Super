const { user: userDb } = require('./db')
const { v4: uuidv4 } = require('uuid')

// ─── Ensure default user exists on startup ───
function ensureLocalUser() {
  const existing = userDb.findByName('lzl')
  if (!existing) {
    userDb.create('u_6d50ad6c', 'lzl', '12345678')
    console.log('[Auth] Created default user: lzl')
  }
}

// ─── Simple token auth middleware ───
function authRequired(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    return res.status(401).json({ error: '请先登录' })
  }
  const u = userDb.findByToken(token)
  if (!u) {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
  req.user = { id: u.id, name: u.name }
  req.token = token
  next()
}

// ─── Optional auth — attaches user if token present, but doesn't block ───
function authOptional(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    const u = userDb.findByToken(token)
    if (u) {
      req.user = { id: u.id, name: u.name }
      req.token = token
    }
  }
  next()
}

// ─── Local auth — falls back to default user (lzl) if no token ───
function localAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token) {
    const u = userDb.findByToken(token)
    if (u) {
      req.user = { id: u.id, name: u.name }
      req.token = token
      return next()
    }
  }
  // Fallback to default user
  const defaultUser = userDb.findByName('lzl')
  if (defaultUser) {
    req.user = { id: defaultUser.id, name: defaultUser.name }
    req.isLocalUser = true
    return next()
  }
  return res.status(500).json({ error: '默认用户未初始化' })
}

// ─── Auto-login endpoint for default user ───
function localLoginHandler(req, res) {
  const defaultUser = userDb.findByName('lzl')
  if (!defaultUser) return res.status(500).json({ error: '默认用户未初始化' })
  const token = defaultUser.token || ('local_' + uuidv4())
  if (!defaultUser.token) {
    userDb.setToken(defaultUser.id, token)
  }
  res.json({ success: true, data: { token, user: { id: defaultUser.id, name: defaultUser.name } } })
}

module.exports = { ensureLocalUser, authRequired, authOptional, localAuth, localLoginHandler }
