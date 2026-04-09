import * as fs from 'fs'
import * as path from 'path'

const WEATHER_TTL_SECS = 30 * 60
const CACHE_FILENAME = 'weather-cache.json'

export interface WeatherData {
  city: string
  tempC: number
  icon: string
  fetchedAt: number
}

/**
 * Load weather from cache file. Returns null if missing, stale (>= 30 min), or malformed.
 */
export function loadWeatherCache(baseDir: string): WeatherData | null {
  const cachePath = path.join(baseDir, CACHE_FILENAME)
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8')
    const data = JSON.parse(raw) as WeatherData
    const nowSecs = Math.floor(Date.now() / 1000)
    if (typeof data.fetchedAt !== 'number' || !Number.isFinite(data.fetchedAt)) return null
    if (nowSecs - data.fetchedAt >= WEATHER_TTL_SECS) return null
    if (typeof data.city !== 'string' || typeof data.tempC !== 'number' || typeof data.icon !== 'string') return null
    return data
  } catch {
    return null
  }
}

const CODE_MAP: [number[], string][] = [
  [[113], '☀️'],
  [[116], '⛅'],
  [[119, 122], '☁️'],
  [[176, 263, 266, 293, 296, 299, 302], '🌦'],
  [[305, 308, 311, 314], '🌧'],
  [[317, 320, 323, 326, 329, 332, 335], '🌨'],
  [[338, 395], '❄️'],
  [[200, 386, 389, 392], '⛈'],
]

export function weatherCodeToEmoji(code: number): string {
  for (const [codes, emoji] of CODE_MAP) {
    if (codes.includes(code)) return emoji
  }
  return '🌡'
}
