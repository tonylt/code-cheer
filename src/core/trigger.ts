import type { VocabData, StateType, ConfigType } from '../schemas'

// ─── Tier helpers ─────────────────────────────────────────────────────────────

/**
 * Return rate limit tier based on usage percentage.
 * Mirrors Python get_tier().
 */
export function getTier(usedPct: number): string {
  if (usedPct >= 95) return 'critical'
  if (usedPct >= 80) return 'warning'
  return 'normal'
}

// ─── Time slot ────────────────────────────────────────────────────────────────

/**
 * Return current time slot: morning / afternoon / evening / midnight.
 * Mirrors Python get_time_slot().
 */
export function getTimeSlot(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour <= 11) return 'morning'
  if (hour >= 12 && hour <= 17) return 'afternoon'
  if (hour >= 18 && hour <= 22) return 'evening'
  return 'midnight'
}

// ─── Random pick helpers ───────────────────────────────────────────────────────

/**
 * Pick a random item from a list.
 * Accepts optional rng for Phase 12 deterministic testing (D-06).
 */
export function pick(options: string[], rng: () => number = Math.random): string {
  const index = Math.floor(rng() * options.length)
  return options[index] ?? ''
}

/**
 * Pick a random item that differs from last.
 * Falls back to any item if only one option or no alternatives.
 * Accepts optional rng for Phase 12 deterministic testing (D-07).
 */
export function pickDifferent(options: string[], last: string, rng: () => number = Math.random): string {
  if (options.length <= 1) return options[0] ?? ''
  const filtered = options.filter(o => o !== last)
  if (filtered.length > 0) return pick(filtered, rng)
  return pick(options, rng)
}

// ─── Cache expiry ──────────────────────────────────────────────────────────────

/**
 * Return true if last_updated is older than `minutes` ago, or missing.
 * Mirrors Python cache_expired().
 */
export function cacheExpired(lastUpdated: string | undefined, minutes: number = 5): boolean {
  if (!lastUpdated) return true
  try {
    const dt = new Date(lastUpdated)
    if (isNaN(dt.getTime())) return true
    const delta = (Date.now() - dt.getTime()) / 1000
    return delta > minutes * 60
  } catch {
    return true
  }
}

// ─── Git event detection ───────────────────────────────────────────────────────

/**
 * Detect triggered git events and return list sorted by priority (highest first).
 * Mirrors Python detect_git_events().
 *
 * Per-repo isolation: when repo changes, effective_last_events resets to [].
 * Note: check repo_path !== null (not !repo_path) — empty string is valid repo (P5).
 */
export function detectGitEvents(
  gitContext: Record<string, unknown>,
  state: StateType,
  config: ConfigType & { event_thresholds?: Record<string, unknown> }
): string[] {
  const thresholds = (config as Record<string, unknown>).event_thresholds as Record<string, unknown> | undefined ?? {}

  const bigDiffThreshold = typeof thresholds.big_diff === 'number' ? thresholds.big_diff : 200
  const milestoneCounts: number[] = Array.isArray(thresholds.milestone_counts)
    ? (thresholds.milestone_counts as unknown[]).filter((x): x is number => typeof x === 'number')
    : [5, 10, 20]
  const bigSessionMinutes = typeof thresholds.big_session_minutes === 'number' ? thresholds.big_session_minutes : 120
  const longDayCommits = typeof thresholds.long_day_commits === 'number' ? thresholds.long_day_commits : 15
  const lateNightHour = typeof thresholds.late_night_hour_start === 'number' ? thresholds.late_night_hour_start : 22

  // Per-repo isolation (D-05): logical reset when repo changes
  const currentRepo = gitContext.repo_path as string | null | undefined
  const lastRepo = state.last_repo
  let effectiveLastEvents: string[]
  if (currentRepo !== null && currentRepo !== undefined && currentRepo !== lastRepo) {
    effectiveLastEvents = []
  } else {
    const raw = state.last_git_events
    effectiveLastEvents = Array.isArray(raw) ? raw : []
  }

  // Use !== undefined for 0-safe checks (P5 pitfall)
  const commitsToday: number = typeof gitContext.commits_today === 'number' ? gitContext.commits_today : 0
  const diffLines: number = typeof gitContext.diff_lines === 'number' ? gitContext.diff_lines : 0

  const events: string[] = []

  // Priority 1: milestones — highest to lowest, independent dedup (D-08)
  const sortedMilestones = [...milestoneCounts].sort((a, b) => b - a)
  for (const count of sortedMilestones) {
    const key = `milestone_${count}`
    if (commitsToday >= count && !effectiveLastEvents.includes(key)) {
      events.push(key)
    }
  }

  // Priority 2: late_night_commit
  // Use > 0 check for commits_today (not truthiness, P5 pitfall)
  if (commitsToday > 0 && new Date().getHours() >= lateNightHour) {
    if (!effectiveLastEvents.includes('late_night_commit')) {
      events.push('late_night_commit')
    }
  }

  // Priority 3: big_diff
  if (diffLines >= bigDiffThreshold && !effectiveLastEvents.includes('big_diff')) {
    events.push('big_diff')
  }

  // Priority 4: big_session — safe skip if session_start missing
  const sessionStart = state.session_start
  if (sessionStart !== undefined && sessionStart !== '') {
    try {
      const startDt = new Date(sessionStart)
      const elapsedMinutes = (Date.now() - startDt.getTime()) / 60000
      if (elapsedMinutes >= bigSessionMinutes && !effectiveLastEvents.includes('big_session')) {
        events.push('big_session')
      }
    } catch {
      // safe skip
    }
  }

  // Priority 5: long_day
  if (commitsToday >= longDayCommits && !effectiveLastEvents.includes('long_day')) {
    events.push('long_day')
  }

  // Priority 6: first_commit_today
  if (commitsToday > 0 && !effectiveLastEvents.includes('first_commit_today')) {
    events.push('first_commit_today')
  }

  return events
}

