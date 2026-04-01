# Phase 4: statusline.py 集成 - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

修改 `statusline.py`，正确区分 render 模式（只读路径）和 update 模式（写入路径），集成三个新能力：
1. **session_start 记录**：--update 首次运行（或跨天）时将 session_start 写入 state.json
2. **Render 模式纯只读**：render 路径永不写 state.json，消除对 git 字段的覆盖风险
3. **--debug-events 输出**：执行完整 update 逻辑，同时将 git context / 事件 / state 快照输出到 stderr

**Requirements in scope:** STA-02, CFG-02

**Not in this phase:**
- vocab git_events 段（Phase 5）
- 完整测试覆盖（Phase 5）

</domain>

<decisions>
## Implementation Decisions

### Render 模式写策略（STA-02）
- **D-01:** Render 模式（无 `--update`）**纯只读**，永不调用 `save_state()`
  - 读取 state.json 后直接渲染并 print，不写任何字段
  - 消除 render 路径对 `last_git_events`/`commits_today` 等 git 字段的覆盖风险
  - --update 是唯一的 state.json 写入方
  - 当前代码 `elif message != state.get("message") or tier != ...: save_state(message, tier, slot=slot)` 需要移除

### session_start 记录与重置（STA-02 延伸）
- **D-02:** --update 模式在以下情况写入 `session_start = now()`：
  1. state.json 中 `session_start` 字段缺失或无效（非 ISO 时间戳）
  2. `session_start` 的日期不是今天（跨天自动重置）
  - 其余情况保持不变，不覆盖
- **D-03:** `session_start` 通过 `save_state()` 参数传入并持久化到 state.json
  - 新增 `session_start` 参数到 `save_state()` 函数签名（可选，`None` 时不写）

### --debug-events 模式（CFG-02）
- **D-04:** `--debug-events` = `--update` 的调试增强，执行完整 update 逻辑（git context 读取、事件检测、state 写入），同时向 stderr 输出调试信息
  - 用法：`python3 statusline.py --debug-events`
  - 不输出 statusline 渲染结果（不 print 到 stdout）
  - stderr 输出格式（已在设计文档定义）：
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 设计文档
- `docs/designs/v2-git-events.md` — 完整 v2 设计，包含 state.json 新字段定义、--debug-events 输出格式、session_start 语义

### 需求
- `.planning/REQUIREMENTS.md` §STA-02 — render 模式不触发 git subprocess，不覆盖 git 字段
- `.planning/REQUIREMENTS.md` §CFG-02 — --debug-events 输出规范

### 现有代码
- `statusline.py` — 当前入口，Phase 4 主要修改文件；注意 render 模式写 state 的现有行为（line 167-168）需修改
- `core/trigger.py` — resolve_message() 和 detect_git_events() 已实现，Phase 4 不修改 trigger 逻辑
- `core/git_context.py` — load_git_context() 已实现（Phase 2）

### 先前阶段决策
- `.planning/phases/03-event-detection/03-CONTEXT.md` §D-04 — git 事件在 priority chain 中的位置
- `.planning/phases/02-git-context/02-CONTEXT.md` §D-05 — git_context 返回结构

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `save_state()` 函数（statusline.py line 68-92）— 已支持 `last_git_events`/`last_repo`/`commits_today` 可选参数；需新增 `session_start` 可选参数
- `load_state()` / `load_config()` — 已实现，Phase 4 复用
- `load_git_context()` — 已在 Phase 2 实现，--update 路径已调用

### Established Patterns
- **原子写入**：`save_state()` 已用 `os.replace(tmp, STATE_PATH)` 原子写入模式
- **Safe defaults**：state.json 读取失败回落到 `_EMPTY_STATE`，Phase 4 的 `session_start` 容错应遵循同样模式
- **参数可选**：`save_state()` 已有 `last_git_events: list | None = None` 风格，`session_start` 参数应一致

### Integration Points
- `main()` 函数：`update_only = "--update" in sys.argv` 现有逻辑；需新增 `debug_events = "--debug-events" in sys.argv` 判断
- `--debug-events` 应设置 `update_only = True`（或直接检查 `debug_events` 标志覆盖 update 路径）
- render 路径（line 167-168）：移除写 state 的逻辑，改为纯 print

### Current State Issues (to fix)
- Line 151-168：update 模式写 state 逻辑正确；但 render 模式（line 167-168）仍会在消息变更时写 state，需移除
- `session_start` 字段：state.json 中尚不存在，Phase 4 首次写入

</code_context>

<specifics>
## Specific Ideas

- session_start 检测示例：
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
- --debug-events 触发：`sys.argv` 同时检查 `--debug-events`，可与 `update_only` 合并处理：
  ```python
  update_only = "--update" in sys.argv or "--debug-events" in sys.argv
  debug_mode = "--debug-events" in sys.argv
  ```
- stderr 输出：仅在 `debug_mode` 时调用 `print(..., file=sys.stderr)`，不影响 stdout 渲染路径

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-statusline-py*
*Context gathered: 2026-04-02*
