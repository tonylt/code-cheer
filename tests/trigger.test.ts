import {
  getTier,
  getTimeSlot,
  pick,
  pickDifferent,
  cacheExpired,
  detectGitEvents,
  resolveMessage,
  formatMemoryTitles,
} from '../src/core/trigger'
import type { VocabData, StateType, ConfigType } from '../src/schemas'
import { DEFAULT_STATE } from '../src/schemas'

// ─── Shared fixtures ───────────────────────────────────────────────────────────

const CHAR: VocabData = {
  meta: { name: 'Nova', ascii: '(*>ω<)', style: 'energetic', color: '33' },
  triggers: {
    random: ['r1', 'r2', 'r3'],
    time: { morning: ['m1'], afternoon: ['a1'], evening: ['e1'], midnight: ['n1'] },
    usage: { warning: ['w1', 'w2'], critical: ['c1', 'c2'] },
    post_tool: ['p1', 'p2', 'p3'],
  },
  git_events: {
    first_commit_today: ['gc1', 'gc2'],
    milestone_5: ['m5_1', 'm5_2'],
    milestone_10: ['m10_1'],
    late_night_commit: ['lnc1'],
    big_diff: ['bd1'],
    big_session: ['bs1'],
    long_day: ['ld1'],
  },
}

function makeState(overrides: Partial<StateType> = {}): StateType {
  return { ...DEFAULT_STATE, ...overrides }
}

function makeCc(usedPct: number = 0): Record<string, unknown> {
  return usedPct > 0
    ? { rate_limits: { five_hour: { used_percentage: usedPct } } }
    : {}
}

const DEFAULT_CONFIG: ConfigType & { event_thresholds?: Record<string, unknown> } = {
  character: 'nova',
}

function makeGitCtx(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    commits_today: 0,
    diff_lines: 0,
    first_commit_time: null,
    repo_path: '/repo/a',
    ...overrides,
  }
}

// ─── getTier ──────────────────────────────────────────────────────────────────

describe('getTier', () => {
  it('returns normal for 0', () => expect(getTier(0)).toBe('normal'))
  it('returns normal for 50', () => expect(getTier(50)).toBe('normal'))
  it('returns normal for 79', () => expect(getTier(79)).toBe('normal'))
  it('returns warning for 80', () => expect(getTier(80)).toBe('warning'))
  it('returns warning for 94', () => expect(getTier(94)).toBe('warning'))
  it('returns critical for 95', () => expect(getTier(95)).toBe('critical'))
  it('returns critical for 100', () => expect(getTier(100)).toBe('critical'))
})

// ─── getTimeSlot ──────────────────────────────────────────────────────────────

describe('getTimeSlot', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns morning at 06:00', () => {
    jest.setSystemTime(new Date('2026-03-22T06:00:00'))
    expect(getTimeSlot()).toBe('morning')
  })

  it('returns morning at 11:59', () => {
    jest.setSystemTime(new Date('2026-03-22T11:59:00'))
    expect(getTimeSlot()).toBe('morning')
  })

  it('returns afternoon at 12:00', () => {
    jest.setSystemTime(new Date('2026-03-22T12:00:00'))
    expect(getTimeSlot()).toBe('afternoon')
  })

  it('returns afternoon at 17:59', () => {
    jest.setSystemTime(new Date('2026-03-22T17:59:00'))
    expect(getTimeSlot()).toBe('afternoon')
  })

  it('returns evening at 18:00', () => {
    jest.setSystemTime(new Date('2026-03-22T18:00:00'))
    expect(getTimeSlot()).toBe('evening')
  })

  it('returns evening at 22:00', () => {
    jest.setSystemTime(new Date('2026-03-22T22:00:00'))
    expect(getTimeSlot()).toBe('evening')
  })

  it('returns midnight at 23:00', () => {
    jest.setSystemTime(new Date('2026-03-22T23:00:00'))
    expect(getTimeSlot()).toBe('midnight')
  })

  it('returns midnight at 05:00', () => {
    jest.setSystemTime(new Date('2026-03-22T05:00:00'))
    expect(getTimeSlot()).toBe('midnight')
  })

  it('returns midnight at 00:00', () => {
    jest.setSystemTime(new Date('2026-03-22T00:00:00'))
    expect(getTimeSlot()).toBe('midnight')
  })
})

// ─── pick ─────────────────────────────────────────────────────────────────────

