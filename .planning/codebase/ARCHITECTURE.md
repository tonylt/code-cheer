# Architecture

**Analysis Date:** 2026-04-01

## System Overview

code-pal is a Claude Code statusline companion. Anime-style characters display encouragement messages and token/rate-limit usage in Claude Code's status bar. The system hooks into Claude Code via two mechanisms: a `statusLine` command polled for rendering, and a `Stop` hook that fires after each Claude response to update the current message.

The system runs entirely as Python scripts installed to `~/.claude/code-pal/`. No server, no daemon — two invocation modes of a single entry point script.

## Core Components

**Entry Point — `statusline.py`:**
- Dual-mode CLI: render mode (no args) and update mode (`--update`)
- Loads config, state, stats, and optional stdin JSON from Claude Code
- Orchestrates the other three core modules
- Writes updated state to `~/.claude/code-pal/state.json`
- Prints the two-line statusline string to stdout (render mode only)
- Fallback chain on missing character: try configured name → try `nova` → hardcoded string

**Character Loader — `core/character.py`:**
- Single function: `load_character(name: str) -> dict`
- Reads `vocab/{name}.json` relative to module location (works both in repo and after install)
- Raises `FileNotFoundError` on unknown character names
- No caching — file is read fresh each invocation

**Message Selector — `core/trigger.py`:**
- Pure logic module: no I/O, no side effects
- `resolve_message(character, state, stats, cc_data, force_post_tool)` returns `(message, tier)` tuple
- Priority ladder (highest to lowest):
  1. Usage tier change (normal → warning → critical based on 5h rate limit percentage)
  2. Alert persistence (same non-normal tier — hold current message unchanged)
  3. `force_post_tool` (`--update` mode — pick from `post_tool` pool, avoid repeat)
  4. Cache still fresh (< 5 minutes since last update — return cached message unchanged)
  5. Time slot changed (morning / afternoon / evening / midnight)
  6. Random fallback (pick from `random` pool, avoid repeating last message)
- Tier thresholds: `>= 95%` = critical, `>= 80%` = warning, else normal
- Time slots: morning (06–11), afternoon (12–17), evening (18–22), midnight (23–05)
- Helper functions: `get_tier()`, `get_time_slot()`, `cache_expired()`, `pick()`, `pick_different()`

**Renderer — `core/display.py`:**
- `render(character, message, cc_data, stats) -> str` produces the final 2-line statusline string
- Line 1: ANSI-colored `{ascii_face} {name}: {message}` (color from `meta.color` ANSI SGR code)
- Line 2: pipe-separated stats: `{model} | {tokens} tokens | 5h {pct}% ↺{resets} | 7d {pct}% | ctx {pct}%`
- `format_tokens()` converts raw counts to human-readable form (e.g., `47768` → `47k`)
- `format_resets()` converts Unix timestamp or ISO string to relative time (`3h20m`, `45m`)
- Omits stat fields not present in `cc_data` (graceful degradation)

**Vocab Files — `vocab/*.json`:**
- One JSON file per character: `nova.json`, `luna.json`, `mochi.json`, `iris.json`
- Required schema:
  ```json
  {
    "meta": { "name": "...", "ascii": "...", "style": "...", "color": "93" },
    "triggers": {
      "random": ["..."],
      "time": { "morning": [...], "afternoon": [...], "evening": [...], "midnight": [...] },
      "usage": { "warning": [...], "critical": [...] },
      "post_tool": ["..."]
    }
  }
  ```
- `color` is an ANSI SGR code string (e.g., `"93"` = bright yellow)
- Safe to edit without any code changes

**Slash Command — `commands/cheer.md`:**
- Claude Code custom command installed to `~/.claude/commands/cheer.md`
- Presents a 4-option character picker via `AskUserQuestion`
- On selection: writes `config.json` with chosen character and resets `state.json` via inline Python one-liner

**Installer — `install.sh`:**
- Copies `statusline.py`, `core/`, `vocab/` to `~/.claude/code-pal/`
- Creates default `config.json` (`{"character": "nova"}`) if absent; always resets `state.json`
- Patches `~/.claude/settings.json` non-destructively via embedded Python (backs up first)
- Copies `commands/cheer.md` to `~/.claude/commands/`
- `--uninstall` reverses all changes cleanly

## Data Flow

**Render Mode (statusLine polling):**

