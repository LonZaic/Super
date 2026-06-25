// ══════════════════════════════════════
// Computer Management API Routes v2
// CC-style read-only file management with smart search & file delivery
// ══════════════════════════════════════

const { Router } = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { execFile } = require('child_process')

const router = Router()

// ─── Safety: forbidden paths ───
const FORBIDDEN_PREFIXES = process.platform === 'win32'
  ? ['C:\\Windows\\System32\\', 'C:\\Windows\\System\\', 'C:\\Windows\\Boot\\', 'C:\\Windows\\WinSxS\\']
  : ['/sys/', '/proc/', '/dev/', '/boot/']

function isForbiddenPath(targetPath) {
  const normalized = path.resolve(targetPath).toLowerCase() + (process.platform === 'win32' ? '\\' : '/')
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (normalized.startsWith(prefix.toLowerCase())) return true
  }
  return false
}

// ─── Recursive directory scanner ───
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.cache', '.npm', '.yarn', 'dist', 'build', '$RECYCLE.BIN', 'System Volume Information'])
const SKIP_FILES = new Set(['.DS_Store', 'Thumbs.db'])
// Files to skip in search results
function isTempFile(name) {
  return name.startsWith('~$') || name.startsWith('~') && name.endsWith('.tmp') || name.endsWith('.tmp') && name.startsWith('~')
}

// Get all available drives on Windows
function getAvailableDrives() {
  const drives = []
  if (process.platform === 'win32') {
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
      const drivePath = letter + ':\\'
      try {
        if (fs.existsSync(drivePath)) {
          try {
            const stat = fs.statSync(drivePath)
            drives.push({ path: drivePath, label: letter + '盘' })
          } catch { drives.push({ path: drivePath, label: letter + '盘' }) }
        }
      } catch {}
    }
  } else {
    drives.push({ path: '/', label: '根目录' })
  }
  return drives
}

function scanDir(dir, maxDepth = 3, depth = 0) {
  const result = { name: path.basename(dir), type: 'directory', children: [], path: dir }
  if (depth >= maxDepth) {
    try { result._fileCount = fs.readdirSync(dir).length } catch { result._fileCount = 0 }
    return result
  }
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue
      if (entry.isFile() && SKIP_FILES.has(entry.name)) continue
      if (entry.isDirectory()) {
        const sub = scanDir(path.join(dir, entry.name), maxDepth, depth + 1)
        result.children.push(sub)
      } else {
        try {
          const stat = fs.statSync(path.join(dir, entry.name))
          result.children.push({
            name: entry.name, type: 'file', size: stat.size,
            sizeDisplay: formatSize(stat.size), path: path.join(dir, entry.name),
            ext: path.extname(entry.name).toLowerCase(), mtime: stat.mtime
          })
        } catch {
          result.children.push({ name: entry.name, type: 'file', size: 0, path: path.join(dir, entry.name), ext: path.extname(entry.name).toLowerCase() })
        }
      }
    }
    result.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  } catch {}
  return result
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB'
  return (bytes / 1073741824).toFixed(2) + ' GB'
}

// ─── Downloads directory for file delivery ───
const DOWNLOADS_DIR = path.join(__dirname, '..', 'workspace', 'downloads')
if (!fs.existsSync(DOWNLOADS_DIR)) fs.mkdirSync(DOWNLOADS_DIR, { recursive: true })

