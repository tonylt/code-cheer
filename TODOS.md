# TODOS

## Open

### T5: vocab 漂移检测测试
**Source:** /autoplan CEO review (2026-04-04) | **Priority:** MEDIUM
添加测试验证所有 `.en.json` 与对应 `.json` 的顶层 key 结构一致，防止未来更新中文 vocab 忘记更新英文版时产生漂移。

### T6: locale 自动检测
**Source:** /autoplan CEO review (2026-04-04) | **Priority:** LOW
当 config.json 未设置 `language` 时，从系统 locale（`process.env.LANG`）自动推断，降低英文用户配置摩擦。

### T7: statusline.ts language 集成测试
**Source:** /autoplan Eng review (2026-04-04) | **Priority:** HIGH
在 statusline.test.ts 添加集成测试验证 `config.language` 在 4 个 loadCharacter 调用点（renderMode×2, runUpdateCore×2）正确传递，防止重构时静默回归。

### T8: README language 文档
**Source:** /autoplan DX review (2026-04-04) | **Priority:** HIGH
在 README.md 和 README.zh.md 添加「配置」章节，说明 `language` 字段用法。英文用户目前必须读源码才能发现此功能。

### T9: CONTRIBUTING 语言贡献指引
**Source:** /autoplan DX review (2026-04-04) | **Priority:** MEDIUM
在 CONTRIBUTING.md 添加「添加新语言」章节，说明如何贡献新语言 vocab 文件。

### T10: 无效 language 值 stderr 警告
**Source:** /autoplan DX Taste Decision (2026-04-04) | **Priority:** LOW
将 `parseConfig` 中无效 language 值的处理从静默忽略升级为 `process.stderr.write` 警告（不 throw，保持向后兼容）。示例：`"language": "french"` → 警告 + 回退到默认行为。

## Completed

### T2: config.json 版本号，支持未来升级迁移
**Completed:** v3.0.1 (2026-04-04) — `config.json` 现在包含 `"version": "3.0.1"` 字段，通过 `src/schemas/config.ts` 的可选字段和 `scripts/install.js` 默认写入实现。

### T3: /cheer 命令展示当天 git 统计
**Completed:** v3.0.1 (2026-04-04) — `commands/cheer.md` 现在在切换角色前先读取 `state.json` 的 `commits_today`，切换后展示三级统计消息（1-3次/4-9次/≥10次）。

> T4 (CI lint/类型检查) 已在 v3.0 TypeScript 迁移中被取代：CI 已有 `npm run typecheck` (strict mode)，Python 文件标记为 @deprecated。
