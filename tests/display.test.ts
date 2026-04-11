import { formatTokens, formatResets, render, termColWidth } from '../src/core/display'
import type { VocabData } from '../src/schemas'

// ─── formatTokens ─────────────────────────────────────────────────────────────

describe('formatTokens', () => {
  it('formats 47768 as 47k', () => {
    expect(formatTokens(47768)).toBe('47k')
  })

  it('formats 500 as 500 (no k)', () => {
    expect(formatTokens(500)).toBe('500')
  })

  it('formats 1000 as 1k', () => {
    expect(formatTokens(1000)).toBe('1k')
  })

  it('formats 0 as 0', () => {
    expect(formatTokens(0)).toBe('0')
  })

  it('formats 999 as 999 (just below k threshold)', () => {
    expect(formatTokens(999)).toBe('999')
  })

  it('returns N/A for null', () => {
    expect(formatTokens(null)).toBe('N/A')
  })

  it('returns N/A for undefined', () => {
    expect(formatTokens(undefined)).toBe('N/A')
  })

  it('returns N/A for string N/A', () => {
    expect(formatTokens('N/A')).toBe('N/A')
  })

  it('parses numeric string 12345 as 12k', () => {
    expect(formatTokens('12345')).toBe('12k')
  })

  it('returns N/A for non-numeric string', () => {
    expect(formatTokens('not-a-number')).toBe('N/A')
  })

  it('formats 1200 as 1.2k (small k gets one decimal)', () => {
    expect(formatTokens(1200)).toBe('1.2k')
  })

  it('formats 9900 as 9.9k', () => {
    expect(formatTokens(9900)).toBe('9.9k')
  })

  it('formats 1_000_000 as 1M', () => {
    expect(formatTokens(1_000_000)).toBe('1M')
  })

  it('formats 2_400_000 as 2.4M', () => {
    expect(formatTokens(2_400_000)).toBe('2.4M')
  })

  it('formats 14_000_000 as 14M (>=10M drops decimal)', () => {
    expect(formatTokens(14_000_000)).toBe('14M')
  })
})

// ─── formatResets ─────────────────────────────────────────────────────────────

