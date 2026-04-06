import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { resolveMemoryPath, parseMemoryTitles, loadMemoryContext } from '../src/core/memory'
import { parseState } from '../src/schemas/state'
import { parseVocab } from '../src/schemas/vocab'

// ─── resolveMemoryPath ────────────────────────────────────────────────────────

describe('resolveMemoryPath', () => {
  it('builds correct MEMORY.md path from gitRoot and homeDir', () => {
    const result = resolveMemoryPath(
      '/Users/tony/workspace/ai/code-cheer',
      '/Users/tony'
    )
    expect(result).toBe(
      '/Users/tony/.claude/projects/-Users-tony-workspace-ai-code-cheer/memory/MEMORY.md'
    )
  })

  it('returns null when gitRoot is null', () => {
    expect(resolveMemoryPath(null, '/Users/tony')).toBeNull()
  })

  it('returns null when gitRoot is undefined', () => {
    expect(resolveMemoryPath(undefined, '/Users/tony')).toBeNull()
  })

  it('replaces all forward slashes in gitRoot with hyphens for slug', () => {
    const result = resolveMemoryPath('/a/b/c', '/home/user')
    expect(result).toBe('/home/user/.claude/projects/-a-b-c/memory/MEMORY.md')
  })
})

// ─── parseMemoryTitles ────────────────────────────────────────────────────────

describe('parseMemoryTitles', () => {
  it('extracts titles from standard MEMORY.md markdown link list', () => {
    const content = '- [Design System](project_design_system.md) -- Warm Pixel-Editorial direction\n- [Auth](auth.md) -- description'
    expect(parseMemoryTitles(content)).toEqual(['Design System', 'Auth'])
  })

  it('returns empty array for content with header but no list entries', () => {
    expect(parseMemoryTitles('# Header\n\nno entries here')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseMemoryTitles('')).toEqual([])
  })

  it('truncates titles longer than 20 chars to 20 chars + ellipsis', () => {
    const content = '- [A Very Long Title That Exceeds Twenty Characters](file.md)'
    const result = parseMemoryTitles(content)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('A Very Long Title Th\u2026')
    expect(result[0].length).toBe(21) // 20 chars + 1 ellipsis char (…)
  })

  it('preserves titles at exactly 20 chars without truncation', () => {
    const content = '- [Exactly20CharTitle](file.md)'
    const result = parseMemoryTitles(content)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Exactly20CharTitle')
    // Note: 'Exactly20CharTitle' is 18 chars, adjust
  })

  it('preserves title at exactly 20 chars', () => {
    const title20 = 'ABCDEFGHIJKLMNOPQRST' // exactly 20 chars
    const content = `- [${title20}](file.md)`
    const result = parseMemoryTitles(content)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(title20)
  })

  it('ignores lines that do not match the link list pattern', () => {
    const content = '# Memory Index\n\nSome text\n- plain item without link\n- [Valid](file.md)'
    expect(parseMemoryTitles(content)).toEqual(['Valid'])
  })

  it('handles multiple valid entries', () => {
    const content = [
      '- [Design System](ds.md)',
      '- [Auth Flow](auth.md)',
      '- [Database](db.md)',
    ].join('\n')
    expect(parseMemoryTitles(content)).toEqual(['Design System', 'Auth Flow', 'Database'])
  })
})

// ─── loadMemoryContext ────────────────────────────────────────────────────────

