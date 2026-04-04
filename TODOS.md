# TODOS

## Completed

### T2: config.json 版本号，支持未来升级迁移
**Completed:** v3.0.1 (2026-04-04) — `config.json` 现在包含 `"version": "3.0.1"` 字段，通过 `src/schemas/config.ts` 的可选字段和 `scripts/install.js` 默认写入实现。

### T3: /cheer 命令展示当天 git 统计
**Completed:** v3.0.1 (2026-04-04) — `commands/cheer.md` 现在在切换角色前先读取 `state.json` 的 `commits_today`，切换后展示三级统计消息（1-3次/4-9次/≥10次）。

> T4 (CI lint/类型检查) 已在 v3.0 TypeScript 迁移中被取代：CI 已有 `npm run typecheck` (strict mode)，Python 文件标记为 @deprecated。
