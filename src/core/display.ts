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
  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  // >= 24h: render as "XdYYh" (weekly reset context)
  if (totalHours >= 24) {
    const days = Math.floor(totalHours / 24)
    const remH = totalHours % 24
    return `${days}d${remH.toString().padStart(2, '0')}h`
  }
  if (totalHours > 0) {
    return `${totalHours}h${minutes.toString().padStart(2, '0')}m`
  }
  return `${minutes}m`
}

/**
 * Format a full cwd path for display, max 32 chars.
 * Always preserves the last path segment (current dir name) in full.
 * Tries to include as many parent segments as fit; falls back to "…/name".
 */
export function formatCwdPath(fullPath: string, maxLen = 32): string {
  if (fullPath.length <= maxLen) return fullPath
  const sep = '/'
  const parts = fullPath.split(sep).filter(p => p.length > 0)
  if (parts.length === 0) return fullPath.slice(-maxLen)
  const last = parts[parts.length - 1]
  // Build from the right, adding segments while they fit
  let result = last
  for (let i = parts.length - 2; i >= 0; i--) {
    const candidate = parts[i] + sep + result
    if (('…' + sep + candidate).length <= maxLen) {
      result = candidate
    } else {
      break
    }
  }
  return result === last ? '…' + sep + last : '…' + sep + result
}

// ─── ANSI block rendering (256-color backgrounds) ────────────────────────────

const ANSI_RESET = '\x1b[0m'

/** Palette entry for color blocks. */
type PlainPalette = { bg: number; fg: number }

/** 256-color palette — Indigo scheme. White fg on deep purple/navy backgrounds. */
const PALETTE = {
  model:      { bg: 54,  fg: 255 } as PlainPalette,  // deep purple
  cwd:        { bg: 237, fg: 255 } as PlainPalette,  // cool dark gray
  branch:     { bg: 235, fg: 255 } as PlainPalette,  // near-black gray
  tokens:     { bg: 58,  fg: 255 } as PlainPalette,  // dark amber
  usageOk:    { bg: 22,  fg: 255 } as PlainPalette,  // dark green
  usageWarn:  { bg: 94,  fg: 255 } as PlainPalette,  // dark orange
  usageDanger:{ bg: 88,  fg: 255 } as PlainPalette,  // dark red
  ctxOk:      { bg: 17,  fg: 255 } as PlainPalette,  // deep navy
  ctxWarn:    { bg: 18,  fg: 255 } as PlainPalette,  // navy
  ctxDanger:  { bg: 54,  fg: 255 } as PlainPalette,  // deep purple (matches model)
  mem:        { bg: 53,  fg: 255 } as PlainPalette,  // dark magenta-purple
  weather:    { bg: 17,  fg: 255 } as PlainPalette,  // deep navy
} as const

/**
 * Two-tone block: dim label on left, bold-white value on right. No gap after (flush).
 * If label is empty, renders value only in bold white.
 */
function block(label: string, value: string, palette: PlainPalette): string {
  const BG  = `\x1b[48;5;${palette.bg}m`
  const DIM = `\x1b[38;5;244m`  // muted label
  const WHT = `\x1b[38;5;255m`  // white value
  if (!label) {
    return `${BG}${WHT} ${value} ${ANSI_RESET}`
  }
  return `${BG}${DIM} ${label} ${WHT}${value} ${ANSI_RESET}`
}

/** Pick usage ok/warn/danger palette from percentage + thresholds. */
function usagePalette(pct: number | undefined, warnAt: number, dangerAt: number): PlainPalette {
  if (pct === undefined) return PALETTE.usageOk
  if (pct >= dangerAt) return PALETTE.usageDanger
  if (pct >= warnAt) return PALETTE.usageWarn
  return PALETTE.usageOk
}

/** Pick ctx ok/warn/danger palette from percentage + thresholds. */
function ctxPalette(pct: number | undefined, warnAt: number, dangerAt: number): PlainPalette {
  if (pct === undefined) return PALETTE.ctxOk
  if (pct >= dangerAt) return PALETTE.ctxDanger
  if (pct >= warnAt) return PALETTE.ctxWarn
  return PALETTE.ctxOk
}

// ─── Segment builders (each returns a ready-to-print block or null) ──────────

/**
 * Build a rate-limit block like " 5h 38% ↻2h15m ".
 * Used for both five_hour and weekly segments.
 * Returns null if the sub-object is missing or empty.
 */
