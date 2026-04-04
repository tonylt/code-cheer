---
phase: quick
plan: 260405-8no
subsystem: statusline/config
tags: [bug-fix, backward-compat, lang-inference, loadConfig]
dependency_graph:
  requires: []
  provides: [loadConfig-no-en-inference]
  affects: [src/statusline.ts, tests/statusline.test.ts]
tech_stack:
  added: []
  patterns: [lang-inference-zh-only]
key_files:
  modified:
    - src/statusline.ts
    - tests/statusline.test.ts
decisions:
  - "只对 LANG 含 'zh' 时推断 language='zh'；其他所有 locale（en、C、C.UTF-8、未设置）均返回 language=undefined，由 resolveVocabPath 回落到 zh 默认行为"
metrics:
  duration: "~5min"
  completed: "2026-04-05"
  tasks: 1
  files: 2
---

# Quick Task 260405-8no: Fix LANG inference backward compatibility regression

**One-liner:** Remove `language='en'` auto-inference from `loadConfig()` — non-zh LANG values now leave `language=undefined`, restoring pre-v3.1.0 Chinese-default behavior for English-locale users.

## Summary

`loadConfig()` had a regression introduced in quick task 260404-suh: any non-`undefined` LANG env var (including `en_US.UTF-8`, `C.UTF-8`, `C`) would auto-infer `language='en'`, breaking users who rely on Chinese vocab as the default and never set a `language` preference in `config.json`.

Fix: removed the `if (lang !== undefined) return { ..., language: 'en' }` lines from both the try block (line 39) and the catch block (line 50) of `loadConfig()`. Only `lang?.includes('zh')` remains — all other locales fall through to `language=undefined`, which causes `resolveVocabPath` to load the `*.json` (Chinese) vocab file.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Remove en auto-inference from loadConfig + update 4 tests | d4bb54a | src/statusline.ts, tests/statusline.test.ts |

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npm test` — 416/416 tests pass
- `npm run typecheck` — no type errors
- `grep "language: 'en'" src/statusline.ts` — no matches in loadConfig

## Self-Check: PASSED

- [x] src/statusline.ts exists and has no `language: 'en'` in loadConfig
- [x] tests/statusline.test.ts updated: 4 assertions now use `toBeUndefined()`
- [x] Commit d4bb54a exists
- [x] All 416 tests pass
