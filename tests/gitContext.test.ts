import { promisify } from 'util'

// ─── Mock strategy ─────────────────────────────────────────────────────────────
// gitContext.ts does: const execFileAsync = promisify(execFile) at module init.
// promisify(execFile) uses execFile[util.promisify.custom], which is set at
// require time. To intercept this, we mock child_process with a factory that
// attaches a custom promisify implementation pointing to a shared state variable.
// This way, each test can set `currentImpl` to control async behavior.

let currentImpl: ((file: string, args: string[], opts: object) => Promise<{ stdout: string; stderr: string }>) | null = null

jest.mock('child_process', () => {
  const { promisify: _promisify } = require('util')

  function execFileMock(_file: string, _args: string[], _opts: object, cb?: Function) {
    // Not used directly — only promisify.custom is used
    if (cb) cb(new Error('direct callback not supported in mock'))
  }

  // Attach custom promisify that delegates to currentImpl
  ;(execFileMock as any)[_promisify.custom] = async (file: string, args: string[], opts: object) => {
    if (currentImpl) {
      return currentImpl(file, args, opts)
    }
    throw new Error('no mock implementation installed')
  }

  return { execFile: execFileMock }
})

import { loadGitContext } from '../src/core/gitContext'

// Helper: determine which git output to return based on args
function mockAllCommands(outputs: {
  commits_today?: string
  diff_lines?: string
  first_commit_time?: string
  repo_path?: string
}) {
  currentImpl = async (_file: string, args: string[]) => {
    const argsStr = args.join(' ')
    let stdout = ''
    if (argsStr.includes('log') && argsStr.includes('--oneline')) {
      stdout = outputs.commits_today ?? ''
    } else if (argsStr.includes('diff') && argsStr.includes('--stat')) {
      stdout = outputs.diff_lines ?? ''
    } else if (argsStr.includes('log') && argsStr.includes('--format=%ai')) {
      stdout = outputs.first_commit_time ?? ''
    } else if (argsStr.includes('rev-parse')) {
      stdout = outputs.repo_path ?? ''
    }
    return { stdout, stderr: '' }
  }
}

beforeEach(() => {
  currentImpl = null
})

// ─── Successful output ─────────────────────────────────────────────────────────

describe('loadGitContext - successful output', () => {
  it('parses commits_today from log output (2 lines = 2 commits)', async () => {
    mockAllCommands({
      commits_today: 'abc1234 commit 1\ndef5678 commit 2\n',
    })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.commits_today).toBe(2)
  })

  it('parses diff_lines as insertions + deletions sum', async () => {
    mockAllCommands({
      diff_lines: ' 3 files changed, 10 insertions(+), 5 deletions(-)\n',
    })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.diff_lines).toBe(15)
  })

  it('parses first_commit_time as last (earliest) line', async () => {
    mockAllCommands({
      first_commit_time: '2026-04-03 10:00:00 +0800\n2026-04-03 08:00:00 +0800\n',
    })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.first_commit_time).toBe('2026-04-03 08:00:00 +0800')
  })

  it('parses repo_path by trimming whitespace', async () => {
    mockAllCommands({
      repo_path: '/Users/tony/workspace/ai/code-pal\n',
    })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.repo_path).toBe('/Users/tony/workspace/ai/code-pal')
  })

  it('returns commits_today: 0 for empty log output', async () => {
    mockAllCommands({ commits_today: '' })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.commits_today).toBe(0)
  })

  it('returns diff_lines: 0 for empty diff output', async () => {
    mockAllCommands({ diff_lines: '' })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.diff_lines).toBe(0)
  })

  it('returns diff_lines for insertions only (no deletions)', async () => {
    mockAllCommands({
      diff_lines: '1 file changed, 20 insertions(+)\n',
    })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.diff_lines).toBe(20)
  })

  it('returns diff_lines for deletions only (no insertions)', async () => {
    mockAllCommands({
      diff_lines: '1 file changed, 10 deletions(-)\n',
    })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.diff_lines).toBe(10)
  })

  it('parses all fields correctly in a combined scenario', async () => {
    mockAllCommands({
      commits_today: 'abc1234 commit 1\ndef5678 commit 2\n',
      diff_lines: ' 3 files changed, 45 insertions(+), 12 deletions(-)\n',
      first_commit_time: '2026-04-01 10:30:00 +0800\n2026-04-01 09:00:00 +0800\n',
      repo_path: '/Users/user/project\n',
    })
    const ctx = await loadGitContext('/Users/user/project')
    expect(ctx.commits_today).toBe(2)
    expect(ctx.diff_lines).toBe(57)
    expect(ctx.first_commit_time).toBe('2026-04-01 09:00:00 +0800')
    expect(ctx.repo_path).toBe('/Users/user/project')
  })
})

