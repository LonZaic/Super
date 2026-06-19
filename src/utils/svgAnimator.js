// ═══════════════════════════════════════
// SVG Stroke Animator — "一笔一笔画出来"
// Animates SVG elements with stroke-dashoffset
// so they appear to draw themselves in sequence
// ═══════════════════════════════════════

/**
 * Estimate the path length of any SVG element.
 * For <path>: use getTotalLength()
 * For <line>: Pythagoras
 * For <circle>/<ellipse>: approximate circumference
 * For <rect>: perimeter
 * For <polygon>/<polyline>: sum of segment lengths
 * For others: return a reasonable default
 */
function estimateLength(el) {
  const tag = (el.tagName || '').toLowerCase()
  try {
    if (tag === 'path' || tag === 'polyline' || tag === 'polygon') {
      // Create a temporary <path> to measure
      const d = el.getAttribute('d') || ''
      const pts = el.getAttribute('points') || ''
      if (d) {
        const tmp = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        tmp.setAttribute('d', d)
        return tmp.getTotalLength ? tmp.getTotalLength() : 200
      }
      if (pts) {
        const coords = pts.trim().split(/[\s,]+/).map(Number)
        let len = 0
        for (let i = 2; i < coords.length; i += 2) {
          const dx = coords[i] - coords[i - 2]
          const dy = coords[i + 1] - coords[i - 1]
          len += Math.sqrt(dx * dx + dy * dy)
        }
        return len || 200
      }
      return 200
    }
    if (tag === 'line') {
      const x1 = parseFloat(el.getAttribute('x1') || 0)
      const y1 = parseFloat(el.getAttribute('y1') || 0)
      const x2 = parseFloat(el.getAttribute('x2') || 0)
      const y2 = parseFloat(el.getAttribute('y2') || 0)
      return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) || 100
    }
    if (tag === 'circle') {
      const r = parseFloat(el.getAttribute('r') || 20)
      return 2 * Math.PI * r
    }
    if (tag === 'ellipse') {
      const rx = parseFloat(el.getAttribute('rx') || 20)
      const ry = parseFloat(el.getAttribute('ry') || 10)
      // Ramanujan approximation
      const h = ((rx - ry) * (rx - ry)) / ((rx + ry) * (rx + ry))
      return Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)))
    }
    if (tag === 'rect') {
      const w = parseFloat(el.getAttribute('width') || 50)
      const h = parseFloat(el.getAttribute('height') || 30)
      return 2 * (w + h)
    }
  } catch {}
  return 150
}

/**
 * Check if element is a "stroke" element (has visible stroke, not just fill).
 * We animate only stroked elements; filled elements appear instantly.
 */
function hasVisibleStroke(el) {
  const stroke = el.getAttribute('stroke') || ''
  if (stroke === 'none' || stroke === 'transparent') return false
  const strokeWidth = parseFloat(el.getAttribute('stroke-width') || '0')
  if (strokeWidth <= 0) {
    // Check CSS
    const style = el.getAttribute('style') || ''
    if (/stroke\s*:\s*none/i.test(style)) return false
    if (!/stroke\s*:/i.test(style) && stroke === '') return false
  }
  return true
}

/**
 * Check if element is a filled element with no stroke.
 * Filled-only elements should appear immediately.
 */
function isFilledOnly(el) {
  if (hasVisibleStroke(el)) return false
  const fill = el.getAttribute('fill') || ''
  if (fill === 'none' || fill === 'transparent') return false
  // Has fill but no stroke → fill-only
  return true
}

/**
 * Animate a single SVG container: make all stroked elements draw themselves
 * sequentially with stroke-dasharray/dashoffset animation.
 *
 * @param {Element} svgEl — the <svg> root element
 * @param {Object} opts
 * @param {number} opts.duration — total animation duration in ms (default 2000)
 * @param {number} opts.stagger — delay between elements in ms (default 150)
 */
