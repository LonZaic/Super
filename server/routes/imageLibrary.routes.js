// ══════════════════════════════════════
// Image Library Routes — search & serve images
// ══════════════════════════════════════
// Uses Pollinations as a free image source (no API key required).
// Images are returned with metadata (title, url, license) so the AI can
// pick the best match and inject them into the chat via _imageGallery.

const { Router } = require('express')
const { sendSuccess, sendError } = require('../errorHandler')

const router = Router()

// In-memory cache of recent searches to avoid hammering Pollinations
const _cache = new Map()
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

/**
 * Build a set of image variations for a query.
 * Pollinations generates a different image per seed, so we create N seeds
 * derived from the query to give the user a small gallery to pick from.
 */
function buildGallery(query, limit) {
  const enc = encodeURIComponent(query)
  const baseSeed = Math.abs(hashCode(query))
  const items = []
  for (let i = 0; i < limit; i++) {
    const seed = (baseSeed + i * 7919) % 1000000  // deterministic per query+index
    const w = 1024, h = 1024
    items.push({
      id: `img_${seed}`,
      url: `https://image.pollinations.ai/prompt/${enc}?width=${w}&height=${h}&seed=${seed}&nologo=true`,
      thumb: `https://image.pollinations.ai/prompt/${enc}?width=400&height=400&seed=${seed}&nologo=true`,
      title: `${query} #${i + 1}`,
      artist: 'AI 生成',
      license: 'Pollinations (免费可商用)',
      width: w,
      height: h,
    })
  }
  return items
}

function hashCode(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0
  }
  return h
}

// ─── Search the image library ───
router.post('/search', async (req, res) => {
  try {
    const { query, limit = 6 } = req.body || {}
    if (!query || typeof query !== 'string') {
      return sendError(res, '缺少查询参数 query', 'BAD_REQUEST', 400)
    }
    const lim = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 12)

    const cacheKey = `${query}::${lim}`
    const cached = _cache.get(cacheKey)
    if (cached && (Date.now() - cached.t) < CACHE_TTL) {
      return sendSuccess(res, { results: cached.items, source: 'cache' })
    }

    const items = buildGallery(query.trim(), lim)
    _cache.set(cacheKey, { items, t: Date.now() })
    // Trim cache to last 200 entries
    if (_cache.size > 200) {
      const firstKey = _cache.keys().next().value
      _cache.delete(firstKey)
    }
    return sendSuccess(res, { results: items, source: 'pollinations' })
  } catch (e) {
    console.error('[image-library] search error:', e.message)
    return sendError(res, '图片搜索失败: ' + e.message, 'INTERNAL', 500)
  }
})

// ─── List curated categories (for a browseable gallery UI) ───
router.get('/categories', (req, res) => {
  const categories = [
    { id: 'nature', name: '自然风光', query: 'beautiful landscape nature mountain lake sunset', cover_seed: 12345 },
    { id: 'city', name: '城市建筑', query: 'modern city skyline architecture night', cover_seed: 23456 },
    { id: 'animal', name: '动物世界', query: 'cute animal cat dog wildlife portrait', cover_seed: 34567 },
    { id: 'food', name: '美食佳肴', query: 'delicious food gourmet dish photography', cover_seed: 45678 },
    { id: 'abstract', name: '抽象艺术', query: 'abstract art colorful geometric pattern', cover_seed: 56789 },
    { id: 'portrait', name: '人物肖像', query: 'portrait person face cinematic lighting', cover_seed: 67890 },
    { id: 'space', name: '宇宙星空', query: 'space galaxy nebula stars cosmos', cover_seed: 78901 },
    { id: 'anime', name: '动漫插画', query: 'anime illustration art style vibrant', cover_seed: 89012 },
  ]
  return sendSuccess(res, { categories })
})

// ─── Browse a category ───
router.get('/browse/:categoryId', (req, res) => {
  const { categoryId } = req.params
  const { limit = 8 } = req.query
  const lim = Math.min(Math.max(parseInt(limit, 10) || 8, 1), 12)
  const categories = {
    nature: 'beautiful landscape nature mountain lake sunset',
    city: 'modern city skyline architecture night',
    animal: 'cute animal cat dog wildlife portrait',
    food: 'delicious food gourmet dish photography',
    abstract: 'abstract art colorful geometric pattern',
    portrait: 'portrait person face cinematic lighting',
    space: 'space galaxy nebula stars cosmos',
    anime: 'anime illustration art style vibrant',
  }
  const query = categories[categoryId]
  if (!query) return sendError(res, '未知分类', 'NOT_FOUND', 404)
  const items = buildGallery(query, lim)
  return sendSuccess(res, { results: items, category: categoryId })
})

module.exports = router
