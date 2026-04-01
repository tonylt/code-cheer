---
phase: 4
slug: statusline-py
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.2 |
| **Config file** | none（直接运行） |
| **Quick run command** | `python3 -m pytest tests/test_statusline.py -q` |
| **Full suite command** | `python3 -m pytest tests/ -q` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python3 -m pytest tests/test_statusline.py -q`
- **After every plan wave:** Run `python3 -m pytest tests/ -q`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | STA-02 | unit | `python3 -m pytest tests/test_statusline.py::test_render_mode_does_not_write_state -x` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | STA-02 | unit | `python3 -m pytest tests/test_statusline.py::test_update_writes_session_start -x` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | STA-02 | unit | `python3 -m pytest tests/test_statusline.py::test_update_preserves_session_start_same_day -x` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 0 | STA-02 | unit | `python3 -m pytest tests/test_statusline.py::test_update_resets_session_start_cross_day -x` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 0 | STA-02 | unit | `python3 -m pytest tests/test_statusline.py::test_save_state_session_start -x` | ❌ W0 | ⬜ pending |
| 04-01-06 | 01 | 0 | CFG-02 | unit | `python3 -m pytest tests/test_statusline.py::test_debug_events_stderr_output -x` | ❌ W0 | ⬜ pending |
| 04-01-07 | 01 | 0 | CFG-02 | unit | `python3 -m pytest tests/test_statusline.py::test_debug_events_no_stdout -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_statusline.py::test_render_mode_does_not_write_state` — render 路径不写 state（STA-02 核心）
- [ ] `tests/test_statusline.py::test_update_writes_session_start` — --update 首次写入 session_start
- [ ] `tests/test_statusline.py::test_update_preserves_session_start_same_day` — 同天不覆盖
- [ ] `tests/test_statusline.py::test_update_resets_session_start_cross_day` — 跨天重置
- [ ] `tests/test_statusline.py::test_save_state_session_start` — save_state 新参数持久化
- [ ] `tests/test_statusline.py::test_debug_events_stderr_output` — stderr 三行输出（CFG-02）
- [ ] `tests/test_statusline.py::test_debug_events_no_stdout` — --debug-events stdout 为空

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| --debug-events 输出格式可读性 | CFG-02 | 格式美观程度需人眼确认 | 运行 `python3 statusline.py --debug-events`，确认三行格式符合设计文档定义 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