// ─── Error fallback ────────────────────────────────────────────────────────────

describe('loadGitContext - error fallback', () => {
  it('returns all defaults when all commands fail', async () => {
    currentImpl = async () => {
      throw new Error('not a git repo')
    }
    const ctx = await loadGitContext('/tmp')
    expect(ctx).toEqual({
      commits_today: 0,
      diff_lines: 0,
      first_commit_time: null,
      repo_path: null,
    })
  })

  it('returns all defaults when git command throws with different error', async () => {
    currentImpl = async () => {
      throw new Error('git not found')
    }
    const ctx = await loadGitContext('/tmp')
    expect(ctx).toEqual({
      commits_today: 0,
      diff_lines: 0,
      first_commit_time: null,
      repo_path: null,
    })
  })
})

// ─── Partial failure ───────────────────────────────────────────────────────────

describe('loadGitContext - partial failure', () => {
  it('returns partial results when only repo_path succeeds', async () => {
    currentImpl = async (_file: string, args: string[]) => {
      const argsStr = args.join(' ')
      if (argsStr.includes('rev-parse')) {
        return { stdout: '/Users/tony/project\n', stderr: '' }
      }
      throw new Error('not a git repo')
    }
    const ctx = await loadGitContext('/tmp')
    expect(ctx.repo_path).toBe('/Users/tony/project')
    expect(ctx.commits_today).toBe(0)
    expect(ctx.diff_lines).toBe(0)
    expect(ctx.first_commit_time).toBeNull()
  })

  it('handles mix of empty and real output gracefully', async () => {
    mockAllCommands({
      commits_today: 'abc1234 only commit\n',
      diff_lines: '',
      first_commit_time: '',
      repo_path: '/my/repo\n',
    })
    const ctx = await loadGitContext('/tmp')
    expect(ctx.commits_today).toBe(1)
    expect(ctx.diff_lines).toBe(0)
    expect(ctx.first_commit_time).toBeNull()
    expect(ctx.repo_path).toBe('/my/repo')
  })
})

// ─── Concurrent execution ──────────────────────────────────────────────────────

describe('loadGitContext - concurrent execution', () => {
  it('calls all 4 git commands concurrently', async () => {
    const called: string[] = []
    currentImpl = async (_file: string, args: string[]) => {
      called.push(args.join(' '))
      return { stdout: '', stderr: '' }
    }
    await loadGitContext('/tmp')
    expect(called).toHaveLength(4)
  })

  it('verifies all 4 command types are issued', async () => {
    const called: string[] = []
    currentImpl = async (_file: string, args: string[]) => {
      called.push(args.join(' '))
      return { stdout: '', stderr: '' }
    }
    await loadGitContext('/tmp')
    expect(called.some(a => a.includes('log') && a.includes('--oneline'))).toBe(true)
    expect(called.some(a => a.includes('diff') && a.includes('--stat'))).toBe(true)
    expect(called.some(a => a.includes('log') && a.includes('--format=%ai'))).toBe(true)
    expect(called.some(a => a.includes('rev-parse'))).toBe(true)
  })
})
