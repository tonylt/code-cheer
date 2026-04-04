---
phase: 14-config-validation
plan: 01
subsystem: config-validation
tags: [zod, validation, ci, testing]
dependency_graph:
  requires: [src/schemas/index.ts, src/schemas/config.ts]
  provides: [loadConfig-zod-validation, ci-jest-step, ci-setup-smoke-test]
  affects: [src/statusline.ts, .github/workflows/ci.yml, tests/statusline.test.ts]
tech_stack:
  added: []
  patterns: [parseWithReadableError, ConfigSchema, jest-stderr-spy]
key_files:
  created: []
  modified:
    - src/statusline.ts
    - tests/statusline.test.ts
    - .github/workflows/ci.yml
decisions:
  - export loadConfig() for unit testing (not just internal use)
  - catch block wraps parseWithReadableError throw to preserve fallback-to-nova behavior
  - CI smoke test gated on node-version == '20' to avoid duplication across matrix
metrics:
  duration_minutes: 2
  tasks_completed: 4
  tasks_total: 4
  files_modified: 3
  completed_date: "2026-04-04"
requirements_satisfied: [SETUP-02]
---

# Phase 14 Plan 01: Config Validation and CI Gaps Summary

**One-liner:** Zod runtime validation in loadConfig() via parseWithReadableError(ConfigSchema), plus CI Jest step and setup smoke test.

## What Was Built

### Task 1: loadConfig() Zod Runtime Validation

`src/statusline.ts` `loadConfig()` 函数从纯类型断言升级为真正的运行时验证：

**Import 变更（第 9 行）：**
```typescript
// 原来
import { parseState, DEFAULT_STATE } from './schemas'

// 修复后
import { parseState, DEFAULT_STATE, ConfigSchema, parseWithReadableError } from './schemas'
```

**函数体替换（31-38 行）：**
```typescript
// 原来：纯类型断言，无验证
function loadConfig(configPath: string): { character: string } {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as { character: string }
  } catch {
    return { character: 'nova' as const }
  }
}

// 修复后：Zod 运行时验证，导出以便测试
export function loadConfig(configPath: string): ConfigType {
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    return parseWithReadableError(ConfigSchema, JSON.parse(raw), 'config.json')
  } catch {
    return { character: 'nova' }
  }
}
```

`parseWithReadableError` 在 schema 验证失败时向 stderr 输出人类可读的 Zod 错误（包含 `config.json` 标签和 `character` 字段路径），然后 throw。catch 块捕获该异常并 fallback 到 `{ character: 'nova' }`，保持系统健壮性。

### Task 2: loadConfig 测试用例

`tests/statusline.test.ts` 新增独立 `describe('loadConfig')` 块，覆盖两个关键场景：

1. **无效 character 名称（`'novaa'`）**：验证 `process.stderr.write` 被调用，输出包含 `config.json` 和 `character` 关键词，返回值 fallback 到 `{ character: 'nova' }`
2. **config.json 不存在**：验证返回 `{ character: 'nova' }` 且 `stderr` 未被调用

### Task 3: CI Jest 测试步骤

`.github/workflows/ci.yml` `test-node` job 在 "Type check" 和 "Validate cold start" 之间插入：

```yaml
- name: Run Jest tests
  run: npm test
```

任一 Jest 测试失败将阻断 CI job，防止有缺陷的代码合并到 main。

### Task 4: CI Setup Smoke Test

`.github/workflows/ci.yml` `test-node` job 末尾（"Validate cold start" 之后）添加：

```yaml
- name: Smoke test setup script
  if: matrix.node-version == '20'
  run: |
    npm run setup
    test -f "$HOME/.claude/code-pal/dist/statusline.js" || ...
    test -f "$HOME/.claude/code-pal/package.json" || ...
    node "$HOME/.claude/code-pal/dist/statusline.js" || ...
    npm run unsetup
    test ! -d "$HOME/.claude/code-pal" || ...
```

仅在 Node 20 矩阵运行（避免重复）。验证 `npm run setup` 完整安装路径和 `npm run unsetup` 清理行为。

## Verification Results

- `npm run build`: 通过（530.5kb bundle，42ms）
- `npm run typecheck`: 通过（零错误）
- `npm test`: 167/167 测试全部通过，覆盖率 84.29%（>= 80% 阈值）

## Requirements Satisfied

**SETUP-02** 完成：
- JSON 加载时通过 Zod schema 验证（`ConfigSchema`）
- 格式错误（无效 character 名称）通过 `parseWithReadableError` + `z.prettifyError` 输出到 stderr
- 文件不存在时静默 fallback 到 nova（非崩溃）

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Export] Export loadConfig() for unit testing**
- **Found during:** Task 2
- **Issue:** Plan Task 2 中提到 loadConfig 是内部函数需要 export 才能直接测试
- **Fix:** 在 Task 1 修复时同时添加 `export` 关键字
- **Files modified:** src/statusline.ts
- **Commit:** 3591ed9

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 3591ed9 | fix(14-01): add Zod runtime validation to loadConfig() |
| 2 | 4c27bdf | test(14-01): add loadConfig unit tests for Zod validation and missing file fallback |
| 3 | 6460286 | ci(14-01): add Jest test step to test-node job |
| 4 | f33944c | ci(14-01): add setup smoke test to test-node job |

## Self-Check: PASSED
