import { z } from 'zod'

// D-03: 8 fixed git_event keys, each z.array(z.string()).optional()
const GIT_EVENT_KEYS = [
  'first_commit_today',
  'milestone_5',
  'milestone_10',
  'milestone_20',
  'late_night_commit',
  'big_diff',
  'big_session',
  'long_day',
] as const

const GitEventsSchema = z.object(
  Object.fromEntries(
    GIT_EVENT_KEYS.map((k) => [k, z.array(z.string()).optional()])
  ) as Record<(typeof GIT_EVENT_KEYS)[number], z.ZodOptional<z.ZodArray<z.ZodString>>>
).partial()

// D-04: triggers sub-fields all optional
const TimeSchema = z.object({
  morning: z.array(z.string()).optional(),
  afternoon: z.array(z.string()).optional(),
  evening: z.array(z.string()).optional(),
  midnight: z.array(z.string()).optional(),
}).partial()

const UsageSchema = z.object({
  warning: z.array(z.string()).optional(),
  critical: z.array(z.string()).optional(),
  // No "normal" — normal tier uses random messages (per CONTEXT.md specifics)
}).partial()

const TriggersSchema = z.object({
  random: z.array(z.string()).optional(),
  post_tool: z.array(z.string()).optional(),
  time: TimeSchema.optional(),
  usage: UsageSchema.optional(),
}).partial()

// D-05: meta fields all required
export const VocabSchema = z.object({
  meta: z.object({
    name: z.string(),
    ascii: z.string(),
    style: z.string(),
    color: z.string(),
  }),
  triggers: TriggersSchema.optional(),
  git_events: GitEventsSchema.optional(),
})

export type VocabData = z.infer<typeof VocabSchema>
