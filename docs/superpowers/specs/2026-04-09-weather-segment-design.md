# Weather Segment Design

**Date:** 2026-04-09  
**Status:** Approved

## Summary

Add a weather block to the statusline line 2 showing current temperature and a weather emoji. Weather data is fetched from wttr.in (free, no API key), cached locally for 30 minutes, and refreshed in `updateMode` so `renderMode` stays fast (~40ms).

---

## Data Layer — `src/core/weather.ts`

### City resolution

1. If `config.city` is set, use it directly.
2. Otherwise, `GET https://ipapi.co/json/` and read the `city` field (IP geolocation, city-level precision).

### Fetching

```
GET https://wttr.in/{city}?format=j1
```

Parse from response:
- `current_condition[0].temp_C` → temperature (integer, °C)
- `current_condition[0].weatherCode` → mapped to emoji (see table below)

### Cache file

```
~/.claude/code-cheer/weather-cache.json
```

Shape:
```ts
{
  city: string
  tempC: number
  icon: string
  fetchedAt: number  // Unix timestamp seconds
}
```

TTL: 30 minutes (hardcoded). Future: `config.weatherTtlMins` override.

### Public API

```ts
export async function fetchAndCacheWeather(baseDir: string, city?: string): Promise<void>
export function loadWeatherCache(baseDir: string): WeatherData | null
```

- `fetchAndCacheWeather` — called from `updateMode`. Resolves city, fetches wttr.in, writes cache. Silent on network failure (never throws).
- `loadWeatherCache` — called from `renderMode`. Reads cache file only, no network. Returns `null` if file missing or stale.

---

## Integration Points

### updateMode (`src/statusline.ts`)

In `runUpdateCore`, after git context is gathered, add weather fetch in parallel:

```ts
await Promise.allSettled([
  loadGitContext(),
  fetchAndCacheWeather(baseDir, config.city),
])
```

### renderMode (`src/statusline.ts`)

When assembling `stats`:

```ts
const weather = loadWeatherCache(baseDir)
stats['weather'] = weather ?? null
```

### display.ts

New palette entry:
```ts
weather: { bg: 60, fg: 255 }  // slate
```

New segment builder:
```ts
function buildWeatherBlock(stats: Record<string, unknown>): string | null
```

Returns `null` if `stats['weather']` is null. Otherwise renders `⛅ 18°C`.

**Position:** rightmost — after `mem` block.

---

## weatherCode → Emoji Mapping

| Code(s) | Condition | Emoji |
|---------|-----------|-------|
| 113 | Clear/Sunny | ☀️ |
| 116 | Partly cloudy | ⛅ |
| 119, 122 | Cloudy/Overcast | ☁️ |
| 176, 263, 266, 293–302 | Light rain/Drizzle | 🌦 |
| 305–314 | Moderate/Heavy rain | 🌧 |
| 317–335 | Sleet/Snow | 🌨 |
| 338, 395 | Heavy snow | ❄️ |
| 200, 386, 389, 392 | Thunderstorm | ⛈ |
| (other) | Unknown | 🌡 |

---

## Config Schema Extension

`config.json` gains two optional fields:

```ts
city?: string          // e.g. "Beijing" — overrides IP geolocation
weatherTtlMins?: number  // reserved for future use, not implemented in v1
```

---

## Error Handling

- Network failures (fetch, IP lookup): log to stderr, return null — weather block simply absent from statusline
- Malformed wttr.in response: return null
- Missing/corrupt cache: return null
- All errors are silent from user's perspective; statusline renders without weather block

---

## Testing

- Unit tests in `tests/weather.test.ts`
- `loadWeatherCache`: returns null for missing file, returns null for stale cache (>30min), returns data for fresh cache
- `buildWeatherBlock` in display tests: absent when `stats.weather` null, renders `icon tempC°C` when present
- weatherCode mapping: spot-check a few codes
- No real network calls in tests — mock `https.get`
