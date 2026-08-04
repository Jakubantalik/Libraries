/** `box-shadow`-syntax parser. Layers become SVG filter passes built from the
 *  merged liquid silhouette, so one shadow hugs the goo through every state. */

export interface ShadowLayer {
  x: number
  y: number
  blur: number
  spread: number
  color: string
}

function splitTop(s: string, sep: ',' | ' '): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (depth === 0 && (sep === ',' ? ch === ',' : /\s/.test(ch))) {
      if (cur.trim()) parts.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts
}

const LENGTH = /^[+-]?(\d+\.?\d*|\.\d+)(px)?$/

let warnedInset = false

export function parseShadow(input?: string | null): ShadowLayer[] {
  if (!input || input.trim() === '' || input.trim() === 'none') return []
  const out: ShadowLayer[] = []
  for (const layer of splitTop(input, ',')) {
    const tokens = splitTop(layer, ' ')
    if (tokens.length === 0) continue
    if (tokens.includes('inset')) {
      if (!warnedInset && typeof console !== 'undefined') {
        warnedInset = true
        console.warn('[gooey] inset shadows are not supported and were skipped.')
      }
      continue
    }
    const nums: number[] = []
    const colorParts: string[] = []
    for (const tok of tokens) {
      if (nums.length < 4 && LENGTH.test(tok)) nums.push(parseFloat(tok))
      else colorParts.push(tok)
    }
    const [x = 0, y = 0, blur = 0, spread = 0] = nums
    out.push({ x, y, blur, spread, color: colorParts.join(' ') || 'rgba(0, 0, 0, 0.35)' })
  }
  return out
}
