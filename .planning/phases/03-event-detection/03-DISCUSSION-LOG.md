# Phase 3: 事件检测与触发 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 03-event-detection
**Areas discussed:** git 事件优先级与 priority chain 位置, per-repo 隔离职责边界, first_commit_today 精确检测逻辑, detect_git_events() 返回格式

---

## git 事件优先级与 priority chain 位置

### Q1: critical/warning 用量告警是否应该被 git 事件覆盖？

| Option | Description | Selected |
|--------|-------------|----------|
| Git 事件优先（覆盖 P1） | milestone/big_diff 消息优先，哪怕 token 快耗尽 | |
| Usage tier 告警优先（Git 等下次） | critical/warning 是不可误展的用量信号，应优先于 git 事件 | ✓ |
| Claude 决定 | | |

**User's choice:** Usage tier 告警优先（Git 等下次）
**Notes:** 无

---

### Q2: Git 事件应在 priority chain 哪个位置？

| Option | Description | Selected |
|--------|-------------|----------|
| P2：Git 替换 post_tool | --update 模式下，有 git 事件用 git_events vocab，没有用 post_tool vocab | ✓ |
| P1.5：Git 在 post_tool 之前，常规 post_tool 之后 | tier 正常时先检查 git 事件，再检查 post_tool | |
| Claude 决定 | | |

**User's choice:** P2：Git 替换 post_tool（推荐）
**Notes:** 最简洁，--update 模式路径清晰

---

### Q3: 当多个 git 事件同时触发，哪个消息胜出？

| Option | Description | Selected |
|--------|-------------|----------|
| 按固定优先级顺序选一个 | milestone > late_night > big_diff > big_session > long_day > first_commit | ✓ |
| 随机选一个触发的事件 | 从所有已触发事件中随机选择 | |
| Claude 决定 | | |

**User's choice:** 按固定优先级顺序选一个（推荐）
**Notes:** 可预测，用户能预期在多事件场景哪个消息会显示

---

## per-repo 隔离职责边界

| Option | Description | Selected |
|--------|-------------|----------|
| trigger.py 内部处理（Phase 3 完整交付） | detect_git_events() 接收 git_context 和 state，内部检测切换 | ✓ |
| statusline.py 处理（Phase 4 实现） | Phase 3 函数签名更简单，repo 切换重置移到 Phase 4 | |

**User's choice:** trigger.py 内部处理（Phase 3 完整交付）（推荐）
**Notes:** STA-01 在 Phase 3 scope，完整交付更好

---

## first_commit_today 精确检测逻辑

| Option | Description | Selected |
|--------|-------------|----------|
| commits_today > 0 且未触发过（推荐） | 宽松，不受时序影响 | ✓ |
| commits_today == 1 且未触发过 | 精确但易被时序 bug | |

**User's choice:** commits_today > 0 且未触发过（推荐）
**Notes:** Stop hook 可能在多次提交后才 fire，==1 检测不可靠

---

## detect_git_events() 返回格式

| Option | Description | Selected |
|--------|-------------|----------|
| 按优先级排序的列表 list[str]（推荐） | 如 ["milestone_5", "big_diff"]，调用方取 [0]，--debug-events 输出全部 | ✓ |
| str \| None（只返回最高优先级的一个） | 更简单，但 --debug-events 拿不到全部触发事件 | |
| Claude 决定 | | |

**User's choice:** 按优先级排序的列表 list[str]（推荐）
**Notes:** 对 Phase 4 --debug-events 友好

---

## Claude's Discretion

- 当 state 中缺少 session_start 时，big_session 如何处理（视为 0 分钟，不触发）
- detect_git_events() 与 resolve_message() 的具体集成方式（分开调用 vs 参数传入）

## Deferred Ideas

None — discussion stayed within phase scope
