# Phase 3: 事件检测与触发 - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

在 `core/trigger.py` 新增 `detect_git_events()` 函数，读取 `config.json` 中的 `event_thresholds` 阈值，检测 6 种 git 事件，整合进现有 `resolve_message()` 优先级链，并在 trigger.py 内部实现 per-repo 隔离（STA-01）。

**Requirements in scope:** GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, GIT-06, CFG-01, STA-01

**Not in this phase:**
- statusline.py 的 render/update 模式分离（Phase 4）
- session_start 写入 state.json（Phase 4）
- --debug-events 输出（Phase 4）
- render 模式不触发 git subprocess（STA-02，Phase 4）
- vocab git_events 段（Phase 5）

</domain>

<decisions>
## Implementation Decisions

### detect_git_events() 函数签名
- **D-01:** 函数位于 `core/trigger.py`（ROADMAP 明确指定，与现有 trigger 模块职责一致）
- **D-02:** 签名为 `detect_git_events(git_context: dict, state: dict, config: dict) -> list[str]`
  - 接收完整 state（需要读取 last_git_events、last_repo）
  - 接收完整 config（需要读取 event_thresholds）
  - **返回按优先级排序的已触发事件 key 列表**，如 `["milestone_5", "big_diff"]`
  - 空列表表示无事件触发
  - 调用方取 `events[0]` 作为本次消息的事件 key
  - Phase 4 的 `--debug-events` 可输出完整列表，知道所有触发事件

### 事件优先级顺序（多事件冲突时按此排序）
- **D-03:** 固定优先级，从高到低：
  1. `milestone_5` / `milestone_10` / `milestone_20`（里程碑，重要度最高）
  2. `late_night_commit`（时间特殊，情感价值高）
  3. `big_diff`（大改动，工作量可见）
  4. `big_session`（长会话，耐力感知）
  5. `long_day`（长天，数量感知）
  6. `first_commit_today`（首次提交，每天最多一次）

### git 事件在 resolve_message() priority chain 中的位置
- **D-04:** Git 事件**替换 Priority 2（post_tool）**
  - Usage tier 告警（P1）仍然优先——critical/warning 是不可误展的用量信号，git 事件等到下次 --update
  - 同一 non-normal tier 持续（PA）→ 保持当前消息，跳过 git 事件
  - **tier 为 normal 且有触发事件时**：用 git_events vocab 替换 post_tool vocab
  - **tier 为 normal 且无触发事件时**：回落到常规 post_tool vocab（原 Priority 2 行为）
  - P3（cache 未过期）、P4（slot 变化）、P5（random fallback）在 --update 模式下通常不走到

### per-repo 隔离（STA-01）
- **D-05:** `detect_git_events()` 内部处理 per-repo 隔离，Phase 3 完整交付 STA-01
  - 函数内部比较 `git_context["repo_path"]` 与 `state.get("last_repo")`
  - **不同时**：将 `last_git_events` 视为 `[]`（逻辑重置，不直接改 state——写操作仍在 statusline.py）
  - 函数返回值基于重置后的 last_git_events 计算，statusline.py 负责将新的 last_repo 和 last_git_events 写入 state.json
  - `repo_path` 为 None（非 git 目录）：视为无 repo 切换，使用当前 last_git_events

### first_commit_today 精确检测逻辑（GIT-01）
- **D-06:** 触发条件：`commits_today > 0` 且 `"first_commit_today" not in last_git_events`
  - 宽松检测，不依赖 commits_today == 1 精确匹配
  - 不受 Stop hook 时序影响（git commit 后 Claude 下一次响应才 fire）
  - 当天第一次出现 commits_today > 0 时触发，之后 last_git_events 中有记录就不再触发

