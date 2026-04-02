# Phase 5: Vocab + 完整测试 - Research

**Researched:** 2026-04-02
**Domain:** Python pytest 测试扩展 + JSON vocab 内容创作
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** `git_events` 放在顶层，与 `meta` / `triggers` 并列
```json
{
  "meta": {...},
  "triggers": {"random": [...], ...},
  "git_events": {
    "first_commit_today": ["消息1", "消息2", "消息3"],
    "milestone_5": ["消息1", "消息2", "消息3"],
    "milestone_10": [...],
    "milestone_20": [...],
    "late_night_commit": [...],
    "big_diff": [...],
    "big_session": [...],
    "long_day": [...]
  }
}
```

**D-02:** 向后兼容：旧 vocab 文件无 `git_events` 段时，`character.py` 用 `d.get("git_events", {})` 静默返回空 dict，不抛异常；触发路径回落到 `post_tool` vocab

**D-03:** `character.py` 新增 `get_git_event_message(event_key: str) -> str | None` 方法
- 从已加载的 vocab 中查找 `git_events.get(event_key, [])` 并随机返回一条
- 若 `git_events` 段不存在，或 `event_key` 不在段内，返回 `None`
- 返回 `None` 时由 `trigger.py` 的 `resolve_message()` 回落到 `post_tool` 消息

**D-04:** 每种事件每个角色 3 条消息，共 96 条新内容（8 事件 × 4 角色 × 3 条 = 96 条）
- 8 个 event key：`first_commit_today` / `milestone_5` / `milestone_10` / `milestone_20` / `late_night_commit` / `big_diff` / `big_session` / `long_day`

**D-05:** 消息风格：长度与各角色 `random` 段相当，内容更具体——引用事件类型，保持各角色个性（Nova 元气系、Luna 温柔系、Mochi 治愈系傲娇猫、Iris 理性女王系）

**D-06:** 扩展现有测试文件，不新建文件
- `tests/test_character.py` — 新增 `get_git_event_message()` 方法的测试
- `tests/test_trigger.py` — 新增 `resolve_message()` git_events 集成测试

**D-07:** 全部使用 fixture（`tmp_path` + `monkeypatch`），与 `test_character.py` 现有模式一致；不依赖真实 vocab 文件

### Claude's Discretion

- `get_git_event_message()` 内部随机选择的具体实现（`random.choice` 还是复用 `pick()`）
- 测试 fixture 中 `git_events` 段的 event_key 覆盖范围（至少测 2 个 key 即可）
- nova.json 等文件中各 key 消息的具体文案——只需保持角色风格，内容质量由 Claude 把控

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TST-02 | 所有 v2 新增代码路径有对应 pytest 测试覆盖（git context、事件检测、去重逻辑、fallback、display 更新、config 阈值读取、per-repo 隔离） | Phase 3/4 已实现所有 v2 代码路径；Phase 5 专注补全缺失的 `get_git_event_message()` 测试、`resolve_message()` git_events 集成测试，以及确认已有测试覆盖率满足需求 |
</phase_requirements>

## Summary

Phase 5 是 v2.0 milestone 的收尾阶段，包含两个独立工作流：（1）为 4 个角色 vocab JSON 文件添加 `git_events` 顶层段，共 96 条新消息内容；（2）为 `character.py` 的新方法 `get_git_event_message()` 及 `resolve_message()` 的 git_events 集成路径编写 pytest 测试。

代码层面变更小而精确：`character.py` 新增一个约 5 行的纯函数方法，`trigger.py` 的 `resolve_message()` 已在 Phase 3 时预留了 `git_events` 整合点（Priority 2 分支已有 `triggers.get("git_events", {})` 调用），但该调用读取的是 `triggers.git_events` 而非顶层 `git_events`。Phase 5 需要确认实际集成点并补全对应测试。

当前测试套件：117 个测试全部通过。`test_trigger.py` 已包含 `test_resolve_git_event_*` 系列测试（4 个），`test_character.py` 有 3 个基础测试。Phase 5 需在这两个文件中扩展，不新建文件。

