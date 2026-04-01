# Phase 2: Git Context 读取 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-01
**Phase:** 02-git-context
**Areas discussed:** cwd 获取方式, diff_lines 语义, repo_path 获取, 测试策略

---

## cwd 获取方式

| Option | Description | Selected |
|--------|-------------|----------|
| os.getcwd() 直接用 | Stop hook 是 subprocess，继承 Claude Code 的 cwd，即用户工作的 git repo 目录。零配置，天然正确。 | ✓ |
| config.json 配置固定路径 | 用户在 config.json 设置 workspace 路径。适合测试环境或多 repo 场景，但增加配置负担。 | |
| 两者结合：config > os.getcwd() fallback | config.json 有设置时用配置路径，没有则用 os.getcwd()。最灵活，但小幅增加复杂度。 | |

**User's choice:** os.getcwd() 直接用
**Notes:** 推荐默认选项，符合 Stop hook 的 subprocess 继承 cwd 行为。

---

## diff_lines 语义

| Option | Description | Selected |
|--------|-------------|----------|
| insertions + deletions 之和 | 总变动行数。删了 100 行 + 新写 100 行，也是一次大重构，应该触发。语义是"这次改动幅度很大" | ✓ |
| 只算 insertions | 只看新写的行。删除旧代码不计入。语义是"这次写了很多新代码" | |

**User's choice:** insertions + deletions 之和
**Notes:** 更全面的变更量语义，大型重构也能触发 big_diff。

---

## repo_path 获取

| Option | Description | Selected |
|--------|-------------|----------|
| 第 4 个并行 subprocess：git rev-parse --show-toplevel | 返回 git repo 的根目录，无论 cwd 在 repo 的哪个子目录都正确。并行执行不增加能耗。 | ✓ |
| os.getcwd() 作为 repo_path | 不作额外 subprocess。但如果用户在子目录工作，Phase 3 的 last_repo 对比会失效。 | |

**User's choice:** 第 4 个并行 subprocess：git rev-parse --show-toplevel
**Notes:** 保证 repo root 准确性，并行执行无额外延迟。设计文档说 3 个，修正为 4 个。

---

## 测试策略

| Option | Description | Selected |
|--------|-------------|----------|
| unittest.mock patch subprocess | mock concurrent.futures 或 subprocess.run，注入不同模拟返回（正常输出、超时、失败）。符合项目已有测试风格，无外部依赖，快速。 | ✓ |
| tmp 目录创建真实 git repo | pytest tmp_path + git init + 提交真实 commit，调用真实 subprocess。测试更着实，但需要系统有 git，运行较慢。 | |
| 两者结合 | mock 覆盖单元测试（fallback 逻辑、解析逻辑），真实 git repo 覆盖 happy path 集成测试。 | |

**User's choice:** unittest.mock patch subprocess
**Notes:** 符合项目风格，覆盖 fallback 逻辑不需要真实 git repo。

---

## Claude's Discretion

- git 命令的具体解析逻辑（正则 vs split）
- `since=midnight` 的时间计算实现
- concurrent.futures.ThreadPoolExecutor 线程池大小

## Deferred Ideas

None — discussion stayed within phase scope