// ══════════════════════════════════════
// 1. List directory
// ══════════════════════════════════════
router.post('/computer/list-dir', (req, res) => {
  try {
    let { dirPath, depth = 2 } = req.body
    if (!dirPath) dirPath = os.homedir()
    if (isForbiddenPath(dirPath)) return res.status(403).json({ error: '禁止访问系统关键路径' })
    if (!fs.existsSync(dirPath)) return res.status(404).json({ error: '路径不存在: ' + dirPath })
    if (!fs.statSync(dirPath).isDirectory()) return res.status(400).json({ error: '不是文件夹' })
    const tree = scanDir(dirPath, Math.min(depth, 4))
    res.json({ tree, path: dirPath })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════
// 2. Read file (text & binary)
// ══════════════════════════════════════
router.post('/computer/read-file', (req, res) => {
  try {
    const { filePath } = req.body
    if (!filePath) return res.status(400).json({ error: '请提供文件路径' })
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在: ' + filePath })
    if (isForbiddenPath(filePath)) return res.status(403).json({ error: '禁止访问系统文件' })
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) return res.status(400).json({ error: '路径是文件夹，不是文件' })

    const ext = path.extname(filePath).toLowerCase()
    const name = path.basename(filePath)

    // Binary file types — return download URL instead of content
    const BINARY_EXTS = ['.png','.jpg','.jpeg','.gif','.bmp','.ico','.webp','.svg',
      '.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx',
      '.zip','.rar','.7z','.tar','.gz','.bz2',
      '.mp3','.mp4','.wav','.avi','.mkv','.mov','.flv',
      '.exe','.dll','.msi','.bin','.dat','.db','.sqlite',
      '.ttf','.otf','.woff','.woff2','.eot',
      '.psd','.ai','.sketch','.cdr']

    if (BINARY_EXTS.includes(ext)) {
      // Copy to downloads for delivery
      const safeName = name.replace(/[<>:"/\\|?*]/g, '_')
      const destPath = path.join(DOWNLOADS_DIR, 'pc_' + Date.now() + '_' + safeName)
      fs.copyFileSync(filePath, destPath)
      const url = '/api/files/download/' + path.basename(destPath)
      return res.json({
        filePath, name, size: stat.size, sizeDisplay: formatSize(stat.size),
        ext, mtime: stat.mtime, isBinary: true,
        downloadUrl: url, message: '这是一个二进制文件，已生成下载链接'
      })
    }

    // Text files — read and return content
    if (stat.size > 10 * 1024 * 1024) {
      return res.json({
        filePath, name, size: stat.size, sizeDisplay: formatSize(stat.size),
        ext, mtime: stat.mtime, isText: true, isLarge: true,
        preview: fs.readFileSync(filePath, 'utf-8').slice(0, 4000),
        message: `文件较大 (${formatSize(stat.size)})，仅显示前4000字符`
      })
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    res.json({
      filePath, name, size: stat.size, sizeDisplay: formatSize(stat.size),
      ext, mtime: stat.mtime, isText: true,
      content, lines: content.split('\n').length
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════
// 3. Deliver file to user (投递文件)
// ══════════════════════════════════════
router.post('/computer/deliver-file', (req, res) => {
  try {
    const { filePath } = req.body
    if (!filePath) return res.status(400).json({ error: '请提供文件路径' })
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在: ' + filePath })
    if (isForbiddenPath(filePath)) return res.status(403).json({ error: '禁止访问系统文件' })
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      // For directories, create a file list instead
      const tree = scanDir(filePath, 2)
      return res.json({
        filePath, name: path.basename(filePath), isDirectory: true,
        size: stat.size, sizeDisplay: formatSize(stat.size),
        tree, message: '这是一个文件夹，已列出内容'
      })
    }

    const safeName = path.basename(filePath).replace(/[<>:"/\\|?*]/g, '_')
    const destName = 'pc_' + Date.now() + '_' + safeName
    const destPath = path.join(DOWNLOADS_DIR, destName)
    fs.copyFileSync(filePath, destPath)

    const url = '/api/files/download/' + destName
    res.json({
      filePath, name: path.basename(filePath), size: stat.size,
      sizeDisplay: formatSize(stat.size), ext: path.extname(filePath).toLowerCase(),
      mtime: stat.mtime, downloadUrl: url,
      message: `文件已准备好: ${path.basename(filePath)}`
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════
// 4. Search files (CC-style glob search)
// ══════════════════════════════════════
router.post('/computer/search-files', (req, res) => {
  try {
    const { query, searchPath, fileTypes } = req.body
    if (!query) return res.status(400).json({ error: '请提供搜索关键词' })
    if (searchPath && isForbiddenPath(searchPath)) return res.status(403).json({ error: '禁止搜索系统关键路径' })

    const lowerQ = query.toLowerCase()
    const results = []
    const MAX_RESULTS = 100

    // Build search roots
    let searchRoots = []
    if (searchPath) {
      if (fs.existsSync(searchPath)) searchRoots.push(searchPath)
      else return res.status(404).json({ error: '搜索路径不存在: ' + searchPath })
    } else {
      searchRoots = getAvailableDrives().map(d => d.path)
    }

    function walk(dir, depth = 0) {
      if (depth > 5 || results.length >= MAX_RESULTS) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = path.join(dir, entry.name)

          // Skip temp/lock files
          if (isTempFile(entry.name)) continue

          // Match check
          const nameMatch = entry.name.toLowerCase().includes(lowerQ)
          if (nameMatch) {
            try {
              const stat = fs.statSync(full)
              results.push({
                path: full, name: entry.name,
                type: entry.isDirectory() ? 'directory' : 'file',
                size: stat.size, sizeDisplay: formatSize(stat.size),
                mtime: stat.mtime,
                ext: entry.isFile() ? path.extname(entry.name).toLowerCase() : '',
              })
            } catch {
              results.push({ path: full, name: entry.name, type: 'file', size: 0 })
            }
          }

          // Recurse into directories
          if (entry.isDirectory() && !SKIP_DIRS.has(entry.name) && !entry.name.startsWith('$') && !entry.name.startsWith('.')) {
            walk(full, depth + 1)
          }

          if (results.length >= MAX_RESULTS) return
        }
      } catch {
        // Permission errors on restricted folders — silently skip
      }
    }

    for (const root of searchRoots) {
      walk(root)
      if (results.length >= MAX_RESULTS) break
    }

    // Sort: directories first, then by name relevance
    results.sort((a, b) => {
      // Exact name match first
      const aExact = a.name.toLowerCase() === lowerQ
      const bExact = b.name.toLowerCase() === lowerQ
      if (aExact !== bExact) return aExact ? -1 : 1

      // Then starts-with match
      const aStarts = a.name.toLowerCase().startsWith(lowerQ)
      const bStarts = b.name.toLowerCase().startsWith(lowerQ)
      if (aStarts !== bStarts) return aStarts ? -1 : 1

      // Then by mtime (newer first)
      const aTime = a.mtime ? new Date(a.mtime).getTime() : 0
      const bTime = b.mtime ? new Date(b.mtime).getTime() : 0
      return bTime - aTime
    })

    const truncated = results.length > MAX_RESULTS
    res.json({
      query, searchRoots, count: results.length, truncated,
      results: results.slice(0, MAX_RESULTS),
      hint: results.length > 1 ? `找到 ${results.length} 个匹配，请让用户选择具体文件` : (results.length === 1 ? '找到1个匹配文件' : '未找到匹配文件')
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════
// 5. Quick file stats (for multi-match selection)
// ══════════════════════════════════════
router.post('/computer/file-stats', (req, res) => {
  try {
    const { filePaths } = req.body
    if (!filePaths || !Array.isArray(filePaths)) return res.status(400).json({ error: '请提供文件路径列表' })

    const stats = []
    for (const fp of filePaths.slice(0, 20)) {
      if (isForbiddenPath(fp)) { stats.push({ path: fp, exists: false, error: '禁止访问' }); continue }
      try {
        if (!fs.existsSync(fp)) { stats.push({ path: fp, exists: false }); continue }
        const stat = fs.statSync(fp)
        stats.push({
          path: fp, name: path.basename(fp), exists: true,
          size: stat.size, sizeDisplay: formatSize(stat.size),
          type: stat.isDirectory() ? 'directory' : 'file',
          mtime: stat.mtime, ext: path.extname(fp).toLowerCase()
        })
      } catch { stats.push({ path: fp, exists: false, error: true }) }
    }
    res.json({ stats })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════
// 6. Analyze disk space (read-only)
// ══════════════════════════════════════
router.post('/computer/analyze-disk', (req, res) => {
  try {
    const scanPath = req.body.scanPath || os.homedir()
    if (isForbiddenPath(scanPath)) return res.status(403).json({ error: '禁止分析系统关键路径' })
    if (!fs.existsSync(scanPath)) return res.status(404).json({ error: '路径不存在' })

    const largeFiles = [], tempFiles = []
    const byCategory = {}, byFolder = {}

    function walk(dir, depth = 0) {
      if (depth > 5) return
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue
            walk(full, depth + 1)
          } else {
            try {
              const stat = fs.statSync(full)
              if (stat.size > 10 * 1024 * 1024) {
                largeFiles.push({ path: full, name: entry.name, size: stat.size, sizeDisplay: formatSize(stat.size), mtime: stat.mtime })
              }
              const ext = path.extname(entry.name).toLowerCase()
              if (['.tmp', '.temp', '.log', '.cache'].includes(ext)) {
                tempFiles.push({ path: full, name: entry.name, size: stat.size, sizeDisplay: formatSize(stat.size) })
              }
              byCategory[ext || '(无后缀)'] = (byCategory[ext || '(无后缀)'] || 0) + stat.size
              const folder = path.dirname(full)
              byFolder[folder] = (byFolder[folder] || 0) + stat.size
            } catch {}
          }
        }
      } catch {}
    }
    walk(scanPath)

    largeFiles.sort((a, b) => b.size - a.size)
    const sortedFolders = Object.entries(byFolder).sort((a, b) => b[1] - a[1]).slice(0, 10)
    const sortedCats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 10)

    res.json({
      scanPath, largeFileCount: largeFiles.length, topLargeFiles: largeFiles.slice(0, 50).map(f => ({ ...f, sizeMB: +(f.size / 1048576).toFixed(1) })),
      tempFileCount: tempFiles.length, totalTempSize: tempFiles.reduce((s, f) => s + f.size, 0),
      topFolders: sortedFolders.map(([f, s]) => ({ folder: f, size: s, sizeDisplay: formatSize(s) })),
      categoryBreakdown: sortedCats.map(([ext, sz]) => ({ ext, size: sz, sizeDisplay: formatSize(sz) })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════
// 7. System info (read-only)
// ══════════════════════════════════════
router.post('/computer/system-info', (req, res) => {
  try {
    const info = {
      platform: os.platform(), arch: os.arch(), hostname: os.hostname(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(), freeMemory: os.freemem(),
      totalMemoryGB: +(os.totalmem() / 1073741824).toFixed(1),
      freeMemoryGB: +(os.freemem() / 1073741824).toFixed(1),
      usedMemoryPercent: +(100 - (os.freemem() / os.totalmem() * 100)).toFixed(1),
      uptime: Math.floor(os.uptime()),
      drives: [],
    }

    const cmd = process.platform === 'win32'
      ? { file: 'wmic', args: ['logicaldisk', 'get', 'caption,size,freespace', '/format:csv'] }
      : { file: 'df', args: ['-h', '--output=source,size,avail,pcent,target'] }

    const child = execFile(cmd.file, cmd.args, { timeout: 10000, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (!err && stdout) {
        const lines = stdout.toString().trim().split('\n')
        if (process.platform === 'win32') {
          for (const line of lines) {
            const parts = line.split(',')
            if (parts.length >= 4 && parts[1] && parts[1].includes(':')) {
              const free = parseInt(parts[2]) || 0
              const size = parseInt(parts[3]) || 0
              if (size > 0) {
                info.drives.push({
                  drive: parts[1].trim(),
                  totalGB: +(size / 1073741824).toFixed(1),
                  freeGB: +(free / 1073741824).toFixed(1),
                  usedPercent: +(100 - (free / size * 100)).toFixed(1),
                })
              }
            }
          }
        } else {
          for (const line of lines.slice(1)) {
            const parts = line.trim().split(/\s+/)
            if (parts.length >= 5) info.drives.push({ drive: parts[4], size: parts[1], avail: parts[2], usedPercent: parts[3] })
          }
        }
      }
      if (!info.drives.length) {
        if (process.platform === 'win32') {
          for (const l of 'CDEFGH') {
            try { if (fs.existsSync(l + ':\\')) info.drives.push({ drive: l + ':\\', accessible: true }) } catch {}
          }
        } else {
          info.drives.push({ drive: '/', accessible: true })
        }
      }
      res.json(info)
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ══════════════════════════════════════
// 8. Delete file (LOCKED — requires user confirmation via UI)
// ══════════════════════════════════════
router.post('/computer/delete-file', (req, res) => {
  return res.status(403).json({ error: '电脑管理模式下不允许删除文件。此功能已被锁定。' })
  /*
  try {
    const { filePath } = req.body
    if (!filePath) return res.status(400).json({ error: '请提供文件路径' })
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' })
    if (isForbiddenPath(filePath)) return res.status(403).json({ error: '禁止删除系统文件' })
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) return res.status(400).json({ error: '请使用删除文件夹接口' })
    fs.unlinkSync(filePath)
    res.json({ ok: true, path: filePath, name: path.basename(filePath), size: stat.size })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
  */
})

// ══════════════════════════════════════
// 9. Delete directory (LOCKED)
// ══════════════════════════════════════
router.post('/computer/delete-dir', (req, res) => {
  return res.status(403).json({ error: '电脑管理模式下不允许删除文件夹。此功能已被锁定。' })
})

// ══════════════════════════════════════
// 10. Move file (LOCKED)
// ══════════════════════════════════════
router.post('/computer/move-file', (req, res) => {
  return res.status(403).json({ error: '电脑管理模式下不允许移动文件。此功能已被锁定。' })
})

// ══════════════════════════════════════
// 11. Run shell (LOCKED — read-only mode)
// ══════════════════════════════════════
router.post('/computer/run-shell', (req, res) => {
  return res.status(403).json({ error: '电脑管理模式下不允许执行命令。此功能已被锁定。' })
})

module.exports = router