export function animateSvgStrokes(svgEl, opts = {}) {
  if (!svgEl || (svgEl.getAttribute('data-animated') === 'true')) return
  const duration = opts.duration || 2000
  const stagger = opts.stagger || 150

  // Collect all drawable stroke elements
  const drawables = []
  // Elements with both stroke and fill: draw stroke first, fill after
  const drawableTags = ['path', 'line', 'circle', 'ellipse', 'rect', 'polygon', 'polyline']

  svgEl.querySelectorAll(drawableTags.join(',')).forEach(el => {
    if (hasVisibleStroke(el)) {
      const len = estimateLength(el)
      const origStroke = el.getAttribute('stroke') || 'currentColor'
      const origStrokeWidth = el.getAttribute('stroke-width') || '1'
      const origStrokeOpacity = el.getAttribute('stroke-opacity') || '1'
      const origFill = el.getAttribute('fill') || ''
      const origFillOpacity = el.getAttribute('fill-opacity') || ''

      drawables.push({
        el,
        len,
        origStroke,
        origStrokeWidth,
        origStrokeOpacity,
        origFill,
        origFillOpacity,
      })
    }
  })

  if (!drawables.length) {
    svgEl.setAttribute('data-animated', 'empty')
    return
  }

  // Total animation: each element takes `duration` to draw, but they overlap
  // by starting with stagger delays
  const perElDuration = Math.min(duration, duration / drawables.length + stagger * 2)
  const totalDuration = stagger * (drawables.length - 1) + perElDuration

  // Apply initial state: make all strokes invisible
  drawables.forEach((d, i) => {
    const el = d.el
    el.setAttribute('stroke-dasharray', d.len)
    el.setAttribute('stroke-dashoffset', d.len)
    // Preserve original visual
    el.style.stroke = d.origStroke
    el.style.strokeWidth = d.origStrokeWidth
    el.style.strokeOpacity = d.origStrokeOpacity
    if (d.origFill && d.origFill !== 'none') {
      // Delay fill until stroke is done
      el.setAttribute('fill', 'none')
    }
  })

  // Use CSS animation via a style element
  const styleId = 'svg-anim-' + Math.random().toString(36).slice(2, 6)
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.setAttribute('type', 'text/css')

  let css = ''
  drawables.forEach((d, i) => {
    // Give each element a unique class
    const cls = 'sa-' + i
    d.el.classList.add(cls)
    const delay = i * stagger
    // Ease-out for natural drawing feel
    css += `
      .${cls} {
        animation: sa-draw-${styleId} ${perElDuration}ms ${delay}ms cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
      }
      @keyframes sa-draw-${styleId} {
        0% { stroke-dashoffset: ${d.len}; }
        100% { stroke-dashoffset: 0; }
      }
    `
    // After animation, restore fill if there was one
    if (d.origFill && d.origFill !== 'none') {
      css += `
        .${cls} {
          animation: sa-draw-${styleId} ${perElDuration}ms ${delay}ms cubic-bezier(0.25, 0.1, 0.25, 1) forwards,
                     sa-fill-${styleId} 200ms ${delay + perElDuration - 200}ms ease forwards;
        }
        @keyframes sa-fill-${styleId} {
          0% { fill: none; }
          100% { fill: ${d.origFill}; }
        }
      `
    }
  })

  style.textContent = css
  svgEl.insertBefore(style, svgEl.firstChild)
  svgEl.setAttribute('data-animated', 'true')
  svgEl.setAttribute('data-anim-duration', totalDuration)

  // Clean up animation classes after animation completes (so SVG is static afterwards)
  setTimeout(() => {
    drawables.forEach(d => {
      d.el.style.strokeDasharray = ''
      d.el.style.strokeDashoffset = ''
      if (d.origFill && d.origFill !== 'none') {
        d.el.setAttribute('fill', d.origFill)
      }
    })
    if (style.parentNode) style.parentNode.removeChild(style)
  }, totalDuration + 100)
}

/**
 * Apply stroke animation to all unanimated SVGs inside a container.
 * Call this after inserting new content into the DOM.
 *
 * @param {Element} [container] — root element to scan (default: document.body)
 */
export function animateAllSvgs(container) {
  if (typeof document === 'undefined') return
  const root = container || document.body
  if (!root) return

  // Process pending SVGs (inserted by markdown renderer, already visible)
  const pendingSvgs = root.querySelectorAll('svg[data-animated="pending"]')
  pendingSvgs.forEach(svg => {
    // Use viewBox dimensions as primary fallback (more reliable than getBoundingClientRect)
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/)
    const vbW = parseFloat(vb[2]) || 0
    const vbH = parseFloat(vb[3]) || 0
    const attrW = parseFloat(svg.getAttribute('width') || '0')
    const attrH = parseFloat(svg.getAttribute('height') || '0')
    const rect = svg.getBoundingClientRect?.() || {}
    const w = attrW || vbW || rect.width || 800  // default to 800 for viewBox-only SVGs
    const h = attrH || vbH || rect.height || 600
    if (w > 50 || h > 50) {
      animateSvgStrokes(svg, { duration: 2000, stagger: 120 })
    } else {
      svg.setAttribute('data-animated', 'skip')
    }
  })

  // Also handle SVGs without any data-animated attribute
  const svgs = root.querySelectorAll('svg:not([data-animated])')
  svgs.forEach(svg => {
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/)
    const vbW = parseFloat(vb[2]) || 0
    const vbH = parseFloat(vb[3]) || 0
    const attrW = parseFloat(svg.getAttribute('width') || '0')
    const attrH = parseFloat(svg.getAttribute('height') || '0')
    const w = attrW || vbW || svg.getBoundingClientRect?.().width || 0
    const h = attrH || vbH || svg.getBoundingClientRect?.().height || 0

    if (w > 50 || h > 50) {
      animateSvgStrokes(svg, { duration: 2000, stagger: 120 })
    } else {
      svg.setAttribute('data-animated', 'skip')
    }
  })
}

// Auto-animate all SVGs when new content appears
let _svgObserver = null
export function startSvgAnimator() {
  if (typeof window === 'undefined' || _svgObserver) return

  // Run immediately for any existing SVGs
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => animateAllSvgs(), 100))
  } else {
    setTimeout(() => animateAllSvgs(), 100)
  }

  // Watch for new SVGs
  _svgObserver = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.nodeType === 1) {
          // Check if the node itself is an SVG or contains SVGs
          if (node.tagName === 'svg' || node.querySelectorAll) {
            requestAnimationFrame(() => animateAllSvgs(node.tagName === 'svg' ? node.parentElement : node))
          }
        }
      }
    }
  })

  const start = () => {
    if (!document.body) { setTimeout(start, 50); return }
    _svgObserver.observe(document.body, { childList: true, subtree: true })
  }
  start()
}

// Auto-start
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startSvgAnimator())
  } else {
    startSvgAnimator()
  }
}