### config 阈值读取（CFG-01）
- **D-07:** `detect_git_events()` 接收 config dict，从 `config.get("event_thresholds", {})` 读取阈值
  - 缺失字段用以下默认值：
    - `big_diff`: 200
    - `milestone_counts`: [5, 10, 20]
    - `big_session_minutes`: 120
    - `long_day_commits`: 15
    - `late_night_hour_start`: 22
  - `late_night_hour_start` 用本地时间（不转换 UTC）

### milestone 去重（GIT-02）
- **D-08:** 细粒度 key：`milestone_5` / `milestone_10` / `milestone_20` 独立去重
  - `commits_today >= 20 and "milestone_20" not in last_git_events` → 触发 milestone_20
  - 依此类推，三个阈值互相独立，不会因为 milestone_5 已触发而抑制 milestone_10

### Claude's Discretion
- `session_minutes` 的计算（Phase 4 负责写入 session_start，Phase 3 接收 state 中的值）
  - 如果 state 中没有 session_start，detect_git_events() 应将 big_session 视为未触发（安全默认）
- 具体的 vocab 查找路径（Phase 5 负责添加 git_events 段，Phase 3 只需确认触发了哪个 key）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 设计文档
- `docs/designs/v2-git-events.md` — 完整 v2 设计，包含事件类型、state.json 新字段、config 结构、容错规则、--debug-events 格式

### 需求
- `.planning/REQUIREMENTS.md` §GIT-01..06 — 6 种事件的验收条件（触发点、去重规则、时间语义）
- `.planning/REQUIREMENTS.md` §CFG-01 — event_thresholds 可配置需求
- `.planning/REQUIREMENTS.md` §STA-01 — per-repo 隔离需求

### 现有代码
- `core/trigger.py` — 当前 resolve_message() 实现，Priority 1-5 链，detect_git_events() 需集成进此文件
- `statusline.py` — 调用方，了解 state.json 读写模式，Phase 3 修改后需配合使用
- `.planning/phases/02-git-context/02-CONTEXT.md` §D-05 — git_context 返回结构定义

### 先前阶段决策
- `.planning/phases/02-git-context/02-CONTEXT.md` — git_context 返回格式、cwd 获取方式

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `trigger.py` 的 `get_time_slot()` — late_night_commit 可直接用 `datetime.now().hour` 与 `late_night_hour_start` 阈值比较
- `trigger.py` 的 `pick()` / `pick_different()` — vocab 消息选择复用
- `statusline.py` 的 `load_config()` / `load_state()` — state 和 config 已在 statusline.py 加载后传入 trigger 函数

### Established Patterns
- **Pure logic**: trigger.py 无 I/O，所有数据通过参数传入
- **Safe defaults**: 每个 config 字段缺失时有明确默认值（参见 D-07）
- **state.json 写操作隔离在 statusline.py**：trigger 函数只读 state，不写；detect_git_events() 返回触发的事件 key，由 statusline.py 决定如何更新 state

### Integration Points
- `resolve_message()` 需要新增 `git_context` 和 `config` 参数（或单独调用 detect_git_events()）
  - 推荐：保持 resolve_message() 签名不变，在 statusline.py 先调用 detect_git_events()，将结果作为参数传给 resolve_message()
  - 具体集成方式由 planner 决定，符合 Phase 4 的分离原则即可
- 测试：`tests/test_trigger.py` 已有 unittest.mock.patch 模式，新增 test_detect_git_events.py 或直接扩展 test_trigger.py

</code_context>

<specifics>
## Specific Ideas

- `detect_git_events()` 内部顺序：先处理 per-repo 隔离（确定有效 last_git_events），再按优先级从高到低检查每个事件条件，把触发的 key 加入结果列表
- milestone 检测示例：`for count in sorted(milestone_counts, reverse=True): if commits_today >= count and f"milestone_{count}" not in effective_last_events: events.append(f"milestone_{count}")`
- big_session 检测需要 state 中的 session_start（Phase 4 负责写入）；Phase 3 中若 session_start 缺失，返回 0 分钟，big_session 不触发

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-event-detection*
*Context gathered: 2026-04-01*
