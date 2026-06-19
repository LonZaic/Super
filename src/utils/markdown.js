import { marked } from 'marked'
import hljs from 'highlight.js'
import { renderAll } from './mediaRenderer.js'

// ═══ SVG streaming mode — prevents flicker during live streaming ═══
// During streaming, SVG blocks render as code (not inline SVG DOM).
// After streaming completes, they render as live SVG.
// This prevents the "destroy-and-recreate" DOM flicker on every chunk.
let _svgStreamingMode = false
export function setSvgStreamingMode(on) {
  _svgStreamingMode = !!on
}

// ═══ Marked config — SVG & Mermaid code blocks get dedicated wrappers ═══
marked.use({
    renderer: {
        code({ text, lang }) {
            // Mermaid diagram
            if (lang === 'mermaid') {
                const id = 'm_' + Math.random().toString(36).slice(2, 8)
                return `<div class="mermaid-wrap mermaid-loading" data-mermaid-state="loading">
  <div class="mermaid-toolbar">
    <span class="mermaid-status">绘制中...</span>
    <div class="mermaid-actions">
      <button class="mermaid-btn mermaid-dl" title="下载 SVG"></button>
      <button class="mermaid-btn mermaid-full" title="放大查看"></button>
    </div>
  </div>
  <div class="mermaid-body"><pre class="mermaid" id="${id}">${escapeHtml(text)}</pre></div>
</div>\n`
            }
            // ═══ SVG detection — handles svg/xml/html lang tags + content sniffing ═══
            // Many AIs output SVG with lang="xml" or lang="html" or no lang at all.
            // Detect SVG by content: if the code block starts with <svg, treat as SVG.
            const isSvgBlock = (lang === 'svg' || lang === 'svg-chart') ||
                ((lang === 'xml' || lang === 'html' || !lang || lang === 'plaintext') && /^\s*<svg\b/i.test(text))

            if (isSvgBlock) {
                if (_svgStreamingMode) {
                    // Streaming mode: show as code block, no DOM replacement flicker
                    const highlighted = hljs.highlight(text, { language: 'xml' }).value
                    return `<pre class="svg-streaming-block"><code class="hljs language-xml">${highlighted}</code></pre>\n`
                }
                let svg = text.trim()
                const m = svg.match(/<svg[\s\S]*?<\/svg>/i)
                if (m) svg = m[0]
                if (svg.startsWith('<svg')) {
                    const animatedSvg = svg.replace(
                        /<svg\b/,
                        '<svg data-animated="pending"'
                    )
                    return `<div class="svg-render-wrap svg-chart-wrap" data-svg="${escapeAttr(svg)}" data-rendered="true">${animatedSvg}</div>\n`
                }
                return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>\n`
            }
            // Regular code block
            const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
            const highlighted = hljs.highlight(text, { language }).value
            return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>\n`
        },
        // Raw inline HTML containing SVG (AI writes <svg> directly in markdown)
        html({ text }) {
            if (/^\s*<svg\b/i.test(text) && /<\/svg>\s*$/i.test(text)) {
                const animatedSvg = text.replace(
                    /<svg\b/,
                    '<svg data-animated="pending"'
                )
                return `<div class="svg-render-wrap" data-svg="${escapeAttr(text)}" data-rendered="true">${animatedSvg}</div>`
            }
            return text
        },
        link({ href, title, tokens }) {
            const text = marked.parseInline(tokens)
            const titleAttr = title ? ` title="${title}"` : ''
            return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
        },
    },
})

marked.setOptions({ breaks: true, gfm: true })

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Sanitize leaked global styles ───
// AI may generate <style> tags in markdown. These would leak to the entire page
// via v-html. Strip them — design previews use iframes (properly isolated).
function stripGlobalStyles(html) {
    // Remove <style>...</style> blocks entirely
    return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
}

// ═══════════════════════════════════════════════════
// HTML Tag Whitelist Sanitizer — LAST LINE OF DEFENSE
//
// Problem: AI models (especially DeepSeek) sometimes output XML tool-call tags
// (<invoke>, <function_calls>, <parameter>, etc.) as raw text in markdown.
// Since marked.js passes raw HTML through unchanged, and v-html renders it as
// DOM, these XML tags become invisible/visible clutter on the page.
//
// Solution: Strip ALL HTML/XML tags that are NOT in a strict allowlist of
// safe, standard HTML elements. Unknown tags get their angle brackets escaped
// so they appear as harmless visible text (e.g., "<invoke>" → "&lt;invoke&gt;").
//
// This is industry-standard practice — DOMPurify does the same thing but we
// implement a lightweight version with zero dependencies.
// ═══════════════════════════════════════════════════

// Tags allowed through (extended HTML5 safe set + SVG + custom containers)
const ALLOWED_TAGS = new Set([
  // Block elements
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code', 'hr', 'br',
  // Lists
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Table
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  // Inline
  'a', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'sup', 'sub',
  'small', 'mark', 'abbr', 'cite', 'q', 'dfn', 'time', 'kbd', 'samp', 'var',
  'wbr',
  // Media
  'img', 'figure', 'figcaption', 'picture', 'source',
  // Semantic
  'article', 'section', 'nav', 'header', 'footer', 'main', 'aside',
  'details', 'summary', 'dialog',
  // SVG elements (embedded via marked html() renderer)
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'tref', 'textPath',
  'defs', 'clipPath', 'mask', 'filter', 'linearGradient', 'radialGradient',
  'stop', 'use', 'symbol', 'pattern', 'marker',
  'foreignObject', 'image', 'title', 'desc',
  // Mermaid containers (custom)
  'iframe',   // only from our own code (design previews use iframe sandbox)
])

// Tags that are ALWAYS stripped (XML tool-call artifacts)
const BLOCKED_TAGS = /^(?:xz:?\s*)?(?:invoke|function_calls|tool_calls?|parameter|DSML|save_file|svg_to_image|create_zip|create_gif|create_document|create_pdf|create_audio|convert|web_search|web_fetch|get_weather|save_to_collection|rename_collection|move_last_saved|update_last_saved|delete_last_saved|list_collections|request_design_preview|classify_intent|send_email|schedule_email|search_files|list_directory|read_file|deliver_file|system_info|analyze_disk|fetch_url|fill_word_template|parse_word_template)$/i

function sanitizeHtml(html) {
  if (!html) return ''

  // Pass 1: Strip known XML tool-call blocks (invoke + children)
  let result = html.replace(/<\s*(\w*:?\s*)?invoke\s+name\s*=\s*"[^"]*"\s*>[^]*?<\s*\/\s*(\w*:?\s*)?invoke\s*>/gi, '')
  result = result.replace(/<\s*(\w*:?\s*)?function_calls\s*>[^]*?<\s*\/\s*(\w*:?\s*)?function_calls\s*>/gi, '')
  result = result.replace(/<\s*(\w*:?\s*)?tool_calls\s*>[^]*?<\s*\/\s*(\w*:?\s*)?tool_calls\s*>/gi, '')
  result = result.replace(/<[|｜]{2}\s*DSML\s*[|｜]{2}[^]*?<\/[|｜]{2}\s*DSML\s*[|｜]{2}>/gi, '')

  // Pass 2: Process individual tags — allowlist good, escape bad
  // Match opening tags: <tagname ...> or </tagname>
  result = result.replace(/<\/?\s*([a-zA-Z][a-zA-Z0-9:_-]*)\b[^>]*>/g, (raw, tagName) => {
    // Normalize tag name (strip namespace prefix for matching)
    const cleanName = tagName.replace(/^[a-z]+:/, '').toLowerCase()

    if (ALLOWED_TAGS.has(cleanName)) return raw
    if (BLOCKED_TAGS.test(cleanName)) return ''  // strip blocked tags entirely

    // Unknown tag → escape angle brackets so it appears as visible text
    return raw.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  })

  // Pass 3: Handle self-closing tags <tag/>
  result = result.replace(/<\s*([a-zA-Z][a-zA-Z0-9:_-]*)\b[^>]*\/\s*>/g, (raw, tagName) => {
    const cleanName = tagName.replace(/^[a-z]+:/, '').toLowerCase()
    if (ALLOWED_TAGS.has(cleanName)) return raw
    if (BLOCKED_TAGS.test(cleanName)) return ''
    return raw.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  })

  // Pass 4: Clean up excessive newlines from stripped blocks
  result = result.replace(/\n{3,}/g, '\n\n')

  return result
}

// ─── Public API ───
export function renderMarkdown(text) {
    if (!text) return ''
    try {
        const rawHtml = marked.parse(text)
        const safe = sanitizeHtml(stripGlobalStyles(rawHtml))
        // Trigger render for anything the MutationObserver hasn't caught yet
        setTimeout(() => renderAll(), 0)
        return safe
    } catch {
        return escapeHtml(text).replace(/\n/g, '<br>')
    }
}

export function reinitMermaid() {
    setTimeout(() => renderAll(), 50)
    setTimeout(() => renderAll(), 300)
}
