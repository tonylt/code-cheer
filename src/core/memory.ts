import * as fs from 'fs'
import * as path from 'path'

export interface MemoryContext {
  memory_count: number
  memory_titles: string[]
}

/**
 * Resolves the path to MEMORY.md for a given git repo root.
 * Returns null if gitRoot is null/undefined.
 *
 * Path: {homeDir}/.claude/projects/{slug}/memory/MEMORY.md
 * where slug = gitRoot with all '/' replaced by '-'
 */
export function resolveMemoryPath(gitRoot: string | null | undefined, homeDir: string): string | null {
  if (gitRoot === null || gitRoot === undefined) return null
  const slug = gitRoot.replace(/\//g, '-')
  return path.join(homeDir, '.claude', 'projects', slug, 'memory', 'MEMORY.md')
}

/**
 * Parses MEMORY.md content and extracts titles from markdown link list entries.
 * Matches lines in the form: - [Title](file.md)
 * Titles longer than 20 chars are truncated to 20 + '…'.
 */
export function parseMemoryTitles(content: string): string[] {
  const titles: string[] = []
  for (const line of content.split('\n')) {
    const match = line.match(/^- \[([^\]]+)\]\([^)]+\)/)
    if (match !== null && match[1] !== undefined) {
      const raw = match[1]
      const title = raw.length > 20 ? raw.slice(0, 20) + '\u2026' : raw
      titles.push(title)
    }
  }
  return titles
}

/**
 * Loads memory context for the current git repo.
 * Returns { memory_count: 0, memory_titles: [] } if MEMORY.md does not exist
 * or gitRoot is null/undefined.
 */
export function loadMemoryContext(gitRoot: string | null | undefined, homeDir: string): MemoryContext {
  const memPath = resolveMemoryPath(gitRoot, homeDir)
  if (memPath === null) return { memory_count: 0, memory_titles: [] }
  try {
    const content = fs.readFileSync(memPath, 'utf-8')
    const titles = parseMemoryTitles(content)
    return { memory_count: titles.length, memory_titles: titles }
  } catch {
    return { memory_count: 0, memory_titles: [] }
  }
}
