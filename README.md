[中文](./README.zh.md)

# code-pal

**A Claude Code statusline companion — anime-style characters that cheer you on while you code.**

- Git-aware reactions — first commit of the day, commit milestones (5/10/20), late-night commits, big diffs, and more trigger character-specific lines
- 5 anime characters — Nova, Luna, Mochi, Iris, Lei Jun, each with a distinct personality. Switch anytime with `/cheer`
- Live stats — model, project folder, token count, and a context window progress bar at a glance

---

## What it looks like

```
(=^･ω･^=) Mochi: 跑完这个就去休息… 才不是
sonnet-4-6 | code-pal | 47k tokens | [████░░░░░░] 32%
```

The statusline updates after each Claude response: character message on line 1, model + project + tokens + context bar on line 2.

---

## Prerequisites

- **Node.js 18+** (check: `node --version`)
- **npm** (bundled with Node.js)
- **git**
- **Claude Code v2.1.80+**

---

## Install

```bash
git clone https://github.com/tonylt/code-pal.git
cd code-pal
npm install
npm run setup
```

Restart Claude Code. The statusline activates immediately.

---

## Switch characters

```
/cheer          # interactive picker
/cheer nova     # switch directly
/cheer luna
/cheer mochi
/cheer iris
/cheer leijun
```

---

## Characters

| Character | Emoji | Style |
|-----------|-------|-------|
| **Nova 星野** | `(*>ω<)` | Energetic cheerleader |
| **Luna 月野** | `(´• ω •\`)` | Gentle and comforting |
| **Mochi 年糕** | `(=^･ω･^=)` | Tsundere cat |
| **Iris 晴** | `(￣ω￣)` | Cool and teasing |
| **Lei Jun 雷军** | `(ง •_•)ง` | "Are you OK" energy |

---

## How it works

```
Claude response ends (Stop hook)
        ↓
node dist/statusline.js --update
  → reads token stats from stats-cache.json
  → selects message by: usage tier > time slot > random
  → writes to ~/.claude/code-pal/state.json
        ↓
Statusline polls node dist/statusline.js
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
~/.claude/code-pal/vocab/leijun.json
```

Each file contains trigger categories: `post_tool`, `time` (morning/afternoon/evening/midnight), `usage` (warning/critical), and `random`.

---

## Uninstall

```bash
npm run unsetup
```

Removes all files and cleans up `~/.claude/settings.json`. If you had a previous statusLine configured, it will be restored automatically.

---

## File structure

```
code-pal/
├── src/
│   ├── statusline.ts   # main entry point
│   └── core/
│       ├── character.ts  # vocab loading
│       ├── trigger.ts    # message selection
│       ├── display.ts    # render output
│       └── gitContext.ts # git subprocess context
├── scripts/
│   ├── install.js      # npm run setup
│   └── uninstall.js    # npm run unsetup
├── dist/
│   └── statusline.js   # esbuild bundle (gitignored, built by npm run build)
├── vocab/
│   ├── nova.json
│   ├── luna.json
│   ├── mochi.json
│   ├── iris.json
│   └── leijun.json
├── commands/
│   └── cheer.md        # /cheer slash command
└── tests/              # Jest test suite (167 tests)
```

---

## Tests

```bash
npm test
```

167 tests across 6 suites (character, display, gitContext, trigger, statusline, install).

---

## Contributing

Pull requests welcome! Some ideas:
- New characters
- New vocab lines
- Language packs
- Bug fixes

See [Tests](#tests) above before submitting.

---

## Troubleshooting

**Statusline not showing?**
Check that `npm run setup` completed without errors. Restart Claude Code. Verify the entry exists:
`cat ~/.claude/settings.json | grep statusLine`

**`node` command not found or wrong version?**
code-pal requires Node.js 18+. Verify with `node --version`. Install via [nodejs.org](https://nodejs.org) or a version manager like nvm/fnm.

**`npm run setup` errors?**
Run from the repo root directory. Check that `~/.claude/` directory exists (created by Claude Code on first run).

**Stop hook not triggering?**
Verify the hook is registered: `cat ~/.claude/settings.json | grep -A5 Stop`. If missing, re-run `npm run setup`. Restart Claude Code after install.

**Claude Code version mismatch?**
code-pal requires Claude Code v2.1.80 or later. Check your version and update if needed.

**Another tool already uses statusLine?**
code-pal requires exclusive access to the statusLine setting. On install, it backs up any existing statusLine config to `~/.claude/code-pal/statusline-backup.json`. Uninstalling restores your previous config. If you want to switch between tools, uninstall one before installing the other.

---

## License

[MIT](./LICENSE)

---

## Inspired by

Forked from and inspired by [Claude-Code-Cheer](https://github.com/alexfly123lee-creator/Claude-Code-Cheer) by [@alexfly123lee-creator](https://github.com/alexfly123lee-creator). Thanks for the original idea and foundation.
