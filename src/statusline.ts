import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { render } from './core/display'
import { loadCharacter } from './core/character'
import { loadGitContext } from './core/gitContext'
import type { GitContextResult } from './core/gitContext'
import { resolveMessage, detectGitEvents, getTimeSlot } from './core/trigger'
import { parseState, DEFAULT_STATE, parseConfig } from './schemas'
import type { VocabData, StateType, ConfigType } from './schemas'

// ─── Constants ────────────────────────────────────────────────────────────────

const HARDCODED_FALLBACK = '(*>ω<) Nova: 加油！今天也要好好编程！\nunknown | N/A tokens'

// ─── Path resolver ────────────────────────────────────────────────────────────

function resolvePaths(env?: NodeJS.ProcessEnv) {
  const e = env ?? process.env
  const baseDir = e.CODE_CHEER_BASE_DIR ?? path.join(os.homedir(), '.claude', 'code-cheer')
  return {
    baseDir,
    configPath: path.join(baseDir, 'config.json'),
    statePath: path.join(baseDir, 'state.json'),
    statsPath: e.CODE_CHEER_STATS_PATH ?? path.join(os.homedir(), '.claude', 'stats-cache.json'),
  }
}

// ─── Loaders ─────────────────────────────────────────────────────────────────

export function loadConfig(configPath: string): ConfigType {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return parseConfig(JSON.parse(raw), 'config.json')
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') {
      process.stderr.write(`[code-cheer] config.json error — using defaults\n`)
    }
    return { character: 'nova' }
  }
}

function loadState(statePath: string): StateType {
  try {
    const raw = fs.readFileSync(statePath, 'utf-8')
    return parseState(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function loadStats(statsPath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(statsPath, 'utf-8')
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
              (acc, v) => acc + (typeof v === 'number' ? v : 0),
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

// ─── Token fallback helper ────────────────────────────────────────────────────

function applyTokenFallback(
  stats: Record<string, unknown>,
  ccData: Record<string, unknown>
): void {
  if (stats['today_tokens'] === 'N/A' || stats['today_tokens'] === undefined) {
    const ctx = ccData['context_window'] as Record<string, unknown> | undefined
    if (ctx !== undefined) {
      const total =
        Number(ctx['total_input_tokens'] ?? 0) + Number(ctx['total_output_tokens'] ?? 0)
      if (total > 0) stats['today_tokens'] = total
    }
  }
}

// ─── Transcript reader ────────────────────────────────────────────────────────

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
  statePath: string,
  baseDir: string,
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
  fs.mkdirSync(baseDir, { recursive: true })
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
  fs.writeFileSync(statePath + '.tmp', JSON.stringify(state, undefined, 2), 'utf-8')
  try {
    fs.renameSync(statePath + '.tmp', statePath)
  } catch (err: unknown) {
    if (err instanceof Error && (err as NodeJS.ErrnoException).code === 'EXDEV') {
      fs.copyFileSync(statePath + '.tmp', statePath)
      fs.unlinkSync(statePath + '.tmp')
    } else {
      throw err
    }
  }
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

// ─── Stdin helper ─────────────────────────────────────────────────────────────

function readStdinString(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk: string) => { data += chunk })
    process.stdin.on('end', () => { resolve(data) })
    setTimeout(() => resolve(data), 50)
  })
}

// ─── Shared update core ───────────────────────────────────────────────────────

interface UpdateCoreResult {
  message: string
  tier: string
  slot: string
  gitContext: GitContextResult
  triggeredEvents: string[]
  sessionStartVal: string
  newLastGitEvents: string[]
  newLastRepo: string | null | undefined
  newCommitsToday: number
  baseDir: string
  statePath: string
}

async function runUpdateCore(
  stdin: string,
  env?: NodeJS.ProcessEnv
): Promise<UpdateCoreResult> {
  const { baseDir, configPath, statePath, statsPath } = resolvePaths(env)

  const config = loadConfig(configPath)
  const state = loadState(statePath)
  const stats = loadStats(statsPath)
  stats['cwd_name'] = path.basename(process.cwd())

  // Parse stdin as JSON (empty string -> {})
  let ccData: Record<string, unknown> = {}
  try {
    const raw = stdin.trim()
    if (raw) ccData = JSON.parse(raw) as Record<string, unknown>
  } catch {
    ccData = {}
  }

  // Token fallback: supplement from ccData when stats-cache has no today entry
  applyTokenFallback(stats, ccData)

  const gitContext = await loadGitContext(process.cwd())
  const triggeredEvents = detectGitEvents(
    gitContext as unknown as Record<string, unknown>,
    state,
    config as ConfigType & { event_thresholds?: Record<string, unknown> }
  )

  // D-10: session_start same-day preserve, cross-day reset
  const existingSessionStart = state.session_start
  const isNewDay = shouldResetSessionStart(existingSessionStart)
  let sessionStartVal: string
  if (isNewDay) {
    sessionStartVal = new Date().toISOString()
  } else {
    sessionStartVal = existingSessionStart!
  }

  // Character loading with two-level fallback (D-06)
  // Pass explicit vocabDir so ts-jest (__dirname=src/) and dist/ (__dirname=dist/) both resolve correctly.
  const vocabDir = path.join(__dirname, '../vocab')
  let character: VocabData
  try {
    character = loadCharacter(config.character ?? 'nova', vocabDir, config.language)
  } catch {
    try {
      character = loadCharacter('nova', vocabDir, config.language)
    } catch {
      throw new Error('character_load_failed')
    }
  }

  const slot = getTimeSlot()
  const { message, tier } = resolveMessage(character, state, stats, ccData, true, triggeredEvents)

  // Compute git state for persistence
  // Reset on repo change OR new day (prevents cross-day event dedup leakage)
  const currentRepo = gitContext.repo_path
  let baseEvents: string[]
  if ((currentRepo !== null && currentRepo !== state.last_repo) || isNewDay) {
    baseEvents = []
  } else {
    const raw = state.last_git_events
    baseEvents = Array.isArray(raw) ? raw : []
  }
  const newLastGitEvents = [
    ...baseEvents,
    ...triggeredEvents.filter((e) => !baseEvents.includes(e)),
  ]
  const newLastRepo = currentRepo !== null ? currentRepo : state.last_repo
  const newCommitsToday = gitContext.commits_today ?? 0

  // Persist state (atomic write)
  if (message !== state.message || tier !== state.last_rate_tier) {
    saveState(statePath, baseDir, message, tier, slot, {
      lastGitEvents: newLastGitEvents,
      lastRepo: newLastRepo ?? undefined,
      commitsToday: newCommitsToday,
      sessionStart: sessionStartVal,
    })
  } else {
    saveState(statePath, baseDir, state.message ?? '', state.last_rate_tier ?? 'normal', slot, {
      lastGitEvents: newLastGitEvents,
      lastRepo: newLastRepo ?? undefined,
      commitsToday: newCommitsToday,
      sessionStart: sessionStartVal,
    })
  }

  return {
    message,
    tier,
    slot,
    gitContext,
    triggeredEvents,
    sessionStartVal,
    newLastGitEvents,
    newLastRepo,
    newCommitsToday,
    baseDir,
    statePath,
  }
}

