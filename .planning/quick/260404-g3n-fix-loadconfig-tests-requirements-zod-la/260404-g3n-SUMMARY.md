---
phase: quick-fix
plan: 01
subsystem: schemas, tests, planning
tags: [code-review-followup, test-cleanup, schema-cleanup, requirements]
dependency_graph:
  requires: []
  provides: [clean-schema-exports, tech-agnostic-test-names, tech-agnostic-requirements]
  affects: [src/schemas, tests/statusline.test.ts, .planning/REQUIREMENTS.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - tests/statusline.test.ts
    - src/schemas/state.ts
    - src/schemas/index.ts
    - .planning/REQUIREMENTS.md
decisions:
  - Remove parseWithReadableError entirely rather than keep as deprecated stub
  - Use 'runtime validation with readable errors' as tech-agnostic phrasing for SETUP-02
metrics:
  duration: ~5 minutes
  completed: 2026-04-04T03:41:00Z
  tasks_completed: 2
  files_modified: 4
---

# Quick Fix 260404-g3n: Fix loadConfig Tests, Requirements, and Zod Language Summary

**One-liner:** Removed dead `parseWithReadableError` stub from schemas, renamed Zod-specific test/requirement language to technology-agnostic alternatives.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Update loadConfig tests and remove parseWithReadableError | cf8aa47 | tests/statusline.test.ts, src/schemas/state.ts, src/schemas/index.ts |
| 2 | Update REQUIREMENTS.md to remove Zod-specific language | 85378d5 | .planning/REQUIREMENTS.md |

## Changes Made

### Task 1: Test cleanup and schema removal

- **tests/statusline.test.ts line 327**: Renamed `'outputs Zod error to stderr when character is invalid'` → `'outputs validation error to stderr when character is invalid'`
- **src/schemas/state.ts**: Removed `parseWithReadableError<T>()` function (lines 26–34 previously) — this was a legacy stub that threw on any call, replaced by `parseConfig`/`parseVocab`
- **src/schemas/index.ts line 3**: Removed `parseWithReadableError` from the re-export list

### Task 2: Requirements language

- **SETUP-02**: `通过 Zod schema 验证` → `通过 schema 验证（runtime validation with readable errors）`
- **CORE-02**: `通过 Zod 验证` → `通过 runtime validation`

## Verification

```
Tests:    167 passed, 167 total (6 test suites)
Typecheck: tsc --noEmit — no errors
grep 'parseWithReadableError' src/ — zero results
grep 'Zod' .planning/REQUIREMENTS.md — zero results
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- tests/statusline.test.ts: FOUND (modified)
- src/schemas/state.ts: FOUND (modified)
- src/schemas/index.ts: FOUND (modified)
- .planning/REQUIREMENTS.md: FOUND (modified)
- commit cf8aa47: FOUND
- commit 85378d5: FOUND