**Primary recommendation:** 先核实 `resolve_message()` 的 `git_events` 读取路径（triggers 内部 vs 顶层），再决定 vocab JSON 结构和 `character.py` 方法实现，确保路径一致。

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pytest | 9.0.2（已安装） | 测试框架 | 项目既有，已配置，117 测试正在运行 |
| Python stdlib `random` | —— | 随机消息选取 | 与 `trigger.py` 的 `pick()` 一致，无需外部依赖 |
| Python stdlib `json` | —— | vocab 文件读写 | 与 `character.py` `load_character()` 一致 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `unittest.mock.patch` | stdlib | mock `datetime.now()` | 需要控制时间的测试（已有模式） |
| pytest `tmp_path` fixture | pytest builtin | 临时 vocab 文件 | 所有 character/vocab 测试（D-07 要求） |
| pytest `monkeypatch` | pytest builtin | 替换 `VOCAB_DIR` | 隔离 character.py 文件系统依赖 |

**Installation:** 无需额外安装，所有依赖已在项目中。

**Version verification:** `python3 -m pytest --version` → pytest 9.0.2（已确认，2026-04-01）

## Architecture Patterns

### Recommended Project Structure
```
core/
├── character.py     # 新增 get_git_event_message() 方法
└── trigger.py       # resolve_message() 已有 git_events 集成点，Phase 5 验证/补全
vocab/
├── nova.json        # 新增顶层 git_events 段（8 event keys × 3 消息）
├── luna.json        # 同上
├── mochi.json       # 同上
└── iris.json        # 同上
tests/
├── test_character.py  # 扩展：get_git_event_message() 测试
└── test_trigger.py    # 扩展：resolve_message() git_events 集成测试
```

### Pattern 1: character.py 方法签名（D-03）
**What:** 纯函数方法，从已加载的 vocab dict 中查找 git_events 消息
**When to use:** `trigger.py` 调用 `resolve_message()` 时，tier=normal + force_post_tool + triggered_events 非空
**Example:**
```python
# Source: 05-CONTEXT.md §specifics
def get_git_event_message(self, event_key: str) -> str | None:
    events = self.vocab.get("git_events", {})
    messages = events.get(event_key, [])
    return pick(messages) if messages else None
```
注意：`character.py` 当前没有类，只有 `load_character()` 函数返回 dict。`get_git_event_message()` 应实现为**模块级函数**，接收已加载的 vocab dict 和 event_key 参数：
```python
def get_git_event_message(vocab: dict, event_key: str) -> str | None:
    events = vocab.get("git_events", {})
    messages = events.get(event_key, [])
    return pick(messages) if messages else None
```
`trigger.py` 中使用时：`get_git_event_message(character, event_key)`

### Pattern 2: 现有 resolve_message() 集成点（关键发现）
**What:** Phase 3 实现的 `resolve_message()` Priority 2 分支已读取 `triggers.get("git_events", {})`，这是 `character["triggers"]["git_events"]`，**不是** `character["git_events"]`。
**Implication:** vocab JSON 结构有两种可能性：
- Option A（CONTEXT.md D-01 决策）：`git_events` 在顶层，需要修改 `trigger.py` 读取路径为 `character.get("git_events", {})`
- Option B：`git_events` 在 `triggers` 内部，现有 `trigger.py` 代码无需修改

当前代码（`trigger.py` line 151-152）：
```python
git_events_vocab = triggers.get("git_events", {})
options = git_events_vocab.get(event_key, triggers["post_tool"])
```
这里 `triggers = character["triggers"]`，所以读取的是 `character["triggers"]["git_events"]`。

**结论：** CONTEXT.md D-01 规定顶层结构，但 `trigger.py` 读取 `triggers` 内部。**需要规范一致**，有两种合规选项：
1. vocab JSON 将 `git_events` 放入 `triggers` 内（修改 D-01 声明的位置）→ `trigger.py` 不变
2. vocab JSON 使用顶层，修改 `trigger.py` 读取路径 → 调用 `character.get("git_events", {})`

基于 D-01 的明确锁定，应选方案 2（顶层结构），同时修改 `trigger.py` 的读取路径。但也需在 `get_git_event_message()` 中一致读取顶层。

### Pattern 3: fixture 扩展模式（D-07）
**What:** 在 `test_character.py` 的 `fixture_vocab` autouse fixture 中添加 `git_events` 字段
**When to use:** 新增 `get_git_event_message()` 测试时
**Example:**
```python
# Source: 05-CONTEXT.md §specifics
char = {
    "meta": {...},
    "triggers": {...},
    "git_events": {
        "first_commit_today": ["gc1", "gc2", "gc3"],
        "milestone_5": ["m1", "m2", "m3"]
    }
}
```
注意：`fixture_vocab` 是 autouse，添加 `git_events` 字段不影响现有 3 个测试（它们不读取该字段）。

