import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { loadWeatherCache } from '../src/core/weather'

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
})
