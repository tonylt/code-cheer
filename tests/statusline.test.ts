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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-cheer-test-'))
    statsPath = path.join(tmpDir, 'stats-cache.json')
    process.env.CODE_CHEER_BASE_DIR = tmpDir
    process.env.CODE_CHEER_STATS_PATH = statsPath
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

// ─── saveState EXDEV fallback ─────────────────────────────────────────────────

describe('saveState EXDEV fallback', () => {
  let tmpDir: string
  // Use require() to get the mutable CJS module object (bypasses ESM namespace freeze)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fsModule = require('fs') as Record<string, unknown>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pal-exdev-test-'))
    process.env.CODE_CHEER_BASE_DIR = tmpDir
    process.env.CODE_CHEER_STATS_PATH = path.join(tmpDir, 'stats-cache.json')
    currentImpl = null
  })

  afterEach(() => {
    // jest.config.ts has restoreMocks: true — spies are restored automatically
    delete process.env.CODE_CHEER_BASE_DIR
    delete process.env.CODE_CHEER_STATS_PATH
    // Use original fs ref for cleanup (spies restored before afterEach by restoreMocks)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('EXDEV triggers copyFileSync + unlinkSync instead of throw', async () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova' }))

    const exdevErr = Object.assign(new Error('EXDEV'), { code: 'EXDEV' })
    const originalRename = fsModule.renameSync
    const originalCopy = fsModule.copyFileSync
    const originalUnlink = fsModule.unlinkSync

    let copyCalled = false
    let unlinkCalled = false
    fsModule.renameSync = () => { throw exdevErr }
    fsModule.copyFileSync = () => { copyCalled = true }
    fsModule.unlinkSync = () => { unlinkCalled = true }

    try {
      await expect(updateMode('{}')).resolves.toBeUndefined()
      expect(copyCalled).toBe(true)
      expect(unlinkCalled).toBe(true)
    } finally {
      fsModule.renameSync = originalRename
      fsModule.copyFileSync = originalCopy
      fsModule.unlinkSync = originalUnlink
    }
  })

  test('non-EXDEV rename error re-throws', async () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova' }))

    const epermErr = Object.assign(new Error('EPERM'), { code: 'EPERM' })
    const originalRename = fsModule.renameSync
    fsModule.renameSync = () => { throw epermErr }

    try {
      await expect(updateMode('{}')).rejects.toThrow('EPERM')
    } finally {
      fsModule.renameSync = originalRename
    }
  })
})

// ─── character three-level fallback ───────────────────────────────────────────

describe('character three-level fallback', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-pal-char-fallback-test-'))
    process.env.CODE_CHEER_BASE_DIR = tmpDir
    process.env.CODE_CHEER_STATS_PATH = path.join(tmpDir, 'stats-cache.json')
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova' }))
    currentImpl = null
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.CODE_CHEER_BASE_DIR
    delete process.env.CODE_CHEER_STATS_PATH
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('renderMode returns HARDCODED_FALLBACK when both loadCharacter calls fail', () => {
    const { loadCharacter: _lc } = require('../src/core/character')
    jest.spyOn(require('../src/core/character'), 'loadCharacter').mockImplementation(() => {
      throw new Error('character not found')
    })

    const result = renderMode('', { CODE_CHEER_BASE_DIR: tmpDir, CODE_CHEER_STATS_PATH: path.join(tmpDir, 'stats-cache.json') })
    expect(result).toContain('Nova')
    expect(result).toContain('加油')
  })

  test('updateMode resolves without throwing when both loadCharacter calls fail', async () => {
    jest.spyOn(require('../src/core/character'), 'loadCharacter').mockImplementation(() => {
      throw new Error('character not found')
    })

    await expect(
      updateMode('{}', { CODE_CHEER_BASE_DIR: tmpDir, CODE_CHEER_STATS_PATH: path.join(tmpDir, 'stats-cache.json') })
    ).resolves.toBeUndefined()
  })
})

// ─── language integration — T7 ────────────────────────────────────────────────
// Verifies config.language is correctly passed to all 4 loadCharacter call sites:
// renderMode (primary + fallback), runUpdateCore via updateMode (primary + fallback).

