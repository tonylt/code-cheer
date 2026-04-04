import type { VocabData } from '../schemas'

/**
 * Format token count: 47768 → '47k', 500 → '500', None → 'N/A'.
 * Mirrors Python display.py format_tokens().
 */
export function formatTokens(tokenCount: number | string | null | undefined): string {
  if (tokenCount === null || tokenCount === undefined || tokenCount === 'N/A') {
    return 'N/A'
  }
  let n: number
  try {
    n = typeof tokenCount === 'number' ? tokenCount : parseInt(String(tokenCount), 10)
    if (isNaN(n)) return 'N/A'
  } catch {
    return 'N/A'
  }
  if (n >= 1000) {
    return `${Math.floor(n / 1000)}k`
  }
  return String(n)
}

/**
 * Format Unix timestamp or ISO string into relative '3h20m' or '45m'.
 * Returns null if past or invalid.
 * Mirrors Python display.py format_resets().
 */
export function formatResets(resetsAt: number | string | null | undefined): string | null {
  if (!resetsAt && resetsAt !== 0) return null
  let deltaSecs: number
  try {
    // Unix timestamp (number or numeric string)
    const ts = typeof resetsAt === 'number' ? resetsAt : parseFloat(String(resetsAt))
    if (!isNaN(ts)) {
      const nowSecs = Date.now() / 1000
      deltaSecs = ts - nowSecs
    } else {
      throw new Error('not a number')
    }
  } catch {
    // ISO string fallback
    try {
      const resetMs = new Date(String(resetsAt)).getTime()
      if (isNaN(resetMs)) return null
      deltaSecs = (resetMs - Date.now()) / 1000
    } catch {
      return null
    }
  }
  if (deltaSecs <= 0) return null
  const totalMinutes = Math.round(deltaSecs / 60)
  if (totalMinutes <= 0) return null
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}m`
  }
  return `${minutes}m`
}

/**
 * Build a block-character progress bar for the given percentage.
 * Mirrors Python display.py _ctx_bar().
 */
function _ctxBar(pct: number, width: number = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

/**
 * Format the 2-line statusline output (both lines left-aligned).
 * Mirrors Python display.py render().
 *
 * Line 1: ascii + name + message (with optional ANSI color)
 * Line 2: model | cwdName | tokens tokens | [bar] pct%
 */
export function render(
  character: VocabData,
  message: string,
  ccData: Record<string, unknown>,
  stats: Record<string, unknown>
): string {
  // Line 1 — D-09: ANSI color if non-empty, D-10: skip escape if empty
  const asciiface = character.meta.ascii
  const name = character.meta.name
  const color = character.meta.color
  const rawLine1 = `${asciiface} ${name}: ${message}`
  const line1 = color ? `\x1b[${color}m${rawLine1}\x1b[0m` : rawLine1

  // Model extraction — handle string or object forms
  const modelRaw = ccData['model']
  let model: string
  if (modelRaw !== null && typeof modelRaw === 'object') {
    const modelObj = modelRaw as Record<string, unknown>
    model = String(modelObj['display_name'] ?? modelObj['id'] ?? 'unknown')
  } else if (modelRaw !== undefined && modelRaw !== null) {
    model = String(modelRaw)
  } else {
    model = 'unknown'
  }


  // Stats fields
  const cwdName = typeof stats['cwd_name'] === 'string' ? stats['cwd_name'] : ''
  const tokens = formatTokens(stats['today_tokens'] as number | string | null | undefined)

  // Context window bar — P5 pitfall: check !== undefined not truthy (pct=0 is valid)
  const ctxWindow = ccData['context_window']
  let ctxPct: number | undefined
  if (ctxWindow !== null && typeof ctxWindow === 'object') {
    const ctxObj = ctxWindow as Record<string, unknown>
    const usedPct = ctxObj['used_percentage']
    if (usedPct !== undefined && usedPct !== null) {
      ctxPct = Number(usedPct)
    }
  }

  // Build line 2 parts
  const parts: string[] = [model]
  if (cwdName) {
    parts.push(cwdName)
  }
  parts.push(`${tokens} tokens`)
  if (ctxPct !== undefined) {
    const bar = _ctxBar(Math.floor(ctxPct))
    parts.push(`[${bar}] ${ctxPct}%`)
  }

  const line2 = parts.join(' | ')
  return `${line1}\n${line2}`
}
