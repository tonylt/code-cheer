# Phase 2: Git Context 读取 - Research

**Researched:** 2026-04-01
**Domain:** Python subprocess / concurrent.futures / git CLI 集成
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `load_git_context(cwd)` 的 `cwd` 参数由 `statusline.py` 传入 `os.getcwd()`
- **D-02:** `diff_lines = insertions + deletions 之和`（从 `git diff --stat HEAD` 最后一行解析）
- **D-03:** 第 4 个并行 subprocess：`git rev-parse --show-toplevel`，失败时 `repo_path = None`
- **D-04:** 共 4 个并行 subprocess（不是 3 个）：
  1. `git log --oneline --since=midnight` → `commits_today: int`
  2. `git diff --stat HEAD` → `diff_lines: int`（insertions + deletions）
  3. `git log --format="%ai" --since=midnight` → `first_commit_time: str|None`（最早一条）
  4. `git rev-parse --show-toplevel` → `repo_path: str|None`
- **D-05:** 返回 flat dict：`{"commits_today": int, "diff_lines": int, "first_commit_time": str|None, "repo_path": str|None}`
- **D-06:** 测试用 `unittest.mock.patch` mock subprocess 调用，不创建真实 git repo

### Claude's Discretion

- git 命令的具体解析逻辑（正则 vs split 等）— 选择最简洁的实现
- `--since=midnight` 的具体时间计算（git log --since=midnight 依赖 git 本地时间，可接受）
- `concurrent.futures.ThreadPoolExecutor` 的线程池大小

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STA-03 | 任意 git subprocess 失败（超时 / 无 repo / git 未安装）时，静默 fallback 到 0，状态栏正常显示，不抛出异常 | subprocess.run timeout 参数 + try/except CalledProcessError + concurrent.futures Future.exception() 全部覆盖此需求 |
</phase_requirements>

---

## Summary

Phase 2 的目标是新建 `core/git_context.py`，实现 `load_git_context(cwd: str) -> dict` 函数。该函数用 4 个并行 subprocess 读取 git 状态，任意 subprocess 失败时静默 fallback，返回安全默认值，保证状态栏正常显示。

技术栈已完全确定：Python stdlib 的 `subprocess` 模块 + `concurrent.futures.ThreadPoolExecutor`，无第三方依赖。这与项目现有的"只用 stdlib"原则完全一致。

核心挑战不是 API 选择，而是三个具体的实现细节：(1) 如何正确解析 `git diff --stat HEAD` 的输出以提取 insertions + deletions 之和；(2) 如何处理 ThreadPoolExecutor 中 Future 超时与异常的关系；(3) 如何在非 git 目录时让 4 个 subprocess 全部安全失败并返回默认值。

**Primary recommendation:** 用 `ThreadPoolExecutor(max_workers=4)` 提交 4 个 `_run_git_cmd()` 调用，每个用 `subprocess.run(..., timeout=5, capture_output=True, text=True, check=False)` 执行，捕获 `subprocess.TimeoutExpired` 和 `Exception`，返回 `None` 作为失败信号，主函数将 `None` 转换为对应字段的默认值。

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `subprocess` | stdlib | 执行 git 命令，获取输出 | Python stdlib，无需安装，`subprocess.run` 是标准 API |
| `concurrent.futures` | stdlib | ThreadPoolExecutor 并行执行 4 个 subprocess | stdlib，比 threading 更高层，比 asyncio 更适合 subprocess I/O |
| `re` | stdlib | 解析 `git diff --stat` 输出中的数字 | 比 split 更健壮（处理单/复数、缺失字段） |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `os` | stdlib | 传递 `cwd` 参数给 subprocess | subprocess.run 的 cwd 参数需要绝对路径 |
| `unittest.mock` | stdlib | 测试中 mock subprocess.run | 项目已有使用，D-06 锁定测试策略 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ThreadPoolExecutor` | `asyncio.create_subprocess_exec` | asyncio 更适合事件循环环境，但 statusline.py 是同步脚本，ThreadPoolExecutor 更简单 |
| `subprocess.run` | `subprocess.check_output` | check_output 在非零返回码时抛出异常，需要额外 try/except；run + check=False 更干净 |
| `re` 解析 diff | `str.split()` | split 在空输出或格式变化时脆弱；re 更明确 |

**Installation:** 无需安装，全部 stdlib。

---

## Architecture Patterns

### Recommended Project Structure

```
core/
├── git_context.py   # 新增：git subprocess I/O 模块
├── character.py     # 已有
├── trigger.py       # 已有
└── display.py       # 已有
tests/
└── test_git_context.py  # 新增：对应单元测试
```

### Pattern 1: I/O 模块 + 静默 fallback

**What:** `git_context.py` 是一个 I/O 模块（不是 pure logic），负责所有 git subprocess 调用。所有异常在模块内部处理，不向上传播。

**When to use:** 所有访问外部进程/文件的函数都应遵循此模式（见 CONVENTIONS.md Error Handling 章节）。

**Example:**
```python
# core/git_context.py
import subprocess
import re
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

