# Phase 4: statusline.py 集成 - Research

**Researched:** 2026-04-02
**Domain:** Python CLI 入口模式 / 状态文件读写分离 / stderr 调试输出
**Confidence:** HIGH

## Summary

Phase 4 是纯代码修改阶段，不引入新依赖库。主要工作是在已有的 `statusline.py` 入口中正确分离 render 路径（只读）和 update 路径（写入），并新增两个能力：session_start 首次写入逻辑、--debug-events 调试模式。

所有依赖的下游组件（`load_git_context()`、`detect_git_events()`、`resolve_message()`）均已在 Phase 2/3 实现并通过 110 个测试。Phase 4 不修改这些函数，只修改 `statusline.py` 的 `main()` 入口和 `save_state()` 函数签名。

核心挑战是理解当前代码在 render 路径（line 167-168）仍然调用 `save_state()` 的问题，并正确移除它，同时保证 `test_main_prints_two_lines` 测试在修改后依然通过。

**Primary recommendation:** 按 D-01 到 D-04 决策逐步修改 `main()` 和 `save_state()`，不重构整体结构。

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Render 模式（无 `--update`）纯只读，永不调用 `save_state()`
- 读取 state.json 后直接渲染并 print，不写任何字段
- 消除 render 路径对 `last_git_events`/`commits_today` 等 git 字段的覆盖风险
- --update 是唯一的 state.json 写入方
- 当前代码 `elif message != state.get("message") or tier != ...: save_state(message, tier, slot=slot)` 需要移除

**D-02:** --update 模式在以下情况写入 `session_start = now()`：
1. state.json 中 `session_start` 字段缺失或无效（非 ISO 时间戳）
2. `session_start` 的日期不是今天（跨天自动重置）
- 其余情况保持不变，不覆盖

**D-03:** `session_start` 通过 `save_state()` 参数传入并持久化到 state.json
- 新增 `session_start` 参数到 `save_state()` 函数签名（可选，`None` 时不写）

**D-04:** `--debug-events` = `--update` 的调试增强，执行完整 update 逻辑（git context 读取、事件检测、state 写入），同时向 stderr 输出调试信息
- 用法：`python3 statusline.py --debug-events`
- 不输出 statusline 渲染结果（不 print 到 stdout）
- stderr 输出格式：
  ```
  [ISO_TIMESTAMP] GIT_CONTEXT: {"commits_today": N, "diff_lines": N, "session_minutes": N}
  EVENTS_WOULD_FIRE: {"event_key": "reason string", ...}
  STATE_SNAPSHOT: {"last_git_events": [...], "commits_today": N, ...}
  ```
- stderr 内容不污染状态栏渲染（statusLine 命令读 stdout，不读 stderr）

### Claude's Discretion

- `save_state()` 新增 `session_start` 参数的具体实现细节
- `--debug-events` 的 `session_minutes` 计算逻辑（从 session_start 到 now()，精确到整数分钟）
- state.json 容错规则的具体实现：`session_start` 无效时的异常处理方式

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

**Not in this phase:**
- vocab git_events 段（Phase 5）
- 完整测试覆盖（Phase 5）
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STA-02 | render 模式（statusline 轮询路径）不触发 git subprocess，不覆盖 `last_git_events`/`commits_today` 等 git 相关字段 | D-01 locked：移除 line 167-168 的 save_state 调用；render 路径无任何写操作 |
| CFG-02 | `statusline.py --debug-events` 输出当前 git context、会触发的事件及原因、state.json 快照到 stderr | D-04 locked：stderr 三行格式已定义；不污染 stdout |
</phase_requirements>

---

## Standard Stack

### Core（无新依赖）

| 模块 | 版本 | 用途 | 说明 |
|------|------|------|------|
| Python stdlib `datetime` | 3.14.1（项目已用） | session_start ISO 时间戳解析和生成 | `datetime.fromisoformat()` / `datetime.now().isoformat()` |
| Python stdlib `sys` | 3.14.1 | `sys.argv` 参数检测、`sys.stderr` 调试输出 | 已在 statusline.py 中导入 |
| Python stdlib `json` | 3.14.1 | state.json 读写 | 已在 statusline.py 中导入 |
| `pytest` | 9.0.2 | 单元测试 | 已安装，110 测试通过 |

**无需 `pip install` 任何新包。** Phase 4 完全使用 stdlib 和已有 core 模块。

