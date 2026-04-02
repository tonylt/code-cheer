# Roadmap: code-pal v2.0 — Git 事件驱动角色反应

**Milestone:** v2.0
**Created:** 2026-04-01
**Requirements:** 13 total (13/13 mapped)
**Granularity:** Standard (5 phases)

---

## Phases

- [x] **Phase 1: 测试基础设施** — 安装 pytest，修复 make_cc() helper，确保测试套件 68/68 通过 (completed 2026-04-01)
- [ ] **Phase 2: Git Context 读取** — 新建 core/git_context.py，4 个并行 subprocess 读取提交数 / diff / repo 路径 / 首次提交时间，带 fallback
- [x] **Phase 3: 事件检测与触发** — trigger.py 实现 detect_git_events()，6 种事件，config.json 阈值，per-repo 隔离 (completed 2026-04-01)
- [x] **Phase 4: statusline.py 集成** — session_start 记录，render 模式约束，last_repo 切换重置，--debug-events 输出 (completed 2026-04-01)
- [x] **Phase 5: Vocab + 完整测试** — 4 个角色 vocab 添加 git_events 段，所有新代码路径有 pytest 覆盖 (completed 2026-04-02)

---

## Phase Details

### Phase 1: 测试基础设施
**Goal**: 测试套件可以正常运行，为 v2 所有新代码提供可靠的测试基础
**Depends on**: Nothing (first phase)
**Requirements**: TST-01
**Plans:** 1/1 plans complete
Plans:
- [x] 01-01-PLAN.md — 安装 pytest + 修复 make_cc() helper 使 68/68 测试通过
**Success Criteria** (what must be TRUE):
  1. `python3 -m pytest tests/` 运行通过，没有 ImportError 或 fixture 错误
  2. `make_cc()` helper 生成与真实 stats-cache.json 结构一致的测试对象，现有测试不再因结构不匹配而失败
  3. `test_display.py` 断言与当前 display.py 输出格式对齐，所有断言通过

### Phase 2: Git Context 读取
**Goal**: code-pal 能够从当前 repo 读取 git 状态，失败时静默降级，不影响状态栏正常显示
**Depends on**: Phase 1
**Requirements**: STA-03
**Plans:** 0/1 plans executed
Plans:
- [ ] 02-01-PLAN.md — TDD: 新建 core/git_context.py + tests/test_git_context.py，4 个并行 subprocess 读取 git 状态，静默 fallback
**Success Criteria** (what must be TRUE):
  1. `core/git_context.py` 可读取：当天提交数、HEAD diff 行数、当前 repo 路径（git rev-parse --show-toplevel）
  2. 4 个 subprocess 并行执行，总耗时由最慢一个决定，实测 < 500ms
  3. 任意 subprocess 失败（无 git repo / git 未安装 / 超时 5s）时，对应字段返回 0 或 None，不抛出异常，状态栏正常显示
  4. 在非 git 目录调用时，返回全部为 0 的安全默认结构

### Phase 3: 事件检测与触发
**Goal**: trigger.py 能根据 git context 数据检测 6 种事件，并配合配置阈值和 per-repo 隔离正确触发角色消息
**Depends on**: Phase 2
**Requirements**: GIT-01, GIT-02, GIT-03, GIT-04, GIT-05, GIT-06, CFG-01, STA-01
**Plans:** 2/2 plans complete
Plans:
- [x] 03-01-PLAN.md — TDD: detect_git_events() 纯函数实现 + 全量单元测试
- [x] 03-02-PLAN.md — 集成: resolve_message() 增加 triggered_events 参数 + statusline.py 状态持久化
**Success Criteria** (what must be TRUE):
  1. 当天首次 git 提交后，下一次 Claude 响应时 state.json 包含 `first_commit_today` 事件，角色消息对应该事件
  2. 提交数达到 5 / 10 / 20 时分别触发对应 milestone 消息；同一阶段当天只触发一次（last_git_events 数组去重）
  3. 22 点（可配置）后有提交时触发 `late_night_commit`；diff ≥ 200 行触发 `big_diff`；提交数 ≥ 15 触发 `long_day`；会话时长 ≥ 120 分钟触发 `big_session`
  4. `config.json` 缺少 `event_thresholds` 字段或部分字段缺失时，静默回落到默认值，功能正常
  5. 切换 git repo 时（last_repo 路径不同），当天 git 事件状态自动重置，不携带上一个 repo 的 last_git_events

