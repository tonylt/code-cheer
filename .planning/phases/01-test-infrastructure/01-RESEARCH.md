# Phase 1: 测试基础设施 - Research

**Researched:** 2026-04-01
**Domain:** pytest 安装、测试 helper 修复、断言对齐
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TST-01 | pytest 已安装；`make_cc()` helper 修复为正确的 stats-cache 结构；`test_display.py` 断言更新匹配当前输出格式 | 已在本机实际运行测试，精确定位所有失败原因，确认修复方案 |

</phase_requirements>

---

## Summary

本阶段目标是让 `python3 -m pytest tests/` 能够无错误地运行通过，为后续 v2 开发提供可靠测试基础。

经过实际运行测试，发现共 3 个测试失败，全部集中在 `test_trigger.py` 中，根因是 `make_cc()` helper 生成的 `rate_limits` 结构与 `trigger.py` 的实际读取路径不匹配。`display.py` 断言与项目状态报告中描述的"旧中文标签"问题**在当前代码中已不存在**——`test_display.py` 的 65 个测试全部通过。

**主要发现：** pytest 尚未安装（需 `pip3 install pytest --break-system-packages`）；`make_cc()` 的 `rate_limits` 结构须从 `{"used_percentage": pct}` 修正为 `{"five_hour": {"used_percentage": pct}}`；`test_display.py` 无需任何修改。

**Primary recommendation:** 安装 pytest，仅修改 `test_trigger.py` 中的 `make_cc()` helper，`test_display.py` 保持不动。

---

## Actual Test Run Results (HIGH confidence)

pytest 安装后（版本 9.0.2，Python 3.14.1）实际运行输出：

```
68 items collected
65 passed, 3 failed
```

**失败的 3 个测试（全部在 `test_trigger.py`）：**

| 测试名 | 期望 | 实际 | 根因 |
|--------|------|------|------|
| `test_resolve_escalates_to_warning` | `msg == "w1"`, `tier == "warning"` | `msg == "r1"`, `tier == "normal"` | `make_cc(pct=85)` 无法被 trigger.py 读取到 |
| `test_resolve_escalates_to_critical` | `msg == "c1"`, `tier == "critical"` | `msg == "r1"`, `tier == "normal"` | 同上 |
| `test_resolve_alert_persists_while_tier_unchanged` | `tier == "warning"` | `tier == "normal"` | 同上 |

---

## Root Cause Analysis

### make_cc() 结构不匹配（HIGH confidence，已验证）

**当前 `make_cc()` 生成的结构：**
```python
def make_cc(pct=0, resets_at=None, model="claude-sonnet-4-6"):
    d = {"model": model, "rate_limits": {"used_percentage": pct}}
    if resets_at:
        d["rate_limits"]["resets_at"] = resets_at
    return d
```

生成：`{"model": "...", "rate_limits": {"used_percentage": 85}}`

**`trigger.py` `resolve_message()` 实际读取路径（第 59-61 行）：**
```python
rate_limits = cc_data.get("rate_limits", {})
used_pct = rate_limits.get("five_hour", {}).get("used_percentage", 0)
tier = get_tier(used_pct)
```

读取路径：`rate_limits → five_hour → used_percentage`

**结论：** `make_cc(pct=85)` 中的 `pct=85` 放在了 `rate_limits.used_percentage`，但 `trigger.py` 读取的是 `rate_limits.five_hour.used_percentage`，所以 `used_pct` 永远为 `0`，`tier` 永远为 `"normal"`。

**正确的 `make_cc()` 结构应为：**
```python
def make_cc(pct=0, resets_at=None, model="claude-sonnet-4-6"):
    five_hour = {"used_percentage": pct}
    if resets_at:
        five_hour["resets_at"] = resets_at
    return {"model": model, "rate_limits": {"five_hour": five_hour}}
```

**验证（实际执行）：**
```
当前 make_cc pct=85 → used_pct read by trigger.py: 0  → tier: normal  (wrong)
修正 make_cc pct=85 → used_pct read by trigger.py: 85 → tier: warning  (correct)
```

---

## 已通过测试分析（不需要修改）

### test_display.py（29 个测试，全部通过）