### 已实现的下游模块（Phase 4 只读，不修改）

| 模块 | 位置 | Phase 4 使用方式 |
|------|------|----------------|
| `load_git_context()` | `core/git_context.py` | update 路径已调用，不变 |
| `detect_git_events()` | `core/trigger.py` | update 路径已调用，不变 |
| `resolve_message()` | `core/trigger.py` | 两条路径均调用，不变 |

---

## Architecture Patterns

### 已有代码结构（Phase 4 修改范围）

```
statusline.py
├── main()                    ← 主要修改目标
│   ├── 参数检测 (line 96)    ← 新增 debug_events 检测
│   ├── update 路径 (line 112-168) ← 新增 session_start 写入
│   └── render 路径 (line 167-168) ← 移除 save_state 调用
└── save_state()              ← 新增 session_start 参数
```

### Pattern 1: 命令行参数检测模式

当前代码（line 96）：
```python
update_only = "--update" in sys.argv
```

Phase 4 扩展为：
```python
update_only = "--update" in sys.argv or "--debug-events" in sys.argv
debug_mode = "--debug-events" in sys.argv
```

`--debug-events` 触发完整 update 逻辑（git context + event detection + state write），同时激活 stderr 输出。

### Pattern 2: session_start 检测与写入

设计文档给出的参考实现（已在 CONTEXT.md specifics 定义）：

```python
def _should_reset_session_start(existing: str | None) -> bool:
    if not existing:
        return True
    try:
        dt = datetime.fromisoformat(existing)
        return dt.date() != datetime.now().date()
    except (ValueError, TypeError):
        return True
```

在 update 路径中：
```python
session_start = state.get("session_start")
if _should_reset_session_start(session_start):
    session_start = datetime.now().isoformat()
```

然后传入 `save_state(..., session_start=session_start)` 持久化。

### Pattern 3: save_state() 新增参数（D-03）

遵循已有 optional 参数风格（与 `last_git_events: list | None = None` 保持一致）：

```python
def save_state(
    message: str,
    tier: str,
    slot: str,
    last_git_events: list | None = None,
    last_repo: str | None = None,
    commits_today: int | None = None,
    session_start: str | None = None,   # 新增
) -> None:
    ...
    if session_start is not None:
        state["session_start"] = session_start
```

`None` 时不写入字段，与已有字段处理方式完全一致。

### Pattern 4: --debug-events stderr 输出（D-04）

```python
if debug_mode:
    # session_minutes 计算：从 session_start（写入后的值）到 now()
    session_start_dt = datetime.fromisoformat(session_start)
    session_minutes = int((datetime.now() - session_start_dt).total_seconds() / 60)

    git_ctx_display = {
        "commits_today": git_context.get("commits_today", 0),
        "diff_lines": git_context.get("diff_lines", 0),
        "session_minutes": session_minutes,
    }
    events_display = {e: _event_reason(e, git_context, config) for e in (triggered_events or [])}
    state_snapshot = {
        "last_git_events": new_last_git_events,
        "commits_today": new_commits_today,
        "session_start": session_start,
        "last_repo": new_last_repo,
    }

    ts = datetime.now().isoformat(timespec="seconds")
    print(f"[{ts}] GIT_CONTEXT: {json.dumps(git_ctx_display)}", file=sys.stderr)
    print(f"EVENTS_WOULD_FIRE: {json.dumps(events_display)}", file=sys.stderr)
    print(f"STATE_SNAPSHOT: {json.dumps(state_snapshot, ensure_ascii=False)}", file=sys.stderr)
```

`_event_reason()` 是一个简单的辅助函数，生成事件触发原因字符串，例如 `"diff_lines 312 >= threshold 200"`。这是 Claude's Discretion 范围，可内联实现。

### Pattern 5: Render 路径纯只读（D-01）

**当前代码（需移除）：**
```python
# statusline.py line 167-168 — 需要删除以下两行
elif message != state.get("message") or tier != state.get("last_rate_tier"):
    save_state(message, tier, slot=slot)
```

**修改后 render 路径：**
```python
if update_only:
    return

print(render(character, message, cc_data, stats))
# ↑ render 路径仅 print，无任何 save_state 调用
```

### Anti-Patterns to Avoid

