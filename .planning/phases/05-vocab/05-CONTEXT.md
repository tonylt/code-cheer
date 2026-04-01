# Phase 5: Vocab + 完整测试 - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

为 4 个角色（Nova/Luna/Mochi/Iris）的 vocab 文件添加 `git_events` 段（共 72 条新消息），修改 `character.py` 支持新段的查找，并为所有 v2 新增代码路径补齐 pytest 覆盖（TST-02）。

**Requirements in scope:** TST-02

**Not in this phase:**
- 任何新的 git 事件检测逻辑（Phase 3 已完成）
- statusline.py 的进一步重构（Phase 4 已完成）
- STA-03（git subprocess fallback）的实现——测试覆盖可以包含，但代码已在 core/git_context.py 实现

</domain>

<decisions>
## Implementation Decisions

### Vocab JSON 结构（vocab/*.json 修改方式）
- **D-01:** `git_events` 放在**顶层**，与 `meta` / `triggers` 并列
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
- **D-02:** 向后兼容：旧 vocab 文件无 `git_events` 段时，`character.py` 用 `d.get("git_events", {})` 静默返回空 dict，不抛异常；触发路径回落到 `post_tool` vocab（Phase 3 D-04）

### character.py 扩展
- **D-03:** `character.py` 新增 `get_git_event_message(event_key: str) -> str | None` 方法
  - 从已加载的 vocab 中查找 `git_events.get(event_key, [])` 并随机返回一条
  - 若 `git_events` 段不存在，或 `event_key` 不在段内，返回 `None`
  - 返回 `None` 时由 `trigger.py` 的 `resolve_message()` 回落到 `post_tool` 消息（现有行为）
  - 方法签名与现有 `pick_message()` 风格一致

### 消息数量与风格
- **D-04:** 每种事件每个角色 **3 条**消息，共 72 条新内容（6 事件 × 4 角色 × 3 条 = 72 条）
  - 6 种事件：`first_commit_today` / `milestone_5` / `milestone_10` / `milestone_20` / `late_night_commit` / `big_diff` / `big_session` / `long_day`（注：8 个 key）
  - 实际 8 × 4 × 3 = 96 条（ROADMAP 原估计 ~96 条与此一致）
- **D-05:** 消息风格：长度与各角色 `random` 段相当，内容**更具体**——引用事件类型（如「今天第一次提交」「大改动」「深夜 coding」），保持各角色个性（Nova 元气系、Luna 温柔系、Mochi 治愈系、Iris 理性系）

### TST-02 测试补全策略
- **D-06:** 扩展**现有**测试文件，不新建文件
  - `tests/test_character.py` — 新增 `get_git_event_message()` 方法的测试：
    - 有 git_events 段 + 有效 event_key → 返回字符串
    - 有 git_events 段 + 无效 event_key → 返回 None
    - 无 git_events 段的 vocab → 返回 None（向后兼容）
  - `tests/test_trigger.py` — 新增 `resolve_message()` git_events 集成测试：
    - tier=normal + 有触发事件 → 返回 git_events 消息
    - tier=normal + 有触发事件 + vocab 无 git_events 段 → 回落到 post_tool
    - tier=warning/critical + 有触发事件 → 仍返回 usage 消息（git 事件不覆盖告警）
- **D-07:** 全部使用 **fixture**（`tmp_path` + `monkeypatch`），与 `test_character.py` 现有模式一致；不依赖真实 vocab 文件

### Claude's Discretion
- `get_git_event_message()` 内部随机选择的具体实现（`random.choice` 还是复用 `pick()`）
- 测试 fixture 中 `git_events` 段的 event_key 覆盖范围（至少测 2 个 key 即可）
- nova.json 等文件中各 key 消息的具体文案——只需保持角色风格，内容质量由 Claude 把控

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 设计文档
- `docs/designs/v2-git-events.md` — 完整 v2 设计，包含 state.json 字段、事件类型定义、角色风格说明

### 需求
- `.planning/REQUIREMENTS.md` §TST-02 — 覆盖范围要求
- `.planning/REQUIREMENTS.md` §GIT-01..06 — 6 种事件定义（触发条件、key 名称）

### 先前阶段决策
- `.planning/phases/03-event-detection/03-CONTEXT.md` §D-02/D-03/D-04 — 事件 key 列表、优先级顺序、git_events 在 resolve_message() 的位置
- `.planning/phases/04-statusline-py/04-CONTEXT.md` — session_start 语义（big_session 依赖）

### 现有代码
- `vocab/nova.json` — 现有 vocab 结构示例（meta + triggers，无 git_events 段）
- `core/character.py` — load_character()，需新增 get_git_event_message()
- `core/trigger.py` — resolve_message()，Phase 5 修改以在 git 事件时调用 get_git_event_message()
- `tests/test_character.py` — 现有测试风格（tmp_path + monkeypatch fixture 模式）
- `tests/test_trigger.py` — 现有 resolve_message 测试，Phase 5 扩展

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `character.py` 的 `load_character()` 已返回完整 vocab dict — `get_git_event_message()` 可直接访问加载后的 `vocab["git_events"]`
- `trigger.py` 的 `pick()` 函数 — `get_git_event_message()` 可复用 `pick()` 实现随机选择，保持一致性
- `test_character.py` 的 `fixture_vocab` autouse fixture — 新增测试直接沿用此 fixture，只需在 fixture 中添加 `git_events` 字段

### Established Patterns
- **Fixture 隔离**：`test_character.py` 用 `tmp_path` 创建临时 vocab 文件，`monkeypatch` 替换 `VOCAB_DIR`；Phase 5 新测试遵循同样模式
- **Pure functions**：`character.py` 的函数无 I/O 副作用；`get_git_event_message()` 同样应为纯函数
- **Safe defaults**：`d.get("git_events", {})` 替代 `d["git_events"]`，保持 fallback 风格一致

### Integration Points
- `trigger.py` 的 `resolve_message()` Priority 2 处（Phase 3 D-04）：tier=normal 时先 `get_git_event_message(events[0])`，若返回 None 则回落到 `post_tool`
- 4 个 vocab JSON 文件均需添加 `git_events` 顶层 key

</code_context>

<specifics>
## Specific Ideas

- `get_git_event_message()` 草案：
  ```python
  def get_git_event_message(self, event_key: str) -> str | None:
      events = self.vocab.get("git_events", {})
      messages = events.get(event_key, [])
      return pick(messages) if messages else None
  ```
- resolve_message() 集成点（Phase 3 D-04）：
  ```python
  # tier == normal 且有触发事件时
  if triggered_events:
      msg = char.get_git_event_message(triggered_events[0])
      if msg:
          return msg  # git_events 消息
  # 回落到 post_tool（原 Priority 2）
  ```
- fixture 扩展示例（test_character.py 的 fixture_vocab 添加 git_events）：
  ```python
  char = {
      "meta": {...},
      "triggers": {...},
      "git_events": {
          "first_commit_today": ["gc1", "gc2", "gc3"],
          "milestone_5": ["m1", "m2", "m3"]
      }
  }
  ```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-vocab*
*Context gathered: 2026-04-02*
