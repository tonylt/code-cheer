import { z } from 'zod'

export const CHARACTER_NAMES = ['nova', 'luna', 'mochi', 'iris', 'leijun'] as const

export const ConfigSchema = z.object({
  character: z.enum(CHARACTER_NAMES),
})

export type ConfigType = z.infer<typeof ConfigSchema>
