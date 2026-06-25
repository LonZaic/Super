// ══════════════════════════════════════
// Auth Controller
// ══════════════════════════════════════

const { v4: uuid } = require('uuid')
const { user } = require('../db')
const { sendSuccess, sendError } = require('../errorHandler')
const { hashPassword, verifyPassword, TOKEN_TTL_MS } = require('../auth')

function register(req, res) {
  const { name, password } = req.body
  if (!name || !password) return sendError(res, '昵称和密码不能为空')
  if (name.length > 20) return sendError(res, '昵称最多20个字符')
  if (password.length < 6) return sendError(res, '密码最少6个字符')

  const existing = user.findByName(name)
  if (existing) return sendError(res, '该昵称已被使用', 'CONFLICT', 409)

  const id = 'u_' + uuid().slice(0, 8)
  const hash = hashPassword(password)
  user.create(id, name, hash)
  const token = 'tk_' + uuid()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  user.setToken(id, token, expiresAt)

  sendSuccess(res, { id, name, token })
}

function login(req, res) {
  const { name, password } = req.body
  if (!name || !password) return sendError(res, '昵称和密码不能为空')

  const u = user.findByName(name)
  if (!u || !verifyPassword(password, u.password_hash)) {
    return sendError(res, '昵称或密码错误', 'UNAUTHORIZED', 401)
  }

  const token = 'tk_' + uuid()
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString()
  user.setToken(u.id, token, expiresAt)

  sendSuccess(res, { id: u.id, name: u.name, token })
}

function me(req, res) {
  sendSuccess(res, { id: req.user.id, name: req.user.name })
}

module.exports = { register, login, me }
