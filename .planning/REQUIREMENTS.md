# Requirements: code-pal

**Defined:** 2026-04-03
**Core Value:** 角色在开发者工作上下文中感知并回应，而不只是通用短语

## v3.0 Requirements

### 项目脚手架 (SETUP)

- [x] **SETUP-01**: 开发者可运行 `npm run build` 产出 `dist/statusline.js`，`node dist/statusline.js` 冷启动 <100ms（满足 Claude Code statusLine 轮询约束）
- [x] **SETUP-02**: vocab/state/config JSON 在加载时通过 Zod schema 验证，格式错误时输出具体错误信息而非静默失败

### CI 更新 (CI)

- [x] **CI-02**: GitHub Actions CI 新增 Node.js 矩阵（Node 20/22），与现有 Python 3.10/3.11/3.12 矩阵并行运行

### Core 模块移植 (CORE)

- [x] **CORE-01**: `src/core/display.ts` 与 Python `display.py` 输出完全一致——相同输入产生相同 statusLine 字符串
- [x] **CORE-02**: `src/core/character.ts` 可加载 4 个角色 vocab JSON，通过 Zod 验证，schema 不符时抛出描述性错误而非静默跳过
- [ ] **CORE-03**: `src/core/gitContext.ts` 并行运行 3 个 git 子进程，任一失败时静默 fallback，不中断整体 --update 流程
- [x] **CORE-04**: `src/core/trigger.ts` 消息选择行为与 Python `trigger.py` 完全一致（所有消息类型、优先级分层、per-repo 隔离、session 跟踪）

### 入口点 (TS)

- [ ] **TS-01**: render 模式读 state.json 输出单行无换行 statusLine 字符串，与 Claude Code statusLine API 兼容（`process.stdout.write`，无尾部换行）
- [ ] **TS-02**: --update 模式完整执行：并行 git 子进程 → 消息选择 → 原子写 state.json（tmp + renameSync 模式）
- [ ] **TS-03**: --debug-events flag 向 stderr 输出 GIT_CONTEXT / EVENTS_WOULD_FIRE / STATE_SNAPSHOT 诊断信息

### 测试 (TEST)

- [ ] **TEST-01**: Jest 测试套件覆盖所有现有 pytest 行为（110+ 测试迁移，覆盖率 ≥80%）

### 安装切换 (INSTALL)

- [ ] **INSTALL-01**: 全部 TypeScript 模块完成且 Jest 套件全部通过后，install.sh 更新 hook 命令指向 `node [abs-path] ~/.claude/code-pal/dist/statusline.js`；Python 源文件添加 `# @deprecated: use src/ TypeScript version` 注释。**整个 v3.0 开发期间，install.sh 和 Python 代码维持现有生产状态不变。**

## Migration Notes

- v3.0 期间 install.sh + Python 代码为**生产版本**（维护状态，不动）
- TypeScript 代码在 `src/` 目录并行开发，不影响现有安装
- INSTALL-01 是最终切换步骤，依赖所有其他需求完成

## Future Requirements

### 发布与分发

- **PUBLISH-01**: 发布到 npm registry（当前 v3.0 仅 npm package.json 结构就绪，不实际发布）

### 增强功能

- **ENHANCE-01**: `/cheer` 命令展示 git 统计信息（TODOS.md T3，延迟到 v3.1）
- **ENHANCE-02**: 磁盘满时静默失败改为有错误日志（TODOS.md T1）

## Out of Scope

| Feature | Reason |
|---------|--------|
| npm registry publish | v3.0 仅结构就绪，CI publish 步骤延迟 |
| ESM 输出 | CJS 更简单，兼容性更好，Claude Code hook 无需 ESM |
| 删除 Python 文件 | 迁移期保留，INSTALL-01 完成后标记 deprecated，不删除 |
| install.sh 完全 Node.js 化 | shell 脚本保留，仅更新路径引用 |
| 完全重写 install.sh | 非破坏性更新，保留现有 settings.json patch 逻辑 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | Phase 08 | Complete |
| CI-02 | Phase 08 | Complete |
| SETUP-02 | Phase 09 | Complete |
| CORE-01 | Phase 10 | Complete |
| CORE-02 | Phase 10 | Complete |
| CORE-03 | Phase 10 | Pending |
| CORE-04 | Phase 10 | Complete |
| TS-01 | Phase 11 | Pending |
| TS-02 | Phase 11 | Pending |
| TS-03 | Phase 11 | Pending |
| TEST-01 | Phase 12 | Pending |
| INSTALL-01 | Phase 13 | Pending |

**Coverage:**
- v3.0 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---

## Previous Milestones (Archived)

### v2.1 Requirements (Complete)

- [x] **DOC-01**: README 功能亮点列表 — *Validated Phase 06*
- [x] **DOC-02**: Prerequisites 章节（Python 3.8+、git）— *Validated Phase 06*
- [x] **DOC-03**: Tests 章节独立 — *Validated Phase 06*
- [x] **DOC-04**: Troubleshooting 5 场景 Q&A — *Validated Phase 06*
- [x] **CI-01**: GitHub Actions CI（Python 3.10/3.11/3.12）— *Validated Phase 07*

---
*Requirements defined: 2026-04-03*
*Last updated: 2026-04-03 — v3.0 roadmap created, all 12 requirements mapped to phases 08-13*
