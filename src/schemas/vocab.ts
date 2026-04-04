// D-03: 8 fixed git_event keys, each string[] optional
export const GIT_EVENT_KEYS = [
  'first_commit_today',
  'milestone_5',
  'milestone_10',
  'milestone_20',
  'late_night_commit',
  'big_diff',
  'big_session',
  'long_day',
] as const

export type GitEventKey = typeof GIT_EVENT_KEYS[number]

// D-04: triggers sub-fields all optional
export type VocabData = {
  meta: {
    name: string
    ascii: string
    style: string
    color: string
  }
  triggers?: {
    random?: string[]
    post_tool?: string[]
    time?: {
      morning?: string[]
      afternoon?: string[]
      evening?: string[]
      midnight?: string[]
    }
    usage?: {
      warning?: string[]
      critical?: string[]
    }
  }
  git_events?: Partial<Record<GitEventKey, string[]>>
}

// Validate an array field: must be string[] if present
function optStrArr(val: unknown): string[] | undefined {
  if (val === undefined || val === null) return undefined
  if (!Array.isArray(val)) return undefined
  return (val as unknown[]).filter((x): x is string => typeof x === 'string')
}

// D-05: meta fields all required — throws if missing
export function parseVocab(raw: unknown, label: string): VocabData {
  if (!raw || typeof raw !== 'object') {
    process.stderr.write(`[code-cheer] ${label} schema validation failed:\n✖ Invalid input: expected object, received undefined\n  → at meta\n`)
    throw new Error(`Invalid ${label}: expected object`)
  }
  const obj = raw as Record<string, unknown>
  const meta = obj.meta as Record<string, unknown> | undefined
  if (!meta || typeof meta !== 'object') {
    process.stderr.write(`[code-cheer] ${label} schema validation failed:\n✖ Invalid input: expected object, received undefined\n  → at meta\n`)
    throw new Error(`Invalid ${label}: missing meta`)
  }
  for (const key of ['name', 'ascii', 'style', 'color'] as const) {
    if (typeof meta[key] !== 'string') {
      process.stderr.write(`[code-cheer] ${label} schema validation failed:\n✖ Invalid input: expected string\n  → at meta.${key}\n`)
      throw new Error(`Invalid ${label}: meta.${key} must be string`)
    }
  }

  const tr = obj.triggers as Record<string, unknown> | undefined
  const triggers: VocabData['triggers'] = tr ? {
    random:    optStrArr(tr['random']),
    post_tool: optStrArr(tr['post_tool']),
    time: tr['time'] && typeof tr['time'] === 'object'
      ? {
          morning:   optStrArr((tr['time'] as Record<string, unknown>)['morning']),
          afternoon: optStrArr((tr['time'] as Record<string, unknown>)['afternoon']),
          evening:   optStrArr((tr['time'] as Record<string, unknown>)['evening']),
          midnight:  optStrArr((tr['time'] as Record<string, unknown>)['midnight']),
        }
      : undefined,
    usage: tr['usage'] && typeof tr['usage'] === 'object'
      ? {
          warning:  optStrArr((tr['usage'] as Record<string, unknown>)['warning']),
          critical: optStrArr((tr['usage'] as Record<string, unknown>)['critical']),
        }
      : undefined,
  } : undefined

  const ge = obj.git_events as Record<string, unknown> | undefined
  const git_events: VocabData['git_events'] = ge
    ? Object.fromEntries(
        GIT_EVENT_KEYS
          .map((k) => [k, optStrArr(ge[k])])
          .filter(([, v]) => v !== undefined)
      ) as Partial<Record<GitEventKey, string[]>>
    : undefined

  return {
    meta: {
      name:  meta['name']  as string,
      ascii: meta['ascii'] as string,
      style: meta['style'] as string,
      color: meta['color'] as string,
    },
    triggers,
    git_events,
  }
}
