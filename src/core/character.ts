import * as fs from 'fs'
import * as path from 'path'
import { parseVocab } from '../schemas'
import type { VocabData } from '../schemas'

/**
 * Pick a random element from an array.
 * Private helper — not exported; trigger.ts has its own rng-injectable version.
 */
function pick(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)]
}

/**
 * Load and validate a character vocab JSON.
 *
 * @param name - Character name (e.g. 'nova', 'luna', 'mochi', 'iris', 'leijun')
 * @param vocabDir - Optional override for vocab directory path.
 *   Defaults to path.join(__dirname, '../vocab') (D-01, D-02).
 *   Pass a custom path in tests to inject fixture data.
 * @returns Validated VocabData object
 * @throws Error if file not found or schema validation fails
 */
export function loadCharacter(name: string, vocabDir?: string): VocabData {
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error(`Invalid character name: '${name}'`)
  }
  const dir = vocabDir !== undefined ? vocabDir : path.join(__dirname, '../vocab')
  const vocabPath = path.join(dir, `${name}.json`)

  if (!fs.existsSync(vocabPath)) {
    throw new Error(`Character '${name}' not found at ${vocabPath}`)
  }

  const content = fs.readFileSync(vocabPath, 'utf-8')
  const parsed: unknown = JSON.parse(content)

  return parseVocab(parsed, `vocab/${name}.json`)
}

/**
 * Get a random git event message for the given event key.
 *
 * @param vocab - Validated VocabData (from loadCharacter())
 * @param eventKey - Git event key (e.g. 'first_commit_today', 'milestone_5')
 * @returns Random message string, or null if section/key not found or empty
 */
export function getGitEventMessage(vocab: VocabData, eventKey: string): string | null {
  const messages = vocab.git_events?.[eventKey as keyof NonNullable<VocabData['git_events']>]
  if (messages !== undefined && messages.length > 0) {
    return pick(messages)
  }
  return null
}
