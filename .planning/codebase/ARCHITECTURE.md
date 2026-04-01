# Architecture

**Analysis Date:** 2026-04-01

## System Overview

code-cheer is a Claude Code statusline companion. It displays anime-style character encouragement and token usage statistics in the Claude Code status bar. The system hooks into Claude Code via two mechanisms: a `statusLine` command (polled for rendering) and a `Stop` hook (fires after each Claude response to update state). The script is installed to `~/.claude/code-cheer/` and patches `~/.claude/settings.json` non-destructively.

## Core Components

**Entry Point — `statusline.py`:**
- Operates in two modes based on CLI argument:
  - Render mode (no args): reads state, renders and prints 2-line statusline output to stdout
  - Update mode (`--update`): selects a new message, writes `state.json`, prints nothing
- Orchestrates loading of config, state, stats, and stdin JSON data
- Delegates message selection to `core/trigger.py` and output formatting to `core/display.py`

**Character Loader — `core/character.py`:**
- Single function `load_character(name: str) -> dict`
- Resolves vocab files from `vocab/` directory relative to module location
- Raises `FileNotFoundError` on missing characters; `statusline.py` falls back to `nova` on failure
- Returns the full character dict including `meta` and `triggers`

**Message Selection — `core/trigger.py`:**
- Implements a 5-level priority selection chain via `resolve_message()`
- Priority order:
  1. Usage tier escalation (rate limit `%` crosses threshold → alert message)
  2. Alert persistence (same non-normal tier → keep existing alert message)
  3. Post-tool forced (`--update` mode → pick from `post_tool` pool, avoid repeat)
  4. Cache freshness (< 5 minutes since last update → return cached message)
  5. Time slot change (morning / afternoon / evening / midnight transition)
  6. Random fallback (pick from `random` pool, avoid repeating last message)
- Helper functions: `get_tier()`, `get_time_slot()`, `cache_expired()`, `pick()`, `pick_different()`

**Output Formatter — `core/display.py`:**
- `render(character, message, cc_data, stats) -> str` produces the final 2-line statusline string
- Line 1: ANSI-colored `{ascii_face} {name}: {message}`
- Line 2: `{model} | {today_tokens} tokens | 5h {pct}% ↺{resets} | 7d {pct}% | ctx {pct}%`
- Helper `format_tokens()` converts raw counts to human-readable form (e.g., `47768 → 47k`)
- Helper `format_resets()` converts Unix timestamps or ISO strings to relative time (`3h20m`, `45m`)

**Vocab Files — `vocab/*.json`:**
- One JSON file per character: `nova.json`, `luna.json`, `mochi.json`, `iris.json`
- Schema: `{ "meta": { name, ascii, style, color }, "triggers": { random[], time{morning,afternoon,evening,midnight}[], usage{warning,critical}[], post_tool[] } }`
- Safe to edit without touching code; adding a character requires only a new JSON file

**Slash Command — `commands/cheer.md`:**
- Claude Code custom command at `/cheer`
- Prompts user to pick a character (Nova / Luna / Mochi / Iris) via `AskUserQuestion`
- Writes new character name to `~/.claude/code-cheer/config.json` and resets `state.json` via inline Python one-liner executed through Bash

**Installer — `install.sh`:**
- Copies `statusline.py`, `core/`, and `vocab/` to `~/.claude/code-cheer/`
- Writes default `config.json` (skips if already exists) and resets `state.json`
- Patches `~/.claude/settings.json` via embedded Python: adds `statusLine` command and `Stop` hook, skips if already present, backs up original
- Copies `commands/cheer.md` to `~/.claude/commands/`
- `--uninstall` flag reverses all changes

## Data Flow

**Render mode (statusLine polling):**
1. Claude Code polls `statusLine` command → invokes `python3 ~/.claude/code-cheer/statusline.py`
2. `statusline.py` reads `config.json` (character name), `state.json` (cached message), `stats-cache.json` (token counts)
3. Reads Claude Code runtime data from stdin (JSON: `model`, `rate_limits`, `context_window`)
4. `load_character()` loads vocab from `vocab/{name}.json`
5. `resolve_message()` determines current message based on priority chain
6. If message or tier changed, `save_state()` writes updated `state.json`
7. `render()` formats 2-line output → printed to stdout → displayed in statusbar

**Update mode (Stop hook):**
1. Claude Code fires `Stop` hook after each response → invokes `python3 ... statusline.py --update`
2. Same load sequence as render mode, but `force_post_tool=True` is passed to `resolve_message()`
3. A `post_tool` message is selected (avoiding repeat of last message)
4. `save_state()` writes the new message and tier to `state.json`
5. No output printed (update-only path returns before `print(render(...))`)

**Character switching (/cheer command):**
1. User runs `/cheer` → Claude Code loads `commands/cheer.md`
2. User selects character via interactive prompt
3. Claude executes inline Python to overwrite `config.json` and reset `state.json`
4. Next statusLine poll picks up new character from `config.json`

## Key Design Patterns

**Dual-mode CLI:** Single entry point `statusline.py` serves two purposes via `--update` flag, keeping install wiring simple (one file, two commands).

**Statefile cache:** `state.json` acts as an inter-process cache between the Stop hook (writer) and statusLine poll (reader). This avoids redundant message selection on every poll.

**Priority-based message selection:** `resolve_message()` implements a deterministic priority chain rather than conditional branching scattered across the codebase. All selection logic lives in one function in `core/trigger.py`.

**Data-driven characters:** Characters are pure JSON with no code coupling. New characters require only a vocab file — no code changes needed.

**Non-destructive install:** `install.sh` patches `settings.json` by loading and merging, never overwriting. It skips entries that already exist and always backs up before modifying.

## Entry Points

**`statusline.py` (render mode):**
- Invoked by: Claude Code `statusLine` polling
- Input: stdin JSON from Claude Code runtime, `config.json`, `state.json`, `stats-cache.json`
- Output: 2-line string to stdout

**`statusline.py --update` (update mode):**
- Invoked by: Claude Code `Stop` hook after each response
- Input: stdin JSON from Claude Code runtime, `config.json`, `state.json`
- Output: updates `state.json` only, no stdout

**`install.sh`:**
- Invoked by: user manually
- Actions: file copy, config patching, settings.json merge

**`commands/cheer.md`:**
- Invoked by: `/cheer` slash command inside Claude Code
- Actions: character selection prompt, writes `config.json` and `state.json`

## State Management

**`~/.claude/code-cheer/config.json`:**
- Schema: `{ "character": "nova" }`
- Written by: `install.sh` (initial), `/cheer` command (character switch)
- Read by: `statusline.py` on every invocation

**`~/.claude/code-cheer/state.json`:**
- Schema: `{ "message": str, "last_updated": ISO8601, "last_rate_tier": str, "last_slot": str|null }`
- Written by: `statusline.py` `save_state()` when message or tier changes; `install.sh` on install/upgrade; `/cheer` on character switch (reset)
- Read by: `statusline.py` `load_state()` on every invocation
- Used as: inter-process cache and deduplication guard (prevents repeat messages)

**`~/.claude/stats-cache.json`:**
- Schema: `{ "dailyModelTokens": [{ "date": "YYYY-MM-DD", "tokensByModel": { model: tokens } }] }`
- Written by: Claude Code itself (external)
- Read by: `statusline.py` `load_stats()` to derive `today_tokens`
- Fallback: if today's date is absent, token data is supplemented from `context_window` in stdin JSON

---

*Architecture analysis: 2026-04-01*
