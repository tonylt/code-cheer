export const CHARACTER_NAMES = ['nova', 'luna', 'mochi', 'iris', 'leijun'] as const

export type ConfigType = {
  character: typeof CHARACTER_NAMES[number]
  version?: string
  language?: 'zh' | 'en'
}

export function parseConfig(raw: unknown, label: string): ConfigType {
  if (!raw || typeof raw !== 'object') {
    process.stderr.write(`[code-cheer] ${label} schema validation failed:\n✖ Invalid input: expected object, received undefined\n  → at meta\n`)
    throw new Error(`Invalid ${label}: expected object`)
  }
  const obj = raw as Record<string, unknown>
  if (!CHARACTER_NAMES.includes(obj.character as typeof CHARACTER_NAMES[number])) {
    process.stderr.write(
      `[code-cheer] ${label} schema validation failed:\n✖ Invalid option: expected one of "${CHARACTER_NAMES.join('"|"')}"\n  → at character\n`
    )
    throw new Error(`Invalid ${label}: bad character value`)
  }
  const version = typeof obj.version === 'string' ? obj.version : undefined
  const language = obj.language === 'en' ? 'en' : obj.language === 'zh' ? 'zh' : undefined
  return {
    character: obj.character as ConfigType['character'],
    ...(version !== undefined && { version }),
    ...(language !== undefined && { language }),
  }
}
