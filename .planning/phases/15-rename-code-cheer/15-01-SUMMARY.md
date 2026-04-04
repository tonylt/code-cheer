---
phase: 15-rename-code-cheer
plan: 01
subsystem: rename
tags: [rename, code-cheer, env-vars, docs]
dependency_graph:
  requires: []
  provides: [code-cheer-runtime-paths, code-cheer-package-name, code-cheer-env-vars]
  affects: [scripts/install.js, scripts/uninstall.js, src/statusline.ts, src/schemas, tests, docs]
tech_stack:
  added: []
  patterns: [global-find-replace, env-var-rename]
key_files:
  created: []
  modified:
    - scripts/install.js
    - scripts/uninstall.js
    - src/statusline.ts
    - src/schemas/state.ts
    - src/schemas/config.ts
    - src/schemas/vocab.ts
    - commands/cheer.md
    - install.sh
    - package.json
    - package-lock.json
    - tests/statusline.test.ts
    - tests/install.test.ts
    - CLAUDE.md
    - README.md
    - README.zh.md
    - CHANGELOG.md
    - .planning/PROJECT.md
    - .planning/STATE.md
    - .planning/ROADMAP.md
decisions:
  - "Hook wiring example in CLAUDE.md updated to Node.js path (node ~/.claude/code-cheer/dist/statusline.js) instead of Python legacy"
  - "install.test.ts statusline.py upgrade test paths kept as code-pal (correct: test verifies Python → Node migration)"
  - "CHANGELOG.md header updated to code-cheer (formerly code-pal)"
metrics:
  duration: 12min
  completed_date: "2026-04-04T09:11:03Z"
  tasks_completed: 2
  files_modified: 19
requirements_satisfied: [D-01, D-03, D-04, D-07, D-08, D-09]
---

# Phase 15 Plan 01: Rename code-pal → code-cheer Summary

Systematic rename of all code-pal references to code-cheer: runtime paths, env vars, error prefixes, package name, test assertions, and all documentation.

## Tasks Completed

| # | Task | Commit | Status |
|---|------|--------|--------|
| 1 | Rename all functional code paths (7 source files + 3 schema files) | e164c98 | Done |
| 2 | Update test assertions + documentation (9 files) | fc5c67a | Done |

## Verification Results

- `npm run typecheck` exits 0
- `npm test` exits 0 — 344/344 tests pass (was 167, grew with this codebase)
- `grep -rn "CODE_PAL" src/ tests/ scripts/` returns 0 results
- `grep -rn "code-pal" src/ scripts/ | grep -v "legacy|deprecated|statusline.py|upgrade"` returns 0
- `node -e "console.log(require('./package.json').name)"` outputs `code-cheer`

## Changes by File

### Runtime Code

**scripts/install.js** — INSTALL_DIR `~/.claude/code-cheer`, error prefix `[code-cheer]`, log messages updated

**scripts/uninstall.js** — INSTALL_DIR `~/.claude/code-cheer`, error prefix `[code-cheer]`, log message updated

**src/statusline.ts** — `CODE_CHEER_BASE_DIR` (was `CODE_PAL_BASE_DIR`), `CODE_CHEER_STATS_PATH` (was `CODE_PAL_STATS_PATH`), default path `~/.claude/code-cheer`, error prefix `[code-cheer]`

**src/schemas/state.ts, config.ts, vocab.ts** — all `[code-pal]` stderr prefixes → `[code-cheer]`

**commands/cheer.md** — title + all path references → code-cheer

**install.sh** — INSTALL_DIR, backup paths, log messages → code-cheer

**package.json + package-lock.json** — `"name": "code-cheer"`

### Tests

**tests/statusline.test.ts** — `CODE_CHEER_BASE_DIR`, `CODE_CHEER_STATS_PATH`, `code-cheer-test-` tmpdir prefix

**tests/install.test.ts** — `statusline.js` paths → `code-cheer` (upgrade/cleanup `statusline.py` paths kept as `code-pal` — correct behavior, those tests verify Python migration)

### Documentation

**CLAUDE.md** — project name, install path, hook wiring JSON example → Node.js `code-cheer` path

**README.md + README.zh.md** — all paths, clone URL, migration note added, troubleshooting updated

**CHANGELOG.md** — v3.1.0 entry: "Renamed project from code-pal to code-cheer"

**.planning/PROJECT.md, STATE.md, ROADMAP.md** — titles and paths → code-cheer

## Deviations from Plan

### Minor Adjustments

**1. [Rule 1 - Auto-fix] Hook wiring example updated to Node.js path**
- **Found during:** Task 2, CLAUDE.md edit
- **Issue:** Plan said "update to Node.js path OR keep as historical example" — the file had a mixed state (statusLine was code-pal Python, Stop hook was accidentally code-cheer Python)
- **Fix:** Updated both entries to Node.js `node ~/.claude/code-cheer/dist/statusline.js` format — accurate for v3.0+ installs
- **Files modified:** CLAUDE.md
- **Commit:** fc5c67a

**2. CHANGELOG.md header updated**
- Plan said update if project name appears in header — it did, updated `All notable changes to code-pal` → `...to code-cheer (formerly code-pal)`

None of these deviate from the plan's intent. Plan executed as written.

## Known Stubs

None — all changes are direct renames of existing functional code. No stubs introduced.

## Self-Check: PASSED
