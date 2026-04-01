# Phase 3: 事件检测与触发 - Research

**Researched:** 2026-04-02
**Domain:** Python pure logic module — event detection, state management, priority dispatch
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** `detect_git_events()` 位于 `core/trigger.py`

**D-02:** 函数签名为 `detect_git_events(git_context: dict, state: dict, config: dict) -> list[str]`
- 接收完整 state（last_git_events、last_repo）
- 接收完整 config（event_thresholds）
- 返回按优先级排序的已触发事件 key 列表，如 `["milestone_5", "big_diff"]`
- 空列表表示无事件触发
- 调用方取 `events[0]` 作为本次消息事件 key

**D-03:** 固定优先级（高到低）：
1. `milestone_5` / `milestone_10` / `milestone_20`
2. `late_night_commit`
3. `big_diff`
4. `big_session`
5. `long_day`
6. `first_commit_today`

**D-04:** Git 事件替换 Priority 2（post_tool），tier=normal 且有事件时用 git_events vocab；tier=normal 无事件时回落 post_tool；usage tier 告警（P1）仍然最优先

**D-05:** per-repo 隔离在 `detect_git_events()` 内部处理；函数比较 `git_context["repo_path"]` 与 `state.get("last_repo")`；不同时将 last_git_events 视为 `[]`（逻辑重置，不直接改 state）；repo_path 为 None 时不视为切换

**D-06:** first_commit_today 触发条件：`commits_today > 0` 且 `"first_commit_today" not in last_git_events`

**D-07:** 从 `config.get("event_thresholds", {})` 读取阈值，缺失字段默认值：
- `big_diff`: 200
- `milestone_counts`: [5, 10, 20]
- `big_session_minutes`: 120
- `long_day_commits`: 15
- `late_night_hour_start`: 22

**D-08:** milestone 细粒度 key（`milestone_5` / `milestone_10` / `milestone_20`）独立去重，互不抑制

### Claude's Discretion

- `session_minutes` 计算方式（Phase 4 负责写入 session_start；Phase 3 中 state 无 session_start 时，big_session 视为未触发）
- 具体 vocab 查找路径（Phase 5 负责，Phase 3 只返回触发 key）
- `resolve_message()` 集成方式：推荐在 statusline.py 先调用 `detect_git_events()`，将结果作为参数传给 `resolve_message()`

### Deferred Ideas (OUT OF SCOPE)

- statusline.py render/update 模式分离（Phase 4）
- session_start 写入 state.json（Phase 4）
- --debug-events 输出（Phase 4）
- render 模式不触发 git subprocess（STA-02，Phase 4）
- vocab git_events 段（Phase 5）
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GIT-01 | 当天首次提交后下一次响应显示 first_commit_today 消息 | D-06：宽松检测 commits_today > 0 且 key 不在 last_git_events |
| GIT-02 | 提交数达 5/10/20 时分别触发 milestone；同阶段当天只触发一次 | D-08：细粒度 key 独立去重；milestone_counts 可配置 |
| GIT-03 | 本地时间 22 点后有提交则触发 late_night_commit | D-07：late_night_hour_start 阈值；datetime.now().hour 比较 |
| GIT-04 | diff 行数 >= 200 时触发 big_diff | D-07：big_diff 阈值；git_context["diff_lines"] 读取 |
| GIT-05 | 会话时长 >= 120 分钟时触发 big_session | D-07：big_session_minutes 阈值；state["session_start"] 缺失时安全跳过 |
| GIT-06 | 当天提交总数 >= 15 时触发 long_day | D-07：long_day_commits 阈值；git_context["commits_today"] 读取 |
| CFG-01 | event_thresholds 字段缺失或部分缺失时静默回落默认值 | D-07：config.get("event_thresholds", {}) + 逐字段 .get(key, default) |
| STA-01 | 切换 git repo 时当天 git 事件状态自动重置 | D-05：repo_path 比较 + 逻辑重置 last_git_events，写操作隔离在 statusline.py |
</phase_requirements>