SUBPROCESS_TIMEOUT = 5  # 模块级常量，snake_case 为 SCREAMING_SNAKE_CASE

_SAFE_DEFAULT = {
    'commits_today': 0,
    'diff_lines': 0,
    'first_commit_time': None,
    'repo_path': None,
}

def _run_git_cmd(args: list[str], cwd: str) -> str | None:
    """Run a git command and return stdout, or None on any failure."""
    try:
        result = subprocess.run(
            args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
            check=False,
        )
        if result.returncode == 0:
            return result.stdout.strip()
        return None
    except (subprocess.TimeoutExpired, Exception):
        return None
```

### Pattern 2: ThreadPoolExecutor 并行执行

**What:** 用 `ThreadPoolExecutor` 提交 4 个任务，用 `future.result()` 收集结果。总耗时由最慢的 subprocess 决定。

**When to use:** 多个独立 I/O 操作需要并行时（D-04 锁定此方案）。

**Example:**
```python
def load_git_context(cwd: str) -> dict:
    """Return git context for the given working directory. Never raises."""
    tasks = {
        'commits_today': (['git', 'log', '--oneline', '--since=midnight'], cwd),
        'diff_lines':    (['git', 'diff', '--stat', 'HEAD'], cwd),
        'first_commit_time': (['git', 'log', '--format=%ai', '--since=midnight'], cwd),
        'repo_path':     (['git', 'rev-parse', '--show-toplevel'], cwd),
    }
    results = dict(_SAFE_DEFAULT)

    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {
            executor.submit(_run_git_cmd, args, wd): key
            for key, (args, wd) in tasks.items()
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                output = future.result()
            except Exception:
                output = None
            results[key] = _parse(key, output)

    return results
```

### Pattern 3: 输出解析函数

**What:** 每个 git 命令的输出有不同的解析逻辑，集中在一个 `_parse(key, output)` 函数或独立的 `_parse_*` 函数中。

**commits_today 解析：**
```python
# git log --oneline --since=midnight 每行一个提交
# 空输出 = 0 个提交
def _parse_commits_today(output: str | None) -> int:
    if not output:
        return 0
    return len(output.splitlines())
```

**diff_lines 解析（D-02：insertions + deletions 之和）：**
```python
# git diff --stat HEAD 最后一行格式（示例）：
# " 3 files changed, 45 insertions(+), 12 deletions(-)"
# 空工作目录（干净）：无最后汇总行，输出为空 → diff_lines = 0
def _parse_diff_lines(output: str | None) -> int:
    if not output:
        return 0
    last_line = output.splitlines()[-1]
    insertions = int(m.group(1)) if (m := re.search(r'(\d+) insertion', last_line)) else 0
    deletions = int(m.group(1)) if (m := re.search(r'(\d+) deletion', last_line)) else 0
    return insertions + deletions
```

**first_commit_time 解析（最早提交 = 列表最后一行）：**
```python
# git log --format="%ai" --since=midnight 输出每行一个 ISO 时间戳
# 最新提交在第一行，最早在最后一行
def _parse_first_commit_time(output: str | None) -> str | None:
    if not output:
        return None
    lines = output.splitlines()
    return lines[-1].strip() if lines else None
```

**repo_path 解析：**
```python
# git rev-parse --show-toplevel 返回绝对路径
def _parse_repo_path(output: str | None) -> str | None:
    return output.strip() if output else None
```

### Anti-Patterns to Avoid

- **使用 `subprocess.check_output`：** 非零返回码时自动抛出 `CalledProcessError`，需要额外 try/except，不如 `run(..., check=False)` 干净。
- **只捕获 `subprocess.TimeoutExpired`：** git 未安装时抛出 `FileNotFoundError`，无 git repo 时返回非零 returncode（不抛出异常），两者都需要处理。正确做法：捕获 `TimeoutExpired`，并用 `check=False` + 检查 `returncode` 处理非零退出。
- **在 `_run_git_cmd` 外处理解析错误：** 解析逻辑也可能出错（空输出、格式变化），应在解析函数内用默认值保护。
- **`with ThreadPoolExecutor` 内使用 `futures.map`：** `map` 遇到异常时不方便 per-key fallback，`as_completed` 更灵活。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 并行 subprocess | 手写 threading.Thread + Queue | `concurrent.futures.ThreadPoolExecutor` | stdlib 高层 API，异常传播、超时处理更清晰 |
| 超时控制 | 用 signal.alarm | `subprocess.run(timeout=5)` | signal 在 Windows 不可用，subprocess.run timeout 跨平台 |
| git 输出解析 | 复杂状态机 | 简单 re.search + splitlines() | git --stat 格式稳定，不需要完整 parser |

**Key insight:** `subprocess.run` 的 `timeout` 参数和 `check=False` 组合已经处理了 99% 的 subprocess 错误场景，不需要手写超时机制。

---

## Common Pitfalls

### Pitfall 1: git diff --stat 空输出误解

**What goes wrong:** 工作目录干净（无未提交修改）时，`git diff --stat HEAD` 输出为空字符串，不是包含 "0 insertions" 的行。直接对空字符串调用 `.splitlines()[-1]` 会抛出 `IndexError`。

**Why it happens:** `--stat` 仅在有变更时输出汇总行。

**How to avoid:** 解析前先检查 `if not output: return 0`。

**Warning signs:** 测试覆盖空输出路径；确保 clean working directory 场景有测试。

### Pitfall 2: subprocess.TimeoutExpired 只是超时异常之一

**What goes wrong:** 只捕获 `subprocess.TimeoutExpired`，但 git 未安装时抛出 `FileNotFoundError`（`[Errno 2] No such file or directory: 'git'`），导致未捕获异常传播，破坏状态栏。

**Why it happens:** `subprocess.run` 在找不到可执行文件时抛出 `FileNotFoundError`，不是 `TimeoutExpired`。

**How to avoid:** `_run_git_cmd` 的 except 子句捕获 `(subprocess.TimeoutExpired, Exception)` 或宽泛的 `Exception`（适合外部进程场景，类比 `read_stdin_json` 中的做法）。

**Warning signs:** 在没有 git 的 CI 环境中测试会暴露此问题。

### Pitfall 3: ThreadPoolExecutor future.result() 可能重新抛出异常

**What goes wrong:** 即使 `_run_git_cmd` 内部捕获了所有异常，如果有编程错误（如 TypeError），异常会被 Future 存储并在 `future.result()` 时重新抛出。

**Why it happens:** `concurrent.futures` 的设计：worker 中的未捕获异常会在调用 `result()` 时传播。

**How to avoid:** 在 `for future in as_completed(futures):` 循环内额外包一层 `try/except Exception`（见 Pattern 2 示例）。

### Pitfall 4: cwd 路径不存在时 subprocess 行为

**What goes wrong:** 如果 `cwd` 目录不存在，`subprocess.run` 抛出 `FileNotFoundError`（`[WinError 2]` 或 `[Errno 2]`，提示是 cwd 本身不存在）。

**Why it happens:** subprocess 在启动前验证 cwd 存在性。

**How to avoid:** 在 `_run_git_cmd` 中捕获宽泛 `Exception` 已覆盖此情况。或在 `load_git_context` 入口处用 `os.path.isdir(cwd)` 做早期检查，不存在时直接返回 `dict(_SAFE_DEFAULT)`。

### Pitfall 5: git log --since=midnight 的 first_commit_time 行序

**What goes wrong:** `git log --format="%ai" --since=midnight` 默认按时间倒序输出（最新提交在第一行），如果错误地取 `lines[0]`，得到的是最新提交时间，而不是最早（用于 session_start 辅助计算）。

**Why it happens:** git log 默认 `--date-order` 从新到旧。

**How to avoid:** 取 `lines[-1]`（最后一行 = 最早提交）。`first_commit_time` 语义是"今天第一次提交的时间"。

---

## Code Examples

### 完整 load_git_context 结构（参考模板）

```python
# core/git_context.py
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

SUBPROCESS_TIMEOUT = 5

_SAFE_DEFAULT: dict = {
    'commits_today': 0,
    'diff_lines': 0,
    'first_commit_time': None,
    'repo_path': None,
}


def _run_git_cmd(args: list[str], cwd: str) -> str | None:
    """Run a git command in cwd; return stdout on success, None on any failure."""
    try:
        result = subprocess.run(
            args,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=SUBPROCESS_TIMEOUT,
            check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception:
        return None


def load_git_context(cwd: str) -> dict:
    """Return git context dict for cwd. Never raises; returns safe defaults on any failure."""
    ...
```

### 测试 mock 模式（参考 test_trigger.py 风格）

```python
# tests/test_git_context.py
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch, MagicMock
from core.git_context import load_git_context

def test_normal_output():
    """4 个 subprocess 全部成功时返回正确解析结果。"""
    def fake_run(args, **kwargs):
        m = MagicMock()
        m.returncode = 0
        if 'log' in args and '--oneline' in args:
            m.stdout = 'abc1234 feat: add feature\ndef5678 fix: bug\n'
        elif 'diff' in args:
            m.stdout = ' 2 files changed, 45 insertions(+), 12 deletions(-)\n'
        elif 'log' in args and '--format=%ai' in args:
            m.stdout = '2026-04-01 23:00:00 +0800\n2026-04-01 09:00:00 +0800\n'
        elif 'rev-parse' in args:
            m.stdout = '/Users/user/project\n'
        return m

    with patch('subprocess.run', side_effect=fake_run):
        ctx = load_git_context('/Users/user/project')
    assert ctx['commits_today'] == 2
    assert ctx['diff_lines'] == 57
    assert ctx['repo_path'] == '/Users/user/project'
    assert ctx['first_commit_time'] == '2026-04-01 09:00:00 +0800'

def test_all_fail_returns_safe_defaults():
    """所有 subprocess 失败时返回全 0/None 默认值。"""
    with patch('subprocess.run', side_effect=Exception('git not found')):
        ctx = load_git_context('/tmp/not-a-repo')
    assert ctx == {'commits_today': 0, 'diff_lines': 0,
                   'first_commit_time': None, 'repo_path': None}

def test_timeout_fallback():
    """单个 subprocess 超时时对应字段 fallback 到默认值，其他字段正常。"""
    ...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `subprocess.check_output` | `subprocess.run(..., check=False)` | Python 3.5+ | check=False 更适合容错场景 |
| `threading.Thread` 手动管理 | `concurrent.futures.ThreadPoolExecutor` | Python 3.2+ | 更高层 API，异常传播更清晰 |

**Deprecated/outdated:**

- `subprocess.call` / `subprocess.check_output`：在需要捕获输出并容错的场景下，`subprocess.run` 是更现代的 API（Python 3.5+）。本项目已经用 Python 3，应统一用 `subprocess.run`。

---

## Open Questions

1. **`first_commit_time` 的精确语义（Phase 3/4 消费方）**
   - What we know: 用于辅助计算 `session_minutes`；取最早提交（`lines[-1]`）
   - What's unclear: Phase 3/4 是否需要 `datetime` 对象还是 ISO 字符串；`git log --format="%ai"` 输出带时区偏移（如 `+0800`）
   - Recommendation: 本 Phase 返回原始 ISO 字符串（`str | None`），Phase 3/4 自行解析。不在 git_context.py 中做时间计算。

2. **ThreadPoolExecutor max_workers 选择**
   - What we know: 固定 4 个任务；`max_workers=4` 确保并行度；线程创建开销微小
   - What's unclear: 是否有必要设为 `None`（让 Python 自动选择）
   - Recommendation: 明确设 `max_workers=4`，代码意图清晰，与 D-04 的"4 个并行"文档一致。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.9+ | subprocess / concurrent.futures | 取决于安装环境 | — | 代码不引入新的 Python 版本要求 |
| git CLI | 4 个 subprocess | ✓（开发机上） | — | 静默 fallback（STA-03 需求本身就是 fallback） |

**Missing dependencies with no fallback:** 无。

**Missing dependencies with fallback:** git 未安装时所有字段 fallback 到 0/None，状态栏正常显示。这正是 STA-03 要求的行为。

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | 无（直接运行） |
| Quick run command | `python3 -m pytest tests/test_git_context.py -v` |
| Full suite command | `python3 -m pytest tests/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STA-03 | 任意 subprocess 超时时对应字段 fallback=0/None | unit | `python3 -m pytest tests/test_git_context.py::test_timeout_fallback -x` | ❌ Wave 0 |
| STA-03 | git 未安装（FileNotFoundError）时全部 fallback | unit | `python3 -m pytest tests/test_git_context.py::test_git_not_installed -x` | ❌ Wave 0 |
| STA-03 | 非 git 目录时返回全 0/None 默认值 | unit | `python3 -m pytest tests/test_git_context.py::test_non_git_dir -x` | ❌ Wave 0 |
| STA-03 | 4 个 subprocess 全部成功时正确解析 | unit | `python3 -m pytest tests/test_git_context.py::test_normal_output -x` | ❌ Wave 0 |
| STA-03 | diff_lines = insertions + deletions（D-02） | unit | `python3 -m pytest tests/test_git_context.py::test_diff_lines_sum -x` | ❌ Wave 0 |
| STA-03 | 干净工作目录（diff 空输出）diff_lines=0 | unit | `python3 -m pytest tests/test_git_context.py::test_clean_working_dir -x` | ❌ Wave 0 |
| STA-03 | first_commit_time 取最早提交（lines[-1]） | unit | `python3 -m pytest tests/test_git_context.py::test_first_commit_time_earliest -x` | ❌ Wave 0 |
| STA-03 | 部分 subprocess 失败时其他字段正常 | unit | `python3 -m pytest tests/test_git_context.py::test_partial_failure -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `python3 -m pytest tests/test_git_context.py -v`
- **Per wave merge:** `python3 -m pytest tests/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/test_git_context.py` — 覆盖上述所有 STA-03 测试用例（新建）
- [ ] `core/git_context.py` — 实现文件（新建）

---

## Project Constraints (from CLAUDE.md)

| Directive | Type | Impact on Phase |
|-----------|------|-----------------|
| 只用 stdlib，无第三方依赖 | Constraint | subprocess + concurrent.futures + re 均为 stdlib，合规 |
| 测试在 `tests/` 目录下，用 pytest | Constraint | 新建 `tests/test_git_context.py` |
| 模块遵循 pure logic / I/O 分离 | Guideline | git_context.py 是 I/O 模块（合理例外），不含业务逻辑 |
| `snake_case` 函数名，`SCREAMING_SNAKE_CASE` 模块级常量 | Style | `load_git_context`, `_run_git_cmd`, `SUBPROCESS_TIMEOUT = 5` |
| 所有公开函数有单行 docstring | Style | 每个函数需添加 docstring |
| 类型注解 | Style | 函数签名需要类型注解 |
| 错误处理：catch-and-default at I/O boundaries | Pattern | `_run_git_cmd` 捕获所有异常返回 None |
| `.get()` with defaults for all external data | Pattern | 不适用（subprocess 输出不是 dict） |
| `os.path` for all file paths | Style | cwd 参数传递用 `os.getcwd()` 在 statusline.py 调用层 |

---

## Sources

### Primary (HIGH confidence)

- Python docs `subprocess.run` — https://docs.python.org/3/library/subprocess.html
- Python docs `concurrent.futures.ThreadPoolExecutor` — https://docs.python.org/3/library/concurrent.futures.html
- `.planning/codebase/CONVENTIONS.md` — 项目代码风格与错误处理模式（直接读取）
- `.planning/codebase/ARCHITECTURE.md` — 系统架构与数据流（直接读取）
- `core/trigger.py` + `tests/test_trigger.py` — 参考实现与测试模式（直接读取）
- `.planning/phases/02-git-context/02-CONTEXT.md` — 锁定决策（直接读取）

### Secondary (MEDIUM confidence)

- `docs/designs/v2-git-events.md` — 设计文档，v2 完整架构（直接读取）

### Tertiary (LOW confidence)

- 无

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — 全部 stdlib，API 稳定
- Architecture: HIGH — CONTEXT.md 锁定了所有关键决策
- Pitfalls: HIGH — 基于 Python subprocess/concurrent.futures 文档 + 代码分析
- Test patterns: HIGH — 直接参考项目现有测试文件

**Research date:** 2026-04-01
**Valid until:** 2026-07-01（stdlib API 极稳定）
