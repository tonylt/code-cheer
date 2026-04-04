---
phase: quick
plan: 260404-suh
subsystem: vocab + character loading
tags: [i18n, english, vocab, character, language]
dependency_graph:
  requires: []
  provides: [english-vocab-all-characters, language-config-field, lang-aware-character-loading]
  affects: [src/schemas/config.ts, src/core/character.ts, src/statusline.ts, tests/character.test.ts]
tech_stack:
  added: []
  patterns: [env-injection-D12, two-level-fallback-D06, lang-suffix-routing]
key_files:
  created:
    - vocab/nova.en.json
    - vocab/luna.en.json
    - vocab/mochi.en.json
    - vocab/iris.en.json
    - vocab/leijun.en.json
  modified:
    - src/schemas/config.ts
    - src/core/character.ts
    - src/statusline.ts
    - tests/character.test.ts
decisions:
  - "resolveVocabPath 内部函数封装 lang 分支逻辑，fallback 到 zh 而非 throw（向后兼容）"
  - "config.language 只接受 'zh' | 'en'，其他值忽略，缺失时 undefined（不设默认值，避免 config.json 膨胀）"
  - "statusline.ts 两处调用点（renderMode + runUpdateCore）均传 config.language"
metrics:
  duration: ~20min
  completed_date: "2026-04-04"
  tasks_completed: 3
  files_changed: 9
---

# Phase quick Plan 260404-suh: English Vocab + Language Switch Summary

**One-liner:** 为 5 个角色新增英文 vocab（.en.json）并通过 config.json language 字段控制语言切换，中文用户行为完全不变。

## What Was Built

- **5 个英文 vocab 文件**（nova / luna / mochi / iris / leijun），各保留原角色风格：
  - `nova.en.json` — 高能运动加油系，感叹号密集，GO!! 风格
  - `luna.en.json` — 温柔治愈陪伴系，软~结尾
  - `mochi.en.json` — 傲娇猫系，第三人称 "Mochi"
  - `iris.en.json` — 女王御姐冷静挑衅，单词短句极简
  - `leijun.en.json` — 雷军风格，"Are U OK?" + "classmates" + "all in" + "beyond bulletproof"
- **config schema** 新增 `language?: 'zh' | 'en'`，parseConfig 解析时忽略无效值（向后兼容）
- **character.ts** `loadCharacter` 新增可选 `lang?` 参数，`resolveVocabPath` 内部函数处理 `.en.json` 查找与 zh fallback
- **statusline.ts** renderMode + runUpdateCore 两处调用点均传入 `config.language`
- **character.test.ts** 新增 6 个语言切换测试（en 加载、fallback + stderr 警告、默认 zh、显式 zh、schema 结构验证）

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Config language field + character.ts lang-aware loading | c4cef47 | src/schemas/config.ts, src/core/character.ts |
| 2 | 5 English vocab files + statusline wiring | 7ad7ead | vocab/*.en.json (5), src/statusline.ts |
| 3 | character.test.ts lang coverage | 6534eb8 | tests/character.test.ts |

## Verification Results

- typecheck: PASSED (tsc --noEmit)
- npm test: 366/366 PASSED (12 test suites)
- 5 .en.json 文件 JSON 合法性验证: PASSED
- leijun.en.json 保留 "Are U OK?" 标志性梗: CONFIRMED

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — 所有 vocab 文件内容完整，language 切换逻辑已完全接入。

## Self-Check: PASSED

Files verified:
- vocab/nova.en.json: FOUND
- vocab/luna.en.json: FOUND
- vocab/mochi.en.json: FOUND
- vocab/iris.en.json: FOUND
- vocab/leijun.en.json: FOUND

Commits verified:
- c4cef47: FOUND
- 7ad7ead: FOUND
- 6534eb8: FOUND