describe('pick', () => {
  it('picks index 0 when rng returns 0', () => {
    expect(pick(['a', 'b', 'c'], () => 0)).toBe('a')
  })

  it('picks last index when rng returns 0.99', () => {
    expect(pick(['a', 'b', 'c'], () => 0.99)).toBe('c')
  })

  it('picks middle index when rng returns 0.5', () => {
    expect(pick(['a', 'b', 'c'], () => 0.5)).toBe('b')
  })

  it('returns empty string for empty array', () => {
    expect(pick([], () => 0)).toBe('')
  })

  it('returns single element without rng', () => {
    expect(pick(['only'])).toBe('only')
  })
})

// ─── pickDifferent ────────────────────────────────────────────────────────────

describe('pickDifferent', () => {
  it('avoids last item by filtering it out', () => {
    // filtered = ['b'], rng 0 picks index 0 = 'b'
    expect(pickDifferent(['a', 'b'], 'a', () => 0)).toBe('b')
  })

  it('returns single element even when it matches last', () => {
    expect(pickDifferent(['a'], 'a', () => 0)).toBe('a')
  })

  it('returns empty string for empty array', () => {
    expect(pickDifferent([], 'x', () => 0)).toBe('')
  })

  it('picks normally when last does not match any item', () => {
    // no match to filter, picks from full array ['a','b','c'], rng 0 → 'a'
    expect(pickDifferent(['a', 'b', 'c'], 'z', () => 0)).toBe('a')
  })

  it('avoids last in a 3-item list using rng', () => {
    // filtered ['b','c'], rng 0 → 'b'
    expect(pickDifferent(['a', 'b', 'c'], 'a', () => 0)).toBe('b')
  })
})

// ─── cacheExpired ─────────────────────────────────────────────────────────────

describe('cacheExpired', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('returns false when within window (3 min < 5 min window)', () => {
    jest.setSystemTime(new Date('2026-03-22T14:03:00'))
    expect(cacheExpired('2026-03-22T14:00:00', 5)).toBe(false)
  })

  it('returns true when outside window (6 min > 5 min window)', () => {
    jest.setSystemTime(new Date('2026-03-22T14:06:00'))
    expect(cacheExpired('2026-03-22T14:00:00', 5)).toBe(true)
  })

  it('returns true for undefined last_updated', () => {
    expect(cacheExpired(undefined)).toBe(true)
  })

  it('returns true for invalid date string', () => {
    expect(cacheExpired('not-a-date')).toBe(true)
  })

  it('returns true when minutes=0 (any positive delta)', () => {
    jest.setSystemTime(new Date('2026-03-22T14:05:00'))
    expect(cacheExpired('2026-03-22T14:04:00', 0)).toBe(true)
  })
})

// ─── detectGitEvents ─────────────────────────────────────────────────────────

