import { z } from 'zod'

// D-06: message/last_rate_tier/last_slot required, rest optional
export const StateSchema = z.object({
  message: z.string(),
  last_rate_tier: z.string(),
  last_slot: z.string(),
  last_git_events: z.array(z.string()).optional(),
  last_repo: z.string().optional(),
  commits_today: z.number().optional(),
  session_start: z.string().optional(),
  last_updated: z.string().optional(),
  last_model: z.string().optional(),
  last_tokens: z.number().optional(),
})

export type StateType = z.infer<typeof StateSchema>

// D-07: default state for when file doesn't exist
export const DEFAULT_STATE: StateType = {
  message: '',
  last_rate_tier: 'normal',
  last_slot: 'afternoon',
}

// D-08: safeParse + z.prettifyError to stderr, then throw
// D-09: vocab validation throws directly, caller decides fallback
export function parseWithReadableError<T>(
  schema: z.ZodSchema<T>,
  raw: unknown,
  label: string,
): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    process.stderr.write(
      `[code-pal] ${label} schema validation failed:\n${z.prettifyError(result.error)}\n`
    )
    throw new Error(`Invalid ${label}: schema validation failed`)
  }
  return result.data
}

// D-07: null/undefined returns default, valid data parsed, invalid throws
export function parseState(raw: unknown): StateType {
  if (raw === null || raw === undefined) {
    return { ...DEFAULT_STATE }
  }
  return parseWithReadableError(StateSchema, raw, 'state.json')
}