### Pattern 4: resolve_message() 中的 git_events 读取（test_trigger.py）
**What:** 已有 4 个 `test_resolve_git_event_*` 测试，Pattern 分析如下：
- `test_resolve_git_event_uses_post_tool_fallback`：CHAR 无 git_events，期望 fallback 到 post_tool ✓
- `test_resolve_git_event_uses_git_vocab_when_present`：将 git_events 放在 `char["triggers"]["git_events"]` 中 ✓

这 4 个测试已对应 **triggers 内部**结构。如果 Phase 5 改为顶层结构，这些测试需要同步更新。

### Anti-Patterns to Avoid
- **直接访问 `vocab["git_events"]`**：用 `.get("git_events", {})` 保证向后兼容（D-02）
- **在 `fixture_vocab` 外依赖真实 vocab 文件**：所有新测试用 tmp_path 隔离（D-07）
- **新建测试文件**：Phase 5 只扩展现有 `test_character.py` 和 `test_trigger.py`（D-06）
- **创建 Character 类**：`character.py` 是函数式模块，`get_git_event_message()` 应为模块级函数

## Critical Issue: git_events 位置不一致

这是 Phase 5 最重要的发现，规划时必须明确处理：

| 来源 | 声明位置 |
|------|----------|
| CONTEXT.md D-01 | `git_events` 在 vocab 顶层（与 `triggers` 并列） |
| `trigger.py` line 151（已实现代码） | `triggers.get("git_events", {})` → 在 `triggers` 内部 |
| `test_trigger.py` 已有测试 | `char["triggers"]["git_events"]` → 在 `triggers` 内部 |

**Planner 必须在 Wave 0 解决此矛盾，选择一种结构并确保三处（vocab JSON、trigger.py、test fixture）全部一致。**

选项分析：
- **顶层结构（遵从 D-01）**：需修改 `trigger.py` 读取路径 + 更新 4 个已有 `test_resolve_git_event_*` 测试
- **triggers 内部结构（遵从现有代码）**：vocab JSON 中 `git_events` 放在 `triggers` 内，CONTEXT.md D-01 重新解释为"概念层面"的并列，不改代码

推荐选项：**triggers 内部结构**，因为现有代码和测试已就绪，改动最小，风险最低。

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 随机消息选取 | 自定义随机逻辑 | 复用 `trigger.py` 的 `pick()` | 已有函数，保持一致性 |
| 向后兼容检查 | 条件判断块 | `dict.get("git_events", {})` | 一行解决，Python 惯用法 |
| 测试 vocab 隔离 | 创建真实文件 | pytest `tmp_path` + `monkeypatch` | 现有模式，D-07 要求 |

**Key insight:** Phase 5 没有需要手写的复杂逻辑，难点在于内容创作（96 条角色对话）和路径一致性验证。

## Common Pitfalls

### Pitfall 1: git_events 结构不一致
**What goes wrong:** vocab JSON 用顶层结构，但 `trigger.py` 读取 `triggers` 内部，导致 git 消息永远不显示（静默失败，无报错）
**Why it happens:** CONTEXT.md D-01 和现有代码实现不一致
**How to avoid:** Phase 5 第一个任务（Wave 0）明确决定结构，同步修改所有三个位置
**Warning signs:** `test_resolve_git_event_uses_git_vocab_when_present` 失败，或消息显示仍为 post_tool

### Pitfall 2: fixture_vocab autouse 副作用
**What goes wrong:** 修改 `fixture_vocab` 中的 vocab 结构（如添加 `git_events`）破坏现有 3 个测试
**Why it happens:** autouse fixture 对所有测试生效
**How to avoid:** 在原有 fixture dict 中增加 `"git_events"` key，而非替换整个 dict；现有测试不读取该 key，不受影响
**Warning signs:** `test_load_character_returns_triggers` 断言失败

### Pitfall 3: get_git_event_message() 位置误判
**What goes wrong:** 将新方法实现为类方法（`self.xxx`），但 `character.py` 是函数式模块，没有类
**Why it happens:** CONTEXT.md 的伪代码草案用了 `self.vocab` 语法
**How to avoid:** 实现为模块级函数 `get_git_event_message(vocab: dict, event_key: str) -> str | None`，与 `load_character()` 同级
**Warning signs:** `AttributeError: 'dict' object has no attribute 'get_git_event_message'`

