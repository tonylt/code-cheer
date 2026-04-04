# TODOS

## Open

### T11: GitHub 仓库 avatar（P1）
**From:** `/office-hours` plan「Nova 视觉标识系统」Deliverable 1（deferred）
**Scope:** 512×512px pixel art Nova avatar for GitHub repository & npm package profile picture
**Needs:** Aseprite / AI pixel art tools (Pal, Pixelicious, etc.) — cannot be generated via pure code
**Design ref:** DESIGN.md — Nova color `#f4a900`, warm dark bg `#1a1410`, kaomoji `(*>ω<)`, Courier New / pixel font

## Completed

### T5: vocab 漂移检测测试
**Completed:** 2026-04-04 — `tests/character.test.ts` 新增 `flatKeys()` 工具函数和 `vocab drift — en/zh key parity` describe 块，枚举 5 个角色的 `.en.json` 文件并递归比对与对应 `.json` 的 key 结构。207/207 测试通过。

### T6: locale 自动检测
**Completed:** 2026-04-04 — `src/statusline.ts` `loadConfig()` 在 `config.language === undefined` 时检查 `process.env.LANG`：`zh_*` → `'zh'`，其他非空值 → `'en'`，未设置 → `undefined`（保留默认中文行为）。try path 和 ENOENT catch path 均覆盖。9 个新测试验证所有分支。

### T9: CONTRIBUTING 语言贡献指引
**Completed:** 2026-04-04 — `CONTRIBUTING.md` 新增「Adding a new language」章节（4 步：创建文件、验证 key parity、注册语言代码、更新 README），位于「Adding a new character」章节之后。

### T10: 无效 language 值 stderr 警告
**Completed:** 2026-04-04 — `src/schemas/config.ts` `parseConfig()` 在 `typeof obj.language === 'string' && obj.language !== '' && obj.language !== 'en' && obj.language !== 'zh'` 时写入 stderr 警告，保持向后兼容（不 throw）。2 个新测试验证 'french' 触发警告、null/'' 不触发。

### T8: README language 文档
**Completed:** 2026-04-04 — `README.md` 新增 `## Configuration` 节，`README.zh.md` 新增 `## 配置` 节，均包含 config.json 示例、language 字段说明（`"zh"` | `"en"`，默认 `"zh"`）及 `.en.json` vocab 文件引用。commit 585b862。

### T7: statusline.ts language 集成测试
**Completed:** 2026-04-04 — `tests/statusline.test.ts` 新增 6 个集成测试，通过 jest.spyOn 验证 `config.language` 在 renderMode×2 + runUpdateCore×2（经由 updateMode）共 4 个 loadCharacter 调用点正确透传。196/196 测试通过。

### T2: config.json 版本号，支持未来升级迁移
**Completed:** v3.0.1 (2026-04-04) — `config.json` 现在包含 `"version": "3.0.1"` 字段，通过 `src/schemas/config.ts` 的可选字段和 `scripts/install.js` 默认写入实现。

### T3: /cheer 命令展示当天 git 统计
**Completed:** v3.0.1 (2026-04-04) — `commands/cheer.md` 现在在切换角色前先读取 `state.json` 的 `commits_today`，切换后展示三级统计消息（1-3次/4-9次/≥10次）。

> T4 (CI lint/类型检查) 已在 v3.0 TypeScript 迁移中被取代：CI 已有 `npm run typecheck` (strict mode)，Python 文件标记为 @deprecated。