describe('detectGitEvents', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  // GIT-01: first_commit_today
  it('detects first_commit_today when commits=1 and no last events', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 1 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('first_commit_today')
  })

  it('deduplicates first_commit_today when already in last_git_events', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 3 }),
      makeState({ last_git_events: ['first_commit_today'], last_repo: '/repo/a' }),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('first_commit_today')
  })

  it('does not detect first_commit_today when commits=0', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 0 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('first_commit_today')
  })

  // GIT-02: milestones
  it('detects milestone_5 at commits=5', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 5 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('milestone_5')
  })

  it('detects milestone_10 at commits=10', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 10 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('milestone_10')
  })

  it('detects milestone_5 AND milestone_10 at commits=10', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 10 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('milestone_5')
    expect(events).toContain('milestone_10')
  })

  it('detects all 3 milestones at commits=20', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 20 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('milestone_5')
    expect(events).toContain('milestone_10')
    expect(events).toContain('milestone_20')
  })

  it('deduplicates milestone_5 independently (milestone_10 still fires)', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 10 }),
      makeState({ last_git_events: ['milestone_5'], last_repo: '/repo/a' }),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('milestone_5')
    expect(events).toContain('milestone_10')
  })

  it('returns milestones in priority order: 20 before 10 before 5', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 20 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events.indexOf('milestone_20')).toBeLessThan(events.indexOf('milestone_10'))
    expect(events.indexOf('milestone_10')).toBeLessThan(events.indexOf('milestone_5'))
  })

  // GIT-03: late_night_commit
  it('detects late_night_commit at 23:00 with commits > 0', () => {
    jest.setSystemTime(new Date('2026-03-22T23:00:00'))
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 1 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('late_night_commit')
  })

  it('does not detect late_night_commit at 21:00 (before hour 22 threshold)', () => {
    jest.setSystemTime(new Date('2026-03-22T21:00:00'))
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 1 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('late_night_commit')
  })

  it('does not detect late_night_commit at 23:00 when commits=0', () => {
    jest.setSystemTime(new Date('2026-03-22T23:00:00'))
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 0 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('late_night_commit')
  })

  it('deduplicates late_night_commit', () => {
    jest.setSystemTime(new Date('2026-03-22T23:00:00'))
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 1 }),
      makeState({ last_git_events: ['late_night_commit'], last_repo: '/repo/a' }),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('late_night_commit')
  })

  // GIT-04: big_diff
  it('detects big_diff at exactly 200 lines', () => {
    const events = detectGitEvents(
      makeGitCtx({ diff_lines: 200 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('big_diff')
  })

  it('does not detect big_diff at 199 lines (below threshold)', () => {
    const events = detectGitEvents(
      makeGitCtx({ diff_lines: 199 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('big_diff')
  })

  it('detects big_diff with custom threshold=100 at diff_lines=100', () => {
    const events = detectGitEvents(
      makeGitCtx({ diff_lines: 100 }),
      makeState(),
      { ...DEFAULT_CONFIG, event_thresholds: { big_diff: 100 } }
    )
    expect(events).toContain('big_diff')
  })

  // GIT-05: big_session
  it('detects big_session when session >= 120 min', () => {
    jest.setSystemTime(new Date('2026-03-22T14:00:00'))
    const sessionStart = new Date('2026-03-22T12:00:00').toISOString()
    const events = detectGitEvents(
      makeGitCtx(),
      makeState({ session_start: sessionStart }),
      DEFAULT_CONFIG
    )
    expect(events).toContain('big_session')
  })

  it('does not detect big_session when session < 120 min', () => {
    jest.setSystemTime(new Date('2026-03-22T14:00:00'))
    const sessionStart = new Date('2026-03-22T12:01:00').toISOString()
    const events = detectGitEvents(
      makeGitCtx(),
      makeState({ session_start: sessionStart }),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('big_session')
  })

  it('does not detect big_session when session_start is missing', () => {
    const events = detectGitEvents(
      makeGitCtx(),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('big_session')
  })

  it('does not detect big_session for invalid session_start', () => {
    const events = detectGitEvents(
      makeGitCtx(),
      makeState({ session_start: 'not-a-date' }),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('big_session')
  })

  // GIT-06: long_day
  it('detects long_day at commits=15', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 15 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('long_day')
  })

  it('does not detect long_day at commits=14', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 14 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('long_day')
  })

  // Per-repo isolation (D-05)
  it('resets effective_last_events when repo changes (per-repo isolation)', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 3, repo_path: '/repo-b' }),
      makeState({ last_git_events: ['first_commit_today'], last_repo: '/repo-a' }),
      DEFAULT_CONFIG
    )
    // repo changed → last_git_events logically reset → first_commit_today fires fresh
    expect(events).toContain('first_commit_today')
  })

  it('preserves last_git_events when same repo', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 3, repo_path: '/repo-a' }),
      makeState({ last_git_events: ['first_commit_today'], last_repo: '/repo-a' }),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('first_commit_today')
  })

  it('does not reset events when repo_path is null', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 3, repo_path: null }),
      makeState({ last_git_events: ['first_commit_today'], last_repo: '/repo-a' }),
      DEFAULT_CONFIG
    )
    expect(events).not.toContain('first_commit_today')
  })

  // Custom thresholds
  it('uses custom event_thresholds from config', () => {
    const events = detectGitEvents(
      makeGitCtx({ diff_lines: 100 }),
      makeState(),
      { ...DEFAULT_CONFIG, event_thresholds: { big_diff: 50 } }
    )
    expect(events).toContain('big_diff')
  })

  it('falls back to default thresholds when config has empty event_thresholds', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 5, diff_lines: 200 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toContain('milestone_5')
    expect(events).toContain('big_diff')
  })

  it('returns empty array when no events triggered', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 0, diff_lines: 0 }),
      makeState(),
      DEFAULT_CONFIG
    )
    expect(events).toEqual([])
  })

  // Edge cases
  it('handles corrupted last_git_events (string instead of array)', () => {
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 1 }),
      // @ts-expect-error testing invalid input
      makeState({ last_git_events: 'not_a_list' }),
      DEFAULT_CONFIG
    )
    expect(events).toContain('first_commit_today')
  })

  it('returns events with milestone_20 first and first_commit_today last (full priority order)', () => {
    jest.setSystemTime(new Date('2026-03-22T23:00:00'))
    const sessionStart = new Date('2026-03-22T20:00:00').toISOString()
    const events = detectGitEvents(
      makeGitCtx({ commits_today: 20, diff_lines: 200, repo_path: '/repo/a' }),
      makeState({ session_start: sessionStart }),
      DEFAULT_CONFIG
    )
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toBe('milestone_20')
    expect(events[events.length - 1]).toBe('first_commit_today')
  })
})