`test_display.py` 当前状态良好，断言与 `display.py` 完全对齐：
- `CHAR` fixture 缺少 `"color"` 字段（`display.py` 用 `.get("color", "")` 处理，安全）
- 所有 render 测试使用英文断言，与当前 `display.py` 输出格式一致
- STATE.md 描述的"旧中文标签"问题**在当前文件中已不存在**

**结论：** `test_display.py` 无需任何修改。

### test_character.py（3 个测试，全部通过）

### test_statusline.py（13 个测试，全部通过）

注意：`test_statusline.py` 中的 `test_load_stats_*` 系列测试使用 `dailyModelTokens` 格式，与真实 `stats-cache.json` 结构一致。

---

## 真实 stats-cache.json 结构（HIGH confidence，实际读取）

文件位置：`~/.claude/stats-cache.json`

顶层键：`['version', 'lastComputedDate', 'dailyActivity', 'dailyModelTokens', 'modelUsage', 'totalSessions', 'totalMessages', 'longestSession', 'firstSessionDate', 'hourCounts', 'totalSpeculationTimeSavedMs']`

`dailyModelTokens` 条目结构：
```json
{
  "date": "2026-02-15",
  "tokensByModel": {
    "pa/claude-sonnet-4-5-20250929": 10506925,
    "pa/claude-opus-4-6": 611718
  }
}
```

**注意：** `stats-cache.json` 不包含 `rate_limits` 字段。`rate_limits` 只存在于 Claude Code 通过 stdin 传入的 `cc_data` 中（`statusline.py` 通过 `read_stdin_json()` 读取）。`make_cc()` 模拟的是 stdin `cc_data`，不是 `stats-cache.json`。

---

## 环境信息

| 项目 | 状态 | 详情 |
|------|------|------|
| Python | ✓ 可用 | 3.14.1 (`/opt/homebrew/bin/python3`) |
| pip3 | ✓ 可用 | 25.3 (Python 3.14) |
| pytest | 初始状态：未安装；研究中已安装 | 9.0.2 |
| macOS | ✓ | Darwin 25.3.0，需 `--break-system-packages` 标志 |

**安装命令：**
```bash
pip3 install pytest --break-system-packages
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3 | 运行测试 | ✓ | 3.14.1 | — |
| pip3 | 安装 pytest | ✓ | 25.3 | — |
| pytest | 测试运行器 | ✓ (已安装于研究阶段) | 9.0.2 | — |

**注意：** 在 macOS Darwin 25.3.0 上，`pip3 install` 需要 `--break-system-packages` 标志（PEP 668 限制）。计划任务中必须包含此标志。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 测试数据结构 | 手写嵌套 dict | 修复 `make_cc()` helper | 所有 `test_trigger.py` 测试共享同一 helper，单点修复 |
| 断言验证 | 自定义断言框架 | pytest 原生 `assert` | 已有完整断言，无需重建 |

---

## Exact Changes Required

### 文件 1: 无需安装步骤文件（环境操作）
```bash
pip3 install pytest --break-system-packages
```

### 文件 2: `tests/test_trigger.py` — 仅修改 `make_cc()` helper

**当前（第 109-113 行）：**
```python
def make_cc(pct=0, resets_at=None, model="claude-sonnet-4-6"):
    d = {"model": model, "rate_limits": {"used_percentage": pct}}
    if resets_at:
        d["rate_limits"]["resets_at"] = resets_at
    return d
```

**修改后：**
```python
def make_cc(pct=0, resets_at=None, model="claude-sonnet-4-6"):
    five_hour = {"used_percentage": pct}
    if resets_at:
        five_hour["resets_at"] = resets_at
    return {"model": model, "rate_limits": {"five_hour": five_hour}}