### Phase 4: statusline.py 集成
**Goal**: statusline.py 入口正确区分 render 模式和 update 模式，集成 session_start 记录、repo 切换重置和 debug 输出
**Depends on**: Phase 3
**Requirements**: STA-02, CFG-02
**Success Criteria** (what must be TRUE):
  1. render 模式（无 `--update`）不执行任何 git subprocess，不覆盖 state.json 中 `last_git_events` / `commits_today` 等 git 字段
  2. `--update` 模式在首次运行时将 `session_start` 写入 state.json，后续调用不覆盖，直到进程重启
  3. `statusline.py --debug-events` 向 stderr 输出：当前 git context 数值、检测到的事件及触发原因、state.json 快照；stderr 内容不污染状态栏渲染
**Plans:** 1/1 plans complete
Plans:
- [x] 04-01-PLAN.md — TDD: render 纯只读 + session_start 记录 + --debug-events stderr 输出
**UI hint**: yes

### Phase 5: Vocab + 完整测试
**Goal**: 4 个角色 vocab 文件包含 git_events 对话内容，所有 v2 新增代码路径有 pytest 覆盖，milestone 可交付
**Depends on**: Phase 4
**Requirements**: TST-02
**Success Criteria** (what must be TRUE):
  1. nova.json / luna.json / mochi.json / iris.json 各自包含 `git_events` 段，覆盖 6 种事件（first_commit_today、milestone_5/10/20、late_night_commit、big_diff、big_session、long_day），每种事件至少 2 条消息
  2. 无 `git_events` 段的旧 vocab 文件加载时静默跳过，不抛出 KeyError
  3. `python3 -m pytest tests/` 覆盖：git context 读取（正常 + fallback）、6 种事件检测、去重逻辑、config 阈值读取、per-repo 隔离、render 模式约束、display 更新；全部通过
  4. 所有新增测试文件放置在 `tests/` 目录，符合现有命名规范
**Plans:** 2/2 plans complete
Plans:
- [x] 05-01-PLAN.md — character.py get_git_event_message() + trigger.py 顶层路径修复 + 测试扩展
- [x] 05-02-PLAN.md — 4 个角色 vocab JSON 添加 git_events 段（96 条消息）

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 测试基础设施 | 1/1 | Complete   | 2026-04-01 |
| 2. Git Context 读取 | 0/1 | Planned    |  |
| 3. 事件检测与触发 | 2/2 | Complete   | 2026-04-01 |
| 4. statusline.py 集成 | 1/1 | Complete   | 2026-04-01 |
| 5. Vocab + 完整测试 | 2/2 | Complete   | 2026-04-02 |

---

## Coverage

| Requirement | Phase |
|-------------|-------|
| TST-01 | Phase 1 |
| STA-03 | Phase 2 |
| GIT-01 | Phase 3 |
| GIT-02 | Phase 3 |
| GIT-03 | Phase 3 |
| GIT-04 | Phase 3 |
| GIT-05 | Phase 3 |
| GIT-06 | Phase 3 |
| CFG-01 | Phase 3 |
| STA-01 | Phase 3 |
| STA-02 | Phase 4 |
| CFG-02 | Phase 4 |
| TST-02 | Phase 5 |

All 13 v2.0 requirements mapped. No orphans.

---

*Created: 2026-04-01*
*Last updated: 2026-04-02 — Phase 5 planned (2 plans, 1 wave)*
