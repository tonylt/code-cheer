---
phase: 12-jest
plan: "01"
subsystem: jest-infrastructure
tags: [jest, ts-jest, testing, statusline, refactor]
dependency_graph:
  requires: []
  provides: [jest-infrastructure, statusline-testable-exports]
  affects: [src/statusline.ts, package.json, jest.config.ts, tsconfig.test.json]
tech_stack:
  added: [jest@29.7.0, ts-jest@29.4.9, "@types/jest@29", ts-node]
  patterns: [ts-jest preset, tsconfig.test.json extends base, env-variable path injection]
key_files:
  created:
    - jest.config.ts
    - tsconfig.test.json
  modified:
    - package.json
    - src/statusline.ts
decisions:
  - ts-node required for TypeScript jest.config.ts — not in plan but added automatically (Rule 3)
  - renderMode/updateMode/debugMode each call resolvePaths(env?) for testable path injection
  - saveState/loadConfig/loadState/loadStats refactored to accept explicit path parameters
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_modified: 4
---

# Phase 12 Plan 01: Jest Infrastructure + statusline.ts Testable Exports Summary

**One-liner:** Jest 29 + ts-jest configured with 80% coverage threshold; statusline.ts refactored to export renderMode/updateMode/debugMode with env-injectable paths.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install Jest dependencies and create config files | 8d700d3 | package.json, jest.config.ts, tsconfig.test.json, package-lock.json |
| 2 | Refactor statusline.ts to export testable functions | 6638d7b | src/statusline.ts |

## What Was Built

**Task 1: Jest Infrastructure**
- Installed `jest@29.7.0`, `ts-jest@29.4.9`, `@types/jest@29`, `ts-node` as devDependencies
- Added `"test": "jest --coverage"` and `"test:watch": "jest --watch"` scripts to package.json
- Created `jest.config.ts` with ts-jest preset, node testEnvironment, `testMatch: ['**/tests/*.test.ts']`, 80% line coverage threshold, `restoreMocks: true`
- Created `tsconfig.test.json` extending base config with `types: ["node", "jest"]` and `include: ["src/**/*", "tests/**/*"]`
- `npm test -- --passWithNoTests` exits 0

**Task 2: statusline.ts Refactor**
- Extracted `resolvePaths(env?)` helper — all path resolution is env-injectable for testing
- Extracted `export function renderMode(env?): string` — reads config/state/stats, returns statusLine string without stdout side effect
- Extracted `export async function updateMode(stdin, env?): Promise<void>` — full update flow with git context + state persistence, accepts stdin as string parameter
- Extracted `export async function debugMode(stdin, env?): Promise<void>` — same as updateMode + writes GIT_CONTEXT/EVENTS_WOULD_FIRE/STATE_SNAPSHOT to stderr
- Refactored `main()` to dispatch based on argv flags using `readStdinString()` helper
- Guarded `main()` with `if (require.main === module)` — importing module produces no side effects
- All helper functions (loadConfig/loadState/loadStats/saveState) refactored to accept explicit path parameters

## Verification Results

- `npm test -- --passWithNoTests` exits 0
- `npm run build` exits 0 (529.8kb bundle in 50ms)
- `npm run typecheck` exits 0
- `node -e "require('./dist/statusline.js')"` produces no output (guarded main)
- `node -e "const m = require('./dist/statusline.js'); console.log(typeof m.renderMode, typeof m.updateMode, typeof m.debugMode)"` outputs `function function function`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ts-node required for TypeScript jest.config.ts**
- **Found during:** Task 1 verification
- **Issue:** `npm test` failed with "ts-node is required for TypeScript configuration files" — jest.config.ts is a .ts file, Jest needs ts-node to parse it
- **Fix:** Added `npm install --save-dev ts-node` — ts-node is the standard solution for TypeScript Jest config files
- **Files modified:** package.json, package-lock.json (auto-modified by npm)
- **Commit:** 8d700d3 (included in task 1 commit)

## Known Stubs

None — all functions fully implemented with complete logic.

## Self-Check: PASSED
