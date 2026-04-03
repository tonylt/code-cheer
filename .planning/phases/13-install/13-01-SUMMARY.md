---
phase: 13-install
plan: 01
subsystem: infra
tags: [nodejs, install-script, settings-json, jest, cjs]

# Dependency graph
requires:
  - phase: 12-jest
    provides: Jest test infrastructure and ts-jest config used for install.test.ts

provides:
  - scripts/install.js with patchSettings (non-destructive settings.json patching, Node.js install flow)
  - scripts/uninstall.js with unpatchSettings (settings.json cleanup, dist/ removal)
  - npm run setup / npm run unsetup as v3.0 install entrypoints
  - 9 integration tests covering all INSTALL-01 SC1/SC4 scenarios

affects:
  - Phase 13 plan 02 (deprecated annotations on Python files)
  - Any future install automation

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CJS Node.js scripts (no TypeScript compile needed) for install automation
    - patchSettings accepts opts object for testable path overrides (D-12 pattern)
    - atomic write via writeFileSync(tmp) + renameSync for settings.json mutation
    - module.exports + require.main guard pattern for dual-use scripts

key-files:
  created:
    - scripts/install.js
    - scripts/uninstall.js
    - tests/install.test.ts
  modified:
    - package.json

key-decisions:
  - "setup/unsetup script names (not install/uninstall) to avoid npm lifecycle hook conflict"
  - "patchSettings accepts opts object {settingsPath, installDir, nodeBin} for testable path overrides"
  - "process.execPath for node absolute path (more reliable than which node in nvm/fnm environments)"
  - "install.js and uninstall.js kept independent (no shared lib) — logic is small enough"

patterns-established:
  - "Node.js CJS scripts: module.exports + require.main === module guard for dual-use"
  - "settings.json patch: data.hooks = data.hooks ?? {} then only touch hooks.Stop (never replace entire hooks)"
  - "D-05 upgrade cleanup: filter statusline.py AND statusline.js before appending new node hook"

requirements-completed: [INSTALL-01]

# Metrics
duration: 25min
completed: 2026-04-04
---

# Phase 13 Plan 01: Install Scripts Summary

**Node.js install/uninstall scripts with non-destructive settings.json patching and 9 integration tests covering fresh install, upgrade from Python, re-install, and backup/restore scenarios**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-04T00:00:00Z
- **Completed:** 2026-04-04
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- scripts/install.js implements full D-03 install flow: checkDeps, build, copyFiles, patchSettings, installCheer
- patchSettings properly handles upgrade scenario (removes old statusline.py hooks, D-05) and re-install (no duplicates)
- scripts/uninstall.js implements D-06 cleanup with backup restore and dist/ removal
- 9 passing tests cover all INSTALL-01 SC1/SC4 integration scenarios using isolated temp dirs
- Full test suite: 164 tests passing, 85.11% coverage maintained

## Task Commits

Each task was committed atomically:

1. **Task 1: Create install.js, uninstall.js, and update package.json** - `96c4dc6` (feat)
2. **Task 2: Create install.test.ts for patchSettings/unpatchSettings** - `30f67c3` (test)

**Plan metadata:** (pending final commit)

## Files Created/Modified

- `scripts/install.js` - Full D-03 install flow; exports patchSettings for testing
- `scripts/uninstall.js` - D-06 uninstall flow; exports unpatchSettings for testing
- `tests/install.test.ts` - 9 integration tests for patchSettings/unpatchSettings
- `package.json` - Added setup/unsetup scripts

## Decisions Made

- Used `setup`/`unsetup` as script names instead of `install`/`uninstall` to avoid npm lifecycle conflict (npm runs `scripts.install` automatically during `npm install`)
- `patchSettings` accepts an opts object `{settingsPath, installDir}` overrides — matches the D-12 env-injection pattern established in Phase 12
- `process.execPath` for node binary path (directly from current process, more reliable than `which node` in nvm/fnm environments)
- install.js and uninstall.js kept as independent files (no shared lib) — total logic small enough that sharing would add complexity without benefit

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- scripts/install.js and scripts/uninstall.js are production-ready for `npm run setup` / `npm run unsetup`
- Phase 13 Plan 02 (D-08 deprecated annotations on Python files) can proceed
- INSTALL-01 SC1 and SC4 are satisfied; SC2 (deprecated annotations) is for Plan 02; SC3 (manual re-install test) is manual

---
*Phase: 13-install*
*Completed: 2026-04-04*
