// D-06: message/last_rate_tier/last_slot required, rest optional
export type StateType = {
  message: string
  last_rate_tier: string
  last_slot: string
  last_git_events?: string[]
  last_repo?: string
  commits_today?: number
  session_start?: string
  last_updated?: string
}

// D-07: default state for when file doesn't exist
export const DEFAULT_STATE: StateType = {
  message: '',
  last_rate_tier: 'normal',
  last_slot: 'afternoon',
}

function validationError(label: string, detail: string): Error {
  process.stderr.write(`[code-pal] ${label} schema validation failed:\n✖ ${detail}\n`)
  return new Error(`Invalid ${label}: ${detail}`)
}

// D-07: null/undefined/non-object returns default, valid data parsed
export function parseState(raw: unknown): StateType {
  if (raw === null || raw === undefined) {
    return { ...DEFAULT_STATE }
  }
  if (typeof raw !== 'object') {
    return { ...DEFAULT_STATE }
  }
  const obj = raw as Record<string, unknown>
  return {
    message:         typeof obj.message        === 'string' ? obj.message        : '',
    last_rate_tier:  typeof obj.last_rate_tier === 'string' ? obj.last_rate_tier : 'normal',
    last_slot:       typeof obj.last_slot      === 'string' ? obj.last_slot      : 'afternoon',
    last_git_events: Array.isArray(obj.last_git_events)
      ? (obj.last_git_events as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined,
    last_repo:      typeof obj.last_repo      === 'string' ? obj.last_repo      : undefined,
    commits_today:  typeof obj.commits_today  === 'number' ? obj.commits_today  : undefined,
    session_start:  typeof obj.session_start  === 'string' ? obj.session_start  : undefined,
    last_updated:   typeof obj.last_updated   === 'string' ? obj.last_updated   : undefined,
  }
}
