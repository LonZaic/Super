// ══════════════════════════════════════════════════════
// Vercel Serverless API Entry Point
//
// 将 Express 应用包装为 Vercel Serverless Function
//
// 注意:
//   - Vercel 不支持 WebSocket，实时消息需用轮询
//   - Vercel 无持久化文件系统，SQLite 数据在每次冷启动后重置
//   - 如需完整功能（WebSocket + 持久存储），请使用 Docker 或 Render 部署
// ══════════════════════════════════════════════════════

const createApp = require('../server/app')

let app

module.exports = (req, res) => {
  if (!app) {
    // 冷启动时初始化
    try {
      app = createApp()
    } catch (e) {
      console.error('Failed to initialize app:', e)
      return res.status(500).json({ error: 'Server initialization failed', message: e.message })
    }
  }

  return app(req, res)
}