// ─── resolveMessage ───────────────────────────────────────────────────────────

describe('resolveMessage', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  // Priority 1 — tier change
  it('escalates to warning tier and returns warning message', () => {
    const state = makeState({ last_rate_tier: 'normal' })
    const result = resolveMessage(CHAR, state, {}, makeCc(85))
    expect(result.tier).toBe('warning')
    expect(result.message).toBe('w1')
  })

  it('escalates to critical tier and returns critical message', () => {
    const state = makeState({ last_rate_tier: 'normal' })
    const result = resolveMessage(CHAR, state, {}, makeCc(95))
    expect(result.tier).toBe('critical')
    expect(result.message).toBe('c1')
  })

  it('drops from warning to normal — falls through to lower priorities', () => {
    jest.setSystemTime(new Date('2026-03-22T14:10:00'))
    const state = makeState({
      last_rate_tier: 'warning',
      last_slot: 'afternoon',
      last_updated: '2026-03-22T14:00:00',
    })
    const result = resolveMessage(CHAR, state, {}, makeCc(0))
    expect(result.tier).toBe('normal')
    // Falls through to random fallback (cache expired, same slot)
    expect(['r1', 'r2', 'r3']).toContain(result.message)
  })

  it('alert persists — same non-normal tier returns current state message', () => {
    const state = makeState({ message: 'w1', last_rate_tier: 'warning' })
    const result = resolveMessage(CHAR, state, {}, makeCc(85))
    expect(result.tier).toBe('warning')
    expect(result.message).toBe('w1')
  })

  // Priority 2 — post_tool with git events
  it('post_tool with git event returns git_events message', () => {
    const state = makeState({ message: '' })
    const result = resolveMessage(CHAR, state, {}, {}, true, ['first_commit_today'])
    expect(['gc1', 'gc2']).toContain(result.message)
  })

  it('post_tool with empty triggered events returns post_tool message', () => {
    const state = makeState({ message: '' })
    const result = resolveMessage(CHAR, state, {}, {}, true, [])
    expect(['p1', 'p2', 'p3']).toContain(result.message)
  })

  it('post_tool with null triggered events returns post_tool message', () => {
    const state = makeState({ message: '' })
    const result = resolveMessage(CHAR, state, {}, {}, true, null)
    expect(['p1', 'p2', 'p3']).toContain(result.message)
  })

  it('post_tool without triggered_events falls back to post_tool (backward compat)', () => {
    const state = makeState({ message: 'r1' })
    const result = resolveMessage(CHAR, state, {}, {}, true)
    expect(['p1', 'p2', 'p3']).toContain(result.message)
  })

  it('warning tier overrides git events (tier takes priority over post_tool)', () => {
    const state = makeState({ last_rate_tier: 'normal' })
    const result = resolveMessage(CHAR, state, {}, makeCc(85), true, ['first_commit_today'])
    expect(result.tier).toBe('warning')
    expect(result.message).toBe('w1')
  })

  // Priority 3 — cache fresh
  it('returns cached message when cache is still fresh (2 min < 5 min window)', () => {
    jest.setSystemTime(new Date('2026-03-22T14:02:00'))
    const state = makeState({
      message: 'r2',
      last_slot: 'afternoon',
      last_updated: '2026-03-22T14:00:00',
    })
    const result = resolveMessage(CHAR, state, {}, {})
    expect(result.message).toBe('r2')
  })

  // Priority 4 — time slot change
  it('changes message on time slot change (afternoon→morning)', () => {
    jest.setSystemTime(new Date('2026-03-22T08:00:00'))
    const state = makeState({
      last_slot: 'afternoon',
      last_updated: '2026-03-22T07:55:00', // expired (> 5 min ago would be needed, but slot change takes priority)
      message: 'a1',
    })
    // Make cache expired to reach priority 4
    jest.setSystemTime(new Date('2026-03-22T08:10:00'))
    const state2 = makeState({
      last_slot: 'afternoon',
      last_updated: '2026-03-22T08:00:00', // 10 min ago → expired
      message: 'a1',
    })
    const result = resolveMessage(CHAR, state2, {}, {})
    expect(result.message).toBe('m1')
  })

  it('changes message on time slot change (afternoon→evening)', () => {
    jest.setSystemTime(new Date('2026-03-22T20:00:00'))
    const state = makeState({
      last_slot: 'afternoon',
      last_updated: '2026-03-22T19:50:00', // 10 min ago → expired
      message: 'a1',
    })
    const result = resolveMessage(CHAR, state, {}, {})
    expect(result.message).toBe('e1')
  })

  // Priority 5 — random fallback
  it('returns random fallback when cache expired and same time slot', () => {
    jest.setSystemTime(new Date('2026-03-22T14:20:00'))
    const state = makeState({
      last_slot: 'afternoon',
      last_updated: '2026-03-22T14:00:00', // 20 min ago → expired
      message: 'r1',
    })
    // With Math.random mocked to 0, pickDifferent(['r2','r3'], 'r1', () => 0) → 'r2'
    // because r1 is filtered out
    const result = resolveMessage(CHAR, state, {}, {})
    expect(['r1', 'r2', 'r3']).toContain(result.message)
    expect(result.tier).toBe('normal')
  })

  // Edge cases
  it('handles missing triggers.usage gracefully', () => {
    const charNoUsage: VocabData = {
      meta: { name: 'NoUsage', ascii: '(o_o)', style: 'test', color: '' },
      triggers: { random: ['fallback'] },
    }
    const state = makeState({ last_rate_tier: 'normal' })
    // escalate to warning tier but no usage.warning → returns empty string
    const result = resolveMessage(charNoUsage, state, {}, makeCc(85))
    expect(result.tier).toBe('warning')
    expect(result.message).toBe('')
  })

  it('handles missing triggers.time.morning gracefully', () => {
    jest.setSystemTime(new Date('2026-03-22T08:10:00'))
    const charNoMorning: VocabData = {
      meta: { name: 'NoMorning', ascii: '(o_o)', style: 'test', color: '' },
      triggers: {
        random: ['r1'],
        time: { afternoon: ['a1'] }, // no morning
      },
    }
    const state = makeState({
      last_slot: 'afternoon',
      last_updated: '2026-03-22T08:00:00', // 10 min ago → expired
    })
    const result = resolveMessage(charNoMorning, state, {}, {})
    // morning slot change fires but no morning messages → empty string
    expect(result.message).toBe('')
  })

  it('handles empty character (minimal meta only) without crashing', () => {
    const minimalChar: VocabData = {
      meta: { name: 'Minimal', ascii: '(-_-)', style: 'minimal', color: '' },
    }
    const state = makeState()
    const result = resolveMessage(minimalChar, state, {}, {})
    expect(result).toBeDefined()
    expect(typeof result.tier).toBe('string')
  })

  // post_tool falls back to post_tool when git_events missing from char
  it('post_tool falls back to post_tool list when char has no git_events vocab', () => {
    const charNoGitEvents: VocabData = {
      meta: { name: 'NoGit', ascii: '(^_^)', style: 'test', color: '' },
      triggers: { post_tool: ['p1', 'p2'] },
    }
    const state = makeState({ message: 'other' })
    const result = resolveMessage(charNoGitEvents, state, {}, {}, true, ['milestone_5'])
    expect(['p1', 'p2']).toContain(result.message)
  })

  // resolve with triggered_events that uses git_events vocab
  it('uses git_events vocab when char has git_events for the triggered event', () => {
    const state = makeState({ message: 'other' })
    const result = resolveMessage(CHAR, state, {}, {}, true, ['milestone_5'])
    expect(['m5_1', 'm5_2']).toContain(result.message)
  })
})

// ─── formatMemoryTitles ───────────────────────────────────────────────────────

describe('formatMemoryTitles', () => {
  it('joins titles with ·  separator', () => {
    expect(formatMemoryTitles(['A', 'B', 'C'])).toBe('A · B · C')
  })

  it('returns empty string for empty array', () => {
    expect(formatMemoryTitles([])).toBe('')
  })

  it('shows ellipsis count when titles exceed maxCount (default 5)', () => {
    const result = formatMemoryTitles(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(result).toBe('A · B · C · D · E …(1 条)')
  })

  it('shows all titles without ellipsis when exactly 5 items', () => {
    const result = formatMemoryTitles(['A', 'B', 'C', 'D', 'E'])
    expect(result).toBe('A · B · C · D · E')
    expect(result).not.toContain('…')
  })
})
