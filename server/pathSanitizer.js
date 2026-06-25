// ══════════════════════════════════════
// Path Sanitizer — prevent path traversal attacks
// Validates user-supplied file paths against system-critical directories
// ══════════════════════════════════════

const path = require('path')

// System-critical directories that must never be accessed by user-supplied paths
const FORBIDDEN_PATTERNS = [
  // Windows
  /[\\/]Windows[\\/]System32/i,
  /[\\/]Windows[\\/]SysWOW64/i,
  /[\\/]Windows[\\/]System/i,
  /[\\/]boot[\\/]$/i,
  /[\\/]\\$Recycle\.Bin[\\/]/i,
  // Unix
  /^\/etc\//,
  /^\/boot\//,
  /^\/proc\//,
  /^\/sys\//,
  /^\/dev\//,
  /^\/root\//,
  // Credentials & secrets
  /[\\/]\.ssh[\\/]/,
  /[\\/]\.gnupg[\\/]/,
  /[\\/]\.aws[\\/]/,
  /[\\/]\.env$/,
]

/**
 * Check if a resolved path points to a system-critical location.
 * @param {string} resolvedPath - absolute path to check
 * @returns {boolean} true if access is forbidden
 */
function isForbiddenPath(resolvedPath) {
  if (!resolvedPath || typeof resolvedPath !== 'string') return true
  const normalized = resolvedPath.replace(/\//g, path.sep)
  return FORBIDDEN_PATTERNS.some(re => re.test(normalized))
}

/**
 * Validate a user-supplied file path.
 * Blocks path traversal (..) and access to system-critical directories.
 *
 * @param {string} rawPath - the path supplied by the user
 * @param {string} [baseDir] - optional base directory to resolve against
 * @returns {{ ok: true, resolved: string } | { ok: false, error: string }}
 */
function validateFilePath(rawPath, baseDir) {
  if (!rawPath || typeof rawPath !== 'string') {
    return { ok: false, error: '路径不能为空' }
  }

  // Block literal ".." segments — no legitimate use case for traversal
  if (rawPath.includes('..')) {
    return { ok: false, error: '路径不允许包含 ".."' }
  }

  const resolved = baseDir ? path.resolve(baseDir, rawPath) : path.resolve(rawPath)

  if (isForbiddenPath(resolved)) {
    return { ok: false, error: '禁止访问系统关键路径: ' + resolved }
  }

  return { ok: true, resolved }
}

module.exports = { validateFilePath, isForbiddenPath }
