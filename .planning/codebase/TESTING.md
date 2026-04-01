# Testing

**Analysis Date:** 2026-04-01

## Test Framework

**Runner:**
- pytest (version not pinned — no `pyproject.toml` or `requirements.txt`)
- No `pytest.ini` or `conftest.py` detected

**Assertion Library:**
- pytest built-in `assert` statements only — no additional assertion libraries

**Run Commands:**
```bash
python3 -m pytest tests/                    # Run all tests
python3 -m pytest tests/test_trigger.py -v  # Run specific file with verbose output
python3 -m pytest --cov=core --cov-report=term-missing  # Coverage (if pytest-cov installed)
```

## Test Organization

**Location:**
- All tests in `tests/` directory at project root
- Co-location with source files is not used

**Naming:**
- Test files: `test_<module_name>.py` matching source module names
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
All test files insert project root into `sys.path` at top:
```python
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
```

## Test Types

**Unit Tests** (`tests/test_character.py`, `tests/test_trigger.py`, `tests/test_display.py`):
- Test individual functions in isolation
- Cover happy paths, edge cases, and error paths
- `test_trigger.py` is the most comprehensive — 19 test functions covering all 5 priority levels of `resolve_message`

**Integration Tests** (`tests/test_statusline.py`):
- Test `main()` end-to-end with file system interactions
- Use `tmp_path` to create real temporary files for config, state, and vocab
- Test both render mode and `--update` mode
- Verify file writes by reading back saved state

**No E2E Tests:**
- No browser, subprocess, or system-level tests
- No tests that invoke `statusline.py` as a subprocess

## Coverage

**Requirements:** No enforced coverage target
**Current coverage:** Not measured (no CI pipeline detected)
**Approximate functional coverage:**

| Module | Test File | Coverage Assessment |
|--------|-----------|---------------------|
| `core/character.py` | `test_character.py` | High — 3 tests, all branches covered |
| `core/trigger.py` | `test_trigger.py` | High — all 5 priority cases + edge cases |
| `core/display.py` | `test_display.py` | High — all 3 functions, multiple edge cases |
| `statusline.py` | `test_statusline.py` | Medium — happy paths + update mode, fallback to hardcoded print not tested |

**Gap:** The fallback print in `statusline.py` `main()` (when even `nova` character fails to load) has no test coverage.

## Mocking Strategy

**Framework:** `unittest.mock.patch` (stdlib, no additional mocking library)

**Time Mocking:**
`datetime` is patched at the module level to control time-dependent tests:
```python
from unittest.mock import patch
from datetime import datetime

@patch('core.trigger.datetime')
def test_get_time_slot_morning(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 8, 0)
    assert get_time_slot() == "morning"
```

**Critical pattern:** When patching `datetime`, `fromisoformat` must be restored:
```python
@patch('core.trigger.datetime')
def test_cache_not_expired(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 14, 3, 0)
    mock_dt.fromisoformat = datetime.fromisoformat  # restore classmethod
    ts = "2026-03-22T14:00:00"
    assert cache_expired(ts, minutes=5) is False
```

**File System Mocking:**
Two approaches are used:

1. `monkeypatch.setattr` to redirect module-level path constants:
```python
def test_load_config_returns_nova_default(tmp_path, monkeypatch):
    monkeypatch.setattr(sl, 'CONFIG_PATH', str(tmp_path / "config.json"))
    assert sl.load_config() == {"character": "nova"}
```

2. `monkeypatch.setattr` on `VOCAB_DIR` in `core.character` to redirect vocab loading:
```python
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
- `random.choice` — randomness is handled in tests by running assertions in loops (20 iterations) to verify probabilistic behavior
- File I/O itself — real `tmp_path` files are used instead of mocking `open`

## Fixtures

**pytest Built-in Fixtures Used:**
- `tmp_path` — temporary directory, used extensively in `test_statusline.py` and `test_character.py`
- `monkeypatch` — attribute patching, used for path constants and module globals
- `capsys` — stdout capture, used to assert render output and `--update` silence

**Custom Fixtures:**
One `autouse` fixture in `test_character.py`:
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
            "time": {"morning": ["m1"], ...},
            "usage": {"warning": ["w1"], "critical": ["c1"]},
            "post_tool": ["p1", "p2"]
        }
    }
    (tmp_path / "nova.json").write_text(json.dumps(char, ensure_ascii=False))
```

**Test Data Helpers (not fixtures):**
`test_trigger.py` defines module-level helper functions for building test inputs:
```python
CHAR = { ... }  # shared character dict

def make_state(message="r1", tier="normal", slot="afternoon", updated=None):
    ts = updated or datetime.now().isoformat()
    return {"message": message, "last_updated": ts, "last_rate_tier": tier, "last_slot": slot}

def make_cc(pct=0, resets_at=None, model="claude-sonnet-4-6"):
    d = {"model": model, "rate_limits": {"used_percentage": pct}}
    ...
    return d
```

**Inline Fixtures in `test_display.py`:**
Minimal character dict defined at module level:
```python
CHAR = {"meta": {"name": "Nova", "ascii": "(*>ω<)", "style": "test"}}
```

## Common Patterns

**Probabilistic Behavior Testing:**
For functions using `random.choice`, run in a loop and assert the set of results:
```python
def test_pick_different_avoids_last():
    options = ["a", "b", "c"]
    for _ in range(20):
        result = pick_different(options, "a")
        assert result != "a"
```

**Error Path Testing:**
Use `pytest.raises` for expected exceptions:
```python
def test_load_character_unknown_raises():
    with pytest.raises(FileNotFoundError):
        load_character("unknown")
```

**Output Assertion:**
For `render()` and `main()`, split output by newline and assert on specific lines:
```python
def test_render_two_lines():
    output = render(CHAR, "冲冲冲！！", cc, stats)
    lines = output.split("\n")
    assert len(lines) == 2

def test_render_line1_format():
    output = render(CHAR, "冲冲冲！！", cc, stats)
    assert output.startswith("(*>ω<) Nova: 冲冲冲！！")
```

**Boundary Testing for Thresholds:**
Both sides of numeric boundaries are tested explicitly:
```python
def test_get_tier_normal():
    assert get_tier(0) == "normal"
    assert get_tier(79.9) == "normal"

def test_get_tier_warning():
    assert get_tier(80) == "warning"
    assert get_tier(94.9) == "warning"
```

---

*Testing analysis: 2026-04-01*