---

## Summary

Phase 3 在现有 `core/trigger.py` 中新增 `detect_git_events()` 纯函数，将 Phase 2 产出的 `git_context` dict 与 state、config 结合，检测 6 种 git 事件并按优先级返回 key 列表。该函数无 I/O 副作用，所有数据通过参数传入，保持模块风格一致。

Phase 2 已完全完成（74 测试通过），`core/git_context.py` 实际接口与 CONTEXT.md D-05 完全吻合。`load_git_context()` 返回 `{"commits_today": int, "diff_lines": int, "first_commit_time": str|None, "repo_path": str|None}`，Phase 3 可直接消费。

集成点包括两处：(1) `resolve_message()` 的 Priority 2 分支需要感知 git 事件来选择 vocab；(2) `statusline.py` 的 `save_state()` 需要扩展以持久化 `last_git_events`、`last_repo`、`commits_today` 字段。整个 Phase 3 是纯 Python 逻辑，无新依赖。

**Primary recommendation:** 先实现 `detect_git_events()`（独立可测试），再修改 `resolve_message()` 接受 `triggered_events` 参数，最后扩展 `statusline.py` 的 state 读写，确保每个环节单独可验证。

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python stdlib `datetime` | 3.x | 时间比较（late_night_commit、session_minutes）| 已在 trigger.py 使用 |
| Python stdlib `typing` | 3.x | 类型注解 list[str] | 项目风格：所有函数签名有类型注解 |

### Supporting

无新依赖——Phase 3 全部使用已有 stdlib 和项目内模块。

**Installation:** 无需安装新包。

---

## Architecture Patterns

### 推荐项目结构（Phase 3 修改范围）

```
core/
├── trigger.py          # 新增 detect_git_events()；修改 resolve_message() 签名
statusline.py           # 修改 save_state()；新增 last_git_events/last_repo 写入
tests/
├── test_trigger.py     # 扩展：新增 detect_git_events 测试用例
```

### Pattern 1: detect_git_events() 内部执行顺序

**What:** 先处理 per-repo 隔离确定有效 `effective_last_events`，再按优先级从高到低检查每个事件条件，触发则追加到结果列表。

**When to use:** 所有 `--update` 模式调用路径。

**Example:**
```python
def detect_git_events(git_context: dict, state: dict, config: dict) -> list[str]:
    thresholds = config.get("event_thresholds", {})
    big_diff_threshold = thresholds.get("big_diff", 200)
    milestone_counts = thresholds.get("milestone_counts", [5, 10, 20])
    big_session_minutes = thresholds.get("big_session_minutes", 120)
    long_day_commits = thresholds.get("long_day_commits", 15)
    late_night_hour = thresholds.get("late_night_hour_start", 22)

    # per-repo 隔离（D-05）
    current_repo = git_context.get("repo_path")
    last_repo = state.get("last_repo")
    if current_repo is not None and current_repo != last_repo:
        effective_last_events = []
    else:
        raw = state.get("last_git_events", [])
        effective_last_events = raw if isinstance(raw, list) else []

    commits_today = git_context.get("commits_today", 0)
    diff_lines = git_context.get("diff_lines", 0)

    events: list[str] = []

    # P1: milestones（高到低扫描，独立去重）
    for count in sorted(milestone_counts, reverse=True):
        key = f"milestone_{count}"
        if commits_today >= count and key not in effective_last_events:
            events.append(key)

    # P2: late_night_commit
    if commits_today > 0 and datetime.now().hour >= late_night_hour:
        if "late_night_commit" not in effective_last_events:
            events.append("late_night_commit")

    # P3: big_diff
    if diff_lines >= big_diff_threshold:
        if "big_diff" not in effective_last_events:
            events.append("big_diff")

    # P4: big_session
    session_start = state.get("session_start")
    if session_start:
        try:
            start_dt = datetime.fromisoformat(session_start)
            elapsed = (datetime.now() - start_dt).total_seconds() / 60
            if elapsed >= big_session_minutes and "big_session" not in effective_last_events:
                events.append("big_session")
        except (ValueError, TypeError):
            pass

    # P5: long_day
    if commits_today >= long_day_commits and "long_day" not in effective_last_events:
        events.append("long_day")

    # P6: first_commit_today
    if commits_today > 0 and "first_commit_today" not in effective_last_events:
        events.append("first_commit_today")

    return events
```

