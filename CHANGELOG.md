# Changelog

All notable changes to code-pal are documented here.

## [3.0.1] - 2026-04-04

### Added

- **Config version field**: `config.json` now includes a `version` field written on install and `/cheer` switch, enabling future upgrade detection (T2)
- **Commit stats in `/cheer`**: switching characters now shows today's commit count from `state.json` (3 tiers: 1-3 / 4-9 / ≥10 commits)

### Changed

- **Leijun vocab rewrite**: `leijun.json` fully rewritten to match authentic 2024-2025 Lei Jun speech patterns — 142× 同学们, 42× 说真的, 5× Are U OK, 0× banned phrases (遥遥领先/行业第一/etc.)

### Fixed

- `/cheer` reads `state.json` before resetting it — commits_today was always 0 because state was cleared before the Read
- Leijun reply text in `/cheer` updated from "朋友们" to "同学们" to match rewritten vocab style
- Removed 22 banned phrases (遥遥领先, 行业第一, 行业最强, 没有之一) from leijun.json

## [3.0.0] - 2026-04-04

### Added

- **TypeScript core modules**: ported all Python core modules to TypeScript (`character.ts`, `display.ts`, `gitContext.ts`, `trigger.ts`)
- **Single-file entrypoint**: `src/statusline.ts` with three exported modes (`renderMode`, `updateMode`, `debugMode`) for statusline rendering, Stop hook updates, and debug output
- **Jest test suite**: 167 tests across 6 test files covering all core modules and the statusline entrypoint; 83% statement coverage
- **Install/uninstall scripts**: `scripts/install.js` and `scripts/uninstall.js` replace `install.sh`, wiring the Node.js statusline into `~/.claude/settings.json` non-destructively
- **Zod config validation**: `loadConfig()` validates `config.json` at runtime using Zod schemas, with readable error messages on invalid character names
- **Leijun character**: new `vocab/leijun.json` character with 雷军-style encouragements; accessible via `/cheer`
- **CI Node.js smoke test**: GitHub Actions `test-node` job installs, runs, and uninstalls the TypeScript build on Node.js 20 and 22

### Changed

- `renderMode` reads model and token data from Claude Code's stdin JSON payload instead of parsing transcript files
- `display.ts` renders the raw model string without stripping prefixes
- Token display falls back to `context_window` when `tokens_remaining` is unavailable
- All Python source files annotated `@deprecated` — Python entrypoint remains functional until Node.js path is validated in production

### Fixed

- `uninstall.js` now removes the entire `~/.claude/code-pal/` directory (previously only removed `dist/`), ensuring CI smoke test passes
- `install.js` copies `package.json` to install directory as required by CI smoke test
- `unsetup` script removes the Python legacy `statusLine` entry from `settings.json`
- `patchSettings` atomic write uses `writeFileSync(tmp) + renameSync` to prevent half-written settings on crash
- `last_git_events` now resets on new day (was: only reset on repo change), so `first_commit_today` and milestone events fire correctly every day
- `ctxPct` NaN guard in `display.ts` prevents `RangeError` crash when `used_percentage` is non-numeric
- `install.js` `spawnSync` null status check (`|| .error`) correctly detects spawn failures (was: `status: null` passed silently)
- `loadConfig` catch block now logs all non-ENOENT errors to stderr (was: only `SyntaxError`), so Zod validation errors surface to users
- `applyTokenFallback` extracted as shared helper; `runUpdateCore` eliminates ~70 lines of duplication between `updateMode` and `debugMode`
- `parseState` returns `DEFAULT_STATE` for non-object inputs instead of throwing
