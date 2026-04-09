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

export function loadWeatherCache(baseDir: string): WeatherData | null {
  const cachePath = path.join(baseDir, CACHE_FILENAME)
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8')
    const data = JSON.parse(raw) as WeatherData
    const nowSecs = Math.floor(Date.now() / 1000)
    if (nowSecs - data.fetchedAt >= WEATHER_TTL_SECS) return null
    if (typeof data.tempC !== 'number' || typeof data.icon !== 'string') return null
    return data
  } catch {
    return null
  }
}
