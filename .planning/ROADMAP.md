# Roadmap: code-pal

**Milestone:** v3.0 — TypeScript 重写
**Created:** 2026-04-03
**Granularity:** Standard (6 phases)
**Coverage:** 12/12 requirements mapped

---

## Phases

- [x] **Phase 08: 脚手架与 CI** - 建立 TypeScript 构建管线，验证 <100ms 冷启动，扩展 CI 至 Node.js 矩阵 (completed 2026-04-03)
- [x] **Phase 09: Zod Schemas** - 定义 vocab/state/config 的运行时验证 schema，作为所有 core 模块的类型锚点 (completed 2026-04-03)
- [x] **Phase 10: Core 模块移植** - 按依赖顺序移植 display → character → gitContext → trigger，行为与 Python 版本完全一致 (completed 2026-04-03)
- [x] **Phase 11: 入口点** - 实现 statusline.ts 三种运行模式（render / --update / --debug-events），集成所有 core 模块 (completed 2026-04-03)
- [ ] **Phase 12: Jest 测试套件** - 迁移全部 110+ pytest 测试至 Jest，覆盖率 ≥80%，确认移植正确性
- [ ] **Phase 13: 安装切换** - 更新 install.sh 指向 TypeScript 构建产物，Python 源文件标记 @deprecated

---

## Phase Details

### Phase 08: 脚手架与 CI
**Goal**: 开发者可以用 TypeScript 工具链构建和运行项目，CI 同时覆盖 Python 和 Node.js 矩阵
**Depends on**: Phase 07 (v2.1 完成)
**Requirements**: SETUP-01, CI-02
**Success Criteria** (what must be TRUE):
  1. 开发者运行 `npm run build` 后，`dist/statusline.js` 文件存在且可执行
  2. `node dist/statusline.js` 冷启动时间 <100ms（满足 Claude Code statusLine 轮询约束）
  3. GitHub Actions CI 在 push/PR 时同时运行 Python 3.10/3.11/3.12 和 Node.js 20/22 矩阵，任一失败阻断合并
  4. `npm run build` 失败时，错误信息明确指向具体问题而非静默退出
**Plans**: 2 plans
Plans:
- [x] 08-01-PLAN.md — TypeScript 项目脚手架（package.json + tsconfig + src/ stubs + 构建验证）
- [x] 08-02-PLAN.md — CI Node.js 矩阵扩展（test-node job + 用户验证 checkpoint）
**UI hint**: no

### Phase 09: Zod Schemas
**Goal**: 所有 JSON 边界（vocab/state/config）有运行时类型验证，格式错误时输出可读错误而非静默失败
**Depends on**: Phase 08
**Requirements**: SETUP-02
**Success Criteria** (what must be TRUE):
  1. 传入格式正确的 vocab JSON 时，schema 验证通过，返回 TypeScript 类型化对象
  2. 传入缺少必填字段的 vocab JSON 时，错误信息包含字段名和期望类型（而非 "undefined is not a function"）
  3. state.json 和 config.json 各有独立 schema，加载时分别验证
  4. 所有 core 模块可通过 `z.infer<typeof Schema>` 使用类型，无需手写重复 interface
**Plans**: 1 plan
Plans:
- [x] 09-01-PLAN.md — Zod v4 schema 定义（vocab/state/config）+ barrel 导出 + 构建验证

### Phase 10: Core 模块移植
**Goal**: 4 个 core 模块完整移植到 TypeScript，相同输入产生与 Python 版本相同的输出
**Depends on**: Phase 09
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04
**Success Criteria** (what must be TRUE):
  1. 给定相同 stats-cache.json 和 state.json，`display.ts` 输出的 statusLine 字符串与 Python `display.py` 逐字符相同
  2. `character.ts` 成功加载全部 4 个 vocab JSON，任一 JSON 不合 schema 时输出描述性错误而非静默跳过
  3. `gitContext.ts` 并行启动 4 个 git 子进程，其中任一失败时其他进程不受影响，整体返回可用的部分结果
  4. `trigger.ts` 消息选择在所有消息类型（random/time/usage/post_tool/git_events）和优先级分层上与 Python 版本行为一致，per-repo 隔离正确工作
**Plans**: 4 plans
Plans:
- [x] 10-01-PLAN.md — display.ts 移植（render + formatTokens + formatResets + _ctxBar）
- [x] 10-02-PLAN.md — character.ts 移植（loadCharacter + getGitEventMessage + Zod 验证）
- [x] 10-03-PLAN.md — gitContext.ts 移植（Promise.allSettled 并行 git 子进程）
- [x] 10-04-PLAN.md — trigger.ts 移植（6 级优先级逻辑 + detectGitEvents + per-repo 隔离）

