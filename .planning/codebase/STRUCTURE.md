# Directory Structure

**Analysis Date:** 2026-04-01

## Top-Level Layout

```
Claude-Code-Cheer/
├── statusline.py        # Entry point — render and update modes
├── install.sh           # Install / uninstall script
├── CLAUDE.md            # Project instructions for Claude Code
├── README.md            # User-facing documentation
├── LICENSE
├── .gitignore
├── core/                # Core logic modules
├── vocab/               # Character dialogue JSON files
├── commands/            # Claude Code slash command definitions
├── tests/               # Pytest test suite
└── docs/                # Design specs and planning docs
    └── superpowers/
        ├── plans/
        └── specs/
```

## Source Organization

The codebase is organized by concern rather than by feature. The `core/` package contains the three processing stages (load → select → render). The `vocab/` directory holds all dialogue data. Tests mirror the source layout.

**`core/` — Processing pipeline:**
```
core/
├── __init__.py
├── character.py    # Load and validate vocab JSON
├── trigger.py      # Message selection logic (priority chain)
└── display.py      # Format output string for statusline
```

**`vocab/` — Character dialogue data:**
```
vocab/
├── nova.json       # Nova — energetic sports type
├── luna.json       # Luna — gentle companion type
├── mochi.json      # Mochi — tsundere cat type
└── iris.json       # Iris — cool queen type
```

**`commands/` — Claude Code slash commands:**
```
commands/
└── cheer.md        # /cheer command — character selection
```

**`tests/` — Pytest suite:**
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
- Primary entry point and orchestrator
- Defines constants `BASE_DIR`, `CONFIG_PATH`, `STATE_PATH`, `STATS_PATH`
- Implements `load_config()`, `load_state()`, `load_stats()`, `read_stdin_json()`, `save_state()`, `main()`
- Not importable as a library cleanly — uses `sys.path.insert` for portability post-install

**`core/trigger.py`:**
- Contains all message selection logic
- Edit here to change trigger priorities, thresholds, or cache TTL
- `resolve_message()` is the main function; `get_tier()`, `get_time_slot()`, `cache_expired()` are pure helpers

**`core/display.py`:**
- Controls all output formatting
- Edit here to change statusline layout, color, or token display format
- `render()` is the main function; `format_tokens()` and `format_resets()` are pure helpers

**`core/character.py`:**
- Single function `load_character(name)` — resolves path relative to module, not CWD
- VOCAB_DIR resolves to `../vocab` from module location, works both in repo and after install

**`vocab/nova.json`** (representative of all vocab files):
- Required keys: `meta.name`, `meta.ascii`, `meta.color`, `triggers.random`, `triggers.time.{morning,afternoon,evening,midnight}`, `triggers.usage.{warning,critical}`, `triggers.post_tool`
- `meta.color` is an ANSI color code string (e.g., `"93"` for yellow)

**`install.sh`:**
- Install target: `~/.claude/code-cheer/`
- Copies: `statusline.py`, `core/`, `vocab/`
- Creates: `config.json` (if absent), `state.json` (always reset)
- Patches: `~/.claude/settings.json` (non-destructive merge via embedded Python)
- Installs: `commands/cheer.md` → `~/.claude/commands/cheer.md`

## Configuration Files

**`~/.claude/code-cheer/config.json`** (runtime, not in repo):
- Controls active character
- Schema: `{ "character": "nova" }`
- Created by `install.sh`, modified by `/cheer` command

**`~/.claude/settings.json`** (Claude Code config, not in repo):
- Patched by `install.sh` to add:
  - `statusLine.command` → `python3 ~/.claude/code-cheer/statusline.py`
  - `hooks.Stop[].hooks[].command` → `python3 ~/.claude/code-cheer/statusline.py --update`

**No project-level config files** (no `pyproject.toml`, `setup.py`, `.env`, etc.). The project has zero Python dependencies beyond the standard library.

## Naming Conventions

**Files:**
- Python source files: `snake_case.py`
- Test files: `test_{module_name}.py` (mirrors source module name)
- Vocab files: `{character_name}.json` (lowercase)
- Command files: `{command_name}.md`

**Directories:**
- Source packages: lowercase single word (`core/`, `vocab/`, `commands/`, `tests/`)

## Where to Add New Code

**New character:**
- Add vocab file: `vocab/{name}.json` (follow schema of existing files)
- Add to `/cheer` command options: `commands/cheer.md`
- Add character tests: `tests/test_character.py`

**New trigger type or priority:**
- Implementation: `core/trigger.py` — extend `resolve_message()`
- Add new trigger key to all vocab files in `vocab/`
- Tests: `tests/test_trigger.py`

**New statusline display element:**
- Implementation: `core/display.py` — extend `render()`
- Tests: `tests/test_display.py`

**New CLI mode or flag:**
- Implementation: `statusline.py` — extend `main()`
- Tests: `tests/test_statusline.py`

**New slash command:**
- Add file: `commands/{name}.md`
- Register in `install.sh` copy step (line ~144)

## Special Directories

**`.planning/`:**
- Purpose: GSD planning and codebase analysis documents
- Generated: By GSD tooling
- Committed: Yes

**`docs/superpowers/`:**
- Purpose: Design specs and implementation plans from initial development
- Key files: `docs/superpowers/specs/2026-03-22-code-cheer-design.md`, `docs/superpowers/plans/2026-03-22-code-cheer.md`
- Generated: No (authored documents)
- Committed: Yes

**Runtime directories (not in repo):**
- `~/.claude/code-cheer/` — install target, contains `statusline.py`, `core/`, `vocab/`, `config.json`, `state.json`

---

*Structure analysis: 2026-04-01*