// ─── Main message resolver ─────────────────────────────────────────────────────

/**
 * Select the appropriate message and return { message, tier }.
 * Implements 6-level priority logic, mirrors Python resolve_message().
 *
 * Return type is an object (NOT a tuple) — Phase 11 statusline.ts depends on this.
 */
export function resolveMessage(
  character: VocabData,
  state: StateType,
  _stats: unknown,
  ccData: Record<string, unknown>,
  forcePostTool: boolean = false,
  triggeredEvents: string[] | null = null
): { message: string; tier: string } {
  const rateLimits = (ccData.rate_limits as Record<string, unknown>) ?? {}
  const fiveHour = (rateLimits.five_hour as Record<string, unknown>) ?? {}
  const usedPct = typeof fiveHour.used_percentage === 'number' ? fiveHour.used_percentage : 0
  const tier = getTier(usedPct)

  const triggers = character.triggers ?? {}
  const lastTier = state.last_rate_tier ?? 'normal'

  // Priority 1: usage tier change
  if (tier !== lastTier) {
    if (tier !== 'normal') {
      const usageVocab = triggers.usage ?? {}
      const tierOptions = (usageVocab as Record<string, string[] | undefined>)[tier] ?? []
      return { message: pick(tierOptions), tier }
    }
    // Dropped back to normal — fall through to normal priorities
  }

  // Alert persistence: same non-normal tier → keep current alert message
  if (tier !== 'normal' && tier === lastTier) {
    return { message: state.message ?? '', tier }
  }

  // Priority 2: post_tool forced (--update mode)
  if (forcePostTool) {
    if (triggeredEvents !== null && triggeredEvents.length > 0) {
      const eventKey = triggeredEvents[0]
      const gitEventsVocab = character.git_events ?? {}
      const options =
        (gitEventsVocab as Record<string, string[] | undefined>)[eventKey ?? ''] ??
        triggers.post_tool ??
        []
      return { message: pickDifferent(options, state.message ?? ''), tier }
    }
    const postToolOptions = triggers.post_tool ?? []
    return { message: pickDifferent(postToolOptions, state.message ?? ''), tier }
  }

  // Priority 3: cache still fresh (5 minutes)
  if (!cacheExpired(state.last_updated, 5)) {
    return { message: state.message ?? '', tier }
  }

  // Priority 4: time slot changed
  const slot = getTimeSlot()
  if (slot !== state.last_slot) {
    const timeVocab = triggers.time ?? {}
    const slotOptions = (timeVocab as Record<string, string[] | undefined>)[slot] ?? []
    return { message: pick(slotOptions), tier }
  }

  // Priority 5: random fallback (avoid repeating last)
  const randomOptions = triggers.random ?? []
  return { message: pickDifferent(randomOptions, state.message ?? ''), tier }
}

// ─── Memory title formatter ───────────────────────────────────────────────────

/**
 * Format memory titles into a display string with · separator.
 * Shows at most maxCount titles; appends ellipsis count if titles exceed maxCount.
 * Pure formatting utility — no trigger logic (per Plan 02 design decision).
 */
export function formatMemoryTitles(titles: string[], maxCount: number = 5): string {
  if (titles.length === 0) return ''
  const shown = titles.slice(0, maxCount)
  const joined = shown.join(' · ')
  if (titles.length > maxCount) {
    return `${joined} …(${titles.length - maxCount} 条)`
  }
  return joined
}