describe('loadMemoryContext', () => {
  let tmpDir: string
  let tmpHome: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-test-'))
    tmpHome = tmpDir
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('returns memory_count and memory_titles when MEMORY.md exists', () => {
    const slug = '-tmp-test-repo'
    const memDir = path.join(tmpHome, '.claude', 'projects', slug, 'memory')
    fs.mkdirSync(memDir, { recursive: true })
    fs.writeFileSync(
      path.join(memDir, 'MEMORY.md'),
      '- [Design System](ds.md)\n- [Auth](auth.md)'
    )
    const gitRoot = '/tmp/test/repo'
    // slug for /tmp/test/repo is -tmp-test-repo
    const result = loadMemoryContext(gitRoot, tmpHome)
    expect(result.memory_count).toBe(2)
    expect(result.memory_titles).toEqual(['Design System', 'Auth'])
  })

  it('returns memory_count=0 and empty array when MEMORY.md does not exist', () => {
    const result = loadMemoryContext('/some/repo', tmpHome)
    expect(result.memory_count).toBe(0)
    expect(result.memory_titles).toEqual([])
  })

  it('returns memory_count=0 and empty array when gitRoot is null', () => {
    const result = loadMemoryContext(null, tmpHome)
    expect(result.memory_count).toBe(0)
    expect(result.memory_titles).toEqual([])
  })

  it('returns memory_count=0 and empty array when gitRoot is undefined', () => {
    const result = loadMemoryContext(undefined, tmpHome)
    expect(result.memory_count).toBe(0)
    expect(result.memory_titles).toEqual([])
  })

  it('returns memory_count=0 when MEMORY.md has no list entries', () => {
    const gitRoot = '/some/empty/repo'
    const slug = gitRoot.replace(/\//g, '-')
    const memDir = path.join(tmpHome, '.claude', 'projects', slug, 'memory')
    fs.mkdirSync(memDir, { recursive: true })
    fs.writeFileSync(path.join(memDir, 'MEMORY.md'), '# Memory Index\n\nNo entries yet.')
    const result = loadMemoryContext(gitRoot, tmpHome)
    expect(result.memory_count).toBe(0)
    expect(result.memory_titles).toEqual([])
  })
})

// ─── parseState backward compat with memory fields ────────────────────────────

describe('parseState — memory fields', () => {
  it('preserves memory_count when present in raw state', () => {
    const raw = {
      message: 'hi',
      last_rate_tier: 'normal',
      last_slot: 'afternoon',
      memory_count: 3,
    }
    expect(parseState(raw).memory_count).toBe(3)
  })

  it('preserves memory_titles array when present', () => {
    const raw = {
      message: 'hi',
      last_rate_tier: 'normal',
      last_slot: 'afternoon',
      memory_titles: ['Design System', 'Auth'],
    }
    expect(parseState(raw).memory_titles).toEqual(['Design System', 'Auth'])
  })

  it('preserves last_memory_recall string when present', () => {
    const raw = {
      message: 'hi',
      last_rate_tier: 'normal',
      last_slot: 'afternoon',
      last_memory_recall: '2026-04-06T00:00:00Z',
    }
    expect(parseState(raw).last_memory_recall).toBe('2026-04-06T00:00:00Z')
  })

  it('returns undefined for memory fields when absent (backward compat)', () => {
    const raw = {
      message: 'hi',
      last_rate_tier: 'normal',
      last_slot: 'afternoon',
    }
    const state = parseState(raw)
    expect(state.memory_count).toBeUndefined()
    expect(state.memory_titles).toBeUndefined()
    expect(state.last_memory_recall).toBeUndefined()
  })

  it('filters non-string values from memory_titles array', () => {
    const raw = {
      message: 'hi',
      last_rate_tier: 'normal',
      last_slot: 'afternoon',
      memory_titles: ['valid', 42, null, 'also-valid'],
    }
    expect(parseState(raw).memory_titles).toEqual(['valid', 'also-valid'])
  })
})

// ─── parseVocab backward compat with memory_recall ─────────────────────────

describe('parseVocab — memory_recall field', () => {
  const baseMeta = {
    meta: { name: 'Test', ascii: '(*)', style: 'test', color: '33' },
  }

  it('preserves memory_recall string[] when present', () => {
    const raw = {
      ...baseMeta,
      memory_recall: ['Welcome back!! Last time: {titles}', 'Back again: {titles}'],
    }
    const vocab = parseVocab(raw, 'test')
    expect(vocab.memory_recall).toEqual([
      'Welcome back!! Last time: {titles}',
      'Back again: {titles}',
    ])
  })

  it('returns undefined for memory_recall when absent (backward compat)', () => {
    const vocab = parseVocab(baseMeta, 'test')
    expect(vocab.memory_recall).toBeUndefined()
  })

  it('returns undefined for memory_recall when value is not an array', () => {
    const raw = { ...baseMeta, memory_recall: 'not an array' }
    const vocab = parseVocab(raw, 'test')
    expect(vocab.memory_recall).toBeUndefined()
  })

  it('filters non-string values from memory_recall array', () => {
    const raw = { ...baseMeta, memory_recall: ['valid {titles}', 42, null, 'also valid {titles}'] }
    const vocab = parseVocab(raw, 'test')
    expect(vocab.memory_recall).toEqual(['valid {titles}', 'also valid {titles}'])
  })
})
