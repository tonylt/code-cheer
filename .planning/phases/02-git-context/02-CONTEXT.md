# Phase 2: Git Context 读取 - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

新建 `core/git_context.py`，实现 `load_git_context(cwd)` 函数，用 4 个并行 subprocess 读取当前 git repo 的状态（提交数、diff 行数、repo 路径、首次提交时间戳），任意 subprocess 失败时静默 fallback 到 0/None，不影响状态栏正常显示。

**Requirement**: STA-03（任意 subprocess 失败时静默 fallback，状态栏正常显示）

**Not in this phase**: 事件检测逻辑（Phase 3）、state.json 集成（Phase 3/4）、session_minutes 计算（Phase 4）

</domain>

<decisions>
## Implementation Decisions

### cwd 获取方式
- **D-01:** `load_git_context(cwd)` 的 `cwd` 参数由 `statusline.py` 传入 `os.getcwd()`
  - Stop hook 以 subprocess 形式调用，继承 Claude Code 的工作目录（即用户正在工作的 repo 目录）
  - 零配置，无需用户设置

### diff_lines 语义
- **D-02:** `diff_lines = insertions + deletions 之和`（不只是 insertions）
  - `git diff --stat HEAD` 输出 "X insertions(+), Y deletions(-)"，取两者之和
  - 语义是"这次改动幅度很大"，大型重构（删旧+写新）也应触发 big_diff
  - 空输出（干净工作目录）→ diff_lines = 0

### repo_path 获取
- **D-03:** 第 4 个并行 subprocess：`git rev-parse --show-toplevel`
  - 不用 os.getcwd() 直接作为 repo_path，因为用户可能在 repo 子目录工作
  - 并行执行不增加总耗时
  - 失败（非 git 目录）→ repo_path = None

### subprocess 数量（设计文档修正）
- **D-04:** 共 4 个并行 subprocess（设计文档说 3 个，Phase 2 成功标准需要 repo_path，合并后为 4 个）:
  1. `git log --oneline --since=midnight` → `commits_today: int`
  2. `git diff --stat HEAD` → `diff_lines: int`（insertions + deletions）
  3. `git log --format="%ai" --since=midnight` → `first_commit_time: str|None`（最早一条）
  4. `git rev-parse --show-toplevel` → `repo_path: str|None`

### 返回结构
- **D-05:** `load_git_context()` 返回 flat dict:
  ```python
  {
      "commits_today": int,    # 默认 0
      "diff_lines": int,       # 默认 0
      "first_commit_time": str | None,  # ISO 格式，默认 None
      "repo_path": str | None  # 绝对路径，默认 None
  }
  ```

### 测试策略
- **D-06:** `unittest.mock.patch` mock subprocess 调用
  - 符合项目已有测试风格（test_trigger.py、test_statusline.py 均用 mock）
  - 覆盖：正常输出解析、单个 subprocess 超时/失败 fallback、全部失败、非 git 目录
  - 不创建真实 git repo（无外部依赖，运行快）

### Claude's Discretion
- git 命令的具体解析逻辑（正则 vs split 等）— Claude 决定最简洁的实现
- `since=midnight` 的具体时间计算（`git log --since=midnight` 依赖 git 本地时间，可接受）
- `concurrent.futures.ThreadPoolExecutor` 的线程池大小

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 设计文档
- `docs/designs/v2-git-events.md` — 完整 v2 设计，包含 git_context.py 架构、并行 subprocess 方案、state.json 新字段定义、容错规则

### 需求
- `.planning/REQUIREMENTS.md` §STA-03 — Phase 2 目标需求（静默 fallback）

### 代码库参考
- `core/trigger.py` — 已有 pure logic 模块风格，git_context.py 应遵循相同模式（无 I/O side effects in logic）
- `.planning/codebase/CONVENTIONS.md` — 命名约定、错误处理模式、docstring 格式
- `.planning/codebase/ARCHITECTURE.md` — 系统架构，了解 git_context.py 在数据流中的位置

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `concurrent.futures`（stdlib）— 设计文档已确定并行方案，直接用 ThreadPoolExecutor
- `core/character.py` 的文件加载模式 — 可参考 `try/except (FileNotFoundError, ...)` 风格

### Established Patterns
- **Pure logic module**: `core/trigger.py` 和 `core/display.py` 均无 I/O，所有 I/O 隔离在 `statusline.py`
  - `core/git_context.py` 是例外：它本身就是 I/O 模块（subprocess），这是正常的
- **Graceful degradation**: 所有外部数据访问都用 `try/except` 返回安全默认值（参见 CONVENTIONS.md）
- **snake_case 函数名**: `load_git_context`、`_run_git_cmd` 等
- **模块级常量**: `SUBPROCESS_TIMEOUT = 5`

### Integration Points
- `statusline.py` 的 `--update` 分支将调用 `load_git_context(os.getcwd())`
- 返回值传给 Phase 3 的 `detect_git_events()` 函数
- 目前 `core/` 只有 `character.py`、`trigger.py`、`display.py`，`git_context.py` 是新增第 4 个模块

### Test Patterns
- `tests/test_trigger.py` — 使用 `unittest.mock.patch("datetime.datetime")` 控制时间
- `tests/test_statusline.py` — 使用 `monkeypatch` 和 `tmp_path`
- 新增：`tests/test_git_context.py`，使用 `unittest.mock.patch("subprocess.run")` 或 patch `concurrent.futures`

</code_context>

<specifics>
## Specific Ideas

- `diff_lines` 解析：从 `git diff --stat HEAD` 最后一行提取 insertions 和 deletions，用正则或 split 均可，两者之和作为 diff_lines
- `first_commit_time`：`git log --format="%ai" --since=midnight` 返回多行（每次提交一行），取最后一行（最早）或第一行（最新）—— 用于 session_minutes 辅助，具体 Phase 3/4 再定
- 在非 git 目录：4 个 subprocess 均会失败，返回 `{"commits_today": 0, "diff_lines": 0, "first_commit_time": None, "repo_path": None}`，状态栏正常显示

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-git-context*
*Context gathered: 2026-04-01*
