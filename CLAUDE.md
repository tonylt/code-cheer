# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

**code-pal** — Claude Code statusline companion. Anime-style characters show encouragement + token usage in the status bar after each response.

Installs to `~/.claude/code-pal/`. Hooks into Claude Code via `settings.json` (Stop hook + statusLine command).

## Commands

```bash
# Run tests
python3 -m pytest tests/

# Run a specific test file
python3 -m pytest tests/test_trigger.py -v

# Manual statusline test (reads state.json, prints render output)
python3 statusline.py

# Force a message update (simulates Stop hook)
python3 statusline.py --update

# Install
./install.sh

# Uninstall
./install.sh --uninstall
```

## Architecture

```
statusline.py           entry point (two modes: render / --update)
core/
  character.py          load + validate vocab JSON from vocab/
  trigger.py            message selection logic (tier, time slot, cache)
  display.py            format output string for statusline
vocab/
  nova.json             character vocab (post_tool, time, usage, random)
  luna.json
  mochi.json
  iris.json
commands/
  cheer.md              /cheer slash command (Claude Code custom command)
install.sh              copies files to ~/.claude/code-pal/, patches settings.json
tests/                  pytest unit tests for each core module
```

## Key files

- `core/trigger.py` — message selection priority logic; edit here to change when/how messages update
- `core/display.py` — output format for the statusline string
- `vocab/*.json` — all character dialogue; safe to edit without touching code
- `install.sh` — both install and uninstall paths; patches `~/.claude/settings.json` non-destructively

## Hook wiring

install.sh registers two entries in `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "python3 ~/.claude/code-pal/statusline.py"
  },
  "hooks": {
    "Stop": [{
      "hooks": [{"type": "command", "command": "python3 ~/.claude/code-pal/statusline.py --update"}]
    }]
  }
}
```

- **statusLine** — polled by Claude Code to render the status bar; reads `state.json`
- **Stop hook** — fires after each Claude response; calls `--update` to pick new message and write `state.json`

## State files (runtime, not in repo)

```
~/.claude/code-pal/config.json   # {"character": "nova"}
~/.claude/code-pal/state.json    # last message, tier, slot, timestamp
~/.claude/stats-cache.json         # token usage by day (written by Claude Code)
```

## Adding a new character

1. Create `vocab/<name>.json` following the structure of an existing vocab file
2. Add the character to `commands/cheer.md` (options list + reply text)
3. Add a test in `tests/test_character.py`
