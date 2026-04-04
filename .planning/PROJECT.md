# code-cheer

## What This Is

code-cheer 是 Claude Code 的状态栏伴侣。4 个动漫风格角色（Nova/Luna/Mochi/Iris）在 Claude Code 状态栏下方展示个性化鼓励消息和 token 用量，在每次 Claude 响应后通过 Stop hook 更新。安装到 `~/.claude/code-cheer/`，通过 `settings.json` 挂钩。v3.0 完成后为 TypeScript/Node.js 实现，esbuild 单文件 bundle（~40ms 冷启动），零 runtime 依赖。

## Core Value

角色在开发者正在工作的上下文中感知并回应，而不只是显示通用短语——让每次 Claude 响应都有一点人情味。

## Current State (after v3.0)

**Shipped:** v3.1 project rename code-pal → code-cheer — 2026-04-04
**Tech stack:** TypeScript 6 + Node.js + esbuild (single-file CJS bundle)
**Tests:** 176 Jest tests, 85.5% line coverage
**Characters:** 4 public (Nova/Luna/Mochi/Iris) + 1 hidden easter egg
**Install:** `npm run setup` — patches settings.json non-destructively, auto-migrates from ~/.claude/code-pal/
**Python:** All files retained, marked `@deprecated`

## Requirements

### Validated

<!-- 已实现的所有功能 -->

**v1.0 (Python)**
- ✓ 测试基础设施（pytest 9.0.2，make_cc() 修复）— 74/74 tests passing — v1.0
- ✓ git 状态读取（core/git_context.py）— ThreadPoolExecutor(4) 并行 subprocess — v1.0
- ✓ 4 个角色（Nova/Luna/Mochi/Iris）各有独立 vocab JSON — v1.0
- ✓ 状态栏展示角色消息 + token 用量（5h 占比、7d 占比、ctx 占比）— v1.0
- ✓ 4 种消息触发类型：random、time slot、usage tier、post_tool — v1.0
- ✓ Stop hook 在每次 Claude 响应后调用 `--update` 更新 state.json — v1.0
- ✓ install.sh 安装到 ~/.claude/code-cheer/，非破坏性 patch settings.json — v1.0
- ✓ /cheer 斜线命令触发角色回应 — v1.0
- ✓ 原子写入 state.json（os.replace() temp file 模式）— v1.0
- ✓ GIT-01~08: git 事件检测（first_commit_today, milestone_5/10/20, late_night, big_diff, big_session, long_day, per-repo 隔离）— v1.0
- ✓ DOC-01~04: README 功能亮点、Prerequisites、Tests、Troubleshooting — v1.0
- ✓ CI-01: GitHub Actions CI workflow（Python 3.10/3.11/3.12 matrix）— v2.1
- ✓ CHEER-SILENT: /cheer 命令静默执行（read-modify-write 模式）— v2.x

**v3.0 (TypeScript)**
- ✓ SETUP-01: esbuild 单文件 CJS bundle，40ms 冷启动，<100ms 约束满足 — v3.0
- ✓ SETUP-02: Zod v4 所有 JSON 边界运行时验证（vocab/state/config），ConfigSchema 验证 loadConfig() — v3.0
- ✓ CI-02: Node.js 20/22 CI 矩阵，与 Python 矩阵并行，Jest 门控，setup smoke test — v3.0
- ✓ CORE-01: display.ts 与 Python display.py 逐字符对等（ANSI 颜色、token 格式化）— v3.0
- ✓ CORE-02: character.ts 加载 vocab JSON，Zod 验证，schema 不符时描述性错误 — v3.0
- ✓ CORE-03: gitContext.ts 并行 4 git 子进程，Promise.allSettled，任一失败静默 fallback — v3.0
- ✓ CORE-04: trigger.ts 6 级优先级消息选择，per-repo 隔离，可注入 rng — v3.0
- ✓ TS-01: render 模式 process.stdout.write 无尾部换行 statusLine 字符串 — v3.0
- ✓ TS-02: --update 模式 stdin JSON 读取 + 原子写入 state.json（writeFileSync+renameSync）— v3.0
- ✓ TS-03: --debug-events stderr 输出 GIT_CONTEXT / EVENTS_WOULD_FIRE / STATE_SNAPSHOT — v3.0
- ✓ TEST-01: 167 Jest 测试，84% 行覆盖率（>= 80%），覆盖全部 core 模块 + 集成测试 — v3.0
- ✓ INSTALL-01: Node.js install/uninstall scripts，settings.json 非破坏性 patch，所有 Python 文件 @deprecated — v3.0
- ✓ D-01~D-09: 项目全量重命名 code-pal → code-cheer（运行时路径、env var、错误前缀、package name、迁移逻辑、文档）— Validated in Phase 15: rename-code-cheer

