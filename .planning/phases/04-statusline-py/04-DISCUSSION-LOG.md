# Phase 4: statusline.py 集成 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 04-statusline-py
**Areas discussed:** Render 模式写策略, session_start 重置规则, --debug-events 模式语义

---

## Render 模式写策略

| Option | Description | Selected |
|--------|-------------|----------|
| Render 纯只读，永不写 state | render 模式完全只读取 state.json 显示，任何消息变更都不持久化。--update 是唯一写入方。防止竞争写入，实现最简单。 | ✓ |
| Render 写 state 但合并 git 字段 | render 写时先读取现有 state.json 中的 git 字段，合并写入。实现稍复杂，但首次 render 时消息可以持久化。 | |

**User's choice:** Render 纯只读，永不写 state
**Notes:** 与 PROJECT.md Key Decisions "render 模式只更新 message/tier/slot" 一致，且更彻底——直接不写，消除竞争写入风险。

---

## session_start 重置规则

| Option | Description | Selected |
|--------|-------------|----------|
| 跨天自动重置 | --update 时检查 session_start 日期，不是今天则重置为 now()。跨天会话时长 > 24h 语义不合理。 | ✓ |
| 不重置，持续到清除 state | 只要 session_start 是有效 ISO 时间戳就不覆盖。用户需手动清除 state.json 重置。简单但跨天不合理。 | |

**User's choice:** 跨天自动重置
**Notes:** 配合设计文档的容错规则（session_start 缺失或无效 → 重置为 now()），新增跨天检测逻辑。

---

## --debug-events 模式语义

| Option | Description | Selected |
|--------|-------------|----------|
| 执行完整 update 逻辑，额外输出 debug | 相当于 --update + stderr 调试输出。实际执行 git context 读取和事件检测，结果写入 state。调试时能看到实际运行的完整状态。 | ✓ |
| 独立模式，只读当前 state 不更新 | 只读取 state.json + config.json + git context，输出即将触发的事件，但不实际写入 state。调试移除副作用不会辅助运行一次更新。 | |

**User's choice:** 执行完整 update 逻辑，额外输出 debug
**Notes:** 设计文档已定义输出格式，此决策确认触发行为：--debug-events 隐含 --update 语义。

---

## Claude's Discretion

- `save_state()` 新增 `session_start` 参数的具体实现细节
- `--debug-events` 的 `session_minutes` 计算逻辑
- state.json 容错规则中 `session_start` 无效时的异常处理方式

## Deferred Ideas

None
