# Technical Concerns

**Analysis Date:** 2026-04-01

---

## Critical Issues

### Test/Production Data Structure Mismatch — Rate Limits Schema

- **Issue:** `core/trigger.py` (line 60) reads `rate_limits.five_hour.used_percentage` (nested), but `tests/test_trigger.py` (line 110) constructs `make_cc()` as `{"rate_limits": {"used_percentage": pct}}` (flat, no `five_hour` key). The same mismatch exists in `tests/test_display.py` (lines 58–83): tests pass `rate_limits.used_percentage` directly, but `core/display.py` (lines 62–65) reads `rate_limits.five_hour.used_percentage` and `rate_limits.seven_day.used_percentage`.
- **Files:** `core/trigger.py`, `core/display.py`, `tests/test_trigger.py`, `tests/test_display.py`
- **Impact:** All unit tests that exercise rate-limit tier escalation (`test_resolve_escalates_to_warning`, `test_resolve_escalates_to_critical`, `test_render_line2_contains_pct`) pass only because the nested key resolves to `None`/`0` — faking a "normal" tier — rather than the intended test value. The tests appear green but do NOT exercise the real code paths. In production the schema is nested; in tests it is flat. The `test_render_line2_contains_pct` test asserts `"用量 32%"` is in line 2, which can never appear because `display.py` outputs `"5h 32.0%"` format, not `"用量 32%"`. This test will always fail when run against the real implementation.
- **Fix approach:** Update `make_cc()` in `tests/test_trigger.py` to use `{"rate_limits": {"five_hour": {"used_percentage": pct}}}`. Update `tests/test_display.py` to pass the nested structure and assert `"5h 32.0%"` instead of `"用量 32%"`.

### pytest Not Available in System Python

- **Issue:** `python3 --version` resolves to Python 3.14.1 via `/opt/homebrew/opt/python@3.14/bin/python3.14`, which does not have `pytest` installed. Running `python3 -m pytest tests/` fails with `No module named pytest`.
- **Files:** `install.sh` (line 72), `CLAUDE.md` (commands section)
- **Impact:** The documented `python3 -m pytest tests/` command fails immediately. CI is effectively broken unless a virtualenv with pytest is explicitly activated first.
- **Fix approach:** Add a `pyproject.toml` or `requirements-dev.txt` specifying `pytest` as a dev dependency, and document the setup steps (e.g., `pip install pytest` or `python3 -m pip install -e ".[dev]"`). Alternatively, add a `Makefile` or `run_tests.sh` that bootstraps the environment.

---

## Technical Debt

### Incomplete Type Annotations

- **Issue:** Several function signatures lack parameter type annotations. `core/display.py` `format_tokens(token_count)` (line 5) and `format_resets(resets_at)` (line 18) have no parameter types. `statusline.py` `main()` (line 79) has no return annotation. `core/trigger.py` `resolve_message` returns `tuple` without specifying element types.
- **Files:** `core/display.py` (lines 5, 18), `core/trigger.py` (line 51), `statusline.py` (line 79)
- **Impact:** Static type checkers cannot catch contract violations. The untyped dict parameters (`character`, `state`, `stats`, `cc_data`) make refactoring error-prone.
- **Fix approach:** Add `-> dict`, `-> tuple[str, str]`, `-> str`, `-> None` annotations; introduce `TypedDict` schemas for the four main dict types.

### Unvalidated Vocab JSON Schema

- **Issue:** `core/character.py` loads vocab files (`load_character`, lines 7–13) but performs zero schema validation. If a user-created vocab file is missing `triggers.post_tool`, `triggers.time`, `triggers.usage`, or any time slot key, `resolve_message` in `core/trigger.py` (lines 63, 68–69, 78, 87) will raise an unhandled `KeyError` at runtime.
- **Files:** `core/character.py` (lines 7–13), `core/trigger.py` (lines 63–90)
- **Impact:** A malformed character file causes the statusline to crash silently with no output, leaving the statusline blank.
- **Fix approach:** Add a validation step in `load_character()` that checks for all required trigger keys and raises a descriptive `ValueError` rather than propagating a bare `KeyError`.

### `save_state` Non-Atomic Write

- **Issue:** `statusline.py` `save_state()` (lines 67–76) writes directly to `STATE_PATH` via `open(STATE_PATH, "w")`. If the process is killed mid-write, the file is left truncated/corrupt. The next invocation falls back to `_EMPTY_STATE` silently.
- **Files:** `statusline.py` (lines 67–76)
- **Impact:** Low-probability but possible on rapid sequential `--update` calls. The install/uninstall logic in `install.sh` already uses the atomic `tmp → os.replace()` pattern, so the fix is well-established in this codebase.
- **Fix approach:** Write to `STATE_PATH + ".tmp"` then call `os.replace(STATE_PATH + ".tmp", STATE_PATH)` as `install.sh` does.

