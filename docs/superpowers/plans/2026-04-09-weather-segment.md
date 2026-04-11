# Weather Segment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `⛅ 18°C` weather block (rightmost) to statusline line 2, fetched from wttr.in with a 30-minute file cache.

**Architecture:** New `src/core/weather.ts` handles fetch + cache. `updateMode` calls `fetchAndCacheWeather` in parallel with `loadGitContext`. `renderMode` calls `loadWeatherCache` (sync, no network). `display.ts` reads `stats['weather']` and renders the block with bg 60 (slate).

**Tech Stack:** Node.js built-in `https`, wttr.in JSON API (`?format=j1`), ipapi.co for IP-based city resolution.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/core/weather.ts` | Create | WeatherData type, cache read/write, wttr.in fetch, city resolution |
| `tests/weather.test.ts` | Create | Unit tests for weather module |
| `src/schemas/config.ts` | Modify | Add optional `city` field to ConfigType |
| `src/statusline.ts` | Modify | Wire fetchAndCacheWeather into updateMode, loadWeatherCache into renderMode |
| `src/core/display.ts` | Modify | Add weather palette entry, buildWeatherBlock, insert into render() |
| `tests/display.test.ts` | Modify | Add weather block display tests |

---

### Task 1: WeatherData type + loadWeatherCache

**Files:**
- Create: `src/core/weather.ts`
- Create: `tests/weather.test.ts`

- [ ] **Step 1: Write failing tests for loadWeatherCache**

Create `tests/weather.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=weather
```
Expected: FAIL — "Cannot find module '../src/core/weather'"

- [ ] **Step 3: Create `src/core/weather.ts`**

```ts
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
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern=weather
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/weather.ts tests/weather.test.ts
git commit -m "feat(weather): WeatherData type + loadWeatherCache"
```

---

### Task 2: weatherCode → emoji mapping

**Files:**
- Modify: `src/core/weather.ts`
- Modify: `tests/weather.test.ts`

- [ ] **Step 1: Add failing tests — append to `tests/weather.test.ts`**

```ts
import { weatherCodeToEmoji } from '../src/core/weather'

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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=weather
```
Expected: FAIL — "weatherCodeToEmoji is not a function"

- [ ] **Step 3: Add weatherCodeToEmoji to `src/core/weather.ts`**

Append after `loadWeatherCache`:

```ts
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
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern=weather
```
Expected: PASS (14 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/weather.ts tests/weather.test.ts
git commit -m "feat(weather): weatherCode to emoji mapping"
```

---

### Task 3: fetchAndCacheWeather

**Files:**
- Modify: `src/core/weather.ts`
- Modify: `tests/weather.test.ts`

- [ ] **Step 1: Add failing tests — append to `tests/weather.test.ts`**

```ts
import { fetchAndCacheWeather } from '../src/core/weather'

describe('fetchAndCacheWeather', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weather-fetch-'))
  })
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true })
  })

  it('writes cache with correct shape when city provided', async () => {
    const mockFetch = async (url: string) => {
      if (url.includes('ipapi')) return JSON.stringify({ city: 'Shanghai' })
      return JSON.stringify({
        current_condition: [{ temp_C: '22', weatherCode: '113' }],
      })
    }
    await fetchAndCacheWeather(tmpDir, 'Beijing', mockFetch)
    const result = loadWeatherCache(tmpDir)
    expect(result).not.toBeNull()
    expect(result!.city).toBe('Beijing')
    expect(result!.tempC).toBe(22)
    expect(result!.icon).toBe('☀️')
  })

  it('falls back to IP geolocation when no city provided', async () => {
    const mockFetch = async (url: string) => {
      if (url.includes('ipapi')) return JSON.stringify({ city: 'Shanghai' })
      return JSON.stringify({
        current_condition: [{ temp_C: '25', weatherCode: '116' }],
      })
    }
    await fetchAndCacheWeather(tmpDir, undefined, mockFetch)
    const result = loadWeatherCache(tmpDir)
    expect(result!.city).toBe('Shanghai')
    expect(result!.icon).toBe('⛅')
  })

  it('does not throw when fetcher fails', async () => {
    const mockFetch = async (_url: string): Promise<string> => { throw new Error('network error') }
    await expect(fetchAndCacheWeather(tmpDir, 'Tokyo', mockFetch)).resolves.not.toThrow()
  })

  it('does not write cache on network failure', async () => {
    const mockFetch = async (_url: string): Promise<string> => { throw new Error('network error') }
    await fetchAndCacheWeather(tmpDir, 'Tokyo', mockFetch)
    expect(loadWeatherCache(tmpDir)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- --testPathPattern=weather
```
Expected: FAIL — "fetchAndCacheWeather is not a function"

