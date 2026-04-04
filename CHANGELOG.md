# Changelog

All notable changes to code-cheer (formerly code-pal) are documented here.

## [3.1.0] - 2026-04-04

### Added

- **English vocab support**: set `"language": "en"` in `~/.claude/code-cheer/config.json` to switch all characters to English messages. English vocab files (`.en.json`) added for all 5 characters; falls back to Chinese if English file is missing
- **Locale auto-detection**: when `language` is not set in `config.json`, the `LANG` environment variable is used to infer the language — `zh_*` → Chinese, any other non-empty value → English, unset → default (Chinese)
- **MIT License**: project is now open-source under MIT
- **CONTRIBUTING.md**: 5-step guide for adding new characters (vocab JSON → config.ts → build → cheer.md → tests)
- **CONTRIBUTING.md — Adding a new language**: step-by-step guide for adding translations (file naming, key parity, registering a new language code, updating READMEs)
- **Invalid language warning**: `config.json` with an unrecognised `language` value (e.g. `"french"`) now prints a `[code-cheer]` warning to stderr instead of silently ignoring it
- **Vocab drift tests**: CI catches key-structure mismatches between `*.json` (Chinese) and `*.en.json` (English) vocab files for all 5 characters
- **GitHub issue templates**: `bug_report.yml` and `new_character.yml` for structured community contributions
- **TUI width protection**: message truncates at 40 chars, model name and cwd truncate at 20 chars to stay within ~80-column terminals
- **Progress bar color tiers**: context window bar turns yellow (`≥80%`) and bright red (`≥95%`) to match the vocab warning/critical tiers

### Changed

- **Project renamed**: code-pal → code-cheer. Installation directory changes from `~/.claude/code-pal/` to `~/.claude/code-cheer/`
- **Environment variables renamed**: `CODE_PAL_BASE_DIR` → `CODE_CHEER_BASE_DIR`, `CODE_PAL_STATS_PATH` → `CODE_CHEER_STATS_PATH`
- **Error log prefix**: all stderr messages now use `[code-cheer]` prefix
- **package.json name**: `code-pal` → `code-cheer`
- **Iris character color**: changed from ANSI 97 (bright white, invisible on light terminals) to 90 (dark gray, visible on both light and dark terminal themes)
- **Python CI job** renamed to `test (legacy)` to clarify deprecation status
- **README**: moved the "reactive, not decorative" rationale before feature bullets for clearer first-impression messaging

### Fixed

- Progress bar percentage now displays as integer (`Math.floor`) matching the bar fill level (was: raw float)

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

- `uninstall.js` now removes the entire `~/.claude/code-cheer/` directory (previously only removed `dist/`), ensuring CI smoke test passes
- `install.js` copies `package.json` to install directory as required by CI smoke test
- `unsetup` script removes the Python legacy `statusLine` entry from `settings.json`
- `patchSettings` atomic write uses `writeFileSync(tmp) + renameSync` to prevent half-written settings on crash
- `last_git_events` now resets on new day (was: only reset on repo change), so `first_commit_today` and milestone events fire correctly every day
- `ctxPct` NaN guard in `display.ts` prevents `RangeError` crash when `used_percentage` is non-numeric
- `install.js` `spawnSync` null status check (`|| .error`) correctly detects spawn failures (was: `status: null` passed silently)
- `loadConfig` catch block now logs all non-ENOENT errors to stderr (was: only `SyntaxError`), so Zod validation errors surface to users
- `applyTokenFallback` extracted as shared helper; `runUpdateCore` eliminates ~70 lines of duplication between `updateMode` and `debugMode`
- `parseState` returns `DEFAULT_STATE` for non-object inputs instead of throwing
