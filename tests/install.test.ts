import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// Import CJS scripts using require (they are plain Node.js .js files)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { patchSettings } = require('../scripts/install.js') as {
  patchSettings: (nodeBin: string, opts?: { settingsPath?: string; installDir?: string }) => void
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { unpatchSettings } = require('../scripts/uninstall.js') as {
  unpatchSettings: (opts?: { settingsPath?: string; installDir?: string }) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cpal-install-'))
}

function writeSettings(dir: string, data: unknown): string {
  const p = path.join(dir, 'settings.json')
  fs.writeFileSync(p, JSON.stringify(data, null, 2))
  return p
}

function readSettings(settingsPath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
}

const FAKE_NODE = '/usr/local/bin/node'

// ─── patchSettings ────────────────────────────────────────────────────────────

describe('patchSettings', () => {
  let tmpDir: string
  let installDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
    installDir = path.join(tmpDir, 'install')
    fs.mkdirSync(installDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates statusLine and Stop hook on fresh settings (no existing file)', () => {
    const settingsPath = path.join(tmpDir, 'settings.json')
    // File does not exist — fresh install
    patchSettings(FAKE_NODE, { settingsPath, installDir })

    const data = readSettings(settingsPath)

    expect(data.statusLine).toEqual({
      type: 'command',
      command: `"${FAKE_NODE}" "${installDir}/dist/statusline.js"`,
    })

    const stop = (data as any).hooks?.Stop
    expect(Array.isArray(stop)).toBe(true)
    expect(stop).toHaveLength(1)
    expect(stop[0]).toEqual({
      hooks: [{ type: 'command', command: `"${FAKE_NODE}" "${installDir}/dist/statusline.js" --update` }],
    })
  })

  it('preserves existing PostToolUse, PreToolUse, SessionStart hooks', () => {
    const existing = {
      hooks: {
        PostToolUse: [{ matcher: '**', hooks: [{ type: 'command', command: 'prettier --write' }] }],
        PreToolUse: [{ matcher: '**', hooks: [{ type: 'command', command: 'lint-check' }] }],
        SessionStart: [{ hooks: [{ type: 'command', command: 'session-init' }] }],
        Stop: [],
      },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    patchSettings(FAKE_NODE, { settingsPath, installDir })

    const data = readSettings(settingsPath)
    const hooks = (data as any).hooks

    // Other hooks must be preserved exactly
    expect(hooks.PostToolUse).toEqual(existing.hooks.PostToolUse)
    expect(hooks.PreToolUse).toEqual(existing.hooks.PreToolUse)
    expect(hooks.SessionStart).toEqual(existing.hooks.SessionStart)

    // Stop now has the new code-pal entry
    expect(hooks.Stop).toHaveLength(1)
    expect(hooks.Stop[0].hooks[0].command).toContain('statusline.js')
    expect(hooks.Stop[0].hooks[0].command).toContain('--update')
  })

  it('cleans old statusline.py Stop hook entries on upgrade (D-05)', () => {
    const existing = {
      statusLine: { type: 'command', command: 'python3 ~/.claude/code-pal/statusline.py' },
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: 'python3 ~/.claude/code-pal/statusline.py --update' }] },
          { hooks: [{ type: 'command', command: 'some-other-hook' }] },
        ],
      },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    patchSettings(FAKE_NODE, { settingsPath, installDir })

    const data = readSettings(settingsPath)
    const stop = (data as any).hooks?.Stop as unknown[]

    // Old Python entry should be gone
    const hasPy = stop.some((h: any) =>
      JSON.stringify(h).includes('statusline.py')
    )
    expect(hasPy).toBe(false)

    // Other hook should be preserved
    const hasOther = stop.some((h: any) =>
      JSON.stringify(h).includes('some-other-hook')
    )
    expect(hasOther).toBe(true)

    // New Node.js entry should be added
    const hasNode = stop.some((h: any) =>
      JSON.stringify(h).includes('statusline.js') && JSON.stringify(h).includes('--update')
    )
    expect(hasNode).toBe(true)
  })

  it('replaces existing statusline.js entries on re-install (no duplicates)', () => {
    const existing = {
      statusLine: { type: 'command', command: `${FAKE_NODE} ${installDir}/dist/statusline.js` },
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: `${FAKE_NODE} ${installDir}/dist/statusline.js --update` }] },
        ],
      },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    patchSettings(FAKE_NODE, { settingsPath, installDir })

    const data = readSettings(settingsPath)
    const stop = (data as any).hooks?.Stop as unknown[]

    // Must have exactly 1 Stop entry (no duplicates)
    expect(stop).toHaveLength(1)
    expect((stop[0] as any).hooks[0].command).toContain('statusline.js')
    expect((stop[0] as any).hooks[0].command).toContain('--update')
  })

  it('backs up third-party statusLine to statusline-backup.json', () => {
    const existing = {
      statusLine: { type: 'command', command: 'my-custom-statusline --render' },
      hooks: { Stop: [] },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    patchSettings(FAKE_NODE, { settingsPath, installDir })

    const backupPath = path.join(installDir, 'statusline-backup.json')
    expect(fs.existsSync(backupPath)).toBe(true)

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    expect(backup.statusLine).toEqual(existing.statusLine)
  })
})