### Hardcoded Character Dialogue in Python Source

- **Issue:** `statusline.py` line 100 embeds a hardcoded Chinese string `"(*>ω<) Nova: 加油！今天也要好好编程！\nunknown | N/A tokens"` in Python source as the last-resort fallback. This is inconsistent with the vocab-file design: if Nova's style or ASCII face changes, this string is never updated.
- **Files:** `statusline.py` (line 100)
- **Fix approach:** Replace with a generic fallback that does not embed character-specific dialogue, or extract as a constant in `statusline.py` with a comment marking it as the emergency fallback.

### Inline Python Embedded in Shell Heredocs (`install.sh`)

- **Issue:** `install.sh` embeds two Python scripts inline as `<<'PYEOF'` heredocs (install: lines 100–140, uninstall: lines 23–51). These scripts are not covered by pytest, not linted by any tool, and have no error handling if `settings.json` contains invalid JSON at install time (the `json.load(f)` call on line 110 will raise an unhandled `json.JSONDecodeError`).
- **Files:** `install.sh` (lines 23–51, lines 100–140)
- **Fix approach:** Extract to `scripts/patch_settings.py` and `scripts/unpatch_settings.py` with proper error handling; call them from `install.sh`.

---

## Missing Features

### No Character Name Validation on Config Load

- **Issue:** `statusline.py` `load_config()` (lines 27–32) returns the raw character name from `config.json` without validating it against known characters. An invalid name silently falls through to the `FileNotFoundError` handler in `main()` (lines 96–101), which hardcodes a Nova fallback rather than showing a useful diagnostic.
- **Files:** `statusline.py` (lines 27–32, 95–101)
- **Fix approach:** After `load_config()`, validate the character name against a whitelist or the actual files in `vocab/`; log a warning message before falling back.

### `/cheer` Command Uses Unsafe String-Interpolated Python One-Liner

