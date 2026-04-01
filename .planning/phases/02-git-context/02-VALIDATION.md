---
phase: 2
slug: git-context
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x |
| **Config file** | `pyproject.toml` or `pytest.ini` (if exists) |
| **Quick run command** | `python3 -m pytest tests/test_git_context.py -v` |
| **Full suite command** | `python3 -m pytest tests/ -v` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `python3 -m pytest tests/test_git_context.py -v`
- **After every plan wave:** Run `python3 -m pytest tests/ -v`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | STA-03 | unit stub | `python3 -m pytest tests/test_git_context.py -v` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | STA-03 | unit | `python3 -m pytest tests/test_git_context.py::test_get_git_context_success -v` | ✅ | ⬜ pending |
| 02-01-03 | 01 | 1 | STA-03 | unit | `python3 -m pytest tests/test_git_context.py::test_no_git_repo -v` | ✅ | ⬜ pending |
| 02-01-04 | 01 | 1 | STA-03 | unit | `python3 -m pytest tests/test_git_context.py::test_timeout -v` | ✅ | ⬜ pending |
| 02-01-05 | 01 | 1 | STA-03 | unit | `python3 -m pytest tests/test_git_context.py::test_git_not_installed -v` | ✅ | ⬜ pending |
| 02-01-06 | 01 | 1 | STA-03 | unit | `python3 -m pytest tests/test_git_context.py::test_parallel_execution -v` | ✅ | ⬜ pending |
| 02-01-07 | 01 | 2 | STA-03 | integration | `python3 -m pytest tests/test_git_context.py::test_real_git_repo -v` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/test_git_context.py` — stubs for STA-03 (8 test cases covering all paths)
- [ ] Existing `tests/` infrastructure confirmed working (pytest available)

*Wave 0 creates the test file with stub implementations that initially fail (RED), then tasks in Wave 1 implement code to pass them.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 性能：3 个 subprocess 并行执行总耗时 < 500ms | STA-03 | 需要真实 git repo + 计时 | `time python3 -c "from core.git_context import get_git_context; import json; print(json.dumps(get_git_context()))"` — 输出应 < 0.5s |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