describe('formatResets', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('formats future timestamp 3600s ahead as 1h00m', () => {
    const now = 1711094400 // fixed epoch
    jest.setSystemTime(now * 1000)
    const future = now + 3600
    expect(formatResets(future)).toBe('1h00m')
  })

  it('formats future timestamp 200 minutes ahead as 3h20m', () => {
    const now = 1711094400
    jest.setSystemTime(now * 1000)
    const future = now + 200 * 60
    expect(formatResets(future)).toBe('3h20m')
  })

  it('formats future timestamp 45 minutes ahead as 45m', () => {
    const now = 1711094400
    jest.setSystemTime(now * 1000)
    const future = now + 45 * 60
    expect(formatResets(future)).toBe('45m')
  })

  it('returns null for past timestamp', () => {
    const now = 1711094400
    jest.setSystemTime(now * 1000)
    const past = now - 100
    expect(formatResets(past)).toBeNull()
  })

  it('returns null for null input', () => {
    expect(formatResets(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(formatResets(undefined)).toBeNull()
  })

  it('returns null for 0 (past timestamp)', () => {
    jest.setSystemTime(Date.now())
    expect(formatResets(0)).toBeNull()
  })

  it('returns null for invalid string', () => {
    expect(formatResets('not-a-date')).toBeNull()
  })

  it('pads minutes with zero: 1h05m', () => {
    const now = 1711094400
    jest.setSystemTime(now * 1000)
    const future = now + 65 * 60
    expect(formatResets(future)).toBe('1h05m')
  })

  it('formats ≥24h as XdYYh (weekly reset context)', () => {
    const now = 1711094400
    jest.setSystemTime(now * 1000)
    // 5 days, 3 hours ahead
    const future = now + (5 * 24 + 3) * 3600
    expect(formatResets(future)).toBe('5d03h')
  })

  it('formats exactly 24h as 1d00h', () => {
    const now = 1711094400
    jest.setSystemTime(now * 1000)
    expect(formatResets(now + 24 * 3600)).toBe('1d00h')
  })
})

// ─── render ───────────────────────────────────────────────────────────────────

const CHAR: VocabData = {
  meta: { name: 'Nova', ascii: '(*>ω<)', style: 'energetic', color: '33' },
  triggers: {
    random: ['msg1'],
    post_tool: ['p1'],
    time: { morning: ['m1'] },
    usage: { warning: ['w1'] },
  },
}

const CHAR_NO_COLOR: VocabData = {
  meta: { name: 'Nova', ascii: '(*>ω<)', style: 'energetic', color: '' },
}

describe('render', () => {
  it('returns 2-line string', () => {
    const output = render(CHAR, 'testmsg', {}, {})
    const lines = output.split('\n')
    expect(lines).toHaveLength(2)
  })

  it('line1 contains character name and message', () => {
    const output = render(CHAR, 'testmsg', {}, {})
    const line1 = output.split('\n')[0]
    expect(line1).toContain('Nova')
    expect(line1).toContain('testmsg')
  })

  it('line2 contains unknown when no model provided', () => {
    const output = render(CHAR, 'testmsg', {}, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('unknown')
  })

  it('shows model string as-is', () => {
    const output = render(CHAR, 'msg', { model: 'claude-sonnet-4-6' }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('claude-sonnet-4-6')
  })

  it('uses display_name from model object', () => {
    const output = render(CHAR, 'msg', { model: { display_name: 'Sonnet' } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('Sonnet')
  })

  it('includes token count when today_tokens provided', () => {
    const output = render(CHAR, 'msg', {}, { today_tokens: 47768 })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('token')
    expect(line2).toContain('47k')
  })

  it('includes cwd_name when provided', () => {
    const output = render(CHAR, 'msg', {}, { cwd_name: 'my-project' })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('my-project')
  })

  it('shows ctx block when context_window.used_percentage provided', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 55 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('ctx')
    expect(line2).toContain('55%')
  })

  it('line1 always contains ANSI escapes (accent bar style)', () => {
    const output = render(CHAR, 'msg', {}, {})
    const line1 = output.split('\n')[0]
    expect(line1).toContain('\x1b[48;5;234m')  // near-black bg
  })

  it('line1 contains ANSI escapes even when character color is empty', () => {
    const output = render(CHAR_NO_COLOR, 'msg', {}, {})
    const line1 = output.split('\n')[0]
    expect(line1).toContain('\x1b[48;5;234m')  // accent bar always rendered
  })

  it('truncates message longer than 40 chars to 39 chars + ellipsis', () => {
    const longMsg = 'a'.repeat(41)
    const output = render(CHAR, longMsg, {}, {})
    const line1 = output.split('\n')[0]
    // rawLine1 should contain 39 a's + '…'
    expect(line1).toContain('a'.repeat(39) + '…')
    expect(line1).not.toContain('a'.repeat(41))
  })

  it('does not truncate message of exactly 40 chars', () => {
    const exactMsg = 'b'.repeat(40)
    const output = render(CHAR, exactMsg, {}, {})
    const line1 = output.split('\n')[0]
    expect(line1).toContain('b'.repeat(40))
    expect(line1).not.toContain('…')
  })

  it('truncates model name longer than 20 chars to 19 chars + ellipsis', () => {
    const longModel = 'x'.repeat(21)
    const output = render(CHAR, 'msg', { model: longModel }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('x'.repeat(19) + '…')
    expect(line2).not.toContain('x'.repeat(21))
  })

  it('truncates cwd_name longer than 32 chars with ellipsis (keeps last segment)', () => {
    const longCwd = '/a/b/c/' + 'y'.repeat(30)
    const output = render(CHAR, 'msg', {}, { cwd_name: longCwd })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('…/')
    expect(line2).toContain('y'.repeat(30))
  })

  it('ctx block uses stable bg (17) at 80% context', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 80 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;110m')
    expect(line2).toContain('ctx')
    expect(line2).toContain('80%')
  })

  it('ctx block uses stable bg (17) at 95% context', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 95 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;110m')
    expect(line2).toContain('ctx')
    expect(line2).toContain('95%')
  })

  it('ctx block uses stable bg (17) at 79% context', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 79 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;110m')
    expect(line2).toContain('ctx')
    expect(line2).toContain('79%')
  })

  it('ctx block displays floor of decimal percentage', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 82.7 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('82%')
    expect(line2).not.toContain('82.7%')
  })

  // ─── 5h quota segment ─────────────────────────────────────────────────────
  it('shows 5h quota percentage when rate_limits.five_hour.used_percentage provided', () => {
    const output = render(
      CHAR,
      'msg',
      { rate_limits: { five_hour: { used_percentage: 38 } } },
      {}
    )
    const line2 = output.split('\n')[1]
    expect(line2).toContain('5h')
    expect(line2).toContain('38%')
  })

  it('shows reset countdown from resets_at unix timestamp', () => {
    jest.useFakeTimers()
    const now = 1711094400
    jest.setSystemTime(now * 1000)
    const output = render(
      CHAR,
      'msg',
      { rate_limits: { five_hour: { used_percentage: 40, resets_at: now + 200 * 60 } } },
      {}
    )
    const line2 = output.split('\n')[1]
    expect(line2).toContain('↻3h20m')
    jest.useRealTimers()
  })

  it('5h quota block uses stable bg (23) at 70%', () => {
    const output = render(
      CHAR,
      'msg',
      { rate_limits: { five_hour: { used_percentage: 70 } } },
      {}
    )
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;108m')
  })

  it('5h quota block uses stable bg (23) at 90%', () => {
    const output = render(
      CHAR,
      'msg',
      { rate_limits: { five_hour: { used_percentage: 90 } } },
      {}
    )
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;108m')
  })

  it('omits 5h segment entirely when no rate_limits provided', () => {
    const output = render(CHAR, 'msg', {}, {})
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('5h')
    expect(line2).not.toContain('↻')
  })

  // ─── Weekly quota segment ─────────────────────────────────────────────────
  it('shows weekly quota block when rate_limits.weekly provided', () => {
    const output = render(
      CHAR,
      'msg',
      { rate_limits: { weekly: { used_percentage: 40 } } },
      {}
    )
    const line2 = output.split('\n')[1]
    expect(line2).toContain('wk')
    expect(line2).toContain('40%')
  })

  it('weekly block uses days format for resets', () => {
    jest.useFakeTimers()
    const now = 1711094400
    jest.setSystemTime(now * 1000)
    const output = render(
      CHAR,
      'msg',
      { rate_limits: { weekly: { used_percentage: 40, resets_at: now + 5 * 24 * 3600 } } },
      {}
    )
    const line2 = output.split('\n')[1]
    expect(line2).toContain('↻5d00h')
    jest.useRealTimers()
  })

  it('weekly block omitted when missing', () => {
    const output = render(
      CHAR,
      'msg',
      { rate_limits: { five_hour: { used_percentage: 30 } } },
      {}
    )
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('wk ')
  })

  it('uses bg color blocks (no · or | separators)', () => {
    const output = render(
      CHAR,
      'msg',
      { model: 'Sonnet' },
      { cwd_name: 'code-cheer', today_tokens: 47768 }
    )
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain(' · ')
    expect(line2).not.toContain(' | ')
    // each segment is wrapped in a 256-color bg escape
    expect(line2).toMatch(/\x1b\[48;5;\d+m/)
  })

  it('model segment uses bg 54 (deep purple)', () => {
    const output = render(CHAR, 'msg', { model: 'Sonnet' }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;73m')
  })

  it('mem segment uses bg 53 (dark magenta) when memory_count>0', () => {
    const output = render(CHAR, 'msg', {}, { memory_count: 3 })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;140m')
    expect(line2).toContain('mem')
    expect(line2).toContain('3')
  })
})

// ─── memory count display ─────────────────────────────────────────────────────

describe('memory count display', () => {
  it('line2 contains mem label and count when memory_count=3', () => {
    const output = render(CHAR, 'msg', {}, { memory_count: 3 })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('mem')
    expect(line2).toContain('3')
  })

  it('line2 does NOT contain "mem" when memory_count=0', () => {
    const output = render(CHAR, 'msg', {}, { memory_count: 0 })
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('mem')
  })

  it('line2 does NOT contain "mem" when memory_count is undefined', () => {
    const output = render(CHAR, 'msg', {}, {})
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('mem')
  })
})

// ─── weather block ────────────────────────────────────────────────────────────

describe('weather block', () => {
  it('renders icon and temperature when stats.weather is provided', () => {
    const output = render(CHAR, 'msg', {}, {
      weather: { city: 'Beijing', tempC: 18, icon: '⛅', fetchedAt: Math.floor(Date.now() / 1000) }
    })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('Beijing')
    expect(line2).toContain('⛅ 18°C')
  })

  it('weather block uses bg 60 (dark slate-blue)', () => {
    const output = render(CHAR, 'msg', {}, {
      weather: { city: 'Beijing', tempC: 18, icon: '⛅', fetchedAt: Math.floor(Date.now() / 1000) }
    })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;173m')
  })

  it('omits weather block when stats.weather is null', () => {
    const output = render(CHAR, 'msg', {}, { weather: null })
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('°C')
  })

  it('omits weather block when stats.weather is absent', () => {
    const output = render(CHAR, 'msg', {}, {})
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('°C')
  })

  it('weather block appears after mem block', () => {
    const output = render(CHAR, 'msg', {}, {
      memory_count: 3,
      weather: { city: 'Beijing', tempC: 22, icon: '☀️', fetchedAt: Math.floor(Date.now() / 1000) }
    })
    const line2 = output.split('\n')[1]
    const memIdx = line2.indexOf('\x1b[48;5;140m')  // mem bg
    const weatherIdx = line2.indexOf('22°C')
    expect(memIdx).toBeGreaterThan(-1)
    expect(weatherIdx).toBeGreaterThan(memIdx)
  })

  it('ascii face with multiple frames: name position stays fixed across frames', () => {
    // Frames of deliberately different visual widths: 7 cols vs 9 cols
    const MULTI: VocabData = {
      meta: { name: 'Nova', ascii: ['(*>ω<)', '(ﾉ*>ω<)ﾉ'], style: '', color: '' },
    }
    const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '')
    // frame 0 at t=0, frame 1 at t=600ms
    jest.setSystemTime(0)
    const out0 = render(MULTI, 'hi', {}, {})
    const namePos0 = stripAnsi(out0.split('\n')[0]).indexOf('Nova')

    jest.setSystemTime(600)
    const out1 = render(MULTI, 'hi', {}, {})
    const namePos1 = stripAnsi(out1.split('\n')[0]).indexOf('Nova')

    expect(namePos0).toBe(namePos1)
  })
})

// ─── termColWidth ─────────────────────────────────────────────────────────────

describe('termColWidth', () => {
  it('counts ASCII as 1 col each', () => {
    expect(termColWidth('hello')).toBe(5)
  })

  it('counts fullwidth katakana as 2 cols', () => {
    // ノ U+30CE is fullwidth katakana = 2 cols
    expect(termColWidth('ノ')).toBe(2)
  })

  it('counts halfwidth katakana as 1 col', () => {
    // ﾉ U+FF89 is halfwidth = 1 col
    expect(termColWidth('ﾉ')).toBe(1)
  })

  it('counts hiragana iteration mark ゞ as 2 cols', () => {
    expect(termColWidth('ゞ')).toBe(2)
  })

  it('kaomoji (*>ω<) is 6 cols (ω is greek, 1 col)', () => {
    expect(termColWidth('(*>ω<)')).toBe(6)
  })

  it('kaomoji (^▽^)ゞ accounts for wide ゞ', () => {
    // ( ^ ▽ ^ ) = 5 cols (▽ U+25BD geometric shape = 1 col), ゞ = 2 cols → 7
    expect(termColWidth('(^▽^)ゞ')).toBe(7)
  })

  it('mixed: (ﾉ*>ω<)ﾉ is 8 cols (both ﾉ are halfwidth)', () => {
    expect(termColWidth('(ﾉ*>ω<)ﾉ')).toBe(8)
  })
})
