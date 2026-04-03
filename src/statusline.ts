import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { render } from './core/display'
import { loadCharacter } from './core/character'
import { loadGitContext } from './core/gitContext'
import type { GitContextResult } from './core/gitContext'
import { resolveMessage, detectGitEvents, getTimeSlot } from './core/trigger'
import { parseState, DEFAULT_STATE } from './schemas'
import type { VocabData, StateType, ConfigType } from './schemas'

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_DIR = process.env.CODE_PAL_BASE_DIR ?? path.join(os.homedir(), '.claude', 'code-pal')
const CONFIG_PATH = path.join(BASE_DIR, 'config.json')
const STATE_PATH = path.join(BASE_DIR, 'state.json')
const STATS_PATH = process.env.CODE_PAL_STATS_PATH ?? path.join(os.homedir(), '.claude', 'stats-cache.json')

const HARDCODED_FALLBACK = '(*>ω<) Nova: 加油！今天也要好好编程！\nunknown | N/A tokens'

// ─── Loaders ─────────────────────────────────────────────────────────────────

function loadConfig(): { character: string } {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8')
    return JSON.parse(raw) as { character: string }
  } catch {
    return { character: 'nova' as const }
  }
}

function loadState(): StateType {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8')
    return parseState(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function loadStats(): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(STATS_PATH, 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown>
    const d = new Date()
    const today =
      `${d.getFullYear()}-` +
      `${String(d.getMonth() + 1).padStart(2, '0')}-` +
      `${String(d.getDate()).padStart(2, '0')}`
    const daily = data.dailyModelTokens
    if (Array.isArray(daily)) {
      for (const entry of daily as Record<string, unknown>[]) {
        if (entry.date === today) {
          const byModel = entry.tokensByModel
          if (byModel !== null && typeof byModel === 'object') {
            const total = Object.values(byModel as Record<string, unknown>).reduce<number>(
              (acc, v) => acc + Number(v),
              0
            )
            return { today_tokens: total }
          }
        }
      }
    }
    return { today_tokens: 'N/A' }
  } catch {
    return { today_tokens: 'N/A' }
  }
}

function loadStdinJson(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk: string) => { data += chunk })
    process.stdin.on('end', () => {
      try {
        const raw = data.trim()
        resolve(raw ? JSON.parse(raw) as Record<string, unknown> : {})
      } catch {
        resolve({})
      }
    })
    setTimeout(() => resolve({}), 50)
  })
}

// ─── State helpers ────────────────────────────────────────────────────────────

function shouldResetSessionStart(existing: string | undefined): boolean {
  if (!existing) return true
  try {
    const dt = new Date(existing)
    const today = new Date()
    return (
      dt.getFullYear() !== today.getFullYear() ||
      dt.getMonth() !== today.getMonth() ||
      dt.getDate() !== today.getDate()
    )
  } catch {
    return true
  }
}

function saveState(
  message: string,
  tier: string,
  slot: string,
  options?: {
    lastGitEvents?: string[]
    lastRepo?: string | undefined
    commitsToday?: number
    sessionStart?: string
  }
): void {
  fs.mkdirSync(BASE_DIR, { recursive: true })
  const state: Record<string, unknown> = {
    message,
    last_updated: new Date().toISOString(),
    last_rate_tier: tier,
    last_slot: slot,
  }
  if (options?.lastGitEvents !== undefined) state.last_git_events = options.lastGitEvents
  if (options?.lastRepo !== undefined) state.last_repo = options.lastRepo
  if (options?.commitsToday !== undefined) state.commits_today = options.commitsToday
  if (options?.sessionStart !== undefined) state.session_start = options.sessionStart
  fs.writeFileSync(STATE_PATH + '.tmp', JSON.stringify(state, undefined, 2), 'utf-8')
  fs.renameSync(STATE_PATH + '.tmp', STATE_PATH)
}

// ─── Debug helpers ────────────────────────────────────────────────────────────

