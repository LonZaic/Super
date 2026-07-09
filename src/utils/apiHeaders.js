// ══════════════════════════════════════
// API Headers helper — sends x-api-key only when user chose "own key"
// ══════════════════════════════════════

export function getApiHeaders(extra = {}) {
  const mode = localStorage.getItem('key_mode') || 'builtin'
  const key = localStorage.getItem('apikey') || ''
  const token = localStorage.getItem('bbot_token') || ''
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  }
  // Only send API key if user explicitly chose "own key" mode
  if (mode === 'own' && key) {
    headers['x-api-key'] = key
  }
  // Attach auth token (required for protected /api/ai/* routes)
  if (token) {
    headers['Authorization'] = 'Bearer ' + token
  }
  return headers
}
