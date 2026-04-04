import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { loadCharacter, getGitEventMessage } from '../src/core/character'
import type { VocabData } from '../src/schemas'

const VALID_VOCAB = {
  meta: { name: 'TestChar', ascii: '(^_^)', style: 'test', color: '33' },
  triggers: {
    random: ['r1', 'r2'],
    post_tool: ['p1'],
    time: { morning: ['m1'], afternoon: ['a1'], evening: ['e1'], midnight: ['n1'] },
    usage: { warning: ['w1'], critical: ['c1'] },
  },
  git_events: { first_commit_today: ['gc1', 'gc2'] },
}

let vocabDir: string

beforeEach(() => {
  vocabDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vocab-test-'))
})

afterEach(() => {
  fs.rmSync(vocabDir, { recursive: true })
})

// ─── loadCharacter ────────────────────────────────────────────────────────────

describe('loadCharacter', () => {
  it('loads valid character by name and returns meta.name', () => {
    fs.writeFileSync(path.join(vocabDir, 'testchar.json'), JSON.stringify(VALID_VOCAB))
    const char = loadCharacter('testchar', vocabDir)
    expect(char.meta.name).toBe('TestChar')
  })

  it('returns correct meta fields (ascii, style, color)', () => {
    fs.writeFileSync(path.join(vocabDir, 'testchar.json'), JSON.stringify(VALID_VOCAB))
    const char = loadCharacter('testchar', vocabDir)
    expect(char.meta.ascii).toBe('(^_^)')
    expect(char.meta.style).toBe('test')
    expect(char.meta.color).toBe('33')
  })

  it('returns triggers with random and post_tool arrays', () => {
    fs.writeFileSync(path.join(vocabDir, 'testchar.json'), JSON.stringify(VALID_VOCAB))
    const char = loadCharacter('testchar', vocabDir)
    expect(char.triggers?.random).toEqual(['r1', 'r2'])
    expect(char.triggers?.post_tool).toEqual(['p1'])
  })

  it('returns git_events with correct keys', () => {
    fs.writeFileSync(path.join(vocabDir, 'testchar.json'), JSON.stringify(VALID_VOCAB))
    const char = loadCharacter('testchar', vocabDir)
    expect(char.git_events?.first_commit_today).toEqual(['gc1', 'gc2'])
  })

  it('throws for unknown character name (file not found)', () => {
    expect(() => loadCharacter('nonexistent', vocabDir)).toThrow('not found')
  })

  it('throws for invalid JSON missing meta field (schema validation error)', () => {
    fs.writeFileSync(path.join(vocabDir, 'invalid.json'), JSON.stringify({}))
    expect(() => loadCharacter('invalid', vocabDir)).toThrow()
  })

  it('loads real nova.json from project vocab/ using project root path', () => {
    // ts-jest sets __dirname to src/core, so we pass the actual vocab dir explicitly
    const projectVocabDir = path.join(__dirname, '..', 'vocab')
    const char = loadCharacter('nova', projectVocabDir)
    expect(char.meta.name).toBeTruthy()
    expect(char.triggers).toBeDefined()
  })
})

// ─── getGitEventMessage ────────────────────────────────────────────────────────

describe('getGitEventMessage', () => {
  let char: VocabData

  beforeEach(() => {
    fs.writeFileSync(path.join(vocabDir, 'testchar.json'), JSON.stringify(VALID_VOCAB))
    char = loadCharacter('testchar', vocabDir)
  })

  it('returns a string for existing event key with messages', () => {
    const result = getGitEventMessage(char, 'first_commit_today')
    expect(typeof result).toBe('string')
    expect(['gc1', 'gc2']).toContain(result)
  })

  it('returns null for unknown event key', () => {
    expect(getGitEventMessage(char, 'nonexistent_event')).toBeNull()
  })

  it('returns null for empty messages array', () => {
    const vocabWithEmpty = {
      ...VALID_VOCAB,
      git_events: { first_commit_today: [] as string[] },
    }
    fs.writeFileSync(path.join(vocabDir, 'empty.json'), JSON.stringify(vocabWithEmpty))
    const emptyChar = loadCharacter('empty', vocabDir)
    expect(getGitEventMessage(emptyChar, 'first_commit_today')).toBeNull()
  })
})
