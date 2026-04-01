# Testing

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- pytest (version not pinned — no `pyproject.toml` or `requirements.txt` present)
- No `pytest.ini`, `conftest.py`, or `setup.cfg` detected

**Assertion Library:**
- pytest built-in `assert` statements only — no additional assertion libraries

**Run Commands:**
```bash
python3 -m pytest tests/                    # Run all tests
python3 -m pytest tests/test_trigger.py -v  # Run specific file with verbose output
python3 -m pytest --cov=core --cov-report=term-missing  # Coverage (requires pytest-cov)
```

## Test Organization

**Location:**
- All tests in `tests/` directory at project root
- Source files are NOT co-located with tests

**Naming:**
- Test files: `test_<module_name>.py` matching source module
  - `tests/test_character.py` → `core/character.py`
  - `tests/test_trigger.py` → `core/trigger.py`
  - `tests/test_display.py` → `core/display.py`
  - `tests/test_statusline.py` → `statusline.py` (integration tests)
- Test functions: `test_<function>_<scenario>` pattern
  - `test_get_tier_normal`, `test_get_tier_warning`, `test_get_tier_critical`
  - `test_load_character_returns_meta`, `test_load_character_unknown_raises`
  - `test_resolve_escalates_to_warning`, `test_resolve_force_post_tool_avoids_last`

**Grouping:**
- Tests grouped by function under comment banners: `# --- get_tier ---`, `# --- resolve_message ---`
- No `class`-based test grouping — all tests are top-level functions

**Import Pattern:**
All test files insert the project root into `sys.path` at top to avoid package installation:
```python
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

## Test Types

**Unit Tests** (`tests/test_character.py`, `tests/test_trigger.py`, `tests/test_display.py`):
- Test individual functions in isolation
- Cover happy paths, edge cases, and error paths per function
- `test_trigger.py` is the most comprehensive — covers all 5 priority levels of `resolve_message` plus edge cases for each helper function

**Integration Tests** (`tests/test_statusline.py`):
- Test `main()` end-to-end with real file system interactions via `tmp_path`
- Create real temporary config, state, and vocab files — no mocking of file I/O
- Test both render mode (stdout output) and `--update` mode (no output, state written)
- Verify file writes by reading back saved state JSON

**No E2E Tests:**
- No subprocess invocation of `statusline.py`
- No system-level or shell integration tests

## Coverage

**Requirements:** No enforced coverage target
**Current coverage:** Not measured (no CI pipeline detected)
**Approximate functional coverage by module:**

| Module | Test File | Coverage Assessment |
|--------|-----------|---------------------|
| `core/character.py` | `tests/test_character.py` | High — all branches covered (found, not found) |
| `core/trigger.py` | `tests/test_trigger.py` | High — all 5 priority branches + edge cases tested |
| `core/display.py` | `tests/test_display.py` | High — all 3 functions, boundary values, None/invalid inputs |
| `statusline.py` | `tests/test_statusline.py` | Medium — happy paths covered; double-fallback print in `main()` not tested |

**Known gap:** The `except FileNotFoundError` branch inside `main()` that falls back to the hardcoded print (when even `nova` character fails to load) has no test coverage in `tests/test_statusline.py`.

## Mocking Strategy

**Framework:** `unittest.mock.patch` from stdlib — no third-party mocking library

**Time Mocking:**
`datetime` is patched at the module level in `core.trigger` to control time-dependent tests:
```python
from unittest.mock import patch
from datetime import datetime

@patch('core.trigger.datetime')
def test_get_time_slot_morning(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 8, 0)
    assert get_time_slot() == "morning"
```

**Critical pattern when mocking datetime:** `fromisoformat` must be restored on the mock because it is a classmethod used separately from `now()`:
```python
@patch('core.trigger.datetime')
def test_cache_not_expired(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 14, 3, 0)
    mock_dt.fromisoformat = datetime.fromisoformat  # must restore this
    ts = "2026-03-22T14:00:00"
    assert cache_expired(ts, minutes=5) is False
```

**File System Mocking:**
`monkeypatch.setattr` redirects module-level path constants to `tmp_path` locations — real files are created and read, not mocked:
```python
def test_load_config_returns_nova_default(tmp_path, monkeypatch):
    monkeypatch.setattr(sl, 'CONFIG_PATH', str(tmp_path / "config.json"))
    assert sl.load_config() == {"character": "nova"}