### Pattern 2: resolve_message() 集成方式

**What:** 保持 `resolve_message()` 签名向后兼容，新增可选参数 `triggered_events`；Priority 2 分支根据此参数决定用 git_events vocab 还是 post_tool vocab。

**When to use:** statusline.py 在调用 `resolve_message()` 之前先调用 `detect_git_events()`，将结果传入。

```python
# statusline.py 调用方式（推荐）
git_context = load_git_context(os.getcwd())
triggered_events = detect_git_events(git_context, state, config)

message, tier = resolve_message(
    character, state, stats, cc_data,
    force_post_tool=update_only,
    triggered_events=triggered_events   # 新增参数
)
```

`resolve_message()` 内部 Priority 2 修改：

```python
# Priority 2: post_tool（含 git 事件替换）
if force_post_tool:
    if triggered_events:
        event_key = triggered_events[0]
        git_events_vocab = triggers.get("git_events", {})
        options = git_events_vocab.get(event_key, triggers["post_tool"])
        return pick_different(options, state.get("message", "")), tier
    return pick_different(triggers["post_tool"], state.get("message", "")), tier
```

注意：Phase 5 添加 vocab git_events 段之前，`triggers.get("git_events", {})` 会返回空 dict，fallback 到 `post_tool` vocab——行为与 Phase 3 暂无 vocab 的阶段兼容。

### Pattern 3: statusline.py save_state() 扩展

**What:** 扩展 `save_state()` 接受并持久化 git 相关字段。

**Why:** state.json 写操作隔离在 statusline.py（trigger 模块只读不写，CONTEXT.md 确认）。

```python
def save_state(message: str, tier: str, slot: str,
               last_git_events: list | None = None,
               last_repo: str | None = None,
               commits_today: int | None = None) -> None:
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
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
```

**Key insight on last_git_events update:** 调用方需要将已触发的新事件追加到 effective_last_events（而不是 state 中的原始 last_git_events），这样 per-repo 重置后触发的事件才能正确记录。具体：

```python
# statusline.py main() --update 分支
git_context = load_git_context(os.getcwd())
triggered_events = detect_git_events(git_context, state, config)

# 重新计算 effective_last_events（与 detect_git_events 内部逻辑对称）
current_repo = git_context.get("repo_path")
if current_repo is not None and current_repo != state.get("last_repo"):
    base_events = []
else:
    base = state.get("last_git_events", [])
    base_events = base if isinstance(base, list) else []

new_last_git_events = list(base_events) + [e for e in triggered_events if e not in base_events]
```

### Anti-Patterns to Avoid

- **在 trigger.py 内写 state.json：** trigger 模块纯逻辑无 I/O，写操作必须隔离在 statusline.py。
- **repo_path=None 时重置 last_git_events：** 非 git 目录 repo_path=None 不视为切换（D-05），避免用户离开 git 目录时误清空记录。
- **late_night_commit 不检查 commits_today：** 如果 commits_today=0 仍触发 late_night_commit，会在深夜启动 Claude 但未提交时误触发。必须加 `commits_today > 0` 前置条件。
- **milestone 从低到高扫描：** 应从高到低（reverse=True），确保 milestone_20 比 milestone_5 更早加入结果列表，符合优先级语义。
- **big_session 未处理 session_start 格式异常：** session_start 可能是非法 ISO 字符串，必须 try/except 包裹 fromisoformat 调用。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 事件优先级排序 | 自定义排序算法 | 按 D-03 固定优先级顺序逐项检查并追加 | 顺序固定，不需要动态排序；追加顺序即是优先级顺序 |
| 时间比较 | 自制时区转换 | `datetime.now().hour` 与阈值直接比较 | D-07 明确：使用本地时间，不转换 UTC |
| 会话时长计算 | 复杂日期库 | `(datetime.now() - datetime.fromisoformat(session_start)).total_seconds() / 60` | stdlib 足够，无需引入 arrow/pendulum |

