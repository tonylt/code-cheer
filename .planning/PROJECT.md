# code-pal

## What This Is

code-pal 是 Claude Code 的状态栏伴侣。4 个动漫风格角色（Nova/Luna/Mochi/Iris）在 Claude Code 状态栏下方展示个性化鼓励消息和 token 用量，在每次 Claude 响应后通过 Stop hook 更新。安装到 `~/.claude/code-pal/`，通过 `settings.json` 挂钩。

## Core Value

角色在开发者正在工作的上下文中感知并回应，而不只是显示通用短语——让每次 Claude 响应都有一点人情味。

## Current Milestone: v2.0 Git 事件驱动角色反应

**Goal:** 让 4 个角色对 Git 操作（提交里程碑、大型 diff、深夜提交、长会话等）产生个性化反应，下一次 Claude 响应后在状态栏显示针对性鼓励消息。

**Target features:**
- `core/git_context.py`（新建）— 3 个并行 subprocess，cwd 参数，80ms 以内
- `core/trigger.py` — detect_git_events()，6 种事件，milestone 细粒度 key
- `statusline.py` — session_start、last_repo 隔离、--debug-events、render 模式只更新 message/tier/slot
- `config.json` — event_thresholds 可配置（5 个阈值 + late_night_hour_start）
- `vocab/*.json` — 4 角色各加 git_events 段（~96 条新消息）
- 测试基础设施 — 安装 pytest，修复 make_cc()，修复 test_display.py 断言

## Requirements

### Validated

<!-- 已实现的 v1 功能 -->

- ✓ 测试基础设施（pytest 9.0.2，make_cc() 修复）— 74/74 tests passing — Validated in Phase 01: test-infrastructure
- ✓ git 状态读取（core/git_context.py）— ThreadPoolExecutor(4) 并行 subprocess，commits_today/diff_lines/first_commit_time/repo_path，失败时静默 fallback — Validated in Phase 02: git-context
- ✓ 4 个角色（Nova/Luna/Mochi/Iris）各有独立 vocab JSON — v1
- ✓ 状态栏展示角色消息 + token 用量（5h 占比、7d 占比、ctx 占比）— v1
- ✓ 4 种消息触发类型：random、time slot、usage tier、post_tool — v1
- ✓ Stop hook 在每次 Claude 响应后调用 `--update` 更新 state.json — v1
- ✓ install.sh 安装到 ~/.claude/code-pal/，非破坏性 patch settings.json — v1
- ✓ /cheer 斜线命令触发角色回应 — v1
- ✓ 原子写入 state.json（os.replace() temp file 模式）— v1
- ✓ GIT-01: first_commit_today 事件检测与消息路由 — Validated in Phase 03: event-detection
- ✓ GIT-02: milestone_5/10/20 独立去重，优先级倒序 — Validated in Phase 03: event-detection
- ✓ GIT-03: late_night_commit（hour >= 22，需有提交）— Validated in Phase 03: event-detection
- ✓ GIT-04: big_diff（diff_lines >= threshold，默认 200）— Validated in Phase 03: event-detection
- ✓ GIT-05: big_session（elapsed >= threshold，默认 120min）— Validated in Phase 03: event-detection
- ✓ GIT-06: long_day（commits_today >= threshold，默认 15）— Validated in Phase 03: event-detection
- ✓ GIT-07: per-repo 隔离（repo 切换时 effective_last_events 逻辑重置）— Validated in Phase 03: event-detection
- ✓ GIT-08: event_thresholds 可配置（5 个阈值，逐字段 .get(key, default)）— Validated in Phase 03: event-detection
- ✓ TEST-02: 110 测试覆盖全部新代码路径（detect_git_events 30 + resolve integration 4 + save_state git 2）— Validated in Phase 03: event-detection
- ✓ STA-02: render 模式纯只读，session_start 首次写入后同天保留跨天重置 — Validated in Phase 04: statusline-py
- ✓ CFG-02: `statusline.py --debug-events` 向 stderr 输出 GIT_CONTEXT / EVENTS_WOULD_FIRE / STATE_SNAPSHOT — Validated in Phase 04: statusline-py
- ✓ TST-02: get_git_event_message() 覆盖 + trigger.py 顶层 git_events 读取路径 + 4 角色 vocab 各含 96 条事件消息 — Validated in Phase 05: vocab

### Active

<!-- v2.0 当前范围 -->

### Out of Scope

- CI/PR 状态感知 — 需要外部 API 或 GitHub CLI，不在 stdlib only 约束内
- 社区 vocab 包 — 12 个月理想状态，v2 先聚焦核心
- 多工作区支持（超出 last_repo 隔离）— 单会话足够，多窗口场景可接受的降级
- 实时 git hook 触发 — 需要侵入用户 git config，install.sh 复杂度翻倍
- /cheer 展示 git 统计 — 延迟到 v2.1（TODOS.md T3）

## Context

- **现有架构**：statusline.py（入口）→ core/trigger.py（消息选择）→ core/display.py（格式化）→ vocab/*.json（对话内容）
- **state.json 位置**：`~/.claude/code-pal/state.json`（全局单文件，v2 加 last_repo 字段实现 per-repo 隔离）
- **stats-cache.json**：`~/.claude/stats-cache.json`（由 Claude Code 写入，包含 rate_limits 嵌套结构）
- **测试现状**：pytest 未安装，make_cc() helper 结构错误，test_display.py 断言过时（用中文旧标签）
- **设计文档**：`docs/designs/v2-git-events.md`（经 eng review + CEO review，11 个发现已全部解决）

## Constraints

- **Tech Stack**: Python 3 stdlib only — 不增加 pip 依赖（安装简单性）
- **Performance**: --update 模式 git 操作总耗时 < 500ms（3 个并行 subprocess，5s timeout/个）
- **Compatibility**: 向后兼容——无 git_events 的旧 vocab 文件静默跳过
- **Install**: 单脚本 install.sh，不破坏用户现有 settings.json

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| git context 只在 --update 读取 | 避免 render 模式（轮询路径）引入 subprocess 延迟 | ✓ Good |
| last_git_events 用数组存储细粒度 key | 防止 milestone_commits 在 5 次后抑制 10/20 次触发 | ✓ Good |
| last_repo 字段实现 per-repo 隔离 | 全局 state.json 在切换 repo 时静默返回错误 git context | ✓ Good |
| render 模式只更新 message/tier/slot | 防止 render 和 Stop hook 竞争写入 git 字段 | ✓ Good |
| concurrent.futures 并行 subprocess | 3 个串行 subprocess ~320ms；并行后由最慢一个决定 ~80ms | ✓ Good |
| session_start 记录到 state.json | 计算 session_minutes 无需额外 subprocess | ✓ Validated in Phase 04 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-02 after Phase 05 (vocab) complete — v2.0 milestone all phases done*
