import type { VocabData } from '../schemas'

/**
 * Format token count with adaptive precision:
 *  - n < 1000         → "500"
 *  - 1000..9999       → "1k" / "1.2k" (one decimal when non-integer)
 *  - 10_000..999_999  → "47k" (floor)
 *  - 1_000_000+       → "1.2M" / "14M" (one decimal when < 10M)
 *  - null/undef/NaN   → "N/A"
 */
export function formatTokens(tokenCount: number | string | null | undefined): string {
  if (tokenCount === null || tokenCount === undefined || tokenCount === 'N/A') {
    return 'N/A'
  }
  const n = typeof tokenCount === 'number' ? tokenCount : parseInt(String(tokenCount), 10)
  if (isNaN(n)) return 'N/A'

  if (n < 1000) return String(n)

  if (n < 10_000) {
    const val = n / 1000
    return val % 1 === 0 ? `${val}k` : `${val.toFixed(1)}k`
  }

  if (n < 1_000_000) {
    return `${Math.floor(n / 1000)}k`
  }

  const m = n / 1_000_000
  if (m < 10) {
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`
  }
  return `${Math.floor(m)}M`
}

/**
 * Format Unix timestamp or ISO string into relative '3h20m' or '45m'.
 * Returns null if past or invalid.
 */
export function formatResets(resetsAt: number | string | null | undefined): string | null {
  if (!resetsAt && resetsAt !== 0) return null
  let deltaSecs: number
  try {
    const ts = typeof resetsAt === 'number' ? resetsAt : parseFloat(String(resetsAt))
    if (!isNaN(ts)) {
      const nowSecs = Date.now() / 1000
      deltaSecs = ts - nowSecs
    } else {
      throw new Error('not a number')
    }
  } catch {
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
 * Block-character progress bar for a percentage.
 */
function _ctxBar(pct: number, width: number = 10): string {
  const filled = Math.max(0, Math.min(width, Math.round((pct / 100) * width)))
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

// ─── ANSI helpers ─────────────────────────────────────────────────────────────

const ANSI_RED = '\x1b[91m'
const ANSI_YELLOW = '\x1b[93m'
const ANSI_RESET = '\x1b[0m'

function colorize(text: string, code: string | null): string {
  return code === null ? text : `${code}${text}${ANSI_RESET}`
}

/** Yellow ≥ yellowAt, Red ≥ redAt, else no color. */
function pctColor(pct: number, yellowAt: number, redAt: number): string | null {
  if (pct >= redAt) return ANSI_RED
  if (pct >= yellowAt) return ANSI_YELLOW
  return null
}

// ─── Segment builders ─────────────────────────────────────────────────────────

/**
 * Build the 5h quota segment: "5h 38% ↻2h15m".
 * Returns null if no quota data is present.
 */
function buildQuotaSegment(ccData: Record<string, unknown>): string | null {
  const rateLimits = ccData['rate_limits']
  if (rateLimits === null || typeof rateLimits !== 'object') return null
  const fiveHour = (rateLimits as Record<string, unknown>)['five_hour']
  if (fiveHour === null || typeof fiveHour !== 'object') return null

  const fh = fiveHour as Record<string, unknown>
  const rawPct = fh['used_percentage']
  const pct = typeof rawPct === 'number' ? rawPct : undefined
  const resets = formatResets(fh['resets_at'] as number | string | null | undefined)

  if (pct === undefined && resets === null) return null

  const parts: string[] = ['5h']
  if (pct !== undefined) {
    parts.push(`${Math.floor(pct)}%`)
  }
  if (resets !== null) {
    parts.push(`↻${resets}`)
  }

  const text = parts.join(' ')
  const color = pct !== undefined ? pctColor(pct, 70, 90) : null
  return colorize(text, color)
}

/**
 * Build the context window segment: "ctx 62% [██████░░░░]".
 * Returns null if no context_window percentage is present.
 */
function buildCtxSegment(ccData: Record<string, unknown>): string | null {
  const ctxWindow = ccData['context_window']
  if (ctxWindow === null || typeof ctxWindow !== 'object') return null
  const usedPct = (ctxWindow as Record<string, unknown>)['used_percentage']
  if (usedPct === undefined || usedPct === null) return null
  const pct = Number(usedPct)
  if (isNaN(pct)) return null

  const pctFloor = Math.floor(pct)
  const bar = _ctxBar(pctFloor)
  const text = `ctx ${pctFloor}% [${bar}]`
  return colorize(text, pctColor(pctFloor, 80, 95))
}

// ─── Main render ──────────────────────────────────────────────────────────────

/**
 * Format the 2-line statusline output.
 *
 * Line 1: ascii + name: message   (optionally ANSI-colored)
 * Line 2: model · cwd · Nk tokens · 5h X% ↻YhZZm · ctx P% [bar] · N mem
 *   — any segment whose data is missing is dropped.
 */
export function render(
  character: VocabData,
  message: string,
  ccData: Record<string, unknown>,
  stats: Record<string, unknown>
): string {
  // ── Line 1 ──
  const asciiface = character.meta.ascii
  const name = character.meta.name
  const color = character.meta.color
  const truncMsg = message.length > 40 ? message.slice(0, 39) + '…' : message
  const rawLine1 = `${asciiface} ${name}: ${truncMsg}`
  const line1 = color ? `\x1b[${color}m${rawLine1}\x1b[0m` : rawLine1

  // ── Line 2 ──
  // Model
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

  const cwdName = typeof stats['cwd_name'] === 'string' ? stats['cwd_name'] : ''
  const tokens = formatTokens(stats['today_tokens'] as number | string | null | undefined)

  const truncModel = model.length > 20 ? model.slice(0, 19) + '…' : model
  const truncCwd = cwdName.length > 20 ? cwdName.slice(0, 19) + '…' : cwdName

  const parts: string[] = [truncModel]
  if (truncCwd) parts.push(truncCwd)
  parts.push(`${tokens} tokens`)

  const quotaSeg = buildQuotaSegment(ccData)
  if (quotaSeg !== null) parts.push(quotaSeg)

  const ctxSeg = buildCtxSegment(ccData)
  if (ctxSeg !== null) parts.push(ctxSeg)

  const memoryCount = typeof stats['memory_count'] === 'number' ? stats['memory_count'] as number : undefined
  if (memoryCount !== undefined && memoryCount > 0) {
    parts.push(`${memoryCount} mem`)
  }

  const line2 = parts.join(' · ')
  return `${line1}\n${line2}`
}