# Redirect vocab dir for character loading
monkeypatch.setattr(char_mod, 'VOCAB_DIR', str(vocab_path))
```

**stdin Mocking:**
```python
import io
monkeypatch.setattr(sys, 'stdin', io.StringIO('{"model": "claude-sonnet-4-6"}'))
```

**argv Mocking:**
```python
monkeypatch.setattr(sys, 'argv', ['statusline.py', '--update'])
```

**What is NOT mocked:**
- `random.choice` — randomness tested via loop iteration (20 runs) to assert probabilistic invariants
- File I/O (`open`) — real `tmp_path` temporary files are used instead

## Fixtures

**pytest Built-in Fixtures Used:**
- `tmp_path` — temporary directory per test, used extensively in `tests/test_statusline.py` and `tests/test_character.py`
- `monkeypatch` — attribute patching on modules, used for path constants and `sys.argv`/`sys.stdin`
- `capsys` — stdout/stderr capture, used to assert render output content and verify `--update` produces no output

**Custom Fixtures:**
One `autouse` fixture in `tests/test_character.py` that sets up a minimal character vocab file for every test in that file:
```python
@pytest.fixture(autouse=True)
def fixture_vocab(tmp_path, monkeypatch):
    """Point VOCAB_DIR at a temp dir with a test character."""
    import core.character as mod
    monkeypatch.setattr(mod, 'VOCAB_DIR', str(tmp_path))
    char = {
        "meta": {"name": "Nova", "ascii": "(*>ω<)", "style": "test"},
        "triggers": {
            "random": ["msg1", "msg2"],
            "time": {"morning": ["m1"], "afternoon": ["a1"], "evening": ["e1"], "midnight": ["n1"]},
            "usage": {"warning": ["w1"], "critical": ["c1"]},
            "post_tool": ["p1", "p2"]
        }
    }
    (tmp_path / "nova.json").write_text(json.dumps(char, ensure_ascii=False))
```

**Test Data Helpers (module-level, not fixtures):**
`tests/test_trigger.py` defines factory functions at module level for building test input dicts:
```python
CHAR = { ... }  # shared character structure

def make_state(message="r1", tier="normal", slot="afternoon", updated=None):
    ts = updated or datetime.now().isoformat()
    return {"message": message, "last_updated": ts, "last_rate_tier": tier, "last_slot": slot}

def make_cc(pct=0, resets_at=None, model="claude-sonnet-4-6"):
    d = {"model": model, "rate_limits": {"used_percentage": pct}}
    if resets_at:
        d["rate_limits"]["resets_at"] = resets_at
    return d
```

**Inline Test Data in `tests/test_display.py`:**
Minimal character dict defined at module level — shared across all render tests:
```python
CHAR = {"meta": {"name": "Nova", "ascii": "(*>ω<)", "style": "test"}}
```

## Common Patterns

**Probabilistic Behavior Testing:**
For functions using `random.choice`, run in a loop and assert the invariant holds across all iterations:
```python
def test_pick_different_avoids_last():
    options = ["a", "b", "c"]
    for _ in range(20):
        result = pick_different(options, "a")
        assert result != "a"
```

**Error Path Testing:**
Use `pytest.raises` as a context manager for expected exceptions:
```python
def test_load_character_unknown_raises():
    with pytest.raises(FileNotFoundError):
        load_character("unknown")
```

**Output Line Assertion:**
Split output by newline and assert per-line properties:
```python
def test_render_two_lines():
    output = render(CHAR, "冲冲冲！！", cc, stats)
    lines = output.split("\n")
    assert len(lines) == 2

def test_render_line1_format():
    output = render(CHAR, "冲冲冲！！", cc, stats)
    assert output.startswith("(*>ω<) Nova: 冲冲冲！！")
```

**Boundary Value Testing:**
Both sides of numeric thresholds are tested explicitly in the same test function:
```python
def test_get_tier_normal():
    assert get_tier(0) == "normal"
    assert get_tier(79.9) == "normal"

def test_get_tier_warning():
    assert get_tier(80) == "warning"
    assert get_tier(94.9) == "warning"
```

**State Verification After Write:**
Integration tests read back written files to verify content:
```python
sl.save_state("hello", "normal", "afternoon")
with open(str(tmp_path / "state.json")) as f:
    s = json.load(f)
assert s["message"] == "hello"
assert s["last_rate_tier"] == "normal"
```

---

*Testing analysis: 2026-04-01*