// ─── Exported mode functions ──────────────────────────────────────────────────

export function renderMode(stdin: string = '', env?: NodeJS.ProcessEnv): string {
  const { configPath, statePath, statsPath } = resolvePaths(env)

  const config = loadConfig(configPath)
  const state = loadState(statePath)
  const stats = loadStats(statsPath)
  stats['cwd_name'] = path.basename(process.cwd())

  // Parse stdin as ccData — mirrors Python: cc_data = read_stdin_json() in all modes
  let ccData: Record<string, unknown> = {}
  try {
    const raw = stdin.trim()
    if (raw) ccData = JSON.parse(raw) as Record<string, unknown>
  } catch {
    ccData = {}
  }

  // Token fallback: supplement from ccData when stats-cache has no today entry
  applyTokenFallback(stats, ccData)

  // Character loading with two-level fallback (D-06)
  // Pass explicit vocabDir so ts-jest (__dirname=src/) and dist/ (__dirname=dist/) both resolve
  // path.join(__dirname, '../vocab') correctly to project-root/vocab/.
  const vocabDir = path.join(__dirname, '../vocab')
  let character: VocabData
  try {
    character = loadCharacter(config.character ?? 'nova', vocabDir, config.language)
  } catch {
    try {
      character = loadCharacter('nova', vocabDir, config.language)
    } catch {
      return HARDCODED_FALLBACK
    }
  }

  const { message } = resolveMessage(character, state, stats, ccData, false, null)

  return render(character, message, ccData, stats)
}

export async function updateMode(stdin: string, env?: NodeJS.ProcessEnv): Promise<void> {
  try {
    await runUpdateCore(stdin, env)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'character_load_failed') return
    throw err
  }
}

export async function debugMode(stdin: string, env?: NodeJS.ProcessEnv): Promise<void> {
  let result: UpdateCoreResult
  try {
    result = await runUpdateCore(stdin, env)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'character_load_failed') return
    throw err
  }

  const { gitContext, triggeredEvents, sessionStartVal, newLastGitEvents, newCommitsToday, newLastRepo } = result

  // Debug output to stderr (D-04, D-05)
  let sessionMinutes = 0
  try {
    const sessionStartDt = new Date(sessionStartVal)
    sessionMinutes = Math.floor((Date.now() - sessionStartDt.getTime()) / 60000)
  } catch {
    sessionMinutes = 0
  }

  // Load config again for eventReason (needed for thresholds)
  const { configPath } = resolvePaths(env)
  const config = loadConfig(configPath)

  const gitCtxDisplay = {
    commits_today: gitContext.commits_today ?? 0,
    diff_lines: gitContext.diff_lines ?? 0,
    session_minutes: sessionMinutes,
  }
  const eventsDisplay: Record<string, string> = {}
  for (const e of triggeredEvents) {
    eventsDisplay[e] = eventReason(
      e,
      (gitContext as unknown as Record<string, unknown>),
      config as Record<string, unknown>
    )
  }
  const stateSnapshot = {
    last_git_events: newLastGitEvents,
    commits_today: newCommitsToday,
    session_start: sessionStartVal,
    last_repo: newLastRepo ?? null,
  }

  const ts = localIsoSeconds()
  process.stderr.write(`[${ts}] GIT_CONTEXT: ${JSON.stringify(gitCtxDisplay)}\n`)
  process.stderr.write(`EVENTS_WOULD_FIRE: ${JSON.stringify(eventsDisplay)}\n`)
  process.stderr.write(`STATE_SNAPSHOT: ${JSON.stringify(stateSnapshot)}\n`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const isDebug = process.argv.includes('--debug-events')
  const isUpdate = process.argv.includes('--update') || isDebug

  const stdin = await readStdinString()

  if (isDebug) {
    await debugMode(stdin)
    return
  }

  if (isUpdate) {
    await updateMode(stdin)
    return
  }

  process.stdout.write(renderMode(stdin))
}

if (require.main === module) {
  main().catch((err: unknown) => {
    process.stderr.write(`[code-cheer] error: ${String(err)}\n`)
    process.exit(1)
  })
}