### Active

<!-- 下一里程碑需求在此定义 -->

### Out of Scope

- CI/PR 状态感知 — 需要外部 API 或 GitHub CLI
- 社区 vocab 包 — 未来可行，暂不优先
- 多工作区支持（超出 last_repo 隔离）— 单会话足够
- 实时 git hook 触发 — 需要侵入用户 git config
- npm registry 发布 — 考虑中，暂无时间线

## Context

- **现有架构（v3.0）**：`src/statusline.ts`（入口）→ `src/core/trigger.ts`（消息选择）→ `src/core/display.ts`（格式化）→ `vocab/*.json`（对话内容）
- **Bundle**：esbuild → `dist/statusline.js` 单文件 CJS，~530kb，~40ms 冷启动
- **state.json**：`~/.claude/code-cheer/state.json`（全局单文件，last_repo 字段实现 per-repo 隔离）
- **stats-cache.json**：`~/.claude/stats-cache.json`（由 Claude Code 写入，包含 rate_limits 结构）
- **Python**：所有 `core/*.py` 和 `statusline.py` 标记 `@deprecated`，保留但不再维护
- **Characters**：4 公开角色（Nova/Luna/Mochi/Iris）+ 1 隐藏彩蛋（leijun）

## Constraints

- **Tech Stack**: TypeScript + Node.js（v3.0 迁移完成）
- **Performance**: --update 模式 git 操作总耗时 < 500ms（4 个并行 subprocess，Promise.allSettled）
- **Cold Start**: `node dist/statusline.js` < 100ms（实际 ~40ms）
- **Zero Runtime Deps**: Zod 仅 devDependency（bundle 时不包含）
- **Compatibility**: 向后兼容——无 git_events 的旧 vocab 文件静默跳过
- **Install**: `npm run setup` 单命令，不破坏用户现有 settings.json

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| git context 只在 --update 读取 | 避免 render 模式（轮询路径）引入 subprocess 延迟 | ✓ Good |
| last_git_events 用数组存储细粒度 key | 防止 milestone_commits 在 5 次后抑制 10/20 次触发 | ✓ Good |
| last_repo 字段实现 per-repo 隔离 | 全局 state.json 在切换 repo 时静默返回错误 git context | ✓ Good |
| render 模式只更新 message/tier/slot | 防止 render 和 Stop hook 竞争写入 git 字段 | ✓ Good |
| concurrent.futures 并行 subprocess | 3 个串行 subprocess ~320ms；并行后由最慢一个决定 ~80ms | ✓ Good |
| session_start 记录到 state.json | 计算 session_minutes 无需额外 subprocess | ✓ Good |
| esbuild bundle 替代 tsc outDir | 单文件 CJS bundle，冷启动 40ms，满足 <100ms 约束 | ✓ Good — v3.0 |
| Zod v4（非 v3）| 更小 bundle（5.36kb vs 12.47kb gzipped），z.prettifyError API | ✓ Good — v3.0 |
| Promise.allSettled 替代 Promise.all | 防止 fail-fast 静默跳过 --update | ✓ Good — v3.0 |
| 原子写 state.json：writeFileSync(tmp)+renameSync | 防止 render 模式读到半写文件 | ✓ Good — v3.0 |
| process.execPath 获取 node 路径 | nvm/fnm 环境下比 which node 更可靠 | ✓ Good — v3.0 |
| 零 runtime 依赖（Zod 仅 devDep）| 安装简单性，bundle 体积可控 | ✓ Good — v3.0 |
| leijun 角色作为隐藏彩蛋 | README 不展示但功能完整，供发现者使用 | — v3.0 |

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
*Last updated: 2026-04-04 after v3.1 rename — code-pal → code-cheer，安装路径、env var、error prefix 全部更新*