```

**影响范围：** `make_cc()` 被以下 9 个测试调用：
- `test_resolve_escalates_to_warning` (失败 → 将通过)
- `test_resolve_escalates_to_critical` (失败 → 将通过)
- `test_resolve_alert_persists_while_tier_unchanged` (失败 → 将通过)
- `test_resolve_tier_drops_to_normal_falls_through` (当前通过，修复后仍通过 — pct=0 时 five_hour.used_percentage=0，tier 仍为 normal)
- `test_resolve_force_post_tool_picks_from_post_tool` (当前通过，不受影响)
- `test_resolve_force_post_tool_avoids_last` (当前通过，不受影响)
- `test_resolve_returns_cache_when_fresh` (当前通过，不受影响)
- `test_resolve_switches_on_slot_change` (当前通过，不受影响)
- `test_resolve_random_fallback` (当前通过，不受影响)
- `test_resolve_handles_missing_rate_limits` (使用 `{}` 而非 `make_cc()`，不受影响)

### 文件 3: `test_display.py` — 无需修改
### 文件 4: `test_character.py` — 无需修改
### 文件 5: `test_statusline.py` — 无需修改

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 9.0.2 |
| Config file | none (no pytest.ini / pyproject.toml test config) |
| Quick run command | `python3 -m pytest tests/test_trigger.py -v` |
| Full suite command | `python3 -m pytest tests/ -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TST-01 (pytest 安装) | pytest 可运行不报 ImportError | smoke | `python3 -m pytest --version` | ✅ (post-install) |
| TST-01 (make_cc 修复) | `make_cc(pct=85)` → trigger reads 85.0, tier="warning" | unit | `python3 -m pytest tests/test_trigger.py::test_resolve_escalates_to_warning tests/test_trigger.py::test_resolve_escalates_to_critical tests/test_trigger.py::test_resolve_alert_persists_while_tier_unchanged -v` | ✅ tests/test_trigger.py |
| TST-01 (全套通过) | 68 tests, 0 failed | integration | `python3 -m pytest tests/ -v` | ✅ tests/ |

### Sampling Rate
- **Per task commit:** `python3 -m pytest tests/test_trigger.py -v`
- **Per wave merge:** `python3 -m pytest tests/ -v`
- **Phase gate:** `python3 -m pytest tests/` 全部 68 个测试通过

### Wave 0 Gaps
None — 现有测试基础设施已覆盖所有 Phase 1 需求，pytest 安装后无需新增测试文件。

---

## Common Pitfalls

### Pitfall 1: macOS PEP 668 阻止 pip 安装
**What goes wrong:** `pip3 install pytest` 在 Darwin 25.3.0 上报 externally-managed-environment 错误
**Why it happens:** Python 3.14 遵循 PEP 668，保护系统 Python 环境
**How to avoid:** 始终使用 `--break-system-packages` 标志
**Warning signs:** 错误信息包含 "externally-managed-environment"

### Pitfall 2: make_cc() 修改影响 pct=0 测试
**What goes wrong:** 修改后 `make_cc(pct=0)` 生成 `{"five_hour": {"used_percentage": 0}}`，与之前不同
**Why it happens:** trigger.py 读取 `five_hour.used_percentage`，0 时仍返回 tier="normal"
**How to avoid:** 已验证：pct=0 修改前后 used_pct 均为 0，get_tier(0)="normal"，无回归风险
**Warning signs:** 如果依赖 pct=0 的测试失败，说明读取路径有其他问题

### Pitfall 3: 误判 test_display.py 需要修改
**What goes wrong:** STATE.md 提到"旧中文标签"，但当前 test_display.py 断言全部为英文且通过
**Why it happens:** 代码在之前某次更新中已同步，STATE.md 记录的是历史问题
**How to avoid:** 先运行测试看实际失败，不要基于文档描述直接修改
**Warning signs:** 修改 test_display.py 反而可能引入回归

---

## Sources

### Primary (HIGH confidence)
- 实际运行 `python3 -m pytest tests/ -v` — 直接观察到 68 tests, 3 failed
- 直接读取 `~/.claude/stats-cache.json` — 获取真实文件结构
- 直接读取 `core/trigger.py` 第 59-61 行 — 确认 `five_hour.used_percentage` 读取路径
- 直接读取 `tests/test_trigger.py` 第 109-113 行 — 确认 `make_cc()` 当前结构

### Secondary (MEDIUM confidence)
- Python 3.14 PEP 668 行为 — pip 安装错误信息中直接观察到

---

## Metadata

**Confidence breakdown:**
- 失败根因: HIGH — 实际运行测试并用 python3 脚本验证了结构不匹配
- make_cc 修复方案: HIGH — 修复后逻辑已用 python3 脚本验证
- test_display.py 无需修改: HIGH — 29 个测试全部通过，直接观察
- pytest 安装命令: HIGH — 在本机实际执行成功

**Research date:** 2026-04-01
**Valid until:** 2026-05-01（pytest 版本稳定，30 天有效）
