# Requirements: code-pal

**Defined:** 2026-04-01
**Core Value:** 角色在开发者工作上下文中感知并回应，而不只是通用短语

## v2.0 Requirements

Requirements for milestone v2.0 — Git 事件驱动角色反应.

### Git 事件感知 (GIT)

- [x] **GIT-01**: 用户当天首次 git 提交后，状态栏在下一次 Claude 响应时显示 `first_commit_today` 角色消息
- [x] **GIT-02**: 用户当天提交数达到 5 次时显示 `milestone_5` 消息；10 次显示 `milestone_10`；20 次显示 `milestone_20`；每个阶段当天最多触发一次
- [x] **GIT-03**: 用户在本地时间 22 点（可配置）后有 git 提交时，显示 `late_night_commit` 角色消息
- [x] **GIT-04**: 当次响应时 HEAD 的 diff 行数 ≥ 200（可配置）时，显示 `big_diff` 角色消息
- [x] **GIT-05**: 当天会话时长（从 `session_start` 起）≥ 120 分钟（可配置）时，显示 `big_session` 角色消息
- [x] **GIT-06**: 当天 git 提交总数 ≥ 15（可配置）时，显示 `long_day` 角色消息

### 配置与可观测性 (CFG)

- [x] **CFG-01**: 用户通过 `config.json` 的 `event_thresholds` 字段自定义触发阈值（big_diff / milestone_counts / big_session_minutes / long_day_commits / late_night_hour_start），字段缺失时回落默认值
- [ ] **CFG-02**: `statusline.py --debug-events` 输出当前 git context、会触发的事件及原因、state.json 快照到 stderr

### 稳定性与隔离 (STA)

- [x] **STA-01**: 切换 git repo 时，当天 git 事件状态自动重置（通过 `last_repo` 字段检测路径变化）
- [ ] **STA-02**: render 模式（statusline 轮询路径）不触发 git subprocess，不覆盖 `last_git_events`/`commits_today` 等 git 相关字段
- [ ] **STA-03**: 任意 git subprocess 失败（超时 / 无 repo / git 未安装）时，静默 fallback 到 0，状态栏正常显示，不抛出异常

### 测试基础设施 (TST)

- [x] **TST-01**: pytest 已安装；`make_cc()` helper 修复为正确的 stats-cache 结构；`test_display.py` 断言更新匹配当前输出格式
- [ ] **TST-02**: 所有 v2 新增代码路径有对应 pytest 测试覆盖（git context、事件检测、去重逻辑、fallback、display 更新、config 阈值读取、per-repo 隔离）

## Future Requirements

### v2.1

- **CHEER-01**: /cheer 命令读取 `state.json` commits_today 并动态插入统计（TODOS.md T3）

### v3+

- CI/PR 状态感知
- 社区 vocab 包
- Streak 连续提交追踪
- 多工作区支持

## Out of Scope

| Feature | Reason |
|---------|--------|
| CI/PR 状态感知 | 需要外部 API，不在 stdlib only 约束内 |
| 社区 vocab 包 | 12 个月理想状态，v2 先聚焦核心 |
| 实时 git hook 触发 | 侵入用户 git config，install.sh 复杂度翻倍 |
| /cheer git 统计 | 延迟到 v2.1，先让核心稳定 |
| 多工作区（超出 last_repo） | 单会话足够，多窗口降级可接受 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TST-01 | Phase 1 | Complete |
| STA-03 | Phase 2 | Pending |
| GIT-01 | Phase 3 | Complete |
| GIT-02 | Phase 3 | Complete |
| GIT-03 | Phase 3 | Complete |
| GIT-04 | Phase 3 | Complete |
| GIT-05 | Phase 3 | Complete |
| GIT-06 | Phase 3 | Complete |
| CFG-01 | Phase 3 | Complete |
| STA-01 | Phase 3 | Complete |
| STA-02 | Phase 4 | Pending |
| CFG-02 | Phase 4 | Pending |
| TST-02 | Phase 5 | Pending |

**Coverage:**
- v2.0 requirements: 13 total
- Mapped to phases: 13 (roadmap complete)
- Unmapped: 0

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 — traceability updated after roadmap creation*