- **不要在 render 路径打印 debug 信息到 stderr**：debug 输出只在 `debug_mode=True` 时执行，不因普通渲染误触发
- **不要在 `_should_reset_session_start()` 抛出异常**：所有解析失败应 return True（跨天重置），与 `_EMPTY_STATE` safe defaults 模式一致
- **不要合并 update_only 和 debug_mode 的退出逻辑**：两者都不 print 到 stdout，但 debug_mode 需要额外 stderr 输出，分支需清晰
- **不要修改 detect_git_events() 来返回原因字符串**：该函数已完成，原因字符串由 statusline.py 本地辅助函数生成

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ISO 时间戳解析 | 自定义正则 | `datetime.fromisoformat()` | Python 3.7+ 原生支持，处理时区边界 |
| 原子写入 | 直接 `open(path, 'w')` | `os.replace(tmp, path)` | 已有模式，防止写入中断损坏 state.json |
| 参数检测 | argparse | `"--flag" in sys.argv` | 已有模式，4 个 flag 不值得引入 argparse 复杂度 |

---

## Common Pitfalls

### Pitfall 1: 移除 render 路径写入后破坏现有测试

**What goes wrong:** `test_main_prints_two_lines` 不直接断言 state.json，但 render 路径的行为改变可能导致测试中 `main()` 在非 update 模式下行为不符合预期。
**Why it happens:** 现有测试（line 102-126）在 render 模式下调用 `sl.main()` 并检查 stdout 两行输出。移除 render 路径的 `save_state` 后测试本身应继续通过，但需确认没有间接依赖。
**How to avoid:** 移除 line 167-168 后立即运行 `python3 -m pytest tests/test_statusline.py -v`，确认 110 个测试仍通过。
**Warning signs:** `test_main_prints_two_lines` 失败，说明 render 路径存在其他副作用被测试依赖。

### Pitfall 2: session_start 跨天重置逻辑的日期边界

**What goes wrong:** 用 `str(dt.date()) != str(datetime.now().date())` 做字符串比较，在时区变化时可能出现意外匹配。
**Why it happens:** `datetime.now()` 返回本地时间，`fromisoformat()` 解析不带时区的字符串时也返回 naive datetime，两者 `.date()` 可直接比较。
**How to avoid:** 使用 `dt.date() != datetime.now().date()`（datetime.date 对象比较，不用字符串）。参见 CONTEXT.md specifics 中的参考实现。
**Warning signs:** 跨天不重置，或同一天多次重置（后者说明 `fromisoformat` 解析失败被吞掉）。

### Pitfall 3: debug_mode 的 stderr 输出污染状态栏

**What goes wrong:** 调试输出误写入 stdout，导致 Claude Code statusLine 命令读取到额外内容，渲染出错。
**Why it happens:** `print()` 默认写 stdout；`--debug-events` 模式不该 print 到 stdout（D-04 明确：不输出 statusline 渲染结果）。
**How to avoid:** 所有 debug 输出统一使用 `print(..., file=sys.stderr)`；`--debug-events` 分支在 `update_only` 返回前完成，不走 render 路径。
**Warning signs:** 在 `--debug-events` 模式中看到 statusline 字符（角色名、tokens 等）出现在输出中。

### Pitfall 4: save_state() 写入 session_start None 时清除已有字段

**What goes wrong:** 如果 `session_start is None` 的条件判断失误（如写成 `if session_start:`），当 `session_start = "2026-04-02T..."` 有效时不写入。
**Why it happens:** `if session_start is not None` vs `if session_start` — 后者对空字符串也跳过写入。
**How to avoid:** 与已有字段保持严格一致：`if session_start is not None: state["session_start"] = session_start`。

### Pitfall 5: debug_mode 的 session_minutes 计算依赖 session_start 已写入

**What goes wrong:** 在 session_start 确定之前就计算 session_minutes，如果 session_start 是本轮刚写入的（首次运行），session_minutes 为 0，这是正确行为，不是 bug。
**Why it happens:** 首次 --debug-events 时 session_start 就是 `now()`，session_minutes = 0 分钟，符合预期。
**How to avoid:** 确保 session_minutes 计算在 session_start 值确定（已写入 state 或本轮新生成）之后执行。

---

## Code Examples

### save_state() 签名扩展