function localIsoSeconds(): string {
  const d = new Date()
  const Y = d.getFullYear()
  const M = String(d.getMonth() + 1).padStart(2, '0')
  const D = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${Y}-${M}-${D}T${h}:${m}:${s}`
}

function eventReason(
  event: string,
  gitContext: Record<string, unknown>,
  config: Record<string, unknown>
): string {
  const thresholds = (config.event_thresholds as Record<string, unknown>) ?? {}
  if (event === 'first_commit_today') return 'first commit of the day'
  if (event.startsWith('milestone_')) {
    const count = event.split('_')[1]
    return `commits_today ${gitContext.commits_today ?? 0} reached milestone ${count}`
  }
  if (event === 'late_night_commit') {
    const hour =
      typeof thresholds.late_night_hour_start === 'number' ? thresholds.late_night_hour_start : 22
    return `current hour >= threshold ${hour}`
  }
  if (event === 'big_diff') {
    const threshold = typeof thresholds.big_diff === 'number' ? thresholds.big_diff : 200
    return `diff_lines ${gitContext.diff_lines ?? 0} >= threshold ${threshold}`
  }
  if (event === 'big_session') {
    const threshold =
      typeof thresholds.big_session_minutes === 'number' ? thresholds.big_session_minutes : 120
    return `session_minutes >= threshold ${threshold}`
  }
  if (event === 'long_day') {
    const threshold =
      typeof thresholds.long_day_commits === 'number' ? thresholds.long_day_commits : 15
    return `commits_today ${gitContext.commits_today ?? 0} >= threshold ${threshold}`
  }
  return event
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const updateOnly =
    process.argv.includes('--update') || process.argv.includes('--debug-events')
  const debugMode = process.argv.includes('--debug-events')

  const config = loadConfig()
  const state = loadState()
  const stats = loadStats()
  stats['cwd_name'] = path.basename(process.cwd())

  // Per D-01: render mode does NOT read stdin; update mode reads stdin
  const ccData: Record<string, unknown> = updateOnly ? await loadStdinJson() : {}

  // Token fallback: supplement from ccData when stats-cache has no today entry
  if (stats['today_tokens'] === 'N/A' || stats['today_tokens'] === undefined) {
    const ctx = ccData['context_window'] as Record<string, unknown> | undefined
    if (ctx !== undefined) {
      const total =
        Number(ctx['total_input_tokens'] ?? 0) + Number(ctx['total_output_tokens'] ?? 0)
      if (total > 0) stats['today_tokens'] = total
    }
  }

  // --update mode: git context + event detection + session tracking
  let gitContext: GitContextResult | null = null
  let triggeredEvents: string[] | null = null
  let sessionStartVal: string | undefined

  if (updateOnly) {
    gitContext = await loadGitContext(process.cwd())
    triggeredEvents = detectGitEvents(
      gitContext as unknown as Record<string, unknown>,
      state,
      config as ConfigType & { event_thresholds?: Record<string, unknown> }
    )

    // D-10: session_start same-day preserve, cross-day reset
    const existingSessionStart = state.session_start
    if (shouldResetSessionStart(existingSessionStart)) {
      sessionStartVal = new Date().toISOString()
    } else {
      sessionStartVal = existingSessionStart
    }
  }

  // Character loading with two-level fallback (D-06)
  let character: VocabData
  try {
    character = loadCharacter(config.character ?? 'nova')
  } catch {
    try {
      character = loadCharacter('nova')
    } catch {
      process.stdout.write(HARDCODED_FALLBACK)
      return
    }
  }

  const slot = getTimeSlot()
  const { message, tier } = resolveMessage(
    character,
    state,
    stats,
    ccData,
    updateOnly,
    triggeredEvents
  )

  // Compute git state for persistence (update mode only)
  let newLastGitEvents: string[] | undefined
  let newLastRepo: string | null | undefined
  let newCommitsToday: number | undefined

  if (updateOnly && gitContext !== null) {
    const currentRepo = gitContext.repo_path
    let baseEvents: string[]
    if (currentRepo !== null && currentRepo !== state.last_repo) {
      baseEvents = []
    } else {
      const raw = state.last_git_events
      baseEvents = Array.isArray(raw) ? raw : []
    }
    newLastGitEvents = [
      ...baseEvents,
      ...(triggeredEvents ?? []).filter((e) => !baseEvents.includes(e)),
    ]
    newLastRepo = currentRepo !== null ? currentRepo : state.last_repo
    newCommitsToday = gitContext.commits_today ?? 0
  }

  // Persist state (update mode)
  if (updateOnly && newLastGitEvents !== undefined) {
    if (message !== state.message || tier !== state.last_rate_tier) {
      saveState(message, tier, slot, {
        lastGitEvents: newLastGitEvents,
        lastRepo: newLastRepo ?? undefined,
        commitsToday: newCommitsToday,
        sessionStart: sessionStartVal,
      })
    } else {
      saveState(state.message ?? '', state.last_rate_tier ?? 'normal', slot, {
        lastGitEvents: newLastGitEvents,
        lastRepo: newLastRepo ?? undefined,
        commitsToday: newCommitsToday,
        sessionStart: sessionStartVal,
      })
    }
  } else if (updateOnly) {
    // update mode but no git context (non-git dir) — still save message + session_start
    saveState(message, tier, slot, { sessionStart: sessionStartVal })
  }

  // --debug-events: output diagnostic info to stderr (D-04, D-05)
  if (debugMode) {
    const safeSessionStart = sessionStartVal ?? new Date().toISOString()
    let sessionMinutes = 0
    try {
      const sessionStartDt = new Date(safeSessionStart)
      sessionMinutes = Math.floor((Date.now() - sessionStartDt.getTime()) / 60000)
    } catch {
      sessionMinutes = 0
    }

    const gitCtxDisplay = {
      commits_today: gitContext !== null ? (gitContext.commits_today ?? 0) : 0,
      diff_lines: gitContext !== null ? (gitContext.diff_lines ?? 0) : 0,
      session_minutes: sessionMinutes,
    }
    const eventsDisplay: Record<string, string> = {}
    for (const e of triggeredEvents ?? []) {
      eventsDisplay[e] = eventReason(
        e,
        (gitContext as unknown as Record<string, unknown>) ?? {},
        config as Record<string, unknown>
      )
    }
    const stateSnapshot = {
      last_git_events: newLastGitEvents ?? [],
      commits_today: newCommitsToday ?? 0,
      session_start: safeSessionStart,
      last_repo: newLastRepo ?? null,
    }

    const ts = localIsoSeconds()
    process.stderr.write(`[${ts}] GIT_CONTEXT: ${JSON.stringify(gitCtxDisplay)}\n`)
    process.stderr.write(`EVENTS_WOULD_FIRE: ${JSON.stringify(eventsDisplay)}\n`)
    process.stderr.write(`STATE_SNAPSHOT: ${JSON.stringify(stateSnapshot)}\n`)
  }

  if (updateOnly) return

  // Per D-09: process.stdout.write, NO trailing newline
  process.stdout.write(render(character, message, ccData, stats))
}

main().catch((err: unknown) => {
  process.stderr.write(`[code-pal] error: ${String(err)}\n`)
  process.exit(1)
})
