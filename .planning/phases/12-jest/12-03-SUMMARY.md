---
phase: 12-jest
plan: "03"
subsystem: tests
tags: [jest, integration-tests, statusline, env-injection, child_process-mock]
dependency_graph:
  requires: ["12-01", "12-02"]
  provides: ["TEST-01"]
  affects: ["tests/statusline.test.ts", "src/statusline.ts"]
tech_stack:
  added: []
  patterns:
    - env-variable path injection (CODE_PAL_BASE_DIR, CODE_PAL_STATS_PATH)
    - jest.mock('child_process') factory with promisify.custom for git isolation
    - process.env = { ...originalEnv } replacement pattern with afterEach restore
    - fs.mkdtempSync temp dir fixtures with afterEach cleanup
    - local timezone date formatting in test helpers to match production loadStats()
key_files:
  created:
    - tests/statusline.test.ts
  modified:
    - src/statusline.ts
decisions:
  - "loadCharacter called with explicit vocabDir in statusline.ts: ts-jest sets __dirname to src/ not dist/, so path.join(__dirname, '../vocab') correctly resolves to project-root/vocab/ in both ts-jest and dist/ execution contexts"
  - "writeStats helper uses local timezone date: loadStats() uses getFullYear/getMonth/getDate (local), not toISOString().slice(0,10) (UTC); using UTC in test helper caused date mismatch in UTC+8 timezone"
metrics:
  duration: "5 minutes"
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 12 Plan 03: statusline Integration Tests Summary

**One-liner:** 22 statusline integration tests with env-injection, child_process mock, and temp dir fixtures; full suite reaches 155 tests, 85.11% line coverage, satisfying TEST-01.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create statusline.test.ts integration tests | 2b38ea4 | tests/statusline.test.ts, src/statusline.ts |
| 2 | Run full suite, verify 110+ tests and coverage >= 80% | (no code changes) | — |

## What Was Built

**Task 1: statusline.test.ts**

- Created `tests/statusline.test.ts` with 22 tests across 3 describe blocks
- `describe('renderMode')` — 7 tests: default fallback, message display, token count, unknown char fallback, no config fallback, 2-line output, no trailing newline
- `describe('updateMode')` — 9 tests: state creation, required fields, atomic write, empty stdin, invalid JSON stdin, token fallback from ccData, rate limit tier extraction, session_start write, session_start same-day preservation
- `describe('debugMode')` — 6 tests: 3 stderr lines, GIT_CONTEXT label, EVENTS_WOULD_FIRE label, STATE_SNAPSHOT label, JSON parseability, state.json creation
- Setup: `process.env = { ...originalEnv }` + `CODE_PAL_BASE_DIR` + `CODE_PAL_STATS_PATH` per test
- Teardown: `process.env = originalEnv` + `fs.rmSync(tmpDir, { recursive: true })` per test
- `jest.mock('child_process')` factory with `promisify.custom` for git isolation (same pattern as gitContext.test.ts)
- Helper functions: `writeConfig()`, `writeState()`, `writeStats()`, `readState()`

**Task 2: Full Suite Verification**

Final results:
```
Test Suites: 5 passed, 5 total
Tests:       155 passed, 155 total
Snapshots:   0 total
Time:        2.015 s
```

Coverage summary:
```
All files  | 83.73% Stmts | 69.71% Branch | 74.66% Funcs | 85.11% Lines
```

Build and typecheck both exit 0. TEST-01 requirement satisfied.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] loadCharacter path resolution broken in ts-jest environment**
- **Found during:** Task 1 verification — `renderMode()` returned hardcoded fallback; `updateMode/debugMode` silently returned without writing state
- **Issue:** `character.ts` resolves vocab dir as `path.join(__dirname, '../vocab')` where `__dirname` is the **source file's directory**. In ts-jest, `__dirname` for `src/core/character.ts` is `<project>/src/core/`, making vocab path `<project>/src/vocab/` (does not exist). `statusline.ts` was calling `loadCharacter(name)` without passing `vocabDir`, so character loading always failed in tests.
- **Fix:** Added explicit `vocabDir = path.join(__dirname, '../vocab')` in all 3 exported functions (renderMode, updateMode, debugMode) in `src/statusline.ts`. Since `statusline.ts`'s `__dirname` is `<project>/src/`, `path.join(__dirname, '../vocab')` = `<project>/vocab/` (correct in both ts-jest and dist/ scenarios).
- **Files modified:** `src/statusline.ts`
- **Commit:** 2b38ea4

**2. [Rule 1 - Bug] writeStats helper used UTC date, loadStats uses local timezone date**
- **Found during:** Task 1 — "with stats shows token count" test failed with `N/A tokens`
- **Issue:** `new Date().toISOString().slice(0, 10)` returns UTC date (e.g. `2026-04-03`), but `loadStats()` computes today using `d.getFullYear()/d.getMonth()/d.getDate()` (local timezone). In UTC+8 at midnight, the UTC date is one day behind local date, causing no match in the `dailyModelTokens` array.
- **Fix:** Changed `writeStats` helper to use local timezone date formatting matching `loadStats()`: `d.getFullYear() + '-' + padStart(month) + '-' + padStart(day)`.
- **Files modified:** `tests/statusline.test.ts`
- **Commit:** 2b38ea4 (same commit)

## Known Stubs

None — all tests fully implemented and passing. No placeholder assertions.

## Self-Check: PASSED
