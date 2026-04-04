---
phase: 10-core
plan: 02
subsystem: core
tags: [typescript, zod, vocab, character, json-validation]

# Dependency graph
requires:
  - phase: 09-zod-schemas
    provides: VocabSchema, parseWithReadableError, VocabData type exports

provides:
  - loadCharacter(name, vocabDir?) — reads + Zod-validates vocab JSON, returns VocabData
  - getGitEventMessage(vocab, eventKey) — picks random git event message or returns null

affects: [11-entry, 12-jest]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "vocabDir optional param for test injection without env vars (D-02)"
    - "private pick() in character.ts avoids cross-module import with trigger.ts stub during Wave 1"
    - "parseWithReadableError reuse from Phase 09 for descriptive Zod validation errors"

key-files:
  created: []
  modified:
    - src/core/character.ts

key-decisions:
  - "vocabDir defaults to path.join(__dirname, '../vocab') — works in both dev and installed (esbuild __dirname = dist/) contexts"
  - "private pick() duplicated from trigger.ts to avoid Wave 1 cross-stub import failure during typecheck"
  - "getGitEventMessage uses optional chaining on git_events — absent key returns null without throw"

patterns-established:
  - "Optional param override for test injection: loadCharacter(name, vocabDir?) avoids env var hacks"
  - "parseWithReadableError wraps Zod safeParse with stderr logging — validation errors are human-readable"

requirements-completed: [CORE-02]

# Metrics
duration: 4min
completed: 2026-04-03
---

# Phase 10 Plan 02: character.ts Summary

**TypeScript character module with Zod-validated vocab JSON loading via loadCharacter() and random git-event message selection via getGitEventMessage()**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-03T10:52:10Z
- **Completed:** 2026-04-03T10:52:14Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Implemented `loadCharacter(name, vocabDir?)` — reads vocab JSON from disk, validates against Phase 09 VocabSchema via `parseWithReadableError`, throws descriptive error on schema failure
- Implemented `getGitEventMessage(vocab, eventKey)` — picks random message from git_events section or returns null when key absent
- vocabDir optional parameter provides Phase 12 Jest tests a clean injection point without environment variable indirection
- `npm run typecheck` passes with 0 errors; all 4 vocab JSON files loadable

## Task Commits

1. **Task 1: 实现 character.ts 核心函数** - `c3a76e3` (feat)

**Plan metadata:** (pending — recorded after state updates)

## Files Created/Modified
- `src/core/character.ts` — loadCharacter + getGitEventMessage exports; private pick() helper

## Decisions Made
- vocabDir defaults to `path.join(__dirname, '../vocab')` per D-01: works correctly in both dev (`src/`) and production (esbuild `dist/`) contexts since `__dirname` is preserved in CJS bundles
- private `pick()` function duplicated inside character.ts rather than importing from trigger.ts: during Wave 1 parallel execution trigger.ts is still a `export {}` stub; cross-importing would fail typecheck
- `getGitEventMessage` uses `vocab.git_events?.[eventKey as keyof ...]` — optional chaining ensures missing git_events section returns null without throw, matching Python `events.get("git_events", {})` fallback behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `loadCharacter` and `getGitEventMessage` exported and typecheck-clean; Phase 11 statusline.ts can import directly
- vocabDir param ready for Phase 12 Jest fixture injection
- Phase 10 Plan 03 (gitContext.ts) can proceed independently

---
*Phase: 10-core*
*Completed: 2026-04-03*