**Key insight:** Phase 3 的所有逻辑都可以用纯 Python 条件判断表达，无需任何新依赖。

---

## Common Pitfalls

### Pitfall 1: late_night_commit 与 get_time_slot() 范围冲突

**What goes wrong:** `get_time_slot()` 将 18-22 点定义为 "evening"，而 `late_night_commit` 默认阈值也是 22 点。22 点整的提交同时满足 evening slot 和 late_night_commit，行为可接受，但需要明确边界。

**Why it happens:** 两个独立逻辑使用 `>=` 比较 22，`get_time_slot` 范围是 `18 <= hour <= 22`，late_night 是 `hour >= 22`，重叠在整点。

**How to avoid:** late_night_commit 检测使用 `datetime.now().hour >= late_night_hour_start`（含等号），与 get_time_slot 逻辑独立，不共享函数。文档注释中说明 22 点整算 late_night。

**Warning signs:** 用户报告 22 点没有触发 late_night_commit——检查阈值是否用了严格大于（`>`）。

### Pitfall 2: milestone 多个同时触发时优先级顺序

**What goes wrong:** `commits_today=20` 时 milestone_5/10/20 都未在 last_git_events 中，三个同时触发。如果从低到高追加（5→10→20），events[0] 是 milestone_5 而非 milestone_20，与"里程碑重要度最高"的语义相反。

**Why it happens:** milestone_counts 默认值 [5, 10, 20] 是升序，不加 reverse 直接遍历会按升序追加。

**How to avoid:** `for count in sorted(milestone_counts, reverse=True)` 确保 20→10→5 的顺序，events 列表中最高里程碑排最前。

### Pitfall 3: per-repo 重置后新触发事件未正确记录

**What goes wrong:** 切换 repo 后 effective_last_events=[]，detect_git_events 触发了 first_commit_today。statusline.py 需要将新触发的事件追加到空列表后写入 state.json，不能把原来 state["last_git_events"] 当基础。

**Why it happens:** detect_git_events 做了逻辑重置但不改 state，statusline.py 如果直接用 state["last_git_events"] 追加，会把旧 repo 的记录一起带过来。

**How to avoid:** statusline.py 需要重新计算 effective_last_events（与 detect_git_events 内部逻辑对称），以 effective_last_events 为基础追加新触发事件，最后写入 state.json。

**Warning signs:** 切换 repo 后旧 repo 的 milestone 事件仍然出现在 last_git_events 中。

### Pitfall 4: resolve_message() 签名变更破坏现有测试

**What goes wrong:** 如果给 resolve_message() 添加 `triggered_events` 必选参数，所有现有的 test_trigger.py 调用都会报 TypeError。

**Why it happens:** 现有测试直接调用 `resolve_message(CHAR, state, stats, cc_data)`，不传 git 参数。

**How to avoid:** `triggered_events: list | None = None` 作为带默认值的可选参数，现有测试无需修改。当 triggered_events=None 时行为与当前完全一致。

### Pitfall 5: state.json 容错未覆盖 last_git_events 非 list 类型

**What goes wrong:** 如果 state.json 损坏，last_git_events 是字符串或 None，`if "key" not in last_git_events` 在字符串上会做 substring 检查而非 list 成员检查，产生错误的去重结果。