- [ ] **Step 3: Add fetchAndCacheWeather to `src/core/weather.ts`**

Add `import * as https from 'https'` at the top of the file (after existing imports).

Append to end of file:

```ts
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
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- --testPathPattern=weather
```
Expected: PASS (18 tests)

- [ ] **Step 5: Commit**

```bash
git add src/core/weather.ts tests/weather.test.ts
git commit -m "feat(weather): fetchAndCacheWeather with injectable fetcher"
```

---

### Task 4: Extend ConfigType with city

**Files:**
- Modify: `src/schemas/config.ts`

- [ ] **Step 1: Add `city` to ConfigType**

In `src/schemas/config.ts`, update the type:

```ts
export type ConfigType = {
  character: typeof CHARACTER_NAMES[number]
  version?: string
  language?: 'zh' | 'en'
  city?: string
}
```

- [ ] **Step 2: Add city parsing to parseConfig**

In `parseConfig`, add after the `language` resolution line and before the `return` statement:

```ts
const city = typeof obj.city === 'string' && obj.city.trim() !== '' ? obj.city.trim() : undefined
```

Update the return object to include city:

```ts
return {
  character: obj.character as ConfigType['character'],
  ...(version !== undefined && { version }),
  ...(language !== undefined && { language }),
  ...(city !== undefined && { city }),
}
```

- [ ] **Step 3: Run all tests to confirm no regressions**

```bash
npm test
```
Expected: all existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/schemas/config.ts
git commit -m "feat(config): add optional city field for weather"
```

---

### Task 5: Wire weather into statusline.ts

**Files:**
- Modify: `src/statusline.ts`

- [ ] **Step 1: Add weather imports at top of `src/statusline.ts`**

After the existing imports, add:

```ts
import { fetchAndCacheWeather, loadWeatherCache } from './core/weather'
```

- [ ] **Step 2: Run weather fetch in parallel with loadGitContext in runUpdateCore**

In `runUpdateCore` (around line 274), replace:

```ts
const gitContext = await loadGitContext(process.cwd())
```

with:

```ts
const [gitSettled] = await Promise.allSettled([
  loadGitContext(process.cwd()),
  fetchAndCacheWeather(baseDir, config.city),
])
const gitContext = gitSettled.status === 'fulfilled'
  ? gitSettled.value
  : { repo_path: null, commits_today: 0, diff_lines: 0, last_git_events: [], branch: null } as GitContextResult
```

- [ ] **Step 3: Inject weather into stats in renderMode**

In `renderMode` (around line 392), update the destructure on line 393:

```ts
const { baseDir, configPath, statePath, statsPath } = resolvePaths(env)
```

Then after `stats['cwd_name'] = path.basename(process.cwd())` (line 398), add:

```ts
const weather = loadWeatherCache(baseDir)
stats['weather'] = weather ?? null
```

- [ ] **Step 4: Run all tests to confirm no regressions**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/statusline.ts
git commit -m "feat(weather): wire fetch into updateMode, cache read into renderMode"
```

---

### Task 6: Weather block in display.ts

**Files:**
- Modify: `src/core/display.ts`
- Modify: `tests/display.test.ts`

- [ ] **Step 1: Add failing display tests — append to `tests/display.test.ts`**