### Pitfall 4: 消息数量误算
**What goes wrong:** 以为是 6 事件 × 4 角色 × 3 = 72 条，实际是 8 事件
**Why it happens:** CONTEXT.md D-04 原文写"6 种事件"但列了 8 个 key（`first_commit_today`, `milestone_5`, `milestone_10`, `milestone_20`, `late_night_commit`, `big_diff`, `big_session`, `long_day`）
**How to avoid:** 按照 8 个 key 计算，共 96 条（8 × 4 × 3 = 96）
**Warning signs:** 某个 vocab 文件缺少 `big_session` 或 `long_day` key

### Pitfall 5: 现有 resolve_message git 测试路径依赖
**What goes wrong:** 修改 `trigger.py` 的 `git_events` 读取路径后，4 个已有 `test_resolve_git_event_*` 测试失败
**Why it happens:** 这些测试基于 `triggers` 内部结构编写
**How to avoid:** 如果选择顶层结构方案，同步更新这 4 个测试；如果选择 triggers 内部结构方案，不修改 `trigger.py`
**Warning signs:** 117 个已通过测试中出现新失败

## Code Examples

### get_git_event_message() 实现（模块级函数）
```python
# Source: 05-CONTEXT.md §specifics + character.py 现有风格
from core.trigger import pick  # 或直接 import random

def get_git_event_message(vocab: dict, event_key: str) -> str | None:
    """Get a random git event message for event_key, or None if not found."""
    events = vocab.get("git_events", {})
    messages = events.get(event_key, [])
    return pick(messages) if messages else None
```

### test_character.py 新增测试（扩展 fixture_vocab）
```python
# Source: 05-CONTEXT.md §specifics，遵从 D-07 fixture 模式
from core.character import load_character, get_git_event_message

# fixture_vocab 中添加 git_events（不影响现有测试）:
# char["git_events"] = {"first_commit_today": ["gc1", "gc2"], "milestone_5": ["m1", "m2"]}

def test_get_git_event_message_returns_string():
    c = load_character("nova")
    result = get_git_event_message(c, "first_commit_today")
    assert isinstance(result, str)
    assert result in ["gc1", "gc2"]

def test_get_git_event_message_unknown_key_returns_none():
    c = load_character("nova")
    assert get_git_event_message(c, "nonexistent_event") is None

def test_get_git_event_message_no_git_events_section_returns_none():
    # vocab without git_events key
    c = load_character("nova")
    # nova fixture has git_events; need a separate fixture without it
    vocab_no_git = {"meta": {}, "triggers": {"post_tool": ["p1"]}}
    assert get_git_event_message(vocab_no_git, "first_commit_today") is None
```

### test_trigger.py 新增集成测试（扩展 CHAR fixture）
```python
# Source: 05-CONTEXT.md D-06，遵从现有 CHAR + resolve_message() 测试模式
# 方案 B（triggers 内部结构）
CHAR_WITH_GIT = {
    "meta": {...},
    "triggers": {
        "random": ["r1", "r2"], "time": {...},
        "usage": {"warning": ["w1"], "critical": ["c1"]},
        "post_tool": ["p1", "p2"],
        "git_events": {"first_commit_today": ["git_fc1", "git_fc2"]}
    }
}

def test_resolve_git_event_warning_tier_ignores_events():
    """warning/critical tier 时，git 事件不覆盖告警消息。"""
    state = make_state(tier="warning")
    msg, tier = resolve_message(CHAR_WITH_GIT, state, {}, make_cc(pct=85),
                                force_post_tool=True,
                                triggered_events=["first_commit_today"])
    assert msg == "w1"  # alert persistence wins
```