**Why it happens:** state.json 可能被手动编辑或写入失败。

**How to avoid:** 在 detect_git_events 内部明确校验：`raw = state.get("last_git_events", []); effective_last_events = raw if isinstance(raw, list) else []`

---

## Code Examples

### 完整 detect_git_events() 实现参考

```python
# core/trigger.py — 新增函数（Source: CONTEXT.md D-02..D-08 + specifics）
def detect_git_events(git_context: dict, state: dict, config: dict) -> list[str]:
    """Detect triggered git events and return sorted by priority (highest first).

    Returns:
        List of triggered event keys, e.g. ["milestone_10", "big_diff"].
        Empty list if no events triggered.
    """
    thresholds = config.get("event_thresholds", {})
    big_diff_threshold = thresholds.get("big_diff", 200)
    milestone_counts = thresholds.get("milestone_counts", [5, 10, 20])
    big_session_minutes = thresholds.get("big_session_minutes", 120)
    long_day_commits = thresholds.get("long_day_commits", 15)
    late_night_hour = thresholds.get("late_night_hour_start", 22)

    # per-repo isolation: logical reset when repo changes (D-05)
    current_repo = git_context.get("repo_path")
    last_repo = state.get("last_repo")
    if current_repo is not None and current_repo != last_repo:
        effective_last_events: list = []
    else:
        raw = state.get("last_git_events", [])
        effective_last_events = raw if isinstance(raw, list) else []

    commits_today: int = git_context.get("commits_today", 0)
    diff_lines: int = git_context.get("diff_lines", 0)

    events: list[str] = []

    # Priority 1: milestones (highest to lowest, independent dedup) (D-08)
    for count in sorted(milestone_counts, reverse=True):
        key = f"milestone_{count}"
        if commits_today >= count and key not in effective_last_events:
            events.append(key)

    # Priority 2: late_night_commit (D-03, D-07)
    if commits_today > 0 and datetime.now().hour >= late_night_hour:
        if "late_night_commit" not in effective_last_events:
            events.append("late_night_commit")

    # Priority 3: big_diff (D-07)
    if diff_lines >= big_diff_threshold and "big_diff" not in effective_last_events:
        events.append("big_diff")

    # Priority 4: big_session — safe skip if session_start missing (D-07, discretion)
    session_start = state.get("session_start")
    if session_start:
        try:
            start_dt = datetime.fromisoformat(session_start)
            elapsed_minutes = (datetime.now() - start_dt).total_seconds() / 60
            if elapsed_minutes >= big_session_minutes and "big_session" not in effective_last_events:
                events.append("big_session")
        except (ValueError, TypeError):
            pass  # invalid session_start — treat as not set

    # Priority 5: long_day (D-07)
    if commits_today >= long_day_commits and "long_day" not in effective_last_events:
        events.append("long_day")

    # Priority 6: first_commit_today (D-06)
    if commits_today > 0 and "first_commit_today" not in effective_last_events:
        events.append("first_commit_today")

    return events
```

### 测试用例骨架

