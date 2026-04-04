---
phase: 12-jest
plan: 02
subsystem: tests
tags: [jest, unit-tests, typescript, display, character, gitContext, trigger]
dependency_graph:
  requires: ["12-01"]
  provides: ["TEST-01"]
  affects: ["src/core/trigger.ts"]
tech_stack:
  added: []
  patterns:
    - jest.useFakeTimers() for deterministic time-dependent tests
    - fs.mkdtempSync fixture dir injection for character tests
    - jest.mock factory with util.promisify.custom for child_process mocking
    - rng injection (pick/pickDifferent accept () => number) for deterministic random tests
    - jest.spyOn(Math, 'random') with restoreMocks: true
key_files:
  created:
    - tests/display.test.ts
    - tests/character.test.ts
    - tests/gitContext.test.ts
    - tests/trigger.test.ts
  modified:
    - src/core/trigger.ts
decisions:
  - "jest.mock factory with util.promisify.custom: execFile uses Node's custom promisify symbol at module init; jest.mock auto-mock cannot intercept it — factory function needed to assign custom implementation at require time"
  - "last_repo must match makeGitCtx repo_path in dedup tests: per-repo isolation logic resets effectiveLastEvents when currentRepo !== state.last_repo; tests omitting last_repo triggered false resets"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-04"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 12 Plan 02: Unit Tests for Core Modules Summary

Jest TypeScript unit tests for all 4 core modules, migrating ~104 Python pytest tests to 133 passing Jest equivalents.

## One-liner

133 Jest tests across display/character/gitContext/trigger with promisify.custom mock pattern and rng injection for determinism.

## Tasks Completed

| Task | Name | Commit | Tests |
|------|------|--------|-------|
| 1 | display.test.ts + character.test.ts | 42f195f | 39 |
| 2 | gitContext.test.ts | c8eb663 | 15 |
| 3 | trigger.test.ts | 3e366ff | 79 |

**Total: 133 tests across 4 files**

## Verification

```
Tests:       133 passed, 133 total
Test Suites: 4 passed, 4 total
```

All files pass independently and together. No real git commands or real file I/O outside temp dirs. All time-dependent tests use `jest.useFakeTimers()`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed cacheExpired returning false for invalid date strings**
- **Found during:** Task 3 — `cacheExpired('not-a-date')` test failed
- **Issue:** `new Date('not-a-date')` does not throw — returns Invalid Date. `Date.now() - NaN = NaN`, and `NaN > 300` is `false`, causing cacheExpired to return `false` instead of `true` for invalid inputs.
- **Fix:** Added `if (isNaN(dt.getTime())) return true` guard before computing delta
- **Files modified:** `src/core/trigger.ts` (line 62)
- **Commit:** 3e366ff

**2. [Rule 3 - Blocking] promisify.custom strategy for child_process mock**
- **Found during:** Task 2 — standard `jest.mock('child_process')` approach failed
- **Issue:** `execFile` has `util.promisify.custom` symbol set. When `promisify(execFile)` runs at module init, it captures the custom implementation. Auto-mocking replaces `execFile` but does not transfer the custom symbol, so `promisify(execFile)` in `gitContext.ts` never calls the mock callback — Promises hang indefinitely.
- **Fix:** Used `jest.mock` factory function to create a custom `execFileMock` with `promisify.custom` pre-attached, pointing to a shared mutable `currentImpl` variable that tests can swap per test.
- **Files modified:** `tests/gitContext.test.ts`
- **Commit:** c8eb663

**3. [Rule 1 - Bug] per-repo isolation triggered false resets in dedup tests**
- **Found during:** Task 3 — `deduplicates first_commit_today`, `deduplicates milestone_5`, `deduplicates late_night_commit` failed
- **Issue:** `DEFAULT_STATE.last_repo` is `undefined`. `detectGitEvents` resets `effectiveLastEvents` when `currentRepo !== lastRepo`. Since `'/repo/a' !== undefined` is `true`, dedup tests using `makeState()` without `last_repo` triggered reset — last_git_events ignored.
- **Fix:** Added `last_repo: '/repo/a'` to state in affected dedup tests to match `makeGitCtx` default repo_path.
- **Files modified:** `tests/trigger.test.ts`
- **Commit:** 3e366ff

## Key Technical Patterns

### 1. util.promisify.custom mock
`gitContext.ts` runs `const execFileAsync = promisify(execFile)` at module init. Intercepting requires a `jest.mock` factory that pre-attaches `promisify.custom` to the mock function before any module imports it. A shared `currentImpl` variable lets each test configure async behavior without re-requiring the module.

### 2. rng injection for deterministic pick()
`pick(['a','b','c'], () => 0)` → `Math.floor(0 * 3) = 0` → `'a'`. Injecting `() => 0` eliminates all randomness. `pickDifferent` filters out last, then calls `pick` on filtered array — so `pickDifferent(['a','b'], 'a', () => 0)` → `pick(['b'], () => 0)` → `'b'`.

### 3. Fake timers for time-dependent tests
`jest.useFakeTimers()` + `jest.setSystemTime(new Date(...))` controls `new Date()`, `Date.now()`, making `getTimeSlot()`, `cacheExpired()`, `detectGitEvents()` (big_session, late_night_commit) fully deterministic.

## Known Stubs

None — all 4 test files fully implemented and passing.

## Self-Check: PASSED

Files exist:
- FOUND: tests/display.test.ts
- FOUND: tests/character.test.ts
- FOUND: tests/gitContext.test.ts
- FOUND: tests/trigger.test.ts

Commits exist:
- FOUND: 42f195f
- FOUND: c8eb663
- FOUND: 3e366ff