### Phase 11: 入口点
**Goal**: `src/statusline.ts` 完整实现三种运行模式，与 Claude Code hook 和 statusLine API 兼容
**Depends on**: Phase 10
**Requirements**: TS-01, TS-02, TS-03
**Success Criteria** (what must be TRUE):
  1. render 模式（无参数）输出单行无尾部换行的 statusLine 字符串，Claude Code statusLine 轮询可正确读取
  2. `--update` 模式完整执行 git 子进程 → 消息选择 → 原子写 state.json 全流程，写入过程中 render 模式不读到半写文件
  3. `--debug-events` flag 向 stderr 输出 GIT_CONTEXT、EVENTS_WOULD_FIRE、STATE_SNAPSHOT 三段诊断信息，内容与 Python `--debug-events` 格式一致
  4. render 模式不读取 stdin（不挂起），`--update` 模式从 stdin 正确读取 Claude Code 传入的 JSON
**Plans**: 1 plan
Plans:
- [ ] 11-01-PLAN.md — statusline.ts 完整入口点（3 种运行模式 + core 模块集成 + smoke test）

### Phase 12: Jest 测试套件
**Goal**: 所有 pytest 测试行为迁移到 Jest，覆盖率达标，作为移植正确性的最终确认
**Depends on**: Phase 11
**Requirements**: TEST-01
**Success Criteria** (what must be TRUE):
  1. `npm test` 输出 110+ 个通过的测试，无跳过，无待实现
  2. Jest 覆盖率报告显示行覆盖率 ≥80%
  3. trigger.test.ts 覆盖所有消息优先级路径、per-repo 隔离逻辑、session 跟踪边界情况
  4. 测试可在 CI（Node.js 20/22 矩阵）中稳定通过，无随机失败（time-sensitive 测试使用 mock 时钟）
**Plans**: 3 plans
Plans:
- [ ] 12-01-PLAN.md — Jest 基础设施（ts-jest 配置 + statusline.ts 可测试性重构）
- [ ] 12-02-PLAN.md — Core 模块测试（display/character/gitContext/trigger 共 100+ 测试）
- [ ] 12-03-PLAN.md — statusline 集成测试 + 覆盖率验收（110+ 测试，≥80% 覆盖率）

### Phase 13: 安装切换
**Goal**: 用户安装后 Claude Code 自动使用 TypeScript 构建产物；Python 版本明确标记为已废弃
**Depends on**: Phase 12 (所有其他需求完成)
**Requirements**: INSTALL-01
**Success Criteria** (what must be TRUE):
  1. 运行 `./install.sh` 后，`~/.claude/settings.json` 中的 statusLine 命令和 Stop hook 均指向 `node [abs-node-path] ~/.claude/code-pal/dist/statusline.js`
  2. 所有 Python 源文件（statusline.py, core/*.py）顶部包含 `# @deprecated: use src/ TypeScript version` 注释
  3. 现有用户重新运行 install.sh 后，功能表现与之前 Python 版本无差异（角色消息、token 显示、git events 均正常）
  4. install.sh 原有的非破坏性 settings.json patch 逻辑保持不变（不清除用户其他配置）
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 08. 脚手架与 CI | 2/2 | Complete   | 2026-04-03 |
| 09. Zod Schemas | 0/1 | Complete    | 2026-04-03 |
| 10. Core 模块移植 | 4/4 | Complete    | 2026-04-03 |
| 11. 入口点 | 0/1 | Complete    | 2026-04-03 |
| 12. Jest 测试套件 | 0/3 | Not started | - |
| 13. 安装切换 | 0/? | Not started | - |

---

## Coverage Map

| Requirement | Phase | Rationale |
|-------------|-------|-----------|
| SETUP-01 | Phase 08 | 构建管线基础，第一步验证 |
| CI-02 | Phase 08 | CI 扩展与脚手架同步完成 |
| SETUP-02 | Phase 09 | 类型锚点，core 模块依赖 |
| CORE-01 | Phase 10 | display.ts 最简单，先移植 |
| CORE-02 | Phase 10 | character.ts 次之 |
| CORE-03 | Phase 10 | gitContext.ts 引入异步 |
| CORE-04 | Phase 10 | trigger.ts 最复杂，依赖前三者 |
| TS-01 | Phase 11 | 入口点集成所有 core 模块 |
| TS-02 | Phase 11 | --update 模式完整流程 |
| TS-03 | Phase 11 | --debug-events 在入口点实现 |
| TEST-01 | Phase 12 | 测试后置，所有模块完成后迁移 |
| INSTALL-01 | Phase 13 | 最终切换，依赖所有其他需求 |

**Total: 12/12 requirements mapped**

---

## Migration Notes

- v3.0 开发期间 install.sh + Python 代码维持**生产状态不变**
- TypeScript 代码在 `src/` 并行开发，不影响现有安装
- Phase 08-12 完成前，Python 版本持续提供生产功能
- Phase 13 是唯一触碰 install.sh 和 Python 文件的阶段

---
*Roadmap created: 2026-04-03*
