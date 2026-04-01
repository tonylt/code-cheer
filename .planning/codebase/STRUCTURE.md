# Directory Structure

**Analysis Date:** 2026-04-01

## Top-Level Layout

```
code-pal/
├── statusline.py        # Entry point — render and update modes
├── install.sh           # Install / uninstall script
├── CLAUDE.md            # Project instructions for Claude Code
├── README.md            # User-facing documentation
├── LICENSE
├── .gitignore
├── core/                # Core logic modules (Python package)
├── vocab/               # Character dialogue JSON files
├── commands/            # Claude Code slash command definitions
├── tests/               # Pytest test suite
└── docs/                # Design specs and planning documents
    └── superpowers/
        ├── plans/
        └── specs/
```

## Source Organization

The codebase is organized by concern rather than by feature. The `core/` package contains the three processing stages (load → select → render). The `vocab/` directory holds all character dialogue data as pure JSON. Tests mirror the source module layout.

**`core/` — Processing pipeline:**
```
core/
├── __init__.py
├── character.py    # Load vocab JSON for a named character
├── trigger.py      # Message selection logic (5-level priority chain)
└── display.py      # Format the 2-line statusline output string
```

**`vocab/` — Character dialogue data:**
```
vocab/
├── nova.json       # Nova — energetic sports-cheerleader type (*>ω<)
├── luna.json       # Luna — gentle companion type (´• ω •`)
├── mochi.json      # Mochi — tsundere cat type (=^･ω･^=)
└── iris.json       # Iris — cool queen type (￣ω￣)
```

**`commands/` — Claude Code slash commands:**
```
commands/
└── cheer.md        # /cheer command — interactive character selector
```

**`tests/` — Pytest test suite:**
```
tests/
├── __init__.py
├── test_character.py     # Tests for core/character.py
├── test_trigger.py       # Tests for core/trigger.py
├── test_display.py       # Tests for core/display.py
└── test_statusline.py    # Integration tests for statusline.py main()
```

## Key Files

**`statusline.py`:**
- Primary entry point and orchestrator for all runtime operations
- Defines path constants: `BASE_DIR`, `CONFIG_PATH`, `STATE_PATH`, `STATS_PATH`
- Implements: `load_config()`, `load_state()`, `load_stats()`, `read_stdin_json()`, `save_state()`, `main()`
- Uses `sys.path.insert(0, ...)` at top for portability after installation to `~/.claude/code-pal/`

**`core/trigger.py`:**
- All message selection logic lives here
- Edit this file to change trigger priorities, tier thresholds, or cache TTL (currently 5 minutes)
- `resolve_message()` is the main function; `get_tier()`, `get_time_slot()`, `cache_expired()` are pure helpers

**`core/display.py`:**
- All output formatting logic lives here
- Edit this file to change statusline layout, ANSI color application, or token display format
- `render()` is the main function; `format_tokens()` and `format_resets()` are pure helpers

**`core/character.py`:**
- Single function `load_character(name)` — resolves `VOCAB_DIR` relative to the module file, not CWD
- Works correctly both when run from the repo root and after installation

**`vocab/nova.json`** (representative schema for all vocab files):
- Required keys: `meta.name`, `meta.ascii`, `meta.color`, `triggers.random[]`, `triggers.time.{morning,afternoon,evening,midnight}[]`, `triggers.usage.{warning,critical}[]`, `triggers.post_tool[]`
- `meta.color` is an ANSI SGR code string (e.g., `"93"` for bright yellow)

**`install.sh`:**
- Install target directory: `~/.claude/code-pal/`
- Copies: `statusline.py`, `core/`, `vocab/`
- Creates: `config.json` (if absent), `state.json` (always reset on install/upgrade)
- Patches: `~/.claude/settings.json` via embedded Python (non-destructive, backs up original)
- Installs: `commands/cheer.md` → `~/.claude/commands/cheer.md`
- Uninstall: `./install.sh --uninstall` removes all installed files and settings entries

**`commands/cheer.md`:**
- Defines `/cheer` slash command behavior for Claude Code
- Uses `AskUserQuestion` to present 4 character choices with personality descriptions
- On selection: executes inline Python to write `~/.claude/code-pal/config.json` and reset `state.json`

## Configuration Files

**`~/.claude/code-pal/config.json`** (runtime, not in repo):
- Controls which character is active
- Schema: `{ "character": "nova" }`
- Created by `install.sh`; modified by `/cheer` command

**`~/.claude/settings.json`** (Claude Code config, not in repo):
- Patched by `install.sh` to register two entries:
  - `statusLine.command` → `python3 ~/.claude/code-pal/statusline.py`
  - `hooks.Stop[].hooks[].command` → `python3 ~/.claude/code-pal/statusline.py --update`

**No project-level Python config** (no `pyproject.toml`, `setup.py`, `requirements.txt`). Zero external dependencies — standard library only.

## Naming Conventions

**Files:**
- Python source: `snake_case.py`
- Test files: `test_{module_name}.py` (matches source module name exactly)
- Vocab files: `{character_name}.json` (lowercase character name)
- Command files: `{command_name}.md`

**Directories:**
- Python packages: lowercase single word (`core/`, `vocab/`, `commands/`, `tests/`)

## Where to Add New Code

**New character:**
- Add vocab file: `vocab/{name}.json` (follow schema of `vocab/nova.json`)
- Add to character picker: `commands/cheer.md` (options list + reply text)
- Add character tests: `tests/test_character.py`

**New trigger type or message category:**
- Extend vocab schema: add new key to all `vocab/*.json` files
- Extend selection logic: `core/trigger.py` — add priority level in `resolve_message()`
- Tests: `tests/test_trigger.py`

**New statusline display element:**
- Implementation: `core/display.py` — extend `render()` or add helper
- Tests: `tests/test_display.py`

**New CLI mode or flag:**
- Implementation: `statusline.py` — extend `main()` with new `sys.argv` check
- Tests: `tests/test_statusline.py`

**New slash command:**
- Add file: `commands/{name}.md`
- Register copy in `install.sh` (after line 143 — the `cp` for `cheer.md`)

## Special Directories

**`.planning/codebase/`:**
- Purpose: GSD codebase analysis documents (ARCHITECTURE.md, STRUCTURE.md, etc.)
- Generated: By GSD tooling (`/gsd:map-codebase`)
- Committed: Yes

**`docs/superpowers/`:**
- Purpose: Design specs and implementation plans from initial development
- Key files: `docs/superpowers/specs/2026-03-22-code-cheer-design.md`, `docs/superpowers/plans/2026-03-22-code-cheer.md`
- Generated: No (authored documents)
- Committed: Yes

**Runtime directories (not in repo):**
- `~/.claude/code-pal/` — install target; contains `statusline.py`, `core/`, `vocab/`, `config.json`, `state.json`

---

*Structure analysis: 2026-04-01*
