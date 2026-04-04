---
phase: 15-rename-code-cheer
plan: 02
subsystem: infra
tags: [migration, install, git, github]

# Dependency graph
requires:
  - phase: 15-01
    provides: "code-pal → code-cheer 全局重命名（路径、env var、error prefix）"
provides:
  - "migrateFromLegacy() 自动迁移 config.json + state.json"
  - "state.json 条件初始化（保留迁移后状态）"
  - "GitHub 仓库重命名为 tonylt/code-cheer"
affects: [install, setup, migration]

# Tech tracking
tech-stack:
  added: []
  patterns: ["条件文件初始化模式（preserves migrated state）", "非破坏性迁移（skip when newDir exists）"]

key-files:
  created: []
  modified:
    - scripts/install.js
    - tests/install.test.ts

key-decisions:
  - "migrateFromLegacy 在 newDir 已存在时跳过（D-02）— 防止覆盖用户现有配置"
  - "state.json 从无条件写入改为条件初始化 — 保留迁移后的会话历史"
  - "GitHub 仓库重命名为 checkpoint:human-action — 无法通过 CLI 自动化"

patterns-established:
  - "Migration pattern: check oldDir exists → check newDir absent → create + copy selectively"
  - "Conditional init pattern: fs.existsSync() guard before writeFileSync()"

requirements-completed: [D-02, D-05, D-06]

# Metrics
duration: 18min
completed: 2026-04-04
---

# Phase 15 Plan 02: Migration Logic + GitHub Rename Summary

**自动迁移 ~/.claude/code-pal/ 配置到 code-cheer，条件初始化 state.json 保留会话历史，GitHub 仓库重命名完成**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-04T09:10:00Z
- **Completed:** 2026-04-04T09:28:00Z
- **Tasks:** 2 (1 auto + 1 checkpoint:human-action)
- **Files modified:** 2

## Accomplishments
- migrateFromLegacy() 函数实现，自动复制 config.json + state.json 从旧目录
- state.json 初始化逻辑修复，从无条件覆盖改为条件创建（保留迁移状态）
- 4 个迁移测试覆盖全部场景（成功迁移、跳过已存在、无旧目录、部分迁移）
- GitHub 仓库重命名为 tonylt/code-cheer，本地 remote 更新验证通过

## Task Commits

1. **Task 1: Add migrateFromLegacy + fix state.json conditional init** - `7557459` (feat)
   - migrateFromLegacy(opts) 函数实现
   - copyFiles() state.json 条件初始化
   - main() 调用顺序调整（migrateFromLegacy → copyFiles）
   - 4 个迁移测试（176 tests passing, 85.5% coverage）

2. **Task 2: GitHub repo rename + local remote update** - checkpoint:human-action
   - GitHub UI 手动重命名 code-pal → code-cheer
   - 本地 remote 更新：`git remote set-url origin git@github.com:tonylt/code-cheer.git`
   - 验证通过：`git remote -v` 显示 code-cheer

**Plan metadata:** (本 commit)

## Files Created/Modified
- `scripts/install.js` - 新增 migrateFromLegacy() 函数，修改 copyFiles() state.json 逻辑，调整 main() 调用顺序
- `tests/install.test.ts` - 新增 4 个迁移测试（成功、跳过、无旧目录、部分迁移）

## Decisions Made

**D-02 实现：newDir 已存在时跳过迁移**
- 防止覆盖用户在新目录的现有配置
- 通过 `fs.existsSync(newDir)` 提前返回

**state.json 条件初始化（修复 research pitfall 2）**
- 原逻辑：copyFiles() 无条件覆盖 state.json（清除迁移后的会话历史）
- 新逻辑：仅在 state.json 不存在时初始化
- 保留 migrateFromLegacy() 复制的用户会话状态

**GitHub 重命名作为 checkpoint:human-action**
- GitHub API 需要 token，CLI 自动化复杂度高
- 手动操作更可靠（UI 提供重定向验证）

## Deviations from Plan

None - plan 执行完全符合规范。

## Issues Encountered

None - 迁移逻辑和测试一次通过，GitHub 重命名按预期完成。

## User Setup Required

None - 迁移逻辑在 `npm run setup` 时自动执行，用户无需手动操作。

## Next Phase Readiness

- code-pal → code-cheer 重命名完全完成（路径、GitHub 仓库、迁移逻辑）
- 现有用户升级时自动保留 character 选择和会话历史
- Phase 15 全部完成，v3.1 可发布

---
*Phase: 15-rename-code-cheer*
*Completed: 2026-04-04*
