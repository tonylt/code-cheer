# Technical Concerns

**Analysis Date:** 2026-04-01

---

## Critical Issues

### Test/Production Data Structure Mismatch — Rate Limits Schema

- **Issue:** `core/trigger.py` (line 60) reads `rate_limits.five_hour.used_percentage` (nested), but `tests/test_trigger.py` (line 110) constructs `rate_limits` as `{"used_percentage": pct}` (flat, no `five_hour` key). The same mismatch exists in `tests/test_display.py` (lines 58–83): tests pass `rate_limits.used_percentage` directly, but `core/display.py` (lines 62–65) reads `rate_limits.five_hour.used_percentage` and `rate_limits.seven_day.used_percentage`.
- **Files:** `core/trigger.py`, `core/display.py`, `tests/test_trigger.py`, `tests/test_display.py`
- **Impact:** All unit tests that exercise rate-limit tier escalation (`test_resolve_escalates_to_warning`, `test_resolve_escalates_to_critical`, display line-2 percentage tests) pass because the nested key resolves to `None`/`0` — which fakes a "normal" tier — rather than the intended test value. Tests appear green but do NOT validate the real code paths. In production, the schema is nested; in tests, it is flat. A real rate-limit warning will never be triggered in CI.
- **Fix approach:** Update `make_cc()` in `tests/test_trigger.py` to use `{"rate_limits": {"five_hour": {"used_percentage": pct}}}`, and align `test_display.py` fixtures to match the nested structure used by `core/display.py`.

---

## Technical Debt

### No Type Annotations

- **Issue:** None of the source files (`statusline.py`, `core/character.py`, `core/trigger.py`, `core/display.py`) use Python type annotations on function signatures, despite the project using Python 3 and the codebase rules requiring annotations on all function signatures.
- **Files:** `statusline.py`, `core/character.py`, `core/trigger.py`, `core/display.py`
- **Impact:** Static type checkers (mypy/pyright) cannot catch contract violations. The `load_character` return type, `resolve_message` tuple return, and all `dict` parameters are untyped, making refactoring error-prone.
- **Fix approach:** Add `-> dict`, `-> tuple[str, str]`, `-> str`, `-> bool` annotations per function; introduce typed `TypedDict` schemas for `character`, `state`, `stats`, and `cc_data` dicts.

### Unvalidated Vocab JSON Schema

- **Issue:** `core/character.py` loads vocab files but performs no validation against any required schema. If a vocab file is missing the `triggers.post_tool`, `triggers.time`, or `triggers.usage` keys, `resolve_message` in `core/trigger.py` will raise an unhandled `KeyError` at runtime.
- **Files:** `core/character.py` (lines 7–13), `core/trigger.py` (lines 63, 68–69, 78, 87)
- **Impact:** A malformed or partial user-created character vocab file causes the entire statusline to crash silently, leaving no message in the statusline.
- **Fix approach:** Add a schema validation step in `load_character()` that checks for required top-level keys and raises a descriptive error rather than a bare `KeyError`.

### `save_state` Has No Atomic Write Guard

- **Issue:** `statusline.py` `save_state()` (line 75) writes directly to `STATE_PATH` with `open(STATE_PATH, "w")`. If the process is killed mid-write, the file will be truncated/corrupt and the next invocation will fall back to `_EMPTY_STATE`, losing the last message.
- **Files:** `statusline.py` (lines 67–76)
- **Impact:** Low-probability but possible: concurrent `--update` calls (rapid tool execution) could race on state file writes.
- **Fix approach:** Use the atomic write pattern already present in `install.sh` (write to `.tmp` then `os.replace()`).

### Hardcoded Fallback Strings in Python Source

- **Issue:** `statusline.py` (line 100) has a hardcoded Chinese fallback string `"(*>ω<) Nova: 加油！今天也要好好编程！\nunknown | N/A tokens"` embedded in Python source rather than in a vocab file. This creates a maintenance inconsistency: if Nova's style is changed, this string will not be updated.
- **Files:** `statusline.py` (line 100)
- **Fix approach:** Replace with a minimal structured fallback that does not embed character-specific dialogue, or load from a bundled default in `vocab/nova.json`.

