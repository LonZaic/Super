// ══════════════════════════════════════
// DeepSeek-Super Express Application Factory
// Registers all middleware and routes
// ══════════════════════════════════════

const path = require('path')
const fs = require('fs')
const express = require('express')
const cors = require('cors')
const logger = require('./config/logger')
const { errorHandler } = require('./errorHandler')
const rateLimiter = require('./rateLimiter')
const routes = require('./routes/index')

function createApp() {
  const app = express()

  // ─── Core middleware ───
  // CORS (#9 fix): restrict to configured origins instead of wildcard.
  // Default allows localhost for dev; production should set CORS_ORIGIN.
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
    : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://127.0.0.1:5173', 'app://']
  app.use(cors({ origin: corsOrigin, credentials: true }))
  app.use(express.json({ limit: '10mb' }))

  // ─── Request logging ───
  app.use(logger.requestLogger)

  // ─── Rate limiting ───
  app.use(rateLimiter)

  // ─── Health check endpoint (for Docker, Render, Vercel) ───
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ─── Mount all API routes ───
  app.use(routes)

  // ─── Serve built frontend (production only) ───
  const distPath = path.join(__dirname, '..', 'dist')
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath))
    // SPA fallback: non-API routes → index.html (Express 5 syntax)
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/ws')) return next()
      if (req.method !== 'GET') return next()
      res.sendFile(path.join(distPath, 'index.html'))
    })
  }

  // ─── Global error handler (must be last) ───
  app.use(errorHandler)

  return app
}

module.exports = createApp