```ts
// ─── weather block ────────────────────────────────────────────────────────────

describe('weather block', () => {
  it('renders icon and temperature when stats.weather is provided', () => {
    const output = render(CHAR, 'msg', {}, {
      weather: { city: 'Beijing', tempC: 18, icon: '⛅', fetchedAt: Math.floor(Date.now() / 1000) }
    })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('⛅ 18°C')
  })

  it('weather block uses bg 60 (slate)', () => {
    const output = render(CHAR, 'msg', {}, {
      weather: { city: 'Beijing', tempC: 18, icon: '⛅', fetchedAt: Math.floor(Date.now() / 1000) }
    })
    const line2 = output.split('\n')[1]
    expect(line2).toContain('\x1b[48;5;60m')
  })

  it('omits weather block when stats.weather is null', () => {
    const output = render(CHAR, 'msg', {}, { weather: null })
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('°C')
  })

  it('omits weather block when stats.weather is absent', () => {
    const output = render(CHAR, 'msg', {}, {})
    const line2 = output.split('\n')[1]
    expect(line2).not.toContain('°C')
  })

  it('weather block appears after mem block', () => {
    const output = render(CHAR, 'msg', {}, {
      memory_count: 3,
      weather: { city: 'Beijing', tempC: 22, icon: '☀️', fetchedAt: Math.floor(Date.now() / 1000) }
    })
    const line2 = output.split('\n')[1]
    const memIdx = line2.indexOf('3 mem')
    const weatherIdx = line2.indexOf('22°C')
    expect(memIdx).toBeGreaterThan(-1)
    expect(weatherIdx).toBeGreaterThan(memIdx)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=display
```
Expected: FAIL — weather tests fail

- [ ] **Step 3: Add weather palette entry to PALETTE in `src/core/display.ts`**

In the `PALETTE` object, add after `mem`:

```ts
weather: { bg: 60, fg: 255 } as PlainPalette,
```

- [ ] **Step 4: Add buildWeatherBlock after buildCtxBlock in `src/core/display.ts`**

```ts
function buildWeatherBlock(stats: Record<string, unknown>): string | null {
  const w = stats['weather']
  if (w === null || w === undefined || typeof w !== 'object') return null
  const weather = w as Record<string, unknown>
  const tempC = weather['tempC']
  const icon = weather['icon']
  if (typeof tempC !== 'number' || typeof icon !== 'string') return null
  return block(`${icon} ${tempC}°C`, PALETTE.weather)
}
```

- [ ] **Step 5: Add weather segment to render() in `src/core/display.ts`**

In `render()`, after the mem block section:

```ts
  if (memoryCount !== undefined && memoryCount > 0) {
    parts.push(block(`${memoryCount} mem`, PALETTE.mem))
  }

  const weatherSeg = buildWeatherBlock(stats)
  if (weatherSeg !== null) parts.push(weatherSeg)
```

- [ ] **Step 6: Run all tests to confirm they pass**

```bash
npm test
```
Expected: all tests pass (5 new weather display tests)

- [ ] **Step 7: Commit**

```bash
git add src/core/display.ts tests/display.test.ts
git commit -m "feat(display): weather block — slate bg 60, rightmost position"
```

---

### Task 7: Build, install, smoke test

- [ ] **Step 1: Full test run + typecheck**

```bash
npm test && npm run typecheck
```
Expected: all tests pass, zero type errors

- [ ] **Step 2: Build**

```bash
npm run build
```
Expected: `dist/statusline.js  ~35kb  ⚡ Done in ~10ms`

- [ ] **Step 3: Reinstall**

```bash
npm run setup
```

- [ ] **Step 4: Smoke test with no cache (weather block absent)**

```bash
echo '{}' | node dist/statusline.js
```
Expected: 2-line output, no `°C` — cache not yet populated

- [ ] **Step 5: Populate cache via updateMode**

```bash
echo '{}' | node dist/statusline.js --update && cat ~/.claude/code-cheer/weather-cache.json
```
Expected: JSON file with `city`, `tempC`, `icon`, `fetchedAt`

- [ ] **Step 6: Confirm weather block renders**

```bash
echo '{}' | node dist/statusline.js
```
Expected: line 2 ends with weather emoji + temperature, e.g. `⛅ 18°C`
