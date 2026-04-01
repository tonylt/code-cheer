# Code Conventions

**Analysis Date:** 2026-04-01

## Naming Conventions

**Files:**
- Modules use `snake_case`: `character.py`, `trigger.py`, `display.py`
- Entry point is a flat script at project root: `statusline.py`
- Vocab data files use lowercase character names: `nova.json`, `luna.json`, `mochi.json`, `iris.json`
- Test files mirror source module names with `test_` prefix: `test_trigger.py`, `test_display.py`

**Functions:**
- `snake_case` throughout: `load_character`, `resolve_message`, `get_time_slot`, `format_tokens`, `format_resets`
- Verb-noun pattern for actions: `load_config`, `save_state`, `read_stdin_json`
- Boolean-returning helpers use adjective form: `cache_expired`
- Short, single-purpose helper names: `pick`, `pick_different`, `get_tier`

**Variables:**
- `snake_case` for all locals and module-level names
- Module-level path constants in `SCREAMING_SNAKE_CASE`: `BASE_DIR`, `CONFIG_PATH`, `STATE_PATH`, `STATS_PATH`, `VOCAB_DIR`
- Descriptive local names: `used_pct`, `last_tier`, `five_hour`, `seven_day`, `delta_secs`

**Constants:**
- Dict constants defined at module level with `_EMPTY_STATE` (single underscore prefix = module-private)
- Test fixture dicts named `CHAR`, `SAMPLE_CHAR` in uppercase at module level in test files

## Code Style

**Formatting:**
- No automated formatter config file present (no `pyproject.toml`, `.flake8`, or `setup.cfg`)
- Code is consistently 4-space indented
- Single blank line between top-level functions within a module
- Single quotes preferred in `core/` modules; double quotes used in `statusline.py`
- f-strings used exclusively for all string interpolation: `f"{ascii_face} {name}: {message}"`

**Linting:**
- No linting config detected in repository
- Code follows PEP 8 conventions informally

**Line Length:**
- No enforced limit; lines generally kept under 90 characters
- Long expressions split across lines using implicit continuation inside parentheses

**Type Annotations:**
- Present on most function signatures in `core/` modules
- Return types annotated: `-> str`, `-> dict`, `-> bool`, `-> tuple`, `-> None`
- Inconsistency: `format_tokens(token_count)` and `format_resets(resets_at)` in `core/display.py` omit parameter type annotations
- `statusline.py` entry-point functions carry return type annotations

## Patterns & Idioms

**Graceful Degradation with Defaults:**
All I/O functions catch `(FileNotFoundError, json.JSONDecodeError)` and return sensible defaults:
```python
# statusline.py
def load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"character": "nova"}
```

**Priority Chain via Early Returns:**
`core/trigger.py` `resolve_message` uses a flat priority waterfall — each condition returns early if matched, avoiding nested branches:
```python
# Priority 1: usage tier change
if tier != last_tier:
    if tier != "normal":
        return pick(triggers["usage"][tier]), tier
# Priority 2: alert persistence
if tier != "normal" and tier == last_tier:
    return state.get("message", ""), tier
# Priority 3: post_tool forced
if force_post_tool:
    return pick_different(triggers["post_tool"], state.get("message", "")), tier
# Priority 4: cache still fresh
if not cache_expired(state.get("last_updated", ""), minutes=5):
    return state.get("message", ""), tier
# Priority 5: random fallback
return pick_different(triggers["random"], state.get("message", "")), tier
```

**`.get()` with Defaults for All External Data:**
All access to external JSON (cc_data, state, stats) uses `.get()` with explicit fallbacks to prevent KeyError:
```python
rate_limits = cc_data.get("rate_limits", {})
used_pct = rate_limits.get("five_hour", {}).get("used_percentage", 0)
```

**`os.path` for All File Paths:**
Cross-platform path construction uses `os.path.join` and `os.path.expanduser` exclusively:
```python
BASE_DIR = os.path.join(os.path.expanduser("~"), ".claude", "code-pal")
VOCAB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vocab')
```