### vocab JSON git_events 段结构示例（Nova 风格）
```json
"git_events": {
  "first_commit_today": [
    "今天第一个 commit！冲起来！！",
    "开门红！今天从这里起飞！！GO！",
    "第一 commit 到位！今天绝对能赢！！"
  ],
  "milestone_5": [
    "5 个 commit！节奏稳！继续冲！！",
    "第 5 次提交，势头来了！！GO！",
    "5 连 commit！你在发光！！冲！"
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| trigger.py 无 git_events 集成 | Priority 2 已读取 `triggers.git_events` | Phase 3 | Phase 5 只需补内容，不重写逻辑 |
| 无 git_events vocab 段 | 4 个 JSON 文件新增顶层/内部 git_events | Phase 5 | 角色首次对 git 活动有个性化反应 |

**Deprecated/outdated:**
- `trigger.py` 中 `git_events_vocab = triggers.get("git_events", {})` 这行：若选择顶层结构方案，需修改为 `character.get("git_events", {})`

## Open Questions

1. **git_events 在顶层还是 triggers 内部？**
   - What we know: CONTEXT.md D-01 说顶层；`trigger.py` 现有代码读 `triggers` 内部；4 个已有测试基于 triggers 内部
   - What's unclear: D-01 是约束性决策还是示意性描述？
   - Recommendation: 选择 **triggers 内部结构**（改动最小，现有代码/测试零修改），在 PLAN.md 中明确记录此选择并更新对 D-01 的解释

2. **`get_git_event_message()` 是否需要被 trigger.py 的 resolve_message() 直接调用？**
   - What we know: `trigger.py` 已有内联实现（直接 `triggers.get("git_events", {}).get(event_key, ...)`），可能不需要额外的 `character.py` 函数
   - What's unclear: D-03 要求新增此函数，但用处是让测试有明确的单元测试入口
   - Recommendation: 按 D-03 在 `character.py` 新增函数，但 `trigger.py` 可以选择不调用它（已有内联逻辑满足功能）；或 `trigger.py` 改为调用 `get_git_event_message()` 以减少重复

## Environment Availability

Step 2.6: SKIPPED（纯代码/内容修改，无外部依赖）

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | `pytest.ini`（项目根目录，如无则直接 `python3 -m pytest tests/`） |
| Quick run command | `python3 -m pytest tests/test_character.py tests/test_trigger.py -v` |
| Full suite command | `python3 -m pytest tests/ -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TST-02 | `get_git_event_message()` 有效 key 返回字符串 | unit | `pytest tests/test_character.py -k "git_event" -x` | ❌ Wave 0 |
| TST-02 | `get_git_event_message()` 无效 key 返回 None | unit | `pytest tests/test_character.py -k "git_event" -x` | ❌ Wave 0 |
| TST-02 | `get_git_event_message()` 无 git_events 段返回 None | unit | `pytest tests/test_character.py -k "git_event" -x` | ❌ Wave 0 |
| TST-02 | `resolve_message()` tier=normal + git 事件 → git 消息 | integration | `pytest tests/test_trigger.py -k "resolve_git" -x` | ✅ 已有部分 |
| TST-02 | `resolve_message()` 无 git_events 段 → fallback post_tool | integration | `pytest tests/test_trigger.py -k "resolve_git" -x` | ✅ 已有 |
| TST-02 | `resolve_message()` warning/critical tier + git 事件 → 保持告警 | integration | `pytest tests/test_trigger.py -k "warning" -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `python3 -m pytest tests/ -q`
- **Per wave merge:** `python3 -m pytest tests/ -q`
- **Phase gate:** 全套 117+ 测试全部绿色，确认无回归

### Wave 0 Gaps
- [ ] `tests/test_character.py` — 新增 `get_git_event_message()` 3 个测试（需更新 `fixture_vocab` + import）
- [ ] `tests/test_trigger.py` — 新增 warning tier 忽略 git 事件的测试（1 个）
- [ ] `core/character.py` — 新增 `get_git_event_message()` 函数签名

*(现有 `test_resolve_git_event_*` 4 个测试已覆盖 TST-02 的 resolve_message() 基本路径)*

## Sources

### Primary (HIGH confidence)
- `core/trigger.py` — 直接读取，确认 Priority 2 git_events 集成点位于 `triggers.git_events`
- `core/character.py` — 直接读取，确认函数式模块结构（无类）
- `tests/test_character.py` — 直接读取，确认 `fixture_vocab` autouse 模式
- `tests/test_trigger.py` — 直接读取，确认已有 `test_resolve_git_event_*` 4 个测试及其 fixture 结构
- `vocab/nova.json` — 直接读取，确认现有 vocab 结构（meta + triggers，无 git_events）
- `.planning/phases/05-vocab/05-CONTEXT.md` — 所有锁定决策来源

### Secondary (MEDIUM confidence)
- `docs/designs/v2-git-events.md` — 总体 v2 设计，事件 key 定义（与 CONTEXT.md 一致）
- `tests/` 实际运行结果（117 passed）— 确认测试基础设施健康

### Tertiary (LOW confidence)
- 无

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — pytest 已安装且运行，版本确认
- Architecture: HIGH — 所有现有代码直接读取，无假设
- Pitfalls: HIGH — 基于直接代码审查发现，非推断
- Critical Issue (git_events 位置): HIGH — 代码和决策文档矛盾已实证

**Research date:** 2026-04-02
**Valid until:** 2026-04-30（项目稳定，无外部依赖）
