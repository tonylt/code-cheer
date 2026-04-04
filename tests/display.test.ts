import { formatTokens, formatResets, render } from '../src/core/display'
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
    expect(line1).toContain('Nova: testmsg')
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
    expect(line2).toContain('47k tokens')
  })

  it('includes cwd_name when provided', () => {
    const output = render(CHAR, 'msg', {}, { cwd_name: 'my-project' })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('my-project')
  })

  it('shows progress bar when context_window.used_percentage provided', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 55 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('55%')
    // bar has 10 blocks: 55% -> 6 filled, 4 empty
    expect(line2).toMatch(/\[█+░+\]/)
  })

  it('line1 contains ANSI escape when color is set', () => {
    const output = render(CHAR, 'msg', {}, {})
    const line1 = output.split('\n')[0]
    expect(line1).toContain('\x1b[33m')
  })

  it('line1 does NOT contain ANSI escapes when color is empty', () => {
    const output = render(CHAR_NO_COLOR, 'msg', {}, {})
    const line1 = output.split('\n')[0]
    expect(line1).not.toContain('\x1b[')
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

  it('truncates cwd_name longer than 20 chars to 19 chars + ellipsis', () => {
    const longCwd = 'y'.repeat(21)
    const output = render(CHAR, 'msg', {}, { cwd_name: longCwd })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('y'.repeat(19) + '…')
    expect(line2).not.toContain('y'.repeat(21))
  })

  it('progress bar shows yellow ANSI color at 80% context', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 80 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[93m')
    expect(line2).toContain('80%')
  })

  it('progress bar shows red ANSI color at 95% context', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 95 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[91m')
    expect(line2).toContain('95%')
  })

  it('progress bar has no color at 79% context', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 79 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('\x1b[91m')
    expect(line2).not.toContain('\x1b[93m')
    expect(line2).toContain('79%')
  })

  it('progress bar displays floor of decimal percentage', () => {
    const output = render(CHAR, 'msg', { context_window: { used_percentage: 82.7 } }, {})
    const line2 = output.split('\n')[1]
    expect(line2).toContain('82%')
    expect(line2).not.toContain('82.7%')
  })
})
