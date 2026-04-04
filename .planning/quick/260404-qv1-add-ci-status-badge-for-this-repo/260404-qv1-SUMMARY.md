---
phase: quick
plan: 260404-qv1
subsystem: docs
tags: [readme, ci, badge, github-actions]
dependency_graph:
  requires: []
  provides: [ci-status-badge]
  affects: [README.md, README.zh.md]
tech_stack:
  added: []
  patterns: [github-actions-badge]
key_files:
  created: []
  modified:
    - README.md
    - README.zh.md
decisions:
  - "使用 GitHub 官方 workflow status badge URL 模式，workflow name 为 CI，对应 ci.yml"
metrics:
  duration: "2min"
  completed: "2026-04-04"
  tasks_completed: 1
  files_modified: 2
---

# Quick Task 260404-qv1: Add CI Status Badge Summary

**One-liner:** 在 README.md 和 README.zh.md 顶部插入可点击的 GitHub Actions CI status badge，链接指向 tonylt/code-cheer ci.yml workflow。

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add CI badge to README.md and README.zh.md | df3ba55 | README.md, README.zh.md |

## What Was Done

在两个 README 文件顶部（语言切换链接之前）插入 CI badge：

```markdown
[![CI](https://github.com/tonylt/code-cheer/actions/workflows/ci.yml/badge.svg)](https://github.com/tonylt/code-cheer/actions/workflows/ci.yml)
```

badge 格式符合 GitHub 官方 workflow status badge URL 模式。

## Deviations from Plan

无 — 计划按原样执行。

## Self-Check: PASSED

- README.md 包含 `badge.svg` ✓
- README.zh.md 包含 `badge.svg` ✓
- badge URL owner/repo 为 `tonylt/code-cheer` ✓
- 提交 df3ba55 存在 ✓
