# Code Cheer

A Claude Code statusline companion — shows encouragement + usage info while you code.

## What it looks like

```
(*>ω<) Nova: 命令跑完啦！下一个目标，冲！！
sonnet-4-6 | 47k tokens | 用量 32% | resets in 3h20m
```

## Install

```bash
git clone https://github.com/your-username/code-cheer
cd code-cheer
./install.sh
```

Restart Claude Code. The statusline activates immediately.

## Switch characters

```
/cheer          # interactive picker
/cheer nova     # switch directly
/cheer luna
/cheer mochi
/cheer iris
```

## Characters

| Character | Style |
|-----------|-------|
| **Nova 星野** `(*>ω<)` | 元气满满，运动系啦啦队 |
| **Luna 月野** `(´• ω •`)` | 温柔治愈，陪伴系 |
| **Mochi 年糕** `(=^･ω･^=)` | 软萌奶凶，傲娇猫系 |
| **Iris 晴** `(￣ω￣)` | 女王御姐，冷静挑逗 |

## Customize vocab

Edit `~/.claude/code-cheer/vocab/nova.json` (or any character) to add your own messages.

## Uninstall

```bash
./install.sh --uninstall
```

## Requirements

- Python 3 (pre-installed on macOS/Linux)
- Claude Code v2.1.80+