// ─── unpatchSettings ──────────────────────────────────────────────────────────

describe('unpatchSettings', () => {
  let tmpDir: string
  let installDir: string

  beforeEach(() => {
    tmpDir = makeTmpDir()
    installDir = path.join(tmpDir, 'install')
    fs.mkdirSync(installDir, { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('removes statusLine containing statusline.js', () => {
    const existing = {
      statusLine: { type: 'command', command: `${FAKE_NODE} ~/.claude/code-pal/dist/statusline.js` },
      hooks: {
        Stop: [{ hooks: [{ type: 'command', command: `${FAKE_NODE} ~/.claude/code-pal/dist/statusline.js --update` }] }],
      },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    unpatchSettings({ settingsPath, installDir })

    const data = readSettings(settingsPath)
    expect(data.statusLine).toBeUndefined()
  })

  it('removes statusLine containing statusline.py (Python legacy)', () => {
    const existing = {
      statusLine: { type: 'command', command: 'python3 /Users/tony/.claude/code-pal/statusline.py' },
      hooks: { PostToolUse: [{ type: 'command', command: 'prettier --write' }] },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    unpatchSettings({ settingsPath, installDir })

    const data = readSettings(settingsPath)
    expect(data.statusLine).toBeUndefined()
    expect((data.hooks as Record<string, unknown>)?.PostToolUse).toBeDefined()
  })

  it('restores statusLine from backup file', () => {
    const thirdParty = { type: 'command', command: 'my-custom-statusline --render' }
    const backupPath = path.join(installDir, 'statusline-backup.json')
    fs.writeFileSync(backupPath, JSON.stringify({ statusLine: thirdParty }, null, 2))

    const existing = {
      statusLine: { type: 'command', command: `${FAKE_NODE} ~/.claude/code-pal/dist/statusline.js` },
      hooks: { Stop: [] },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    unpatchSettings({ settingsPath, installDir })

    const data = readSettings(settingsPath)
    expect(data.statusLine).toEqual(thirdParty)
    // Backup file should be removed after restore
    expect(fs.existsSync(backupPath)).toBe(false)
  })

  it('preserves non-statusline Stop hooks', () => {
    const existing = {
      statusLine: { type: 'command', command: `${FAKE_NODE} ~/.claude/code-pal/dist/statusline.js` },
      hooks: {
        PostToolUse: [{ matcher: '**', hooks: [{ type: 'command', command: 'prettier' }] }],
        Stop: [
          { hooks: [{ type: 'command', command: `${FAKE_NODE} ~/.claude/code-pal/dist/statusline.js --update` }] },
          { hooks: [{ type: 'command', command: 'some-other-stop-hook' }] },
        ],
      },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    unpatchSettings({ settingsPath, installDir })

    const data = readSettings(settingsPath)
    const hooks = (data as any).hooks
    expect(hooks.PostToolUse).toEqual(existing.hooks.PostToolUse)

    const stop = hooks.Stop as unknown[]
    expect(stop).toHaveLength(1)
    expect((stop[0] as any).hooks[0].command).toBe('some-other-stop-hook')
  })

  it('cleans up empty hooks.Stop and hooks object after removal', () => {
    const existing = {
      statusLine: { type: 'command', command: `${FAKE_NODE} ~/.claude/code-pal/dist/statusline.js` },
      hooks: {
        Stop: [
          { hooks: [{ type: 'command', command: `${FAKE_NODE} ~/.claude/code-pal/dist/statusline.js --update` }] },
        ],
      },
    }
    const settingsPath = writeSettings(tmpDir, existing)
    unpatchSettings({ settingsPath, installDir })

    const data = readSettings(settingsPath)
    // Stop was the only hook, so hooks object should be deleted
    expect((data as any).hooks).toBeUndefined()
  })
})