```python
# Source: statusline.py 已有 save_state() 模式 + D-03 decision
def save_state(
    message: str,
    tier: str,
    slot: str,
    last_git_events: list | None = None,
    last_repo: str | None = None,
    commits_today: int | None = None,
    session_start: str | None = None,   # 新增，None 时不写入字段
) -> None:
    os.makedirs(BASE_DIR, exist_ok=True)
    state = {
        "message": message,
        "last_updated": datetime.now().isoformat(),
        "last_rate_tier": tier,
        "last_slot": slot,
    }
    if last_git_events is not None:
        state["last_git_events"] = last_git_events
    if last_repo is not None:
        state["last_repo"] = last_repo
    if commits_today is not None:
        state["commits_today"] = commits_today
    if session_start is not None:                   # 新增
        state["session_start"] = session_start      # 新增
    tmp_path = STATE_PATH + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, STATE_PATH)
```

### session_start 决策逻辑（在 main() update 路径中）

```python
# Source: CONTEXT.md D-02 + specifics 参考实现
session_start_val = state.get("session_start")
if _should_reset_session_start(session_start_val):
    session_start_val = datetime.now().isoformat()
# session_start_val 现在保证是今天的有效 ISO 时间戳
# 传入 save_state() 持久化
```

### main() 参数检测（扩展后）

```python
# Source: CONTEXT.md D-04 specifics
update_only = "--update" in sys.argv or "--debug-events" in sys.argv
debug_mode = "--debug-events" in sys.argv
```

### --debug-events 输出格式示例

```
[2026-04-02T23:15:00] GIT_CONTEXT: {"commits_today": 6, "diff_lines": 312, "session_minutes": 47}
EVENTS_WOULD_FIRE: {"big_diff": "diff_lines 312 >= threshold 200", "late_night_commit": "hour 23 >= threshold 22"}
STATE_SNAPSHOT: {"last_git_events": ["big_diff"], "commits_today": 6, "session_start": "...", "last_repo": "/path/to/repo"}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| render 路径在消息变更时写 state | render 路径纯只读（D-01） | Phase 4 | 消除 render 对 git 字段的意外覆盖 |
| session_start 字段不存在 | --update 首次运行写入并持久化 | Phase 4 | 解锁 big_session 事件计算（GIT-05） |
| 无调试工具 | --debug-events 输出到 stderr | Phase 4 | 可观测性；用户可自诊断事件未触发原因 |

**Deprecated/outdated:**
- `statusline.py` line 167-168（render 路径 `save_state` 调用）：Phase 4 移除

---

## Open Questions

1. **`_event_reason()` 辅助函数的实现范围**
   - What we know: 格式在设计文档中已定义（`"diff_lines 312 >= threshold 200"`）
   - What's unclear: 是否需要覆盖所有 6 种事件，还是只覆盖当次实际触发的事件
   - Recommendation: 只为 triggered_events 中的事件生成原因字符串，用简单的 match/if-else 实现，内联在 `main()` 或提取为私有函数

2. **debug_mode 时是否仍写 state.json**
   - What we know: D-04 说执行"完整 update 逻辑（git context 读取、事件检测、state 写入）"
   - What's unclear: 写入行为在 debug 场景下是否符合预期（写了 state，但 render 用户看不到变化直到下次 render）
   - Recommendation: 是，写入 state.json；debug_mode 只影响 stderr 输出，不影响 update 核心逻辑。这样更简单，也避免 debug 模式和正常 update 模式行为差异造成混淆

---

## Environment Availability

Step 2.6: SKIPPED（Phase 4 是纯代码修改，无外部依赖。所有 subprocess 在 `load_git_context()` 中已处理，Phase 4 不新增任何 CLI 工具依赖。）

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | none（无 pytest.ini，直接运行） |
| Quick run command | `python3 -m pytest tests/test_statusline.py -q` |
| Full suite command | `python3 -m pytest tests/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STA-02 | render 模式不调用 save_state，git 字段不被覆盖 | unit | `python3 -m pytest tests/test_statusline.py::test_render_mode_does_not_write_state -x` | ❌ Wave 0 |
| STA-02 | render 模式 stdout 仍正常输出两行 | unit | `python3 -m pytest tests/test_statusline.py::test_main_prints_two_lines -x` | ✅ 已有 |
| CFG-02 | --debug-events 向 stderr 输出 GIT_CONTEXT 行 | unit | `python3 -m pytest tests/test_statusline.py::test_debug_events_stderr_output -x` | ❌ Wave 0 |
| CFG-02 | --debug-events stdout 为空（不污染 statusLine） | unit | `python3 -m pytest tests/test_statusline.py::test_debug_events_no_stdout -x` | ❌ Wave 0 |
| STA-02 | --update 写入 session_start 首次写入 | unit | `python3 -m pytest tests/test_statusline.py::test_update_writes_session_start -x` | ❌ Wave 0 |
| STA-02 | --update 不覆盖当天已有的 session_start | unit | `python3 -m pytest tests/test_statusline.py::test_update_preserves_session_start_same_day -x` | ❌ Wave 0 |
| STA-02 | --update 跨天重置 session_start | unit | `python3 -m pytest tests/test_statusline.py::test_update_resets_session_start_cross_day -x` | ❌ Wave 0 |
| STA-02 | save_state() 持久化 session_start 字段 | unit | `python3 -m pytest tests/test_statusline.py::test_save_state_session_start -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `python3 -m pytest tests/test_statusline.py -q`
- **Per wave merge:** `python3 -m pytest tests/ -q`
- **Phase gate:** Full suite (110+ tests) green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/test_statusline.py::test_render_mode_does_not_write_state` — 覆盖 STA-02 核心：render 路径不写 state
- [ ] `tests/test_statusline.py::test_debug_events_stderr_output` — 覆盖 CFG-02：stderr 有三行输出
- [ ] `tests/test_statusline.py::test_debug_events_no_stdout` — 覆盖 CFG-02：stdout 为空
- [ ] `tests/test_statusline.py::test_update_writes_session_start` — 覆盖 STA-02 扩展：首次写入
- [ ] `tests/test_statusline.py::test_update_preserves_session_start_same_day` — 同天不覆盖
- [ ] `tests/test_statusline.py::test_update_resets_session_start_cross_day` — 跨天重置
- [ ] `tests/test_statusline.py::test_save_state_session_start` — save_state 新参数

