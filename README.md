# Code Cheer

**A Claude Code statusline companion — anime-style characters that cheer you on while you code.**

Claude Code 状态栏应援助手 —— 二次元角色陪你写代码，实时显示鼓励语和 token 用量。

---

## What it looks like / 效果预览

```
(=^･ω･^=) Mochi: 跑完这个就去休息… 才不是
claude-sonnet-4-6 | 47k tokens | 用量 32% | resets in 3h20m
```

The statusline updates after each Claude response with a character message + session stats.

每次 Claude 回复结束后，状态栏自动刷新：角色台词 + 当前会话 token 用量。

---

## Install / 安装

```bash
git clone https://github.com/YOUR-USERNAME/code-cheer
cd code-cheer
./install.sh
```

Restart Claude Code. The statusline activates immediately.

重启 Claude Code，状态栏立即生效。

> **Requirements / 环境要求**
> - Python 3 (pre-installed on macOS/Linux / macOS/Linux 已内置)
> - Claude Code v2.1.80+

---

## Switch characters / 切换角色

```
/cheer          # interactive picker / 交互选择
/cheer nova     # switch directly / 直接指定
/cheer luna
/cheer mochi
/cheer iris
```

---

## Characters / 角色一览

| Character | Emoji | Style |
|-----------|-------|-------|
| **Nova 星野** | `(*>ω<)` | 元气满满，运动系啦啦队 / Energetic cheerleader |
| **Luna 月野** | `(´• ω •\`)` | 温柔治愈，陪伴系 / Gentle and comforting |
| **Mochi 年糕** | `(=^･ω･^=)` | 软萌奶凶，傲娇猫系 / Tsundere cat |
| **Iris 晴** | `(￣ω￣)` | 女王御姐，冷静挑衅 / Cool and teasing |

---

## How it works / 工作原理

```
Claude response ends (Stop hook)
        ↓
statusline.py --update
  → reads token stats from stats-cache.json
  → selects message by: usage tier > time slot > random
  → writes to ~/.claude/code-cheer/state.json
        ↓
Statusline polls statusline.py
  → reads state.json → renders to status bar
```

**Message selection priority / 台词选择优先级：**

| Priority | Condition | Result |
|----------|-----------|--------|
| 1 | Token usage tier changes (normal → warning → critical) | Alert message |
| 2 | Same non-normal tier | Keep current alert |
| 3 | After each Claude response | Rotate `post_tool` vocab |
| 4 | Time slot changes (morning/afternoon/evening/midnight) | Time-specific line |
| 5 | Fallback | Random, no repeat |

---

## Customize vocab / 自定义台词

Edit any character's JSON file to add your own lines:

```bash
~/.claude/code-cheer/vocab/nova.json
~/.claude/code-cheer/vocab/luna.json
~/.claude/code-cheer/vocab/mochi.json
~/.claude/code-cheer/vocab/iris.json
```

Each file contains trigger categories: `post_tool`, `time` (morning/afternoon/evening/midnight), `usage` (warning/critical), and `random`.

每个文件包含以下触发类别：`post_tool`（工具后）、`time`（时段）、`usage`（用量告警）、`random`（随机兜底）。

---

## Uninstall / 卸载

```bash
./install.sh --uninstall
```

Removes all files and cleans up `~/.claude/settings.json`.

删除所有文件并清理 `~/.claude/settings.json`。

---

## File structure / 文件结构

```
code-cheer/
├── install.sh          # installer / 安装脚本
├── statusline.py       # main entry point / 状态栏入口
├── core/
│   ├── character.py    # load character config / 加载角色配置
│   ├── trigger.py      # message selection logic / 台词选择逻辑
│   └── display.py      # render output / 渲染输出
├── vocab/
│   ├── nova.json
│   ├── luna.json
│   ├── mochi.json
│   └── iris.json
├── commands/
│   └── cheer.md        # /cheer slash command / 斜杠命令
└── tests/              # unit tests / 单元测试
```

---

## Contributing / 贡献

Pull requests welcome! Some ideas:
- New characters / 新角色
- New vocab lines / 新台词
- Language packs / 多语言台词包
- Bug fixes / Bug 修复

Run tests before submitting: `python3 -m pytest tests/`
