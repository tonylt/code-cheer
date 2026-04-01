# Code Conventions

**Analysis Date:** 2026-04-01

## Naming Conventions

**Files:**
- Modules use `snake_case`: `character.py`, `trigger.py`, `display.py`
- Entry point is a flat script at project root: `statusline.py`
- Vocab data files use lowercase character names: `nova.json`, `luna.json`
- Test files mirror source module names with `test_` prefix: `test_trigger.py`, `test_display.py`

**Functions:**
- `snake_case` throughout: `load_character`, `resolve_message`, `get_time_slot`, `format_tokens`, `format_resets`
- Verb-noun pattern for actions: `load_config`, `save_state`, `read_stdin_json`
- Boolean-returning helpers use adjective form: `cache_expired`
- Short, single-purpose helper names: `pick`, `pick_different`, `get_tier`

**Variables:**
- `snake_case` for all locals and module-level names
- Module-level path constants in `SCREAMING_SNAKE_CASE`: `BASE_DIR`, `CONFIG_PATH`, `STATE_PATH`, `STATS_PATH`, `VOCAB_DIR`
- Descriptive placeholder names: `used_pct`, `last_tier`, `five_hour`, `seven_day`, `delta_secs`

**Constants:**
- Dict constants defined at module level with `_EMPTY_STATE` (single underscore prefix for module-private)
- Test fixture dicts named `CHAR`, `SAMPLE_CHAR` in uppercase (module-level in test files)

## Code Style

**Formatting:**
- No automated formatter config file detected (no `pyproject.toml`, `.flake8`, or `setup.cfg` present)
- Code is consistently 4-space indented
- Single blank line between functions, double blank line not enforced at module level
- Single quotes preferred for string literals in `core/` modules; double quotes used in `statusline.py`
- f-strings used for all string interpolation: `f"{ascii_face} {name}: {message}"`

**Linting:**
- No linting config found in repository
- Code follows PEP 8 style conventions informally

**Line Length:**
- No enforced limit; lines generally kept under 90 characters
- Long expressions split across lines using implicit continuation inside parentheses

**Type Annotations:**
- Present on all function signatures in `core/` modules: `def load_character(name: str) -> dict`
- Return types annotated: `-> str`, `-> dict`, `-> bool`, `-> tuple`, `-> None`
- `statusline.py` entry-point functions also carry return type annotations

## Patterns & Idioms

**Graceful Degradation with Defaults:**
All I/O functions catch `(FileNotFoundError, json.JSONDecodeError)` and return sensible defaults:
```python
def load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"character": "nova"}
```

**Priority Chain via Early Returns:**
`core/trigger.py` `resolve_message` uses a priority waterfall — each condition returns early if matched, no nested branches:
```python
# Priority 1: usage tier change
if tier != last_tier:
    ...
    return pick(triggers["usage"][tier]), tier
# Priority 2: alert persistence
if tier != "normal" and tier == last_tier:
    return state.get("message", ""), tier
# Priority 3: post_tool forced
if force_post_tool:
    return pick_different(triggers["post_tool"], ...), tier
# Priority 4: cache fresh
if not cache_expired(...):
    return state.get("message", ""), tier
# ...etc
```

**`.get()` with Defaults for External Data:**
All access to external JSON (cc_data, state, stats) uses `.get()` with explicit fallbacks to avoid KeyError:
```python
rate_limits = cc_data.get("rate_limits", {})
used_pct = rate_limits.get("five_hour", {}).get("used_percentage", 0)
```

**`os.path` for All Paths:**
Cross-platform path construction via `os.path.join` and `os.path.expanduser`:
```python
BASE_DIR = os.path.join(os.path.expanduser("~"), ".claude", "code-cheer")
```

**`sys.path.insert(0, ...)` for Import Resolution:**
Both `statusline.py` and all test files insert the project root into `sys.path` at the top to enable consistent imports without package installation.

## Documentation Style

**Docstrings:**
- All public functions in `core/` modules have single-line docstrings
- Format: imperative sentence describing what the function returns or does
- Examples from `core/trigger.py`:
  ```python
  def get_tier(used_pct: float) -> str:
      """Return rate limit tier based on usage percentage."""

  def cache_expired(last_updated: str, minutes: int = 5) -> bool:
      """Return True if last_updated is older than `minutes` ago, or missing."""
  ```
- `core/display.py` uses inline parameter description in docstring:
  ```python
  def format_tokens(token_count) -> str:
      """Format token count: 47768 → '47k', 500 → '500', None → 'N/A'."""
  ```

**Inline Comments:**
- Used for priority labels in `resolve_message`: `# Priority 1: usage tier change`
- Used to explain non-obvious edge cases: `# today not in file yet`
- Used to annotate fallback logic: `# Supplement missing token data from cc_data`

**File-Level Comments:**
- `statusline.py` has `# statusline.py` as first comment after shebang
- `core/display.py` has `# core/display.py` at top

**No class-level or module-level docstrings** — modules are small and self-explanatory.

## Error Handling

**Strategy:** Catch-and-default at I/O boundaries; let logic errors propagate as exceptions.

**File I/O:** Always wrapped in `try/except (FileNotFoundError, json.JSONDecodeError)` returning a safe default:
```python
try:
    with open(STATE_PATH, "r") as f:
        return json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    return dict(_EMPTY_STATE)
```

**Stdin Parsing:** Broad `except Exception` catch in `read_stdin_json` — appropriate since stdin content is external:
```python
try:
    raw = sys.stdin.read().strip()
    if raw:
        return json.loads(raw)
except Exception:
    pass
return {}
```

**Character Loading:** `load_character` raises `FileNotFoundError` explicitly with a descriptive message; `main()` catches it and falls back to `"nova"`, then falls back to a hardcoded print:
```python
except FileNotFoundError:
    try:
        character = load_character("nova")
    except FileNotFoundError:
        print("(*>ω<) Nova: ...")
        return
```

**Date Parsing:** `cache_expired` catches `(ValueError, TypeError)` and returns `True` (treat as expired), which is the safe default.

**No bare `except:` clauses** — all except clauses name specific exception types (except `read_stdin_json` which uses `Exception` intentionally).

## Module Organization

**Package Structure:**
```
statusline.py          # entry-point script (two modes: render / --update)
core/
    __init__.py        # empty, marks package
    character.py       # data loading only
    trigger.py         # message selection logic
    display.py         # output formatting
tests/
    __init__.py        # empty, marks package
    test_character.py  # tests for core/character.py
    test_trigger.py    # tests for core/trigger.py
    test_display.py    # tests for core/display.py
    test_statusline.py # integration tests for statusline.py main()
vocab/
    nova.json          # character dialogue data
    luna.json
    mochi.json
    iris.json
```

**Import Pattern:**
- Each `core/` module imports only stdlib: `json`, `os`, `random`, `datetime`
- `statusline.py` imports all three core modules
- No circular imports — `character` → nothing, `trigger` → nothing, `display` → nothing, `statusline` → all three

**Module Responsibilities (Single Responsibility):**
- `core/character.py`: file loading only — no logic
- `core/trigger.py`: message selection logic — no I/O, no formatting
- `core/display.py`: string formatting only — no I/O, no selection logic
- `statusline.py`: orchestration — reads config/state/stats, calls core modules, writes state

**Exports:**
- No `__all__` defined; all public functions are importable directly
- Test files import specific functions: `from core.trigger import get_tier, resolve_message`

---

*Convention analysis: 2026-04-01*
