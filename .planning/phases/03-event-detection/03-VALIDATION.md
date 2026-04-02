---
phase: 3
slug: event-detection
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-02
audited: 2026-04-02
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
- **Before `/gsd:verify-work`:** Full suite must be green (122/122 pass)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | GIT-01..06, CFG-01, STA-01 | unit | `python3 -m pytest tests/test_trigger.py -k "detect" -v` | ✅ | ✅ green |
| 3-02-01 | 01 | 1 | STA-01 (repo isolation) | unit | `python3 -m pytest tests/test_trigger.py -k "repo" -v` | ✅ | ✅ green |
| 3-03-01 | 02 | 2 | GIT-01..06 (resolve routing) | unit | `python3 -m pytest tests/test_trigger.py -k "resolve_git" -v` | ✅ | ✅ green |
| 3-04-01 | 02 | 2 | STA-01 (save_state git fields) | unit | `python3 -m pytest tests/test_statusline.py -k "git" -v` | ✅ | ✅ green |
| 3-05-01 | 02 | 3 | GIT-01..06 full integration | integration | `python3 -m pytest tests/ -v` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/test_trigger.py` — 新增 `detect_git_events` 测试用例（GIT-01..06, CFG-01, STA-01），扩展现有文件
- [x] `tests/test_statusline.py` — 新增 `save_state()` 扩展字段测试（last_git_events, last_repo, commits_today 写入）

*Wave 0 在 Plan 01 中完成，所有后续 plan 依赖这些 stub 测试通过。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 22 点整提交触发 late_night_commit（边界值） | GIT-03 | 时间 mock 边界验证 | 设 state.json 模拟 commits_today=1，mock hour=22，确认触发 |
| 切换 repo 后状态栏显示 first_commit_today 消息 | STA-01 | 需要真实 git repo | 在两个不同 git repo 间切换，确认消息重置 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✅ compliant — audited 2026-04-02

---

## Validation Audit 2026-04-02

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
| Total tests passing | 122 |
| detect tests (GIT-01..06, CFG-01, STA-01) | 30 |
| repo isolation tests (STA-01) | 3 |
| resolve_git routing tests | 4 |
| save_state git fields tests | 2 |
| Nyquist compliant | ✅ true |

> Note: Task map updated to reflect actual plan structure (Plan 01: TDD detect, Plan 02: integration wiring). All requirements GIT-01..06, CFG-01, STA-01 fully covered by automated tests.