### Inline Python in Shell Heredoc (`install.sh`)

- **Issue:** `install.sh` embeds two separate Python scripts inline as `<<'PYEOF'` heredocs (lines 23–51 and lines 100–140). These embedded scripts are not tested, not linted, and not tracked as standalone Python files.
- **Files:** `install.sh` (lines 23–51, lines 100–140)
- **Impact:** Bugs in the install/uninstall JSON patching logic are invisible to pytest and hard to debug. The scripts use bare `import json, os, sys, shutil` one-liner style with no error handling if `settings.json` contains invalid JSON before install.
- **Fix approach:** Extract to `scripts/patch_settings.py` and `scripts/unpatch_settings.py` with proper error handling, then call them from `install.sh`.

---

## Missing Features

### No Character Validation on Config Load

- **Issue:** `statusline.py` `load_config()` returns `{"character": "nova"}` as default, but never validates that the configured character name is one of the known characters. An invalid `config.json` value silently falls through to the `FileNotFoundError` handler in `main()`, which attempts to load `nova` as a hardcoded fallback rather than reporting a useful error.
- **Files:** `statusline.py` (lines 27–32, 95–101)
- **Fix approach:** Add validation after `load_config()` that warns with the character name if not found, before attempting fallback.

### `/cheer` Command Uses Unsafe Inline Python One-Liner