- **Issue:** `commands/cheer.md` (line 13) instructs Claude Code to run a one-liner `python3 -c "..."` that writes to `config.json` and `state.json` with the character name string-interpolated as `NAME` directly into a Python string literal. The write uses raw `open().write('{\"character\": \"NAME\"}')` with no `json.dumps`, no atomic write, and no encoding safety.
- **Files:** `commands/cheer.md` (line 13)
- **Impact:** Current character names are ASCII-safe (nova/luna/mochi/iris), so risk is low. A future character name containing `"`, `\`, or non-ASCII could corrupt both files.
- **Fix approach:** Invoke a dedicated `statusline.py --set-character NAME` subcommand or a `scripts/set_character.py` script instead of inline string construction.

### No Coverage Enforcement or Project Config File

- **Issue:** No `pytest.ini`, `setup.cfg`, `pyproject.toml`, or `tox.ini` exists to configure coverage thresholds, test discovery settings, or linting. `pytest` is not listed as a dependency anywhere.
- **Files:** Project root (no config file present)
- **Fix approach:** Add a minimal `pyproject.toml` with `[tool.pytest.ini_options]`, `[project.optional-dependencies]` for dev deps (`pytest`, `pytest-cov`), and optionally `[tool.ruff]` for linting.

---

## Performance Concerns

### `load_stats()` Linear Scan on Every Render

- **Issue:** `statusline.py` `load_stats()` (lines 43–54) reads and iterates the full `dailyModelTokens` list on every statusline render invocation. As `stats-cache.json` grows over months of use, this is a linear scan per render.
- **Files:** `statusline.py` (lines 43–54)
- **Impact:** Negligible at typical sizes (tens of entries). The `for` loop already returns on the first match, so it is effectively an early-exit scan. No action needed unless the list exceeds thousands of entries.

---

## Security Concerns

### No Path Traversal Guard in `load_character`

- **Issue:** `core/character.py` `load_character(name)` (line 9) constructs the path as `os.path.join(VOCAB_DIR, f'{name}.json')` without normalizing it. A name like `"../../../etc/passwd"` produces the joined path `/Users/…/vocab/../../../etc/passwd.json`, which `os.path.normpath` resolves outside `VOCAB_DIR`. There is no check that the resolved path stays within `VOCAB_DIR`.
- **Files:** `core/character.py` (lines 8–11)
- **Impact:** In practice, the character name comes from `config.json`, which is user-controlled (written by `/cheer`). Exploitation requires the user to manually write a malicious value to their own `config.json`, so the practical risk is low. However, adding a guard is a one-liner fix.
- **Fix approach:** Add `if not os.path.normpath(path).startswith(os.path.normpath(VOCAB_DIR) + os.sep): raise ValueError(f"Invalid character name: {name}")` before opening the file.

### `read_stdin_json` Passes Unvalidated Data to Rendering

- **Issue:** `statusline.py` `read_stdin_json()` (lines 57–64) reads all of stdin and passes the parsed dict directly into `resolve_message` and `render` without any type validation. Unexpected types (e.g., `context_window.used_percentage` as a string instead of a number) propagate into `core/display.py` format strings.
- **Files:** `statusline.py` (lines 57–64), `core/display.py` (line 69)
- **Impact:** Low in practice — stdin is provided by Claude Code itself. Defensive `isinstance` checks would make display formatting more robust against future API schema changes.

---

## Dependency Risks

### Python Minimum Version Unspecified

- **Issue:** `install.sh` only checks `python3 --version > /dev/null` (line 72) with no minimum version assertion. `core/display.py` uses `datetime.fromisoformat()` with timezone strings replaced via `.replace("Z", "+00:00")` (line 30), which can behave differently before Python 3.11 (where `fromisoformat` gained full ISO 8601 support including timezone offsets). The current system Python is 3.14.1, but users on older systems may see unexpected behavior.
- **Files:** `install.sh` (line 72), `core/display.py` (line 30)
- **Fix approach:** Add a Python version check in `install.sh`: `python3 -c "import sys; assert sys.version_info >= (3, 9), 'Python 3.9+ required'"`. Document the minimum version in a `pyproject.toml`.

---

## Improvement Opportunities

### Test Fixtures Duplicated Across All Four Test Files

- **Issue:** The character fixture dict (`SAMPLE_CHAR` / `CHAR`) is defined independently in `tests/test_trigger.py` (line 91), `tests/test_display.py` (line 55), and `tests/test_statusline.py` (line 8), each with minor structural variations. The `make_cc()` and `make_state()` helpers exist only in `tests/test_trigger.py`.
- **Files:** `tests/test_trigger.py`, `tests/test_display.py`, `tests/test_statusline.py`
- **Suggestion:** Introduce `tests/conftest.py` with shared `@pytest.fixture` definitions for the standard character dict, `make_cc()`, and `make_state()`.

### `resolve_message` Priority Logic Has No Structural Enforcement

- **Issue:** `core/trigger.py` `resolve_message()` (lines 51–90) implements a 5-level waterfall as sequential `if/return` statements with inline comments. The logic is correct but fragile: adding a new priority level requires careful manual insertion at the right position with no structural guarantee.
- **Files:** `core/trigger.py` (lines 51–90)
- **Suggestion:** Document the priority table in the module or function docstring. If more priority levels are added, consider a list-of-resolver-functions pattern.

### `format_resets` Dual Parse Path Undocumented

- **Issue:** `core/display.py` `format_resets()` (lines 18–41) first attempts to parse the input as a float Unix timestamp, then falls back to ISO string. The dual path is not documented and the precedence is implicit. A numeric string like `"1735000000"` succeeds on the float path, which is correct but non-obvious.
- **Files:** `core/display.py` (lines 18–41)
- **Suggestion:** Add a docstring clarifying that Unix timestamps (int/float) take priority over ISO strings.

### No `.python-version` Runtime Pinning

- **Issue:** No `.python-version` file exists at the project root. Contributors on different Python versions may get inconsistent `datetime.fromisoformat` behavior for edge-case timezone formats.
- **Files:** Project root
- **Suggestion:** Add `.python-version` containing `3.11` (or the minimum tested version) to communicate the intended runtime.

### `CHAR` Fixture in `test_display.py` Missing `color` Key

- **Issue:** `tests/test_display.py` (line 55) defines `CHAR = {"meta": {"name": "Nova", "ascii": "(*>ω<)", "style": "test"}}` without a `"color"` key. `core/display.py` `render()` (line 48) calls `character["meta"].get("color", "")`, so this is safe via `.get()`. However, the fixture does not test the ANSI color escape code path at all; no test covers the `color` branch in `render()`.
- **Files:** `tests/test_display.py` (line 55), `core/display.py` (lines 48–51)
- **Suggestion:** Add a test case that provides a `color` value and asserts the ANSI escape sequence appears in line 1 output.

---

*Concerns audit: 2026-04-01*
