import * as fs from 'fs'
import * as https from 'https'
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
    if (typeof data.city !== 'string' || typeof data.tempC !== 'number' || !Number.isFinite(data.tempC) || typeof data.icon !== 'string') return null
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

type Fetcher = (url: string) => Promise<string>

function httpsGet(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 3000 }, (res) => {
      let data = ''
      res.setEncoding('utf-8')
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')) })
  })
}

/**
 * Fetch weather from wttr.in and write to cache. Silent on any error.
 * City resolution: use provided city, otherwise fall back to IP geolocation via ipapi.co.
 * Uses atomic write (tmp + rename) to prevent partial reads.
 */
export async function fetchAndCacheWeather(
  baseDir: string,
  city?: string,
  _fetch: Fetcher = httpsGet
): Promise<void> {
  try {
    let resolvedCity = city
    if (!resolvedCity) {
      const ipJson = JSON.parse(await _fetch('https://ipapi.co/json/')) as Record<string, unknown>
      resolvedCity = typeof ipJson['city'] === 'string' ? ipJson['city'] : 'Unknown'
    }

    const wttrJson = JSON.parse(
      await _fetch(`https://wttr.in/${encodeURIComponent(resolvedCity)}?format=j1`)
    ) as Record<string, unknown>

    const cond = (wttrJson['current_condition'] as Record<string, unknown>[])[0]
    const tempC = parseInt(String(cond['temp_C']), 10)
    const icon = weatherCodeToEmoji(parseInt(String(cond['weatherCode']), 10))

    const data: WeatherData = {
      city: resolvedCity,
      tempC,
      icon,
      fetchedAt: Math.floor(Date.now() / 1000),
    }

    const cachePath = path.join(baseDir, CACHE_FILENAME)
    const tmp = cachePath + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(data), 'utf-8')
    fs.renameSync(tmp, cachePath)
  } catch {
    // silent — weather block simply absent from statusline
  }
}
