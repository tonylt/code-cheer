# Changelog

All notable changes to code-pal are documented here.

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
