import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { loadWeatherCache, weatherCodeToEmoji } from '../src/core/weather'

describe('loadWeatherCache', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weather-test-'))
  })
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('returns null when cache file does not exist', () => {
    expect(loadWeatherCache(tmpDir)).toBeNull()
  })

  it('returns data when cache is fresh (< 30 min)', () => {
    const data = {
      city: 'Beijing',
      tempC: 18,
      icon: '⛅',
      fetchedAt: Math.floor(Date.now() / 1000) - 5 * 60,
    }
    fs.writeFileSync(path.join(tmpDir, 'weather-cache.json'), JSON.stringify(data))
    const result = loadWeatherCache(tmpDir)
    expect(result).not.toBeNull()
    expect(result!.city).toBe('Beijing')
    expect(result!.tempC).toBe(18)
    expect(result!.icon).toBe('⛅')
  })

  it('returns null when cache is stale (>= 30 min)', () => {
    const data = {
      city: 'Beijing',
      tempC: 18,
      icon: '⛅',
      fetchedAt: Math.floor(Date.now() / 1000) - 31 * 60,
    }
    fs.writeFileSync(path.join(tmpDir, 'weather-cache.json'), JSON.stringify(data))
    expect(loadWeatherCache(tmpDir)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'weather-cache.json'), 'not-json')
    expect(loadWeatherCache(tmpDir)).toBeNull()
  })

  it('returns null when fetchedAt is not a number', () => {
    const data = { city: 'Beijing', tempC: 18, icon: '⛅', fetchedAt: null }
    fs.writeFileSync(path.join(tmpDir, 'weather-cache.json'), JSON.stringify(data))
    expect(loadWeatherCache(tmpDir)).toBeNull()
  })

  it('returns null when required fields are missing', () => {
    fs.writeFileSync(path.join(tmpDir, 'weather-cache.json'), JSON.stringify({}))
    expect(loadWeatherCache(tmpDir)).toBeNull()
  })
})

describe('weatherCodeToEmoji', () => {
  it('113 → ☀️', () => expect(weatherCodeToEmoji(113)).toBe('☀️'))
  it('116 → ⛅', () => expect(weatherCodeToEmoji(116)).toBe('⛅'))
  it('119 → ☁️', () => expect(weatherCodeToEmoji(119)).toBe('☁️'))
  it('122 → ☁️', () => expect(weatherCodeToEmoji(122)).toBe('☁️'))
  it('176 → 🌦', () => expect(weatherCodeToEmoji(176)).toBe('🌦'))
  it('305 → 🌧', () => expect(weatherCodeToEmoji(305)).toBe('🌧'))
  it('320 → 🌨', () => expect(weatherCodeToEmoji(320)).toBe('🌨'))
  it('338 → ❄️', () => expect(weatherCodeToEmoji(338)).toBe('❄️'))
  it('200 → ⛈', () => expect(weatherCodeToEmoji(200)).toBe('⛈'))
  it('999 (unknown) → 🌡', () => expect(weatherCodeToEmoji(999)).toBe('🌡'))
})
