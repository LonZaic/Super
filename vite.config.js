import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import nodemailer from 'nodemailer'
import fs from 'fs'
import path from 'path'
import https from 'https'

// ─── Free image library search (Wikimedia Commons — no API key needed) ───
function searchImageLibrary(query, limit = 6) {
  return new Promise((resolve) => {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${limit}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&origin=*`
    https.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const pages = json?.query?.pages || {}
          const results = Object.values(pages).map(p => {
            const info = p.imageinfo?.[0]
            if (!info) return null
            const meta = info.extmetadata || {}
            return {
              id: p.pageid,
              title: (p.title || '').replace(/^File:/, '').replace(/\.[^.]+$/, ''),
              url: info.thumburl || info.url,
              fullUrl: info.url,
              width: info.thumbwidth,
              height: info.thumbheight,
              license: meta.LicenseShortName?.value || 'Wikimedia Commons',
              artist: (meta.Artist?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 80),
              desc: (meta.ImageDescription?.value || '').replace(/<[^>]+>/g, '').trim().slice(0, 120),
            }
          }).filter(Boolean)
          resolve(results)
        } catch { resolve([]) }
      })
    }).on('error', () => resolve([]))
  })
}

// ─── Download image to buffer for email attachment ───
function downloadImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : require('http')
    mod.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImageBuffer(res.headers.location).then(resolve).catch(reject)
      }
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'wasm-mime',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url.endsWith('.wasm')) {
            res.setHeader('Content-Type', 'application/wasm')
          }
          next()
        })
      }
    },
    {
      name: 'smtp-proxy',
      configureServer(server) {
        // ─── Image library search endpoint (free, no API key) ───
        server.middlewares.use('/api/image-library/search', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405; res.end('Method Not Allowed'); return
          }
          let bodyStr = ''
          req.on('data', chunk => bodyStr += chunk)
          req.on('end', async () => {
            try {
              const { query, limit } = JSON.parse(bodyStr)
              if (!query) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: '请提供搜索关键词' })); return
              }
              const results = await searchImageLibrary(query, limit || 6)
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: true, count: results.length, results }))
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: e.message }))
            }
          })
        })

        // ─── Email send with attachments ───
        server.middlewares.use('/api/send-email', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }
          let bodyStr = ''
          req.on('data', chunk => bodyStr += chunk)
          req.on('end', async () => {
            let payload
            try { payload = JSON.parse(bodyStr) } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
              return
            }
            const { host, port, user, pass, to, subject, text, html, attachments } = payload
            if (!host || !user || !pass || !to) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: '缺少必要参数' }))
              return
            }
            try {
              const transporter = nodemailer.createTransport({
                host,
                port: parseInt(port) || 465,
                secure: true,
                auth: { user, pass },
              })

              // Build mail options with optional attachments
              const mailOpts = { from: user, to, subject, text }
              if (html) mailOpts.html = html

              // Process attachments: each is { filename, path } (local file) or { filename, content } (base64)
              if (Array.isArray(attachments) && attachments.length > 0) {
                mailOpts.attachments = []
                for (const att of attachments) {
                  if (att.path && fs.existsSync(att.path)) {
                    // Local file path (from computer management mode)
                    mailOpts.attachments.push({ filename: att.filename || path.basename(att.path), path: att.path })
                  } else if (att.url) {
                    // Remote URL (image library) — download to buffer
                    try {
                      const buf = await downloadImageBuffer(att.url)
                      mailOpts.attachments.push({ filename: att.filename || 'image.jpg', content: buf })
                    } catch {}
                  } else if (att.content) {
                    // Base64 content
                    mailOpts.attachments.push({ filename: att.filename || 'file', content: Buffer.from(att.content, 'base64') })
                  }
                }
                if (mailOpts.attachments.length === 0) delete mailOpts.attachments
              }

              const info = await transporter.sendMail(mailOpts)
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: true, messageId: info.messageId }))
            } catch (e) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: e.message }))
            }
          })
        })
      }
    }
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      overlay: true,
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      }
    }
  }
})