function buildRateLimitBlock(
  ccData: Record<string, unknown>,
  key: 'five_hour' | 'weekly',
  label: string,
  warnAt: number,
  dangerAt: number
): string | null {
  const rateLimits = ccData['rate_limits']
  if (rateLimits === null || typeof rateLimits !== 'object') return null
  const sub = (rateLimits as Record<string, unknown>)[key]
  if (sub === null || typeof sub !== 'object') return null

  const s = sub as Record<string, unknown>
  const rawPct = s['used_percentage']
  const pct = typeof rawPct === 'number' ? rawPct : undefined
  const resets = formatResets(s['resets_at'] as number | string | null | undefined)

  if (pct === undefined && resets === null) return null

  const palette = usagePalette(pct, warnAt, dangerAt)
  const valueParts: string[] = []
  if (pct !== undefined) valueParts.push(`${Math.floor(pct)}%`)
  if (resets !== null) valueParts.push(`↻${resets}`)

  return block(label, valueParts.join(' '), palette)
}

/** 5h quota block. */
function buildQuotaBlock(ccData: Record<string, unknown>): string | null {
  return buildRateLimitBlock(ccData, 'five_hour', '5h', 70, 90)
}

/** Weekly quota block. */
function buildWeeklyBlock(ccData: Record<string, unknown>): string | null {
  return buildRateLimitBlock(ccData, 'weekly', 'wk', 70, 90)
}

/**
 * Build the context window block: " ctx 62% ".
 * Returns null if no context_window percentage is present.
 */
function buildCtxBlock(ccData: Record<string, unknown>): string | null {
  const ctxWindow = ccData['context_window']
  if (ctxWindow === null || typeof ctxWindow !== 'object') return null
  const usedPct = (ctxWindow as Record<string, unknown>)['used_percentage']
  if (usedPct === undefined || usedPct === null) return null
  const pct = Number(usedPct)
  if (isNaN(pct)) return null

  const pctFloor = Math.floor(pct)
  const palette = ctxPalette(pctFloor, 80, 95)
  return block('ctx', `${pctFloor}%`, palette)
}

function buildWeatherBlock(stats: Record<string, unknown>): string | null {
  const w = stats['weather']
  if (w === null || w === undefined || typeof w !== 'object') return null
  const weather = w as Record<string, unknown>
  const tempC = weather['tempC']
  const icon = weather['icon']
  const city = weather['city']
  if (typeof tempC !== 'number' || typeof icon !== 'string') return null
  const cityLabel = typeof city === 'string' && city.length > 0 ? city : ''
  return block(cityLabel, `${icon} ${tempC}°C`, PALETTE.weather)
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
  const gitBranch = typeof stats['git_branch'] === 'string' ? stats['git_branch'] : ''
  const tokens = formatTokens(stats['today_tokens'] as number | string | null | undefined)

  const truncModel = model.length > 20 ? model.slice(0, 19) + '…' : model
  const truncCwd = formatCwdPath(cwdName)
  const isMainBranch = gitBranch === 'main' || gitBranch === 'master'
  const branchSymbol = isMainBranch ? '⌂' : '⎇'
  const truncBranch = gitBranch.length > 20 ? gitBranch.slice(0, 19) + '…' : gitBranch

  const parts: string[] = []
  parts.push(block('', truncModel, PALETTE.model))
  if (truncCwd) parts.push(block('', truncCwd, PALETTE.cwd))
  if (truncBranch) parts.push(block(branchSymbol, truncBranch, PALETTE.branch))
  parts.push(block('tok', tokens, PALETTE.tokens))

  const quotaSeg = buildQuotaBlock(ccData)
  if (quotaSeg !== null) parts.push(quotaSeg)

  const weeklySeg = buildWeeklyBlock(ccData)
  if (weeklySeg !== null) parts.push(weeklySeg)

  const ctxSeg = buildCtxBlock(ccData)
  if (ctxSeg !== null) parts.push(ctxSeg)

  const memoryCount = typeof stats['memory_count'] === 'number' ? stats['memory_count'] as number : undefined
  if (memoryCount !== undefined && memoryCount > 0) {
    parts.push(block('mem', String(memoryCount), PALETTE.mem))
  }

  const weatherSeg = buildWeatherBlock(stats)
  if (weatherSeg !== null) parts.push(weatherSeg)

  const line2 = parts.join('')
  return `${line1}\n${line2}`
}
