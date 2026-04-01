# Phase 5: Vocab + 完整测试 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 05-vocab
**Areas discussed:** vocab JSON 结构, 每事件消息数量与角色风格, TST-02 测试缺口

---

## Vocab JSON 结构

| Option | Description | Selected |
|--------|-------------|----------|
| 方案 A：顶层 git_events 属性 | character.py 用 d.get('git_events', {}) 静默跳过旧文件；结构清晰孤立；向后兼容最简单 | ✓ |
| 方案 B：triggers 内的 git_events 子键 | 与现有 post_tool/random 并列；少改一个层级；但 triggers 语义变宽松 | |

**User's choice:** 方案 A：顶层 git_events 属性
**Notes:** 向后兼容优先，清晰隔离。

---

## character.py 查找方式

| Option | Description | Selected |
|--------|-------------|----------|
| 新增 get_git_event_message(event_key) 方法 | 与现有 pick_message() 并列的新方法；返回随机一条；无 git_events 段时返回 None（静默降级）；由 trigger.py 回落 post_tool | ✓ |
| trigger.py 直接读 vocab['git_events'] | character.py 不动；直接在 resolve_message() 里读 vocab['git_events']；少改一个层级但违背4角色模块化 | |

**User's choice:** 新增 get_git_event_message(event_key) 方法
**Notes:** 保持角色模块化，character.py 封装 vocab 访问。

---

## 每事件消息数量与角色风格

| Option | Description | Selected |
|--------|-------------|----------|
| 3 条（推荐） | 每组 3 条，重复率低而工作量可控，共 96 条新内容（8 事件 × 4 角色 × 3） | ✓ |
| 2 条（最小化） | 满足 ROADMAP 最低要求，共 64 条，相对少 | |
| 4~5 条（丰富） | 每组 4-5 条，共 128~160 条，工作量最大 | |

**User's choice:** 3 条
**Notes:** 与 ROADMAP ~96 条估计吻合。

---

## 消息长度风格

| Option | Description | Selected |
|--------|-------------|----------|
| 与 random 段长度相当，内容更具体 | 引用事件类型（如「今天第一次提交」「大改动」），自然融入角色风格 | ✓ |
| 更短更直接，文字量减少 1/3 | 1、2 句就完，直达切题；建议对事件类消息更堂 | |

**User's choice:** 与 random 段长度相当，内容更具体
**Notes:** 引用事件类型，保持角色个性（Nova 元气、Luna 温柔、Mochi 治愈、Iris 理性）。

---

## TST-02 测试策略

| Option | Description | Selected |
|--------|-------------|----------|
| fixture，与现有测试保持一致（推荐） | test_character.py 已用 tmp_path fixture 隔离 vocab；新测试继续用 fixture vocab 覆盖，速度快且确定性高 | ✓ |
| 一部分用真实 nova.json 验证内容 | 至少一个测试直接读 nova.json，确认所有 6 种事件和每种 ≥ 3 条消息实际存在 | |

**User's choice:** fixture，与现有测试保持一致

---

## TST-02 测试文件组织

| Option | Description | Selected |
|--------|-------------|----------|
| 扩展现有文件（推荐） | character 测试加到 test_character.py，git_events 路径集成测试加到 test_trigger.py；类相关的紧凑在一起 | ✓ |
| 新建 test_vocab.py + test_integration.py | 单独文件隔离，不改动已有测试文件；但会分散角色相关逻辑 | |

**User's choice:** 扩展现有文件

---

## Claude's Discretion

- `get_git_event_message()` 内部随机选择实现（`random.choice` 还是复用 `pick()`）
- 测试 fixture 中 `git_events` 段的 event_key 覆盖范围
- 各角色消息的具体文案

## Deferred Ideas

None — discussion stayed within phase scope
