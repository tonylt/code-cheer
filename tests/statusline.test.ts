import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

// ─── Mock child_process before statusline import ─────────────────────────────
// statusline.ts imports core/gitContext.ts which does:
//   const execFileAsync = promisify(execFile) at module init
// We must mock before any imports use promisify.custom.

let currentImpl:
  | ((file: string, args: string[], opts: object) => Promise<{ stdout: string; stderr: string }>)
  | null = null

jest.mock('child_process', () => {
  const { promisify: _promisify } = require('util')

  function execFileMock(_file: string, _args: string[], _opts: object, cb?: Function) {
    if (cb) cb(new Error('direct callback not supported in mock'))
  }

  ;(execFileMock as any)[_promisify.custom] = async (
    file: string,
    args: string[],
    opts: object
  ) => {
    if (currentImpl) {
      return currentImpl(file, args, opts)
    }
    // Default: simulate non-git dir
    throw new Error('not a git repo')
  }

  return { execFile: execFileMock }
})

import { renderMode, updateMode, debugMode, loadConfig } from '../src/statusline'

// ─── Shared setup ─────────────────────────────────────────────────────────────

describe('statusline', () => {
  let tmpDir: string
  let statsPath: string
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pal-test-'))
    statsPath = path.join(tmpDir, 'stats-cache.json')
    process.env.CODE_PAL_BASE_DIR = tmpDir
    process.env.CODE_PAL_STATS_PATH = statsPath
    // Default mock: non-git dir
    currentImpl = null
  })

  afterEach(() => {
    process.env = originalEnv
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // ─── Helper fixtures ──────────────────────────────────────────────────────

  function writeConfig(char: string = 'nova') {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: char }))
  }

  function writeState(overrides: Record<string, unknown> = {}) {
    const state = {
      message: 'test message',
      last_rate_tier: 'normal',
      last_slot: 'afternoon',
      last_updated: new Date().toISOString(),
      ...overrides,
    }
    fs.writeFileSync(path.join(tmpDir, 'state.json'), JSON.stringify(state))
  }

  function writeStats(tokens: number | string = 'N/A') {
    // Use local timezone date to match loadStats() in statusline.ts which uses getFullYear/getMonth/getDate
    const d = new Date()
    const today =
      `${d.getFullYear()}-` +
      `${String(d.getMonth() + 1).padStart(2, '0')}-` +
      `${String(d.getDate()).padStart(2, '0')}`
    const data = {
      dailyModelTokens: [{ date: today, tokensByModel: { 'claude-sonnet': tokens } }],
    }
    fs.writeFileSync(statsPath, JSON.stringify(data))
  }

  function readState(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf-8'))
  }

  // ─── renderMode ──────────────────────────────────────────────────────────

  describe('renderMode', () => {
    test('default state (no state.json) returns string containing Nova', () => {
      writeConfig('nova')
      const result = renderMode()
      expect(result).toContain('Nova')
    })

    test('with state.json returns string containing message', () => {
      writeConfig()
      writeState({ message: 'Hello world!' })
      const result = renderMode()
      expect(result).toContain('Hello world!')
    })

    test('with stats shows token count', () => {
      writeConfig()
      writeState()
      writeStats(47768)
      const result = renderMode()
      // display.ts formats 47768 → "47k tokens"
      expect(result).toContain('47k')
    })

    test('unknown character falls back to nova', () => {
      writeConfig('nonexistent')
      const result = renderMode()
      expect(result).toContain('Nova')
    })

    test('no config.json defaults to nova', () => {
      // do not write config.json
      const result = renderMode()
      expect(result).toContain('Nova')
    })

    test('returns exactly 2 lines', () => {
      writeConfig()
      writeState()
      const result = renderMode()
      const lines = result.split('\n')
      expect(lines).toHaveLength(2)
    })

    test('no trailing newline', () => {
      writeConfig()
      writeState()
      const result = renderMode()
      expect(result.endsWith('\n')).toBe(false)
    })
  })

  // ─── updateMode ──────────────────────────────────────────────────────────

  describe('updateMode', () => {
    beforeEach(() => {
      // Default mock: non-git dir (no commits)
      currentImpl = async (_file: string, _args: string[], _opts: object) => {
        throw new Error('not a git repo')
      }
    })

    test('creates state.json after update', async () => {
      writeConfig()
      await updateMode('{}')
      expect(fs.existsSync(path.join(tmpDir, 'state.json'))).toBe(true)
    })

    test('state contains required fields', async () => {
      writeConfig()
      await updateMode('{}')
      const state = readState()
      expect(state).toHaveProperty('message')
      expect(state).toHaveProperty('last_updated')
      expect(state).toHaveProperty('last_rate_tier')
      expect(state).toHaveProperty('last_slot')
    })

    test('atomic write: tmp file not left behind', async () => {
      writeConfig()
      await updateMode('{}')
      expect(fs.existsSync(path.join(tmpDir, 'state.json.tmp'))).toBe(false)
    })

    test('handles empty stdin', async () => {
      writeConfig()
      await expect(updateMode('')).resolves.toBeUndefined()
    })

    test('handles invalid JSON stdin', async () => {
      writeConfig()
      await expect(updateMode('not json')).resolves.toBeUndefined()
    })

    test('token fallback from ccData context_window', async () => {
      writeConfig()
      const ccData = JSON.stringify({
        context_window: { total_input_tokens: 1000, total_output_tokens: 500 },
      })
      await updateMode(ccData)
      // state is written — no crash
      expect(fs.existsSync(path.join(tmpDir, 'state.json'))).toBe(true)
    })

    test('rate limit tier warning extracted from ccData', async () => {
      writeConfig()
      const ccData = JSON.stringify({
        rate_limits: { five_hour: { used_percentage: 90 } },
      })
      await updateMode(ccData)
      const state = readState()
      // 90% → warning tier (>= 80, < 95)
      expect(state.last_rate_tier).toBe('warning')
    })

    test('session_start written to state', async () => {
      writeConfig()
      await updateMode('{}')
      const state = readState()
      expect(state).toHaveProperty('session_start')
    })

    test('session_start preserved same day', async () => {
      writeConfig()
      const today = new Date()
      const todayStart = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        8,
        0,
        0
      ).toISOString()
      writeState({ session_start: todayStart })
      await updateMode('{}')
      const state = readState()
      expect(state.session_start).toBe(todayStart)
    })
  })

  // ─── debugMode ──────────────────────────────────────────────────────────

  describe('debugMode', () => {
    beforeEach(() => {
      // Default mock: non-git dir
      currentImpl = async (_file: string, _args: string[], _opts: object) => {
        throw new Error('not a git repo')
      }
    })

    test('outputs 3 debug lines to stderr', async () => {
      writeConfig()
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
      await debugMode('{}')
      expect(stderrSpy).toHaveBeenCalledTimes(3)
    })

    test('contains GIT_CONTEXT label in stderr', async () => {
      writeConfig()
      const stderrLines: string[] = []
      jest.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
        stderrLines.push(String(msg))
        return true
      })
      await debugMode('{}')
      expect(stderrLines.some((line) => /GIT_CONTEXT:/.test(line))).toBe(true)
    })

    test('contains EVENTS_WOULD_FIRE label in stderr', async () => {
      writeConfig()
      const stderrLines: string[] = []
      jest.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
        stderrLines.push(String(msg))
        return true
      })
      await debugMode('{}')
      expect(stderrLines.some((line) => /EVENTS_WOULD_FIRE:/.test(line))).toBe(true)
    })

    test('contains STATE_SNAPSHOT label in stderr', async () => {
      writeConfig()
      const stderrLines: string[] = []
      jest.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
        stderrLines.push(String(msg))
        return true
      })
      await debugMode('{}')
      expect(stderrLines.some((line) => /STATE_SNAPSHOT:/.test(line))).toBe(true)
    })

    test('debug output JSON is parseable after label', async () => {
      writeConfig()
      const stderrLines: string[] = []
      jest.spyOn(process.stderr, 'write').mockImplementation((msg: string | Uint8Array) => {
        stderrLines.push(String(msg))
        return true
      })
      await debugMode('{}')
      // Each line contains "LABEL: {json}" — parse the JSON portion
      for (const line of stderrLines) {
        const match = line.match(/:\s*(\{.+\})\s*$/)
        if (match) {
          expect(() => JSON.parse(match[1])).not.toThrow()
        }
      }
    })

    test('debugMode also writes state.json', async () => {
      writeConfig()
      jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
      await debugMode('{}')
      expect(fs.existsSync(path.join(tmpDir, 'state.json'))).toBe(true)
    })
  })
})

// ─── loadConfig (standalone) ─────────────────────────────────────────────────

describe('loadConfig', () => {
  let tmpDir: string
  let stderrSpy: jest.SpyInstance

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pal-cfg-test-'))
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    stderrSpy.mockRestore()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('outputs Zod error to stderr when character is invalid', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'novaa' }))

    const result = loadConfig(configPath)

    expect(stderrSpy).toHaveBeenCalled()
    const stderrOutput = (stderrSpy.mock.calls as Array<Array<string | Uint8Array>>)
      .map((c) => String(c[0]))
      .join('')
    expect(stderrOutput).toContain('config.json')
    expect(stderrOutput).toContain('character')
    expect(result).toEqual({ character: 'nova' })
  })

  it('falls back to nova when config.json does not exist', () => {
    const result = loadConfig('/nonexistent/config.json')
    expect(result).toEqual({ character: 'nova' })
    expect(stderrSpy).not.toHaveBeenCalled()
  })
})
