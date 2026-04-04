# TODOS

## T2: config.json 版本号，支持未来升级迁移

**What:** config.json 目前只有 `{"character": "nova"}`，没有版本号。未来如果 state.json 或 config.json 结构发生破坏性变更，install.sh 无法检测用户的已安装版本。

**Why:** v2 在 state.json 加了新字段（last_git_events, commits_today, last_repo），现有的升级方案是直接重置 state.json（install.sh:94-95）。如果未来有需要迁移数据的情况，版本号是先决条件。

**Pros:** install.sh 可以读版本号，针对旧版做迁移脚本。

**Cons:** 增加 install.sh 的升级逻辑复杂度。YAGNI 风险（可能永远用不到）。

**How to fix:** config.json 加 `"version": "2.0.0"`，install.sh 加版本检测逻辑。

**Depends on / blocked by:** 无。

**Context:** Design doc (2026-04-01) 已提到此项。v2 state 字段变化是合适的时机点。

---

## T3: /cheer 命令展示当天 git 统计

**What:** `/cheer` 命令目前回复通用励志消息。v2 安装后 `state.json` 已有 `commits_today` 和 `last_git_events`，`/cheer` 可以在 Claude 回复中动态插入当天 git 活动统计，让励志消息更具体。

**Why:** v2 后 state.json 数据唾手可得。"你今天已经提交了 8 次，这次 big_diff 看起来是突破口！" 比通用短语情感共鸣更强。

**Pros:** 建立在 v2 已有数据上，几乎零额外 IO 成本；让 /cheer 从通用工具变成个性化鼓励。

**Cons:** 需要处理 v2 未安装时的平滑降级（state.json 不存在或 commits_today 为 0 时回落到通用消息）；commands/cheer.md 需要嵌入 state.json 读取逻辑。

**How to fix:** `commands/cheer.md` 加读取 `~/.claude/code-pal/state.json` 的指令，如果 `commits_today > 0` 则在 Claude 回复模板中插入统计信息，否则使用当前通用消息。

**Effort:** S（CC: ~10min）

**Priority:** P3

**Depends on / blocked by:** T0（v2 主功能完成并稳定后实施）。

**Context:** 发现于 v2 CEO review (2026-04-01)，cherry-pick 阶段决定先发 v2 核心功能再迭代 /cheer。

---

> T4 (CI lint/类型检查) 已在 v3.0 TypeScript 迁移中被取代：CI 已有 `npm run typecheck` (strict mode)，Python 文件标记为 @deprecated。
