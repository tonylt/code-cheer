import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface GitContextResult {
  commits_today: number
  diff_lines: number
  first_commit_time: string | null
  repo_path: string | null
}

const COMMANDS: Record<string, string[]> = {
  commits_today: ['git', 'log', '--oneline', '--since=midnight'],
  diff_lines: ['git', 'diff', '--stat', 'HEAD'],
  first_commit_time: ['git', 'log', '--format=%ai', '--since=midnight'],
  repo_path: ['git', 'rev-parse', '--show-toplevel'],
}

export async function loadGitContext(cwd: string): Promise<GitContextResult> {
  const promises = Object.entries(COMMANDS).map(([key, cmd]) =>
    _runGitCmd(cmd, cwd).then(output => ({ key, output }))
  )

  const settled = await Promise.allSettled(promises)

  const results: GitContextResult = {
    commits_today: 0,
    diff_lines: 0,
    first_commit_time: null,
    repo_path: null,
  }

  for (const result of settled) {
    if (result.status === 'fulfilled') {
      const { key, output } = result.value
      if (output !== null) {
        if (key === 'commits_today') results.commits_today = _parseCommitsToday(output)
        else if (key === 'diff_lines') results.diff_lines = _parseDiffLines(output)
        else if (key === 'first_commit_time') results.first_commit_time = _parseFirstCommitTime(output)
        else if (key === 'repo_path') results.repo_path = _parseRepoPath(output)
      }
    }
    // result.status === 'rejected' → 静默跳过，使用默认值
  }

  return results
}

async function _runGitCmd(cmd: string[], cwd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd[0], cmd.slice(1), { cwd, timeout: 5000 })
    return stdout
  } catch {
    return null
  }
}

function _parseCommitsToday(output: string): number {
  return output.trim().split('\n').filter(line => line).length
}

function _parseDiffLines(output: string): number {
  if (!output.trim()) return 0

  let insertions = 0
  let deletions = 0

  const insMatch = output.match(/(\d+) insertion/)
  if (insMatch !== null) insertions = parseInt(insMatch[1], 10)

  const delMatch = output.match(/(\d+) deletion/)
  if (delMatch !== null) deletions = parseInt(delMatch[1], 10)

  return insertions + deletions
}

function _parseFirstCommitTime(output: string): string | null {
  const lines = output.trim().split('\n').filter(line => line)
  return lines[lines.length - 1] || null
}

function _parseRepoPath(output: string): string | null {
  const path = output.trim()
  return path || null
}
