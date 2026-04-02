[中文](./README.zh.md)

# code-pal

**A Claude Code statusline companion — anime-style characters that cheer you on while you code.**

---

## What it looks like

```
(=^･ω･^=) Mochi: 跑完这个就去休息… 才不是
claude-sonnet-4-6 | 47k tokens | 用量 32% | resets in 3h20m
```

The statusline updates after each Claude response with a character message + session stats.

---

## Install

```bash
git clone https://github.com/tonylt/code-pal.git
cd code-pal
./install.sh
```

Restart Claude Code. The statusline activates immediately.

> **Requirements**
> - Python 3 (pre-installed on macOS/Linux)
> - Claude Code v2.1.80+

---

## Switch characters

```
/cheer          # interactive picker
/cheer nova     # switch directly
/cheer luna
/cheer mochi
/cheer iris
```

---

## Characters

| Character | Emoji | Style |
|-----------|-------|-------|
| **Nova 星野** | `(*>ω<)` | Energetic cheerleader |
| **Luna 月野** | `(´• ω •\`)` | Gentle and comforting |
| **Mochi 年糕** | `(=^･ω･^=)` | Tsundere cat |
| **Iris 晴** | `(￣ω￣)` | Cool and teasing |

---

## How it works

```
Claude response ends (Stop hook)
        ↓
statusline.py --update
  → reads token stats from stats-cache.json
  → selects message by: usage tier > time slot > random
  → writes to ~/.claude/code-pal/state.json
        ↓
Statusline polls statusline.py
  → reads state.json → renders to status bar
```

**Message selection priority:**

| Priority | Condition | Result |
|----------|-----------|--------|
| 1 | Token usage tier changes (normal → warning → critical) | Alert message |
| 2 | Same non-normal tier | Keep current alert |
| 3 | After each Claude response | Rotate `post_tool` vocab |
| 4 | Time slot changes (morning/afternoon/evening/midnight) | Time-specific line |
| 5 | Fallback | Random, no repeat |

---

## Customize vocab

Edit any character's JSON file to add your own lines:

```bash
~/.claude/code-pal/vocab/nova.json
~/.claude/code-pal/vocab/luna.json
~/.claude/code-pal/vocab/mochi.json
~/.claude/code-pal/vocab/iris.json
```

Each file contains trigger categories: `post_tool`, `time` (morning/afternoon/evening/midnight), `usage` (warning/critical), and `random`.

---

## Uninstall

```bash
./install.sh --uninstall
```

Removes all files and cleans up `~/.claude/settings.json`.

---

## File structure

```
code-pal/
├── install.sh          # installer
├── statusline.py       # main entry point
├── core/
│   ├── character.py    # load character config
│   ├── trigger.py      # message selection logic
│   └── display.py      # render output
├── vocab/
│   ├── nova.json
│   ├── luna.json
│   ├── mochi.json
│   └── iris.json
├── commands/
│   └── cheer.md        # /cheer slash command
└── tests/              # unit tests
```

---

## Contributing

Pull requests welcome! Some ideas:
- New characters
- New vocab lines
- Language packs
- Bug fixes

Run tests before submitting: `python3 -m pytest tests/`

---

## License

[MIT](./LICENSE)

---

## Inspired by

Forked from and inspired by [Claude-Code-Cheer](https://github.com/alexfly123lee-creator/Claude-Code-Cheer) by [@alexfly123lee-creator](https://github.com/alexfly123lee-creator). Thanks for the original idea and foundation.
