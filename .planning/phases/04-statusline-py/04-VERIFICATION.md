---
phase: 04-statusline-py
verified: 2026-04-02T07:03:30Z
status: passed
score: 4/4 must-haves verified
gaps: []
human_verification: []
---

# Phase 04: statusline-py Verification Report

**Phase Goal:** statusline.py 入口正确区分 render 模式和 update 模式，集成 session_start 记录、repo 切换重置和 debug 输出
**Verified:** 2026-04-02T07:03:30Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | render 模式（无 --update）不执行任何 git subprocess，不覆盖 state.json 中 last_git_events/commits_today 等 git 字段 | VERIFIED | `load_git_context` 仅在 `if update_only:` 块内调用（line 152）；手动运行确认 render 模式 git subprocess 调用次数 = 0，state.json message 保持 "old" 不变 |
| 2 | --update 模式在首次运行时将 session_start 写入 state.json，后续同天调用不覆盖，跨天重置 | VERIFIED | `_should_reset_session_start()` 函数存在（line 98-106）；`test_update_writes_session_start`、`test_update_preserves_session_start_same_day`、`test_update_resets_session_start_cross_day` 三个测试全部通过 |
| 3 | statusline.py --debug-events 向 stderr 输出当前 git context 数值、检测到的事件及触发原因、state.json 快照；stderr 内容不污染状态栏渲染 | VERIFIED | `--debug-events` 实际运行：stdout 为空，stderr 包含 `GIT_CONTEXT:`、`EVENTS_WOULD_FIRE:`、`STATE_SNAPSHOT:` 三行；数据含真实 git 值（commits_today=21，real repo path） |
| 4 | render 模式 stdout 仍正常输出两行（角色消息 + token 信息） | VERIFIED | `test_main_prints_two_lines` 通过；`print(render(...))` 仅在 `update_only=False` 路径执行（line 249） |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `statusline.py` | render/update 模式分离、session_start 逻辑、--debug-events stderr 输出 | VERIFIED | 254 行，包含 `_should_reset_session_start()`、`_event_reason()`、`session_start: str | None = None` 参数、`debug_mode` 标志、三行 stderr 输出 |
| `tests/test_statusline.py` | 7 个新测试覆盖 STA-02 和 CFG-02，min_lines: 200 | VERIFIED | 361 行（>200），包含全部 7 个指定测试函数：`test_render_mode_does_not_write_state`、`test_save_state_session_start`、`test_update_writes_session_start`、`test_update_preserves_session_start_same_day`、`test_update_resets_session_start_cross_day`、`test_debug_events_stderr_output`、`test_debug_events_no_stdout` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `statusline.py main()` | `save_state()` | 仅在 `update_only=True` 时调用 | WIRED | render 路径不含任何 `save_state()` 调用；`elif message != state.get("message")` 旧分支已确认不存在（grep 返回空） |
| `statusline.py main()` | `sys.stderr` | `debug_mode` 时输出三行 JSON | WIRED | line 242-244：三处 `print(..., file=sys.stderr)` 均在 `if debug_mode:` 块内；`if update_only: return`（line 246-247）在 debug 块之后，保证 stdout 不被 print(render(...)) 污染 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `statusline.py` --debug-events | `git_ctx_display` / `events_display` | `load_git_context(os.getcwd())` + `detect_git_events()` | 是（实测 commits_today=21，真实 repo path，5 个事件触发） | FLOWING |
| `statusline.py` --update session_start | `session_start_val` | `_should_reset_session_start()` + `datetime.now().isoformat()` | 是（写入今天 ISO 时间戳） | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| render 模式不写 state，不调用 git subprocess | Python 内联测试（mock load_git_context） | call_count=0，state message="old" 保持不变 | PASS |
| --debug-events stdout 为空 | `python3 statusline.py --debug-events 1>/tmp/debug_out.txt` | stdout 文件为空 | PASS |
| --debug-events stderr 含三个标记 | `grep -c 'GIT_CONTEXT:' /tmp/debug_err.txt` | count=1，三行均存在 | PASS |
| 全量测试通过 | `python3 -m pytest tests/ -q` | 117 passed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| STA-02 | 04-01-PLAN.md | render 模式不触发 git subprocess，不覆盖 git 相关字段 | SATISFIED | render 路径完全不含 `load_git_context()` 或 `save_state()` 调用；`test_render_mode_does_not_write_state` 通过 |
| CFG-02 | 04-01-PLAN.md | `statusline.py --debug-events` 输出当前 git context、会触发的事件及原因、state.json 快照到 stderr | SATISFIED | 实测输出：GIT_CONTEXT/EVENTS_WOULD_FIRE/STATE_SNAPSHOT 三行，含真实数据，stdout 无输出 |

**REQUIREMENTS.md 对应检查：**
- STA-02 标注为 Phase 4，REQUIREMENTS.md 状态为 `[x]`（已完成）— 与实现一致
- CFG-02 标注为 Phase 4，REQUIREMENTS.md 状态为 `[x]`（已完成）— 与实现一致
- 无孤立需求（ORPHANED）：Phase 4 在 REQUIREMENTS.md Traceability 表中仅声明 STA-02 和 CFG-02，与 PLAN frontmatter 完全一致

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | 无反模式 |

`statusline.py` 和 `tests/test_statusline.py` 均无 TODO、FIXME、placeholder、stub 返回值或空实现。

### Human Verification Required

无需人工验证。所有 success criteria 均可程序化验证，且已通过。

### Gaps Summary

无 gap。所有 4 个 must-have truths 已验证，两个 artifacts 达到 Level 4（存在 + 实质性 + 已连接 + 数据流通），两条 key links 已连接，STA-02 和 CFG-02 需求已满足，117 个测试全部通过。

---

## Implementation Notes

**关键设计决策已正确实现：**

1. **render 纯只读（D-01）**：旧的 `elif message != state.get("message"): save_state(...)` 分支已完全删除；render 路径只读 state、统计、stdin，不写任何文件
2. **session_start 同天保留/跨天重置（D-02）**：`_should_reset_session_start()` 纯函数实现日期比较，覆盖缺失、无效、跨天三种情况
3. **session_start 通过 save_state 持久化（D-03）**：`session_start: str | None = None` 参数遵循已有 optional 字段模式（与 last_git_events、last_repo、commits_today 一致）
4. **--debug-events 语义（D-04）**：`update_only = True`（因此会执行 git subprocess 和状态写入），但 `debug_mode` 标志阻止 stdout 输出，保证状态栏渲染不受污染
5. **非 git 目录 edge case**：`elif update_only:` 分支（line 215-217）确保即使 git_context 为 None 时 session_start 也能写入

---
_Verified: 2026-04-02T07:03:30Z_
_Verifier: Claude (gsd-verifier)_
