// ══════════════════════════════════════
// HTTP Client — axios wrapper with interceptors
// ══════════════════════════════════════

import axios from 'axios'

const BASE_URL = 'http://localhost:3001'

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ─── Request interceptor: attach API key & auth token from localStorage ───
// NOTE (#8 fix): previously read 'ds_api_key' / 'ds_token', which were never
// written anywhere — login writes 'bbot_token', settings write 'apikey'.
// Now aligned with the rest of the app.
client.interceptors.request.use(config => {
  const apiKey = localStorage.getItem('apikey')
  if (apiKey) {
    config.headers['x-api-key'] = apiKey
  }
  const token = localStorage.getItem('bbot_token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
}, error => Promise.reject(error))

// ─── Response interceptor: unwrap & handle errors ───
client.interceptors.response.use(
  response => {
    const body = response.data
    if (body && typeof body === 'object' && 'success' in body) {
      // If server wraps in { success, data }, unwrap. Otherwise return body as-is.
      return 'data' in body ? body.data : body
    }
    return body
  },
  error => {
    if (error.response) {
      const body = error.response.data
      const message = body?.error?.message || body?.error || error.message
      const code = body?.error?.code || 'UNKNOWN'
      const err = new Error(message)
      err.code = code
      err.status = error.response.status
      return Promise.reject(err)
    }
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时，请检查网络'))
    }
    return Promise.reject(error)
  }
)

export default client
export { BASE_URL }