```python
# tests/test_trigger.py — 扩展区域

from core.trigger import detect_git_events

def make_git_ctx(commits=0, diff=0, repo="/repo/a"):
    return {"commits_today": commits, "diff_lines": diff,
            "first_commit_time": None, "repo_path": repo}

def make_det_state(last_events=None, last_repo="/repo/a", session_start=None):
    s = {"last_git_events": last_events or [], "last_repo": last_repo}
    if session_start:
        s["session_start"] = session_start
    return s

# GIT-01: first_commit_today
def test_detect_first_commit_today():
    events = detect_git_events(make_git_ctx(commits=1), make_det_state(), {})
    assert "first_commit_today" in events

def test_detect_first_commit_today_dedup():
    state = make_det_state(last_events=["first_commit_today"])
    events = detect_git_events(make_git_ctx(commits=3), state, {})
    assert "first_commit_today" not in events

# GIT-02: milestones
def test_detect_milestone_5():
    events = detect_git_events(make_git_ctx(commits=5), make_det_state(), {})
    assert "milestone_5" in events

def test_detect_milestone_independent_dedup():
    state = make_det_state(last_events=["milestone_5"])
    events = detect_git_events(make_git_ctx(commits=10), state, {})
    assert "milestone_5" not in events
    assert "milestone_10" in events

# GIT-04: big_diff
def test_detect_big_diff():
    events = detect_git_events(make_git_ctx(diff=200), make_det_state(), {})
    assert "big_diff" in events

def test_detect_big_diff_custom_threshold():
    events = detect_git_events(
        make_git_ctx(diff=100),
        make_det_state(),
        {"event_thresholds": {"big_diff": 50}}
    )
    assert "big_diff" in events

# CFG-01: missing thresholds fallback
def test_detect_no_config_uses_defaults():
    events = detect_git_events(make_git_ctx(commits=5, diff=200), make_det_state(), {})
    assert "milestone_5" in events
    assert "big_diff" in events

# STA-01: per-repo isolation
def test_detect_repo_switch_resets_events():
    state = make_det_state(last_events=["milestone_5", "first_commit_today"], last_repo="/repo/a")
    ctx = make_git_ctx(commits=3, repo="/repo/b")
    events = detect_git_events(ctx, state, {})
    # After repo switch, last_git_events is effectively []
    assert "first_commit_today" in events  # retriggered

def test_detect_repo_none_no_reset():
    state = make_det_state(last_events=["first_commit_today"], last_repo="/repo/a")
    ctx = make_git_ctx(commits=3, repo=None)  # non-git dir
    events = detect_git_events(ctx, state, {})
    assert "first_commit_today" not in events  # no reset, still deduped
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 单一 `post_tool` vocab | git 事件替换 Priority 2 | Phase 3 | 角色响应上下文感知，不再通用 |
| `late_night_push` 命名 | `late_night_commit` | 设计 Codex 审查 | 触发点语义准确（commit 不需要 push） |
| milestone 单一 key | milestone_5/10/20 细粒度 key | 设计 Codex 审查 | 独立去重，高阶段 milestone 不被低阶段抑制 |

---

## Open Questions

1. **late_night_commit 当天去重语义**
   - What we know: D-03/D-08 定义了 milestone 去重（same-day once），但 CONTEXT.md 未明确 late_night_commit 是否也是当天只触发一次
   - What's unclear: 如果用户深夜持续提交，是否每次都触发（用完 effective_last_events 机制可去重），还是允许重复
   - Recommendation: 与 first_commit_today 保持一致语义——加入 `effective_last_events` 后不再触发（当天一次）；测试中验证

2. **resolve_message() 中 git_events vocab 缺失时的 fallback**
   - What we know: Phase 5 才添加 vocab git_events 段；Phase 3 触发事件时 triggers.get("git_events") 为 None
   - What's unclear: Phase 3 完成后是否需要 stub vocab 才能端到端测试 git 事件消息
   - Recommendation: resolve_message 做双重 fallback（git_events vocab → post_tool vocab），Phase 3 集成测试用 post_tool 消息验证事件触发路径，不依赖 Phase 5

---

## Environment Availability

Step 2.6: SKIPPED（Phase 3 为纯 Python 逻辑修改，无外部依赖；Phase 2 已完成 git subprocess 封装，Phase 3 不直接调用 git）

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | 无（通过 sys.path.insert 解析） |
| Quick run command | `python3 -m pytest tests/test_trigger.py -v` |
| Full suite command | `python3 -m pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GIT-01 | commits_today > 0 且 key 不在 last_git_events 时触发 | unit | `python3 -m pytest tests/test_trigger.py -k "first_commit" -x` | ❌ Wave 0 |
| GIT-02 | milestone_5/10/20 独立触发与去重 | unit | `python3 -m pytest tests/test_trigger.py -k "milestone" -x` | ❌ Wave 0 |
| GIT-03 | hour >= late_night_hour 且 commits_today > 0 | unit | `python3 -m pytest tests/test_trigger.py -k "late_night" -x` | ❌ Wave 0 |
| GIT-04 | diff_lines >= big_diff_threshold | unit | `python3 -m pytest tests/test_trigger.py -k "big_diff" -x` | ❌ Wave 0 |
| GIT-05 | session_start 存在时计算 elapsed；缺失时安全跳过 | unit | `python3 -m pytest tests/test_trigger.py -k "big_session" -x` | ❌ Wave 0 |
| GIT-06 | commits_today >= long_day_commits | unit | `python3 -m pytest tests/test_trigger.py -k "long_day" -x` | ❌ Wave 0 |
| CFG-01 | event_thresholds 完全缺失/部分缺失时默认值生效 | unit | `python3 -m pytest tests/test_trigger.py -k "config" -x` | ❌ Wave 0 |
| STA-01 | repo_path 变化时 effective_last_events 重置；repo_path=None 不重置 | unit | `python3 -m pytest tests/test_trigger.py -k "repo" -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `python3 -m pytest tests/test_trigger.py -v`
- **Per wave merge:** `python3 -m pytest tests/ -v`
- **Phase gate:** Full suite green (现有 74 tests + 新增 Phase 3 tests) before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/test_trigger.py` 中新增 `detect_git_events` 测试用例（GIT-01..06, CFG-01, STA-01）——扩展现有文件，不新建
- [ ] `tests/test_statusline.py` 中新增 `save_state()` 扩展字段测试（last_git_events, last_repo, commits_today 写入）

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 3 |
|-----------|------------------|
| 安装路径 `~/.claude/code-pal/` | state.json 路径不变，Phase 3 无需修改 |
| Stop hook + statusLine 双模式 | detect_git_events 只在 --update 模式调用（render 模式无 git subprocess） |
| 纯 stdlib Python | 无新依赖，datetime/typing 均为 stdlib |
| `core/trigger.py` 无 I/O 副作用 | detect_git_events 纯函数，不写 state；写操作隔离 statusline.py |
| `tests/` 目录放置测试文件 | 扩展 tests/test_trigger.py，不新建 test_detect_git_events.py（CONVENTIONS 允许扩展） |
| 测试框架 pytest | python3 -m pytest tests/ |

