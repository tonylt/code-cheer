# Statusline Layout v3 — 设计文档

**日期：** 2026-04-02
**状态：** 已实现（分支 `refactor-statusline-layout`）
**影响文件：** `core/display.py`、`statusline.py`

---

## 背景

v2 的 `display.py` 输出两行内容，但 line 2 的字段组合随着迭代出现了两个问题：

1. **布局问题：** 曾尝试单行左右分栏（character 在左，stats 在右，用终端宽度填充空格），在窄窗口（如左右分屏）下右侧内容被截断，用户无法看到 stats。
2. **信息密度：** 显示了 5h/7d rate limit 百分比，但这些数字变化慢、对即时编程状态参考价值低；而上下文窗口占用（ctx%）更直接反映当前 session 状态，且之前缺少可视化进度条。

---

## 设计决策

### 布局：改回两行左对齐

**方案 A（最终选择）：** 两行均左对齐

```
(*>ω<) Nova: 20 commits！全场最燃！今天你无可阻挡！！冲！
ppio/pa/sonnet-4-6 | code-pal | 47k tokens | [█████░░░░░] 48%
```

**方案 B（已废弃）：** 单行左右分栏

```
(*>ω<) Nova: message...                    model | [bar] 48% | 47k
```

方案 B 用 `shutil.get_terminal_size()` 计算填充宽度，但 CJK 字符占 2 列、ANSI 颜色码不占宽度，导致计算复杂且仍会在窄窗口溢出。方案 A 无此问题，行宽由终端自然换行处理。

### 信息字段调整

| 字段 | v2 | v3 | 理由 |
|------|----|----|------|
| model | `sonnet-4-6` | `ppio/pa/sonnet-4-6` | 保留完整 provider 前缀（去掉 `claude-` 前缀即可） |
| rate limit 5h/7d % | 显示 | **移除** | 变化慢，对即时 coding 参考价值低 |
| resets_at 倒计时 | 显示 | **移除** | 与 rate limit 一并清理 |
| ctx% | 裸数字 `ctx 48%` | **进度条** `[█████░░░░░] 48%` | 可视化更直观 |
| tokens | `47k tokens` | `47k tokens` | 保留不变 |
| 项目目录名 | 无 | **新增** `code-pal` | 多项目切换时一眼识别当前工作目录 |

### 进度条实现

```python
def _ctx_bar(pct: int, width: int = 10) -> str:
    filled = max(0, min(width, round(pct / 100 * width)))
    return "█" * filled + "░" * (width - filled)
```

- 10 格，精度 10%，避免小变化引起视觉抖动
- `ctx_pct` 为 `None`（Claude Code 未提供数据）时，整个 `[bar] X%` 字段省略

### 项目目录名来源

```python
# statusline.py
stats["cwd_name"] = os.path.basename(os.getcwd())
```

- 在 `main()` 入口处注入到 `stats` 字典，`display.render()` 通过 `stats.get("cwd_name", "")` 读取
- 为空时字段省略，不影响 render 输出（不会多出一个 `| |`）
- 使用 `os.getcwd()` 而非 stdin JSON，因为 Stop hook 调用时 cwd 即为用户当前项目目录

---

## 最终输出规格

### 格式

```
Line 1: {ascii} {name}: {message}
Line 2: {model} | {cwd_name} | {tokens} tokens[  | [{ctx_bar}] {ctx_pct}%]
```

方括号内字段在数据缺失时省略。

### 字段说明

| 字段 | 来源 | 示例 | 缺失时 |
|------|------|------|--------|
| `ascii` | `vocab/{char}.json` → `meta.ascii` | `(*>ω<)` | — |
| `name` | `vocab/{char}.json` → `meta.name` | `Nova` | — |
| `message` | `state.json` | `20 commits！冲！` | 空字符串 |
| `model` | stdin JSON → `model`，去掉 `claude-` 前缀 | `sonnet-4-6` | `unknown` |
| `cwd_name` | `os.path.basename(os.getcwd())` | `code-pal` | 字段省略 |
| `tokens` | `stats-cache.json` 当日累计，不足时从 `context_window` 补充 | `47k tokens` | `N/A tokens` |
| `ctx_bar` | stdin JSON → `context_window.used_percentage` | `[█████░░░░░]` | 字段省略 |
| `ctx_pct` | stdin JSON → `context_window.used_percentage` | `48%` | 字段省略 |

### 实际示例

```
(=^･ω･^=) Mochi: 跑完这个就去休息… 才不是
ppio/pa/sonnet-4-6 | code-pal | 47k tokens | [████░░░░░░] 40%
```

无 ctx 数据时：

```
(=^･ω･^=) Mochi: 跑完这个就去休息… 才不是
ppio/pa/sonnet-4-6 | code-pal | 47k tokens
```

---

## 代码变更摘要

### `core/display.py`

- 移除 `shutil`、`re`、`unicodedata` 导入（单行布局所需，已废弃）
- 移除 `_visual_width()` 函数
- 新增 `_ctx_bar(pct, width=10)` 函数
- `render()` 改为两行左对齐，line 2 字段顺序：`model | cwd_name | tokens | [bar] ctx%`

### `statusline.py`

- `main()` 中 `stats = load_stats()` 之后添加一行：
  ```python
  stats["cwd_name"] = os.path.basename(os.getcwd())
  ```

### 测试

`tests/test_display.py` 更新测试覆盖：
- 两行格式验证
- ctx 进度条满/空/正常三态
- cwd_name 存在/缺失两种情况
- 角色消息在 stats 前出现的位置关系

`tests/test_statusline.py` 更新 `test_main_prints_two_lines` 断言（从检查 `tokens` in line[1] 改为检查 `sonnet-4-6`）。

---

## 迭代历史

| 版本 | 日期 | 变化 |
|------|------|------|
| v1 | 2026-03-22 | 初始版本：`model | tokens | 用量% | resets in Xh` |
| v2 | 2026-04-01 | 新增 5h/7d rate limit 字段，ctx% 裸数字 |
| v3 | 2026-04-02 | 移除 rate limit 字段，新增 cwd 目录名 + ctx 进度条，两行左对齐 |