1. Claude Code polls `statusLine` → invokes `python3 ~/.claude/code-pal/statusline.py`
2. `load_config()` reads `~/.claude/code-pal/config.json` → character name
3. `load_state()` reads `~/.claude/code-pal/state.json` → cached message + tier + slot
4. `load_stats()` reads `~/.claude/stats-cache.json` → today's token total
5. `read_stdin_json()` reads Claude Code's JSON payload from stdin → model, rate_limits, context_window
6. Token fallback: if stats-cache has no today entry, supplement from stdin `context_window` fields
7. `load_character(name)` reads `vocab/{name}.json`
8. `resolve_message(...)` selects message using priority ladder → returns `(message, tier)`
9. If message or tier changed: `save_state()` writes updated `state.json`
10. `render(...)` formats two-line output → printed to stdout → displayed in status bar

**Update Mode (Stop hook):**

Steps 1–9 identical to render mode, but `force_post_tool=True` is passed to `resolve_message()`, ensuring a `post_tool` message is selected. Step 10 is skipped — no stdout output printed.

**Character Switch (`/cheer` command):**

1. User invokes `/cheer` in Claude Code
2. Command presents 4-option picker via `AskUserQuestion`
3. On selection: writes `config.json` with chosen name, resets `state.json` to blank state
4. Next render poll picks up new character automatically from `config.json`

## Key Design Patterns

**Dual-mode single entry point:** One script, two behaviors controlled by `--update` flag. Avoids two separate scripts drifting out of sync while keeping install wiring simple.

**State-as-file cache:** `state.json` acts as an inter-process cache between the Stop hook (writer) and statusLine poll (reader). All logic is stateless; state is loaded fresh each invocation. No in-memory persistence needed since the process is short-lived.

**Priority ladder in `resolve_message`:** Message selection is a deterministic waterfall. Each priority level either returns a result or falls through to the next. All selection logic lives in one function in `core/trigger.py`, making it easy to test and modify.

**Vocab separation from logic:** All character dialogue lives in `vocab/*.json`. Adding a character requires only a new JSON file and a line in `commands/cheer.md` — no Python changes needed.

**Pure logic modules:** `core/trigger.py` and `core/display.py` have no I/O. All file access is isolated in `statusline.py`. This makes unit testing straightforward with no filesystem mocking required.

**Non-destructive install:** `install.sh` patches `settings.json` by loading and merging, never overwriting. Skips entries already present; always backs up before modifying.

## Entry Points

**`statusline.py` (render mode):**
- Invoked by: Claude Code `statusLine` polling
- Command: `python3 ~/.claude/code-pal/statusline.py`
- Input: stdin JSON from Claude Code (optional), `config.json`, `state.json`, `stats-cache.json`
- Output: two-line string to stdout

**`statusline.py --update` (update mode):**
- Invoked by: Claude Code `Stop` hook after each response
- Command: `python3 ~/.claude/code-pal/statusline.py --update`
- Input: same as render mode
- Output: writes `state.json` only, no stdout

**`install.sh`:**
- Invoked by: user manually from repo root
- Commands: `./install.sh` (install) or `./install.sh --uninstall`

**`/cheer` slash command:**
- Invoked by: user typing `/cheer` in Claude Code
- Installed at: `~/.claude/commands/cheer.md`
- Output: writes `config.json` and resets `state.json`

## State Management

**`~/.claude/code-pal/config.json`** (runtime, not in repo):
- Schema: `{ "character": "nova" }`
- Written by: `install.sh` (initial default), `/cheer` command (character switch)
- Read by: `statusline.py` on every invocation
- Default fallback if absent: `{"character": "nova"}`

**`~/.claude/code-pal/state.json`** (runtime, not in repo):
- Schema: `{ "message": str, "last_updated": ISO8601, "last_rate_tier": str, "last_slot": str|null }`
- Written by: `statusline.py` `save_state()` when message or tier changes; `install.sh` on install/upgrade; `/cheer` on character switch (reset to blank)
- Read by: `statusline.py` `load_state()` on every invocation
- Acts as: inter-process cache and deduplication guard (prevents repeat messages, avoids redundant selection)

**`~/.claude/stats-cache.json`** (written by Claude Code, read-only for code-pal):
- Schema: `{ "dailyModelTokens": [{ "date": "YYYY-MM-DD", "tokensByModel": { model: count } }] }`
- code-pal sums all model token counts for today's date entry
- Fallback: if today absent, derive from `context_window.total_input_tokens + total_output_tokens` in stdin JSON

---

*Architecture analysis: 2026-04-01*