- **Issue:** `commands/cheer.md` (line 13) instructs Claude Code to run a one-liner `python3 -c "..."` that directly `open().write()` to both `config.json` and `state.json` without atomic write, without JSON serialization safety, and with the character name string-interpolated directly into a `NAME` placeholder. A character name containing special characters would corrupt both files.
- **Files:** `commands/cheer.md` (line 13)
- **Impact:** Character names are controlled (nova/luna/mochi/iris), so current risk is low. But any future character with a name containing `"`, `\`, or non-ASCII could break the generated command.
- **Fix approach:** The slash command should invoke `statusline.py --set-character NAME` or a dedicated `scripts/set_character.py` rather than inlining raw Python string construction.

### No Coverage Enforcement

- **Issue:** No `pytest.ini`, `setup.cfg`, `pyproject.toml`, or `tox.ini` exists to configure coverage thresholds. The project has tests but no enforced coverage gate.
- **Files:** Project root (no config file present)
- **Fix approach:** Add a `pyproject.toml` with `[tool.pytest.ini_options]` and `--cov` threshold, or a `pytest.ini`.

### No `pyproject.toml` / Dependency Manifest

- **Issue:** The project has no `requirements.txt`, `pyproject.toml`, or equivalent. The only stated dependency is Python 3 (checked in `install.sh` line 72). There is no pinned Python version requirement, no specification that `pytest` is needed for development.
- **Files:** Project root
- **Impact:** New contributors or CI pipelines have no machine-readable specification of what Python version or dev dependencies to install.
- **Fix approach:** Add a minimal `pyproject.toml` specifying `python_requires`, dev dependencies (`pytest`), and optional linter config (`ruff`, `black`).

---

## Performance Concerns

### `load_stats()` Linear Scan of `dailyModelTokens`

- **Issue:** `statusline.py` `load_stats()` (lines 48–51) iterates through the full `dailyModelTokens` list on every statusline render call. If the stats cache grows to hundreds of daily entries over time, this is a linear scan per render.
- **Files:** `statusline.py` (lines 43–54)
- **Impact:** Negligible at current typical list sizes (tens of entries). Could become noticeable over months of daily use.
- **Fix approach:** Low priority. Could use `next((e for e in data if e["date"] == today), None)` to short-circuit, but the current `for` loop already breaks on first match implicitly by returning inside the loop.

---

## Security Concerns

### `state.json` Written Without `ensure_ascii=False` Consistency

- **Issue:** `save_state()` in `statusline.py` (line 76) writes JSON with `ensure_ascii=False`, which is correct for Chinese content. However, the `/cheer` command inline Python (line 13 of `commands/cheer.md`) uses `open().write('{"character": "NAME"}')` without `json.dumps`, making it a raw string write that bypasses any encoding safety.
- **Files:** `commands/cheer.md` (line 13), `statusline.py` (line 76)
- **Impact:** Low risk with current ASCII character names. The concern is about consistency and future-proofing.

### No Input Sanitization on `cc_data` stdin

- **Issue:** `read_stdin_json()` in `statusline.py` (lines 57–64) reads all of stdin and passes the parsed dict directly into `resolve_message` and `render` without any validation. Malicious or malformed `cc_data` with unexpected types (e.g., `context_window.used_percentage` as a string) would propagate into display formatting.
- **Files:** `statusline.py` (lines 57–64), `core/display.py` (line 69)
- **Impact:** In practice, stdin is provided by Claude Code itself, so the threat model is low. However, defensive `isinstance` checks would make the display code more robust.

---

## Dependency Risks

### Python Version Unspecified

- **Issue:** `install.sh` only checks `python3 --version > /dev/null` (line 72) without verifying a minimum version. The code uses f-strings, `datetime.fromisoformat()` (requires Python 3.7+), walrus operator is not used but `datetime.fromisoformat` with timezone-aware strings via `.replace("Z", "+00:00")` has edge cases before Python 3.11.
- **Files:** `install.sh` (line 72), `core/display.py` (line 30)
- **Fix approach:** Add a Python version check (`python3 -c "import sys; assert sys.version_info >= (3, 7)"`) in `install.sh`, or document minimum Python version in a `pyproject.toml`.

---

## Improvement Opportunities

### `resolve_message` Priority Logic is Implicit

- **Issue:** `core/trigger.py` `resolve_message()` (lines 51–90) implements a 5-priority waterfall using sequential `if/return` with inline comments. The logic is correct but fragile to extend: adding a new priority requires careful insertion at the right position with no structural enforcement.
- **Files:** `core/trigger.py` (lines 51–90)
- **Suggestion:** Document the priority table explicitly in the module docstring. Consider a list-of-handlers pattern if more than 6–7 priorities are expected.

### Test Fixtures Are Duplicated Across Test Files

- **Issue:** The `SAMPLE_CHAR` / `CHAR` fixture dict is defined independently in `tests/test_trigger.py` (line 92), `tests/test_display.py` (line 55), and `tests/test_statusline.py` (line 8) with minor variations. A `conftest.py` with shared fixtures would reduce duplication.
- **Files:** `tests/test_trigger.py`, `tests/test_display.py`, `tests/test_statusline.py`
- **Suggestion:** Introduce `tests/conftest.py` with `@pytest.fixture` for the standard character dict and `make_cc()` / `make_state()` helpers.

### `format_resets` Uses Dual Parse Path Without Clear Priority Documentation

- **Issue:** `core/display.py` `format_resets()` (lines 23–34) first attempts to parse as a float Unix timestamp, then falls back to ISO string. The dual path is not documented and could silently mishandle a value that is a numeric string representing a future Unix epoch (e.g., `"1735000000"`) — it would succeed on the float path, which is correct but non-obvious.
- **Files:** `core/display.py` (lines 18–41)
- **Suggestion:** Add a docstring clarifying accepted input formats and expected precedence.

### No `.python-version` or Runtime Pinning

- **Issue:** No `.python-version`, `.nvmrc` equivalent, or `pyproject.toml` specifies the intended Python version. Contributors on different Python versions may get inconsistent `datetime.fromisoformat` behavior.
- **Files:** Project root
- **Suggestion:** Add a `.python-version` file (e.g., `3.11`) to communicate the intended runtime.

---

*Concerns audit: 2026-04-01*
