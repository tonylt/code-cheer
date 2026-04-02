---
phase: 5
slug: vocab
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-02
audited: 2026-04-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.2 |
| **Config file** | `pytest.ini`（项目根目录，如无则直接 `python3 -m pytest tests/`） |
| **Quick run command** | `python3 -m pytest tests/test_character.py tests/test_trigger.py -v` |
| **Full suite command** | `python3 -m pytest tests/ -q` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python3 -m pytest tests/ -q`
- **After every plan wave:** Run `python3 -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | TST-02 | unit | `python3 -m pytest tests/test_character.py -k "git_event" -x` | ✅ test_character.py:45 | ✅ green |
| 5-01-02 | 01 | 0 | TST-02 | unit | `python3 -m pytest tests/test_character.py -k "git_event" -x` | ✅ test_character.py:52 | ✅ green |
| 5-01-03 | 01 | 0 | TST-02 | unit | `python3 -m pytest tests/test_character.py -k "git_event" -x` | ✅ test_character.py:57 | ✅ green |
| 5-01-04 | 01 | 0 | TST-02 | integration | `python3 -m pytest tests/test_trigger.py -k "warning" -x` | ✅ test_trigger.py:519,529 | ✅ green |
| 5-01-05 | 01 | 1 | TST-02 | integration | `python3 -m pytest tests/test_trigger.py -k "resolve_git" -x` | ✅ 已有部分 | ✅ green |
| 5-02-01 | 02 | 1 | TST-02 | content | `python3 -m pytest tests/ -q` | ✅ 4 vocab 文件，8键x3条x4角色 | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/test_character.py` — 新增 `get_git_event_message()` 3 个单元测试（:45 :52 :57）
- [x] `tests/test_trigger.py` — 新增 warning tier 忽略 git 事件的测试（:519 warning + :529 critical）
- [x] `core/character.py` — 新增 `get_git_event_message(vocab: dict, event_key: str) -> str | None` 函数（:18）

*(现有 `test_resolve_git_event_*` 4 个测试已覆盖 TST-02 的 resolve_message() 基本路径)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 角色消息风格符合人设 | TST-02（内容质量） | 内容质量无法自动化断言 | 人工读取 nova/luna/mochi/iris 各角色 git_events 消息，确认风格与 random 段一致 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s (122 tests in 0.16s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ COMPLETE — 2026-04-02 (audited post-execution; all wave 0 requirements confirmed in codebase)