describe('language integration — config.language passed to loadCharacter', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-cheer-lang-int-test-'))
    process.env.CODE_CHEER_BASE_DIR = tmpDir
    process.env.CODE_CHEER_STATS_PATH = path.join(tmpDir, 'stats-cache.json')
    currentImpl = null
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.CODE_CHEER_BASE_DIR
    delete process.env.CODE_CHEER_STATS_PATH
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  // renderMode ──────────────────────────────────────────────────────────────────

  it('renderMode: passes language=en to loadCharacter when config.language=en', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova', language: 'en' }))
    const spy = jest.spyOn(require('../src/core/character'), 'loadCharacter')
    renderMode()
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'en')
  })

  it('renderMode: passes language=zh to loadCharacter when config.language=zh', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova', language: 'zh' }))
    const spy = jest.spyOn(require('../src/core/character'), 'loadCharacter')
    renderMode()
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'zh')
  })

  it('renderMode: passes language=undefined when config has no language field and LANG unset', () => {
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova' }))
    const spy = jest.spyOn(require('../src/core/character'), 'loadCharacter')
    renderMode('', { CODE_CHEER_BASE_DIR: tmpDir, CODE_CHEER_STATS_PATH: path.join(tmpDir, 'stats-cache.json') })
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined)
  })

  // updateMode (runUpdateCore) ──────────────────────────────────────────────────

  it('updateMode: passes language=en to loadCharacter when config.language=en', async () => {
    currentImpl = async () => { throw new Error('not a git repo') }
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova', language: 'en' }))
    const spy = jest.spyOn(require('../src/core/character'), 'loadCharacter')
    await updateMode('{}')
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'en')
  })

  it('updateMode: passes language=zh to loadCharacter when config.language=zh', async () => {
    currentImpl = async () => { throw new Error('not a git repo') }
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova', language: 'zh' }))
    const spy = jest.spyOn(require('../src/core/character'), 'loadCharacter')
    await updateMode('{}')
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), 'zh')
  })

  it('updateMode: passes language=undefined when config has no language field and LANG unset', async () => {
    currentImpl = async () => { throw new Error('not a git repo') }
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify({ character: 'nova' }))
    const spy = jest.spyOn(require('../src/core/character'), 'loadCharacter')
    await updateMode('{}', { CODE_CHEER_BASE_DIR: tmpDir, CODE_CHEER_STATS_PATH: path.join(tmpDir, 'stats-cache.json') })
    expect(spy).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined)
  })
})

// ─── parseState edge cases ────────────────────────────────────────────────────

describe('parseState edge cases', () => {
  it('parseState(123) returns DEFAULT_STATE without throwing', () => {
    const { parseState } = require('../src/schemas')
    expect(() => parseState(123 as unknown)).not.toThrow()
    const result = parseState(123 as unknown)
    expect(result).toHaveProperty('message')
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

  it('outputs validation error to stderr when character is invalid', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'novaa' }))

    const result = loadConfig(configPath, {})

    expect(stderrSpy).toHaveBeenCalled()
    const stderrOutput = (stderrSpy.mock.calls as Array<Array<string | Uint8Array>>)
      .map((c) => String(c[0]))
      .join('')
    expect(stderrOutput).toContain('config.json')
    expect(stderrOutput).toContain('character')
    expect(result).toEqual({ character: 'nova' })
  })

  it('falls back to nova when config.json does not exist and LANG unset', () => {
    const result = loadConfig('/nonexistent/config.json', {})
    expect(result).toEqual({ character: 'nova' })
    expect(stderrSpy).not.toHaveBeenCalled()
  })

  // T6: locale auto-detection ──────────────────────────────────────────────────

  it('T6: infers language=zh when config has no language and LANG contains zh', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova' }))
    const result = loadConfig(configPath, { LANG: 'zh_CN.UTF-8' })
    expect(result.language).toBe('zh')
  })

  it('T6: infers language=en when config has no language and LANG is set but not zh', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova' }))
    const result = loadConfig(configPath, { LANG: 'en_US.UTF-8' })
    expect(result.language).toBe('en')
  })

  it('T6: keeps language=undefined when config has no language and LANG is unset', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova' }))
    const result = loadConfig(configPath, {})
    expect(result.language).toBeUndefined()
  })

  it('T6: infers language=en when config.json does not exist and LANG is en', () => {
    const result = loadConfig('/nonexistent/config.json', { LANG: 'en_US.UTF-8' })
    expect(result.language).toBe('en')
    expect(result.character).toBe('nova')
  })

  it('T6: infers language=zh when config.json does not exist and LANG is zh', () => {
    const result = loadConfig('/nonexistent/config.json', { LANG: 'zh_CN.UTF-8' })
    expect(result.language).toBe('zh')
  })

  it('T6: explicit config language overrides LANG inference', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova', language: 'zh' }))
    const result = loadConfig(configPath, { LANG: 'en_US.UTF-8' })
    expect(result.language).toBe('zh')
  })

  it('T6: infers language=en when LANG=C.UTF-8 (POSIX/Docker locale)', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova' }))
    const result = loadConfig(configPath, { LANG: 'C.UTF-8' })
    expect(result.language).toBe('en')
  })

  it('T6: infers language=en when LANG=C (minimal POSIX locale)', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova' }))
    const result = loadConfig(configPath, { LANG: 'C' })
    expect(result.language).toBe('en')
  })

  // T10: invalid language warning ──────────────────────────────────────────────

  it('T10: outputs stderr warning for unknown language value', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova', language: 'french' }))
    const result = loadConfig(configPath, {})
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('unknown language "french"'))
    expect(result.language).toBeUndefined()
  })

  it('T10: no stderr warning for null language', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova', language: null }))
    stderrSpy.mockClear()
    loadConfig(configPath, {})
    const calls = (stderrSpy.mock.calls as Array<Array<string>>).map((c) => String(c[0]))
    expect(calls.some((s) => s.includes('unknown language'))).toBe(false)
  })

  it('T10: no stderr warning for empty string language', () => {
    const configPath = path.join(tmpDir, 'config.json')
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova', language: '' }))
    stderrSpy.mockClear()
    loadConfig(configPath, {})
    const calls = (stderrSpy.mock.calls as Array<Array<string>>).map((c) => String(c[0]))
    expect(calls.some((s) => s.includes('unknown language'))).toBe(false)
  })
})