**`sys.path.insert(0, ...)` for Import Resolution:**
Both `statusline.py` and all test files insert the project root into `sys.path` at the top to enable consistent imports without package installation:
```python
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
```

**Inline Conditional Formatting:**
Short ternary-style inline conditions used when building output parts:
```python
line1 = f"\033[{color}m{raw_line1}\033[0m" if color else raw_line1
```

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
- `core/display.py` uses inline example notation in docstring:
  ```python
  def format_tokens(token_count) -> str:
      """Format token count: 47768 → '47k', 500 → '500', None → 'N/A'."""
  ```

**Inline Comments:**
- Priority labels in `resolve_message`: `# Priority 1: usage tier change`
- Explain non-obvious edge cases: `# today not in file yet`
- Annotate fallback logic: `# Supplement missing token data from cc_data`
- Dropped-to-normal comment: `# Dropped back to normal — fall through to normal priorities`

**File-Level Identifiers:**
- `statusline.py` opens with `#!/usr/bin/env python3` shebang then `# statusline.py` comment
- `core/display.py` opens with `# core/display.py` comment

**No class-level or module-level docstrings** — modules are small with clear single responsibilities.

## Error Handling

**Strategy:** Catch-and-default at I/O boundaries; let logic errors propagate as exceptions.

**File I/O Pattern:** Always wrapped in `try/except (FileNotFoundError, json.JSONDecodeError)` returning a safe default:
```python
try:
    with open(STATE_PATH, "r") as f:
        return json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    return dict(_EMPTY_STATE)
```

**Stdin Parsing:** Broad `except Exception` in `read_stdin_json` — appropriate since stdin content is entirely external:
```python
try:
    raw = sys.stdin.read().strip()
    if raw:
        return json.loads(raw)
except Exception:
    pass
return {}
```

**Character Loading:** `load_character` raises `FileNotFoundError` explicitly; `main()` catches it and falls back to `"nova"`, then falls back to a hardcoded print-and-return:
```python
except FileNotFoundError:
    try:
        character = load_character("nova")
    except FileNotFoundError:
        print("(*>ω<) Nova: 加油！今天也要好好编程！\nunknown | N/A tokens")
        return
```

**Date Parsing:** `cache_expired` catches `(ValueError, TypeError)` and returns `True` (treat as expired — the safe default).

**No bare `except:` clauses** — all except clauses name specific exception types, except `read_stdin_json` which uses `Exception` intentionally as a catch-all for external input.

## Module Organization

**Package Structure:**
```
statusline.py          # entry-point script (render mode / --update mode)
core/
    __init__.py        # empty, marks package
    character.py       # data loading only — no logic
    trigger.py         # message selection logic — no I/O, no formatting
    display.py         # output formatting only — no I/O, no selection
tests/
    __init__.py        # empty, marks package
    test_character.py  # unit tests for core/character.py
    test_trigger.py    # unit tests for core/trigger.py
    test_display.py    # unit tests for core/display.py
    test_statusline.py # integration tests for statusline.py main()
vocab/
    nova.json          # character dialogue data (JSON)
    luna.json
    mochi.json
    iris.json
```

**Import Pattern:**
- Each `core/` module imports only stdlib: `json`, `os`, `random`, `datetime`
- `statusline.py` imports all three core modules
- No circular imports — dependency direction: `statusline` → `core/*` → stdlib only

**Module Responsibilities (Single Responsibility):**
- `core/character.py`: file loading only
- `core/trigger.py`: message selection logic only
- `core/display.py`: string formatting only
- `statusline.py`: orchestration — reads config/state/stats, calls core modules, writes state

**Exports:**
- No `__all__` defined; all public functions importable directly
- Test files import specific names: `from core.trigger import get_tier, resolve_message`

---

*Convention analysis: 2026-04-01*