---

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Impact on Phase 4 |
|------------|--------|-------------------|
| 安装到 `~/.claude/code-pal/`，hooks 通过 settings.json 注册 | CLAUDE.md Architecture | --debug-events 输出到 stderr 不影响 statusLine 读取 stdout |
| `core/trigger.py` — resolve_message() 和 detect_git_events() 已实现 | CLAUDE.md Key files | Phase 4 不修改 trigger 逻辑 |
| 原子写入：`os.replace(tmp, STATE_PATH)` | Phase 3 决策 / save_state() 已有 | session_start 写入沿用已有原子写入模式 |
| `_EMPTY_STATE` safe defaults：读取失败回落默认值 | statusline.py 已有 | session_start 容错遵循同一模式（解析失败 → 重置为 now()） |
| Python stdlib only，无外部库 | 项目约束 | Phase 4 无 pip 依赖 |
| 测试覆盖 80%+，TDD 模式 | CLAUDE.md / RULES.md | Wave 0 先写测试，再实现；test_statusline.py 中新增 7 个测试 |
| PEP 8 + 类型注解 | coding-style.md | save_state() 新参数加 `str | None = None` 类型注解 |
| commit 消息格式：`<type>: <desc>` | CLAUDE.md Git | Phase 4 提交用 `feat:` 或 `refactor:` 前缀 |

---

## Sources

### Primary (HIGH confidence)

- `statusline.py`（直接读取）— 当前入口代码，line 96-173 全部分析
- `core/trigger.py`（直接读取）— detect_git_events() 和 resolve_message() 已实现
- `core/git_context.py`（直接读取）— load_git_context() 返回结构确认
- `tests/test_statusline.py`（直接读取）— 现有测试模式，monkeypatch 用法
- `.planning/phases/04-statusline-py/04-CONTEXT.md`（直接读取）— 锁定决策 D-01 到 D-04
- `docs/designs/v2-git-events.md`（直接读取）— --debug-events 输出格式、session_start 语义

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — STA-02 / CFG-02 需求文本
- `.planning/STATE.md` — Phase 3 完成状态，110 测试通过确认

### Tertiary (LOW confidence)

无

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 无新依赖，stdlib + 已有 core 模块，直接读取代码确认
- Architecture: HIGH — 基于实际代码分析，修改范围精确到行号（line 96, 167-168）
- Pitfalls: HIGH — 来自代码读取（实际 bug 位置已确认）和设计决策分析
- Test gaps: HIGH — 对照需求文本和现有测试文件逐项核对

**Research date:** 2026-04-02
**Valid until:** 2026-05-02（稳定代码阶段，无外部依赖版本风险）
