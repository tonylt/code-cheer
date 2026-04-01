# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- Python 3 — all application logic, CLI entry point (`statusline.py`), core modules (`core/*.py`), and inline install scripts embedded in `install.sh`

**Secondary:**
- Bash — `install.sh` orchestration (install/uninstall, file copying, settings.json patching)
- JSON — character vocab data (`vocab/*.json`), runtime state and config files

## Runtime

**Environment:**
- Python 3 (no minimum version pinned; `#!/usr/bin/env python3` shebang used throughout)
- No virtual environment, no `requirements.txt`, no `pyproject.toml`, no `setup.py`
- Zero third-party Python packages — entire dependency surface is the Python standard library

**Package Manager:**
- None — not applicable

## Frameworks

**Core:**
- Python standard library only: `json`, `os`, `sys`, `random`, `datetime`, `unittest.mock`

**Testing:**
- `pytest` — test runner; invoked via `python3 -m pytest tests/`
- `unittest.mock` (stdlib) — patching `datetime` and `sys.argv/stdin` in `tests/test_trigger.py` and `tests/test_statusline.py`
- `pytest` fixtures: `tmp_path`, `monkeypatch`, `capsys` used extensively

**Build/Dev:**
- None — no build step, bundler, or transpiler; scripts run directly as Python source

## Key Dependencies

**Critical:**
- None (zero third-party packages)

**Runtime environment dependency:**
- Claude Code application — required host; provides `statusLine` polling and `Stop` hook dispatch; not a Python dependency but a required runtime environment

## Configuration

**Runtime config files (created at install time, not in repo):**
- `~/.claude/code-pal/config.json` — active character selection: `{"character": "nova"}`; read by `statusline.py:load_config()`
- `~/.claude/code-pal/state.json` — persisted message, tier, slot, timestamp; read/written by `statusline.py`
- `~/.claude/stats-cache.json` — daily token usage written by Claude Code; read-only from this project

**Claude Code host config (patched by install.sh):**
- `~/.claude/settings.json` — receives `statusLine` command entry and `hooks.Stop` entry

**No environment variables used anywhere in the codebase.**

## Platform Requirements

**Development:**
- Python 3 in PATH
- `pytest` available: `python3 -m pytest tests/`
- No OS-specific requirements beyond POSIX shell for `install.sh`

**Production:**
- macOS or Linux with `~/.claude/` directory (Claude Code installation)
- `python3` in PATH
- Claude Code as the host environment (provides statusLine polling and Stop hook dispatch)
- Installed to `~/.claude/code-pal/` via `./install.sh`

---

*Stack analysis: 2026-04-01*