---

## Sources

### Primary (HIGH confidence)

- `core/trigger.py` — 现有 resolve_message() 实现，Priority 1-5 链完整，datetime mock 模式确认
- `core/git_context.py` — Phase 2 完成产出，返回结构与 CONTEXT.md D-05 完全一致
- `.planning/phases/03-event-detection/03-CONTEXT.md` — 所有实现决策来源（D-01..D-08）
- `tests/test_trigger.py` — 现有测试风格参考，`@patch('core.trigger.datetime')` 模式已验证
- `statusline.py` — save_state() 现有签名，扩展参考基础

### Secondary (MEDIUM confidence)

- `docs/designs/v2-git-events.md` — v2 完整设计文档，state.json 新字段和容错规则
- `.planning/REQUIREMENTS.md` §GIT-01..06, CFG-01, STA-01 — 验收条件定义

### Tertiary (LOW confidence)

- 无

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 全部使用已有 stdlib 和项目内模块，无新依赖
- Architecture: HIGH — detect_git_events 函数签名、优先级顺序、per-repo 隔离逻辑全部由 CONTEXT.md 锁定决策覆盖
- Pitfalls: HIGH — 基于对现有代码的直接分析（trigger.py get_time_slot 边界、milestone 排序、state 容错）

**Research date:** 2026-04-02
**Valid until:** 2026-05-02（稳定，无外部依赖变化风险）
