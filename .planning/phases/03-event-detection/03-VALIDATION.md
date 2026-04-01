---
phase: 3
slug: event-detection
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-02
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 9.0.2 |
| **Config file** | 无（通过 sys.path.insert 解析） |
| **Quick run command** | `python3 -m pytest tests/test_trigger.py -v` |
| **Full suite command** | `python3 -m pytest tests/ -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python3 -m pytest tests/test_trigger.py -v`
- **After every plan wave:** Run `python3 -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green (现有 74 tests + Phase 3 新增 tests)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | GIT-01..06, CFG-01, STA-01 | unit | `python3 -m pytest tests/test_trigger.py -k "detect" -v` | ❌ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | GIT-01..06, CFG-01 | unit | `python3 -m pytest tests/test_trigger.py -k "detect" -v` | ❌ W0 | ⬜ pending |
| 3-03-01 | 03 | 2 | STA-01 | unit | `python3 -m pytest tests/test_trigger.py -k "repo" -v` | ❌ W0 | ⬜ pending |
| 3-04-01 | 04 | 3 | GIT-01..06 | integration | `python3 -m pytest tests/ -v` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_trigger.py` — 新增 `detect_git_events` 测试用例（GIT-01..06, CFG-01, STA-01），扩展现有文件
- [ ] `tests/test_statusline.py` — 新增 `save_state()` 扩展字段测试（last_git_events, last_repo, commits_today 写入）

*Wave 0 在 Plan 01 中完成，所有后续 plan 依赖这些 stub 测试通过。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 22 点整提交触发 late_night_commit（边界值） | GIT-03 | 时间 mock 边界验证 | 设 state.json 模拟 commits_today=1，mock hour=22，确认触发 |
| 切换 repo 后状态栏显示 first_commit_today 消息 | STA-01 | 需要真实 git repo | 在两个不同 git repo 间切换，确认消息重置 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
