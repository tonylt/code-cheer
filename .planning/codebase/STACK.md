# Technology Stack

**Analysis Date:** 2026-04-01

## Languages

**Primary:**
- Python 3 (system `python3`, tested with 3.14.1) — all application logic, tests, and installer inline scripts

**Secondary:**
- Bash — `install.sh` installer/uninstaller script
- JSON — character vocab data files (`vocab/*.json`) and runtime state/config files

## Runtime

**Environment:**
- Python 3 (no specific minimum pinned; `#!/usr/bin/env python3` shebang used throughout)
- No virtual environment config detected (no `requirements.txt`, `Pipfile`, `pyproject.toml`, or `setup.py`)

**Package Manager:**
- None — project has zero third-party Python dependencies
- Lockfile: Not present (not needed)

## Frameworks

**Core:**
- Python standard library only — all logic uses `json`, `os`, `sys`, `random`, `datetime`, `unittest.mock`

**Testing:**
- `pytest` — test runner; invoked via `python3 -m pytest tests/`
- `unittest.mock` (stdlib) — mocking and patching; used in `tests/test_trigger.py` and `tests/test_statusline.py`

**Build/Dev:**
- None — no build step, bundler, or transpiler
- `install.sh` is a Bash script that copies files directly to `~/.claude/code-cheer/`

## Key Dependencies

**Critical:**
- None (zero third-party packages) — entire dependency surface is Python standard library

**Infrastructure:**
- Claude Code (`~/.claude/settings.json`) — host application that polls the statusLine command and fires Stop hooks; not a Python dep but a required runtime environment

## Configuration

**Environment:**
- No environment variables used
- Runtime config via JSON files only:
  - `~/.claude/code-cheer/config.json` — active character selection: `{"character": "nova"}`
  - `~/.claude/code-cheer/state.json` — persisted message/tier/slot/timestamp
  - `~/.claude/stats-cache.json` — daily token usage written by Claude Code (read-only from this project's perspective)

**Build:**
- No build config files; `install.sh` is the only deployment mechanism

## Platform Requirements

**Development:**
- Python 3 (any recent version)
- `pytest` for running tests: `python3 -m pytest tests/`
- No OS-specific requirements beyond standard POSIX shell for `install.sh`

**Production:**
- macOS or Linux with `~/.claude/` directory (Claude Code installation)
- `python3` available on `PATH`
- Claude Code application as the host environment (provides `statusLine` polling and `Stop` hook dispatch)

---

*Stack analysis: 2026-04-01*
