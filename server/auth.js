// ══════════════════════════════════════
// Auth middleware (canonical — replaces server/middleware/auth.js)
// ══════════════════════════════════════
const bcrypt = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { user: userDb } = require('./db')

// Token TTL: 30 days
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

// ─── Password helpers ───
function hashPassword(plain) {
  return bcrypt.hashSync(plain, 10)
}

function verifyPassword(plain, hash) {
  if (!hash) return false
  return bcrypt.compareSync(plain, hash)
}

// ─── One-time migration: hash any legacy plaintext passwords ───
// Called once on startup. Idempotent — skips users already hashed.
function migrateLegacyPasswords() {
  try {
    const rows = userDb.listAll()
    for (const u of rows) {
      const full = userDb.findById(u.id) // light row, no password
      // Need full row incl. password / password_hash
      const fullRow = userDb.findByName(u.name)
      if (fullRow && !fullRow.password_hash && fullRow.password) {
        // Legacy plaintext user — hash and clear plaintext
        const hash = hashPassword(fullRow.password)
        userDb.setPasswordHash(fullRow.id, hash)
        console.log(`[Auth] Migrated legacy password for user "${u.name}"`)
      }
    }
  } catch (e) {
    console.error('[Auth] Password migration failed:', e.message)
  }
}

// ─── Simple token auth middleware (strict — no fallback) ───
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

// ─── Local auth — STRICT version, no default-user fallback ───
// Previously this fell back to hardcoded user "lzl". That was a critical
// security hole (#1/#4): any unauthenticated request was treated as the
// default user. Now it behaves like authRequired — callers that still
// reference localAuth get the same protection.
function localAuth(req, res, next) {
  return authRequired(req, res, next)
}

// ─── Local login endpoint ───
// Behaviour:
//   - If no users exist yet → return 409 "needs_setup" so frontend can
//     route to the registration page (first-run flow).
//   - If a user exists and request supplies name+password → real login.
//   - If a user exists and request is empty → return 401 (must login).
function localLoginHandler(req, res) {
  const userCount = userDb.count()

  // First-run: no users yet
  if (userCount === 0) {
    return res.status(409).json({
      success: false,
      error: { code: 'needs_setup', message: '尚未创建任何用户，请先注册。' }
    })
  }

  const { name, password } = req.body || {}

  // No credentials supplied → require login
  if (!name || !password) {
    return res.status(401).json({
      success: false,
      error: { code: 'login_required', message: '请提供用户名和密码登录。' }
    })
  }

  // Real login
  const u = userDb.findByName(name)
  if (!u || !verifyPassword(password, u.password_hash)) {
    return res.status(401).json({
      success: false,
      error: { code: 'bad_credentials', message: '用户名或密码错误' }
    })
  }

  const token = 'tk_' + uuidv4()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  userDb.setToken(u.id, token, expiresAt)

  res.json({
    success: true,
    data: { token, user: { id: u.id, name: u.name } }
  })
}

module.exports = {
  authRequired,
  authOptional,
  localAuth,
  localLoginHandler,
  hashPassword,
  verifyPassword,
  migrateLegacyPasswords,
  TOKEN_TTL_MS
}
