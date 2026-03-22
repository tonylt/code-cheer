# Code Cheer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Claude Code statusline tool with 4 virtual companion characters that display encouragement + usage info in 2 lines.

**Architecture:** A Python 3 stdlib-only script (`statusline.py`) runs on every statusline refresh and PostToolUse hook. It reads character vocab from JSON files, selects a message via priority-based trigger logic, and prints 2 formatted lines. A bash `install.sh` wires everything into `~/.claude/settings.json` safely.

**Tech Stack:** Python 3 (stdlib only), Bash, JSON vocab files, pytest (dev only)

---

## File Map

| File | Responsibility |
|------|---------------|
| `statusline.py` | Entry point: load config → resolve message → print 2 lines |
| `core/__init__.py` | Empty, makes `core` a package |
| `core/character.py` | `load_character(name)` → loads `vocab/{name}.json` |
| `core/trigger.py` | `get_tier`, `get_time_slot`, `pick`, `pick_different`, `cache_expired`, `resolve_message` |
| `core/display.py` | `format_tokens`, `format_resets`, `render` |
| `vocab/nova.json` | Nova's full vocab (12 random, 4×time, 3 warning, 3 critical, 8 post_tool) |
| `vocab/luna.json` | Luna's full vocab |
| `vocab/mochi.json` | Mochi's full vocab |
| `vocab/iris.json` | Iris's full vocab |
| `commands/cheer.md` | Claude Code custom command for `/cheer` |
| `install.sh` | Install + uninstall script |
| `tests/__init__.py` | Empty |
| `tests/test_character.py` | Tests for character loading |
| `tests/test_trigger.py` | Tests for all trigger logic |
| `tests/test_display.py` | Tests for display formatting |
| `tests/test_statusline.py` | Integration tests for main() |
| `README.md` | Setup and usage guide |

---

## Task 1: Project Scaffold

**Files:**
- Create: `core/__init__.py`
- Create: `tests/__init__.py`
- Create: `vocab/` (empty dir marker)

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p core vocab commands tests
touch core/__init__.py tests/__init__.py
```

- [ ] **Step 2: Verify structure**

```bash
find . -type f | sort
```

Expected output includes `core/__init__.py`, `tests/__init__.py`.

- [ ] **Step 3: Install pytest (dev only)**

```bash
pip3 install pytest --quiet
```

- [ ] **Step 4: Verify pytest works**

```bash
python3 -m pytest --version
```

Expected: `pytest 7.x.x` or similar.

- [ ] **Step 5: Commit scaffold**

```bash
git add core/__init__.py tests/__init__.py
git commit -m "chore: project scaffold"
```

---

## Task 2: Character Loading

**Files:**
- Create: `core/character.py`
- Create: `tests/test_character.py`
- Create: `vocab/nova.json` (minimal fixture for tests)

- [ ] **Step 1: Write failing tests**

```python
# tests/test_character.py
import os, sys, json, pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.character import load_character

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), 'fixtures')

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

def test_load_character_returns_meta():
    c = load_character("nova")
    assert c["meta"]["name"] == "Nova"
    assert c["meta"]["ascii"] == "(*>ω<)"

def test_load_character_returns_triggers():
    c = load_character("nova")
    assert "random" in c["triggers"]
    assert "time" in c["triggers"]
    assert "usage" in c["triggers"]
    assert "post_tool" in c["triggers"]

def test_load_character_unknown_raises():
    with pytest.raises(FileNotFoundError):
        load_character("unknown")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_character.py -v
```

Expected: `ImportError` or `ModuleNotFoundError` (file doesn't exist yet).

- [ ] **Step 3: Implement `core/character.py`**

```python
# core/character.py
import json
import os

VOCAB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vocab')


def load_character(name: str) -> dict:
    """Load character meta and vocab from vocab/{name}.json."""
    path = os.path.join(VOCAB_DIR, f'{name}.json')
    if not os.path.exists(path):
        raise FileNotFoundError(f"Character '{name}' not found at {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_character.py -v
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add core/character.py tests/test_character.py
git commit -m "feat: character loader with tests"
```

---

## Task 3: Trigger Utilities

**Files:**
- Create: `core/trigger.py` (utilities only — `get_tier`, `get_time_slot`, `pick`, `pick_different`, `cache_expired`)
- Create: `tests/test_trigger.py` (utilities section)

- [ ] **Step 1: Write failing tests for utilities**

```python
# tests/test_trigger.py
import os, sys
from datetime import datetime, timedelta
from unittest.mock import patch
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.trigger import get_tier, get_time_slot, pick, pick_different, cache_expired

# --- get_tier ---
def test_get_tier_normal():
    assert get_tier(0) == "normal"
    assert get_tier(79.9) == "normal"

def test_get_tier_warning():
    assert get_tier(80) == "warning"
    assert get_tier(94.9) == "warning"

def test_get_tier_critical():
    assert get_tier(95) == "critical"
    assert get_tier(100) == "critical"

# --- get_time_slot ---
@patch('core.trigger.datetime')
def test_get_time_slot_morning(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 8, 0)
    assert get_time_slot() == "morning"

@patch('core.trigger.datetime')
def test_get_time_slot_afternoon(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 14, 0)
    assert get_time_slot() == "afternoon"

@patch('core.trigger.datetime')
def test_get_time_slot_evening(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 20, 0)
    assert get_time_slot() == "evening"

@patch('core.trigger.datetime')
def test_get_time_slot_midnight_late(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 23, 30)
    assert get_time_slot() == "midnight"

@patch('core.trigger.datetime')
def test_get_time_slot_midnight_early(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 3, 0)
    assert get_time_slot() == "midnight"

# --- pick ---
def test_pick_returns_item_from_list():
    options = ["a", "b", "c"]
    result = pick(options)
    assert result in options

# --- pick_different ---
def test_pick_different_avoids_last():
    options = ["a", "b", "c"]
    for _ in range(20):
        result = pick_different(options, "a")
        assert result != "a"

def test_pick_different_single_item_returns_it():
    assert pick_different(["only"], "only") == "only"

def test_pick_different_two_items_always_returns_other():
    for _ in range(10):
        assert pick_different(["x", "y"], "x") == "y"

# --- cache_expired ---
@patch('core.trigger.datetime')
def test_cache_not_expired(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 14, 3, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    ts = "2026-03-22T14:00:00"
    assert cache_expired(ts, minutes=5) is False

@patch('core.trigger.datetime')
def test_cache_expired(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 14, 6, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    ts = "2026-03-22T14:00:00"
    assert cache_expired(ts, minutes=5) is True

def test_cache_expired_empty_string():
    assert cache_expired("") is True

def test_cache_expired_none():
    assert cache_expired(None) is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_trigger.py -v
```

Expected: `ImportError` (module doesn't exist yet).

- [ ] **Step 3: Implement utilities in `core/trigger.py`**

```python
# core/trigger.py
import random
from datetime import datetime


def get_tier(used_pct: float) -> str:
    """Return rate limit tier based on usage percentage."""
    if used_pct >= 95:
        return "critical"
    elif used_pct >= 80:
        return "warning"
    return "normal"


def get_time_slot() -> str:
    """Return current time slot: morning/afternoon/evening/midnight."""
    hour = datetime.now().hour
    if 6 <= hour <= 11:
        return "morning"
    elif 12 <= hour <= 17:
        return "afternoon"
    elif 18 <= hour <= 22:
        return "evening"
    return "midnight"


def pick(options: list) -> str:
    """Pick a random item from a list."""
    return random.choice(options)


def pick_different(options: list, last: str) -> str:
    """Pick a random item that differs from last. Falls back to any item if only one."""
    if len(options) <= 1:
        return options[0] if options else ""
    filtered = [o for o in options if o != last]
    return random.choice(filtered) if filtered else random.choice(options)


def cache_expired(last_updated: str, minutes: int = 5) -> bool:
    """Return True if last_updated is older than `minutes` ago, or missing."""
    if not last_updated:
        return True
    try:
        dt = datetime.fromisoformat(last_updated)
        delta = (datetime.now() - dt).total_seconds()
        return delta > minutes * 60
    except (ValueError, TypeError):
        return True
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_trigger.py -v -k "tier or slot or pick or cache"
```

Expected: all utility tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/trigger.py tests/test_trigger.py
git commit -m "feat: trigger utilities (get_tier, get_time_slot, pick, cache_expired)"
```

---

## Task 4: `resolve_message()` Logic

**Files:**
- Modify: `core/trigger.py` (add `resolve_message`)
- Modify: `tests/test_trigger.py` (add resolve tests)

- [ ] **Step 1: Write failing tests for `resolve_message`**

Append to `tests/test_trigger.py`:

```python
from core.trigger import resolve_message

# Shared character fixture
CHAR = {
    "meta": {"name": "Nova", "ascii": "(*>ω<)", "style": "test"},
    "triggers": {
        "random": ["r1", "r2", "r3"],
        "time": {
            "morning": ["m1"], "afternoon": ["a1"],
            "evening": ["e1"], "midnight": ["n1"]
        },
        "usage": {"warning": ["w1"], "critical": ["c1"]},
        "post_tool": ["p1", "p2", "p3"]
    }
}

def make_state(message="r1", tier="normal", slot="afternoon", updated=None):
    from datetime import datetime
    ts = updated or datetime.now().isoformat()
    return {"message": message, "last_updated": ts, "last_rate_tier": tier, "last_slot": slot}

def make_cc(pct=0, resets_at=None, model="claude-sonnet-4-6"):
    d = {"model": model, "rate_limits": {"used_percentage": pct}}
    if resets_at:
        d["rate_limits"]["resets_at"] = resets_at
    return d

# --- Priority 1: usage tier escalation ---
def test_resolve_escalates_to_warning():
    state = make_state(tier="normal")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(pct=85))
    assert msg == "w1"
    assert tier == "warning"

def test_resolve_escalates_to_critical():
    state = make_state(tier="warning")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(pct=97))
    assert msg == "c1"
    assert tier == "critical"

def test_resolve_alert_persists_while_tier_unchanged():
    state = make_state(message="w1", tier="warning")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(pct=85))
    assert msg == "w1"
    assert tier == "warning"

@patch('core.trigger.datetime')
def test_resolve_tier_drops_to_normal_falls_through(mock_dt):
    """When tier drops back to normal, should not KeyError, returns a normal message."""
    mock_dt.now.return_value = datetime(2026, 3, 22, 14, 10, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    # Cache is expired (updated 10 min ago), slot unchanged → random fallback
    state = make_state(message="w1", tier="warning", slot="afternoon",
                       updated="2026-03-22T14:00:00")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(pct=0))
    assert tier == "normal"
    assert msg in ["r1", "r2", "r3"]  # fell through to random, no KeyError

# --- Priority 2: force_post_tool ---
def test_resolve_force_post_tool_picks_from_post_tool():
    state = make_state(message="r1")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(), force_post_tool=True)
    assert msg in ["p1", "p2", "p3"]
    assert tier == "normal"

def test_resolve_force_post_tool_avoids_last():
    state = make_state(message="p1")
    results = set()
    for _ in range(20):
        msg, _ = resolve_message(CHAR, state, {}, make_cc(), force_post_tool=True)
        results.add(msg)
    assert "p1" not in results

# --- Priority 3: cache not expired ---
@patch('core.trigger.datetime')
def test_resolve_returns_cache_when_fresh(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 14, 2, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    state = make_state(message="r2", slot="afternoon",
                       updated="2026-03-22T14:00:00")
    msg, tier = resolve_message(CHAR, state, {}, make_cc())
    assert msg == "r2"

# --- Priority 4: time slot change ---
@patch('core.trigger.datetime')
def test_resolve_switches_on_slot_change(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 8, 15, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    # Cache expired (updated 15 min before now), slot was "afternoon" → now "morning"
    state = make_state(message="a1", slot="afternoon",
                       updated="2026-03-22T08:00:00")
    msg, tier = resolve_message(CHAR, state, {}, make_cc())
    assert msg == "m1"

# --- Priority 5: random fallback ---
@patch('core.trigger.datetime')
def test_resolve_random_fallback(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 14, 10, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    state = make_state(message="r1", slot="afternoon",
                       updated="2026-03-22T14:00:00")  # expired (10 min ago)
    msg, tier = resolve_message(CHAR, state, {}, make_cc())
    assert msg in ["r2", "r3"]  # never r1 (last message)

# --- Fallback: missing cc_data fields ---
def test_resolve_handles_missing_rate_limits():
    state = make_state()
    msg, tier = resolve_message(CHAR, state, {}, {})
    assert tier == "normal"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_trigger.py -v -k "resolve"
```

Expected: `ImportError` for `resolve_message`.

- [ ] **Step 3: Add `resolve_message` to `core/trigger.py`**

Append to `core/trigger.py`:

```python
def resolve_message(
    character: dict,
    state: dict,
    stats: dict,
    cc_data: dict,
    force_post_tool: bool = False
) -> tuple:
    """Select the appropriate message and return (message, tier)."""
    rate_limits = cc_data.get("rate_limits", {})
    used_pct = rate_limits.get("used_percentage", 0)
    tier = get_tier(used_pct)

    triggers = character["triggers"]
    last_tier = state.get("last_rate_tier", "normal")

    # Priority 1: usage tier change
    if tier != last_tier:
        if tier != "normal":
            return pick(triggers["usage"][tier]), tier
        # Dropped back to normal — fall through to normal priorities

    # Alert persistence: same non-normal tier → keep current alert message
    if tier != "normal" and tier == last_tier:
        return state.get("message", ""), tier

    # Priority 2: post_tool forced (--update mode)
    if force_post_tool:
        return pick_different(triggers["post_tool"], state.get("message", "")), tier

    # Priority 3: cache still fresh
    if not cache_expired(state.get("last_updated", ""), minutes=5):
        return state.get("message", ""), tier

    # Priority 4: time slot changed
    slot = get_time_slot()
    if slot != state.get("last_slot"):
        return pick(triggers["time"][slot]), tier

    # Priority 5: random fallback (avoid repeating last)
    return pick_different(triggers["random"], state.get("message", "")), tier
```

- [ ] **Step 4: Run all trigger tests**

```bash
python3 -m pytest tests/test_trigger.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

> Note: `tests/test_trigger.py` was first committed in Task 3 with utility tests only. This commit adds the resolve tests to the same file — stage the full file, not just the diff.

```bash
git add core/trigger.py tests/test_trigger.py
git commit -m "feat: resolve_message with full priority logic and tests"
```

---

## Task 5: Display Formatting

**Files:**
- Create: `core/display.py`
- Create: `tests/test_display.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_display.py
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.display import format_tokens, format_resets, render

# --- format_tokens ---
def test_format_tokens_thousands():
    assert format_tokens(47768) == "47k"

def test_format_tokens_small():
    assert format_tokens(500) == "500"

def test_format_tokens_exactly_1000():
    assert format_tokens(1000) == "1k"

def test_format_tokens_none():
    assert format_tokens(None) == "N/A"

def test_format_tokens_na_string():
    assert format_tokens("N/A") == "N/A"

def test_format_tokens_zero():
    assert format_tokens(0) == "0"

# --- format_resets ---
def test_format_resets_hours_and_minutes():
    from datetime import datetime, timezone, timedelta
    future = (datetime.now(timezone.utc) + timedelta(hours=3, minutes=20)).isoformat()
    result = format_resets(future)
    assert result == "3h20m"

def test_format_resets_minutes_only():
    from datetime import datetime, timezone, timedelta
    future = (datetime.now(timezone.utc) + timedelta(minutes=45)).isoformat()
    result = format_resets(future)
    assert result == "45m"

def test_format_resets_zero_pads_minutes():
    from datetime import datetime, timezone, timedelta
    future = (datetime.now(timezone.utc) + timedelta(hours=1, minutes=5)).isoformat()
    result = format_resets(future)
    assert result == "1h05m"  # zero-padded minutes

def test_format_resets_past_returns_none():
    assert format_resets("2020-01-01T00:00:00+00:00") is None

def test_format_resets_none_returns_none():
    assert format_resets(None) is None

def test_format_resets_invalid_returns_none():
    assert format_resets("not-a-date") is None

# --- render ---
CHAR = {"meta": {"name": "Nova", "ascii": "(*>ω<)", "style": "test"}}

def test_render_two_lines():
    cc = {"model": "claude-sonnet-4-6", "rate_limits": {"used_percentage": 32}}
    stats = {"today_tokens": 47768}
    output = render(CHAR, "冲冲冲！！", cc, stats)
    lines = output.split("\n")
    assert len(lines) == 2

def test_render_line1_format():
    cc = {"model": "claude-sonnet-4-6", "rate_limits": {"used_percentage": 32}}
    stats = {"today_tokens": 100}
    output = render(CHAR, "冲冲冲！！", cc, stats)
    assert output.startswith("(*>ω<) Nova: 冲冲冲！！")

def test_render_line2_contains_model():
    cc = {"model": "claude-sonnet-4-6", "rate_limits": {"used_percentage": 32}}
    stats = {"today_tokens": 100}
    output = render(CHAR, "msg", cc, stats)
    assert "sonnet-4-6" in output.split("\n")[1]

def test_render_line2_contains_pct():
    cc = {"model": "claude-sonnet-4-6", "rate_limits": {"used_percentage": 32}}
    stats = {"today_tokens": 100}
    output = render(CHAR, "msg", cc, stats)
    assert "用量 32%" in output.split("\n")[1]

def test_render_no_resets_when_missing():
    cc = {"model": "claude-sonnet-4-6", "rate_limits": {"used_percentage": 10}}
    stats = {"today_tokens": 100}
    output = render(CHAR, "msg", cc, stats)
    assert "resets" not in output

def test_render_strips_claude_prefix():
    cc = {"model": "claude-opus-4-6", "rate_limits": {}}
    stats = {}
    output = render(CHAR, "msg", cc, stats)
    assert "opus-4-6" in output
    assert "claude-opus" not in output

def test_render_fallback_when_no_model():
    cc = {}
    stats = {}
    output = render(CHAR, "msg", cc, stats)
    assert "unknown" in output
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_display.py -v
```

Expected: `ImportError`.

- [ ] **Step 3: Implement `core/display.py`**

```python
# core/display.py
from datetime import datetime, timezone


def format_tokens(token_count) -> str:
    """Format token count: 47768 → '47k', 500 → '500', None → 'N/A'."""
    if token_count is None or token_count == "N/A":
        return "N/A"
    try:
        n = int(token_count)
    except (ValueError, TypeError):
        return "N/A"
    if n >= 1000:
        return f"{n // 1000}k"
    return str(n)


def format_resets(resets_at: str):
    """Format ISO UTC timestamp into relative '3h20m' or '45m'. Returns None if past or invalid."""
    if not resets_at:
        return None
    try:
        reset_dt = datetime.fromisoformat(resets_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta_secs = (reset_dt - now).total_seconds()
        if delta_secs <= 0:
            return None
        total_minutes = int(delta_secs // 60)
        hours, minutes = divmod(total_minutes, 60)
        if hours > 0:
            return f"{hours}h{minutes:02d}m"
        return f"{minutes}m"
    except (ValueError, TypeError, AttributeError):
        return None


def render(character: dict, message: str, cc_data: dict, stats: dict) -> str:
    """Format the 2-line statusline output."""
    ascii_face = character["meta"]["ascii"]
    name = character["meta"]["name"]
    line1 = f"{ascii_face} {name}: {message}"

    model = cc_data.get("model", "unknown").replace("claude-", "")
    tokens = format_tokens(stats.get("today_tokens"))
    rate_limits = cc_data.get("rate_limits", {})
    pct = rate_limits.get("used_percentage")
    resets = format_resets(rate_limits.get("resets_at"))

    parts = [model, f"{tokens} tokens"]
    if pct is not None:
        parts.append(f"用量 {pct}%")
    if resets:
        parts.append(f"resets in {resets}")
    line2 = " | ".join(parts)

    return f"{line1}\n{line2}"
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_display.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add core/display.py tests/test_display.py
git commit -m "feat: display formatting with tests"
```

---

## Task 6: `statusline.py` Entry Point

**Files:**
- Create: `statusline.py`
- Create: `tests/test_statusline.py`

- [ ] **Step 1: Write failing integration tests**

```python
# tests/test_statusline.py
import json, os, sys, tempfile
from unittest.mock import patch
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import statusline as sl

SAMPLE_CHAR = {
    "meta": {"name": "Nova", "ascii": "(*>ω<)", "style": "test"},
    "triggers": {
        "random": ["r1", "r2", "r3"],
        "time": {"morning": ["m1"], "afternoon": ["a1"], "evening": ["e1"], "midnight": ["n1"]},
        "usage": {"warning": ["w1"], "critical": ["c1"]},
        "post_tool": ["p1", "p2"]
    }
}

def write_json(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, ensure_ascii=False)

# --- load_config ---
def test_load_config_returns_nova_default(tmp_path, monkeypatch):
    monkeypatch.setattr(sl, 'CONFIG_PATH', str(tmp_path / "config.json"))
    assert sl.load_config() == {"character": "nova"}

def test_load_config_reads_file(tmp_path, monkeypatch):
    p = tmp_path / "config.json"
    write_json(str(p), {"character": "luna"})
    monkeypatch.setattr(sl, 'CONFIG_PATH', str(p))
    assert sl.load_config()["character"] == "luna"

# --- load_state ---
def test_load_state_returns_default_when_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(sl, 'STATE_PATH', str(tmp_path / "state.json"))
    state = sl.load_state()
    assert state["last_rate_tier"] == "normal"
    assert state["message"] == ""

# --- load_stats ---
def test_load_stats_returns_todays_tokens(tmp_path, monkeypatch):
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    data = {"dailyModelTokens": [{"date": today, "tokensByModel": {"claude-sonnet-4-6": 47768}}]}
    p = tmp_path / "stats.json"
    write_json(str(p), data)
    monkeypatch.setattr(sl, 'STATS_PATH', str(p))
    assert sl.load_stats()["today_tokens"] == 47768

def test_load_stats_returns_na_when_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(sl, 'STATS_PATH', str(tmp_path / "no.json"))
    assert sl.load_stats()["today_tokens"] == "N/A"

def test_load_stats_returns_na_when_date_absent(tmp_path, monkeypatch):
    data = {"dailyModelTokens": [{"date": "2020-01-01", "tokensByModel": {"claude-sonnet-4-6": 1000}}]}
    p = tmp_path / "stats.json"
    write_json(str(p), data)
    monkeypatch.setattr(sl, 'STATS_PATH', str(p))
    assert sl.load_stats()["today_tokens"] == "N/A"

def test_load_stats_sums_multiple_models(tmp_path, monkeypatch):
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")
    data = {"dailyModelTokens": [{"date": today, "tokensByModel": {
        "claude-sonnet-4-6": 30000,
        "claude-opus-4-6": 17768
    }}]}
    p = tmp_path / "stats.json"
    write_json(str(p), data)
    monkeypatch.setattr(sl, 'STATS_PATH', str(p))
    assert sl.load_stats()["today_tokens"] == 47768

# --- read_stdin_json ---
def test_read_stdin_json_parses_valid(monkeypatch):
    import io
    monkeypatch.setattr(sys, 'stdin', io.StringIO('{"model": "claude-sonnet-4-6"}'))
    assert sl.read_stdin_json()["model"] == "claude-sonnet-4-6"

def test_read_stdin_json_returns_empty_on_invalid(monkeypatch):
    import io
    monkeypatch.setattr(sys, 'stdin', io.StringIO("not json"))
    assert sl.read_stdin_json() == {}

def test_read_stdin_json_returns_empty_on_empty(monkeypatch):
    import io
    monkeypatch.setattr(sys, 'stdin', io.StringIO(""))
    assert sl.read_stdin_json() == {}

# --- save_state ---
def test_save_state_writes_all_fields(tmp_path, monkeypatch):
    monkeypatch.setattr(sl, 'STATE_PATH', str(tmp_path / "state.json"))
    monkeypatch.setattr(sl, 'BASE_DIR', str(tmp_path))
    sl.save_state("hello", "normal", "afternoon")
    with open(str(tmp_path / "state.json")) as f:
        s = json.load(f)
    assert s["message"] == "hello"
    assert s["last_rate_tier"] == "normal"
    assert s["last_slot"] == "afternoon"
    assert "last_updated" in s

# --- main() render mode ---
def test_main_prints_two_lines(tmp_path, monkeypatch, capsys):
    import io
    config_path = tmp_path / "config.json"
    state_path = tmp_path / "state.json"
    vocab_path = tmp_path / "vocab"
    vocab_path.mkdir()
    write_json(str(config_path), {"character": "nova"})
    write_json(str(state_path), {"message": "", "last_updated": "", "last_rate_tier": "normal", "last_slot": None})
    write_json(str(vocab_path / "nova.json"), SAMPLE_CHAR)

    import core.character as char_mod
    monkeypatch.setattr(char_mod, 'VOCAB_DIR', str(vocab_path))
    monkeypatch.setattr(sl, 'CONFIG_PATH', str(config_path))
    monkeypatch.setattr(sl, 'STATE_PATH', str(state_path))
    monkeypatch.setattr(sl, 'STATS_PATH', str(tmp_path / "no.json"))
    monkeypatch.setattr(sl, 'BASE_DIR', str(tmp_path))
    monkeypatch.setattr(sys, 'argv', ['statusline.py'])
    monkeypatch.setattr(sys, 'stdin', io.StringIO('{"model":"claude-sonnet-4-6","rate_limits":{"used_percentage":10}}'))

    sl.main()
    captured = capsys.readouterr()
    lines = captured.out.strip().split("\n")
    assert len(lines) == 2
    assert "Nova" in lines[0]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_statusline.py -v
```

Expected: `ImportError` or `ModuleNotFoundError`.

- [ ] **Step 3: Implement `statusline.py`**

```python
#!/usr/bin/env python3
# statusline.py
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.character import load_character
from core.trigger import resolve_message, get_time_slot
from core.display import render

BASE_DIR = os.path.join(os.path.expanduser("~"), ".claude", "code-cheer")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
STATE_PATH = os.path.join(BASE_DIR, "state.json")
STATS_PATH = os.path.join(os.path.expanduser("~"), ".claude", "stats-cache.json")

_EMPTY_STATE = {
    "message": "",
    "last_updated": "",
    "last_rate_tier": "normal",
    "last_slot": None,
}


def load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"character": "nova"}


def load_state() -> dict:
    try:
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return dict(_EMPTY_STATE)


def load_stats() -> dict:
    try:
        with open(STATS_PATH, "r") as f:
            data = json.load(f)
        today = datetime.now().strftime("%Y-%m-%d")
        for entry in data.get("dailyModelTokens", []):
            if entry.get("date") == today:
                total = sum(entry.get("tokensByModel", {}).values())
                return {"today_tokens": total}
        return {"today_tokens": "N/A"}  # today not in file yet
    except (FileNotFoundError, json.JSONDecodeError):
        return {"today_tokens": "N/A"}


def read_stdin_json() -> dict:
    try:
        raw = sys.stdin.read().strip()
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return {}


def save_state(message: str, tier: str, slot: str) -> None:
    os.makedirs(BASE_DIR, exist_ok=True)
    state = {
        "message": message,
        "last_updated": datetime.now().isoformat(),
        "last_rate_tier": tier,
        "last_slot": slot,
    }
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def main():
    update_only = "--update" in sys.argv

    config = load_config()
    state = load_state()
    stats = load_stats()
    cc_data = read_stdin_json()

    try:
        character = load_character(config.get("character", "nova"))
    except FileNotFoundError:
        character = load_character("nova")

    message, tier = resolve_message(
        character, state, stats, cc_data, force_post_tool=update_only
    )

    if message != state.get("message") or tier != state.get("last_rate_tier"):
        save_state(message, tier, slot=get_time_slot())

    if update_only:
        return

    print(render(character, message, cc_data, stats))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run all tests**

```bash
python3 -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 4b: Add `--update` mode integration test**

Append to `tests/test_statusline.py`:

```python
def test_main_update_mode_no_output(tmp_path, monkeypatch, capsys):
    import io
    config_path = tmp_path / "config.json"
    state_path = tmp_path / "state.json"
    vocab_path = tmp_path / "vocab"
    vocab_path.mkdir()
    write_json(str(config_path), {"character": "nova"})
    write_json(str(state_path), {"message": "", "last_updated": "", "last_rate_tier": "normal", "last_slot": None})
    write_json(str(vocab_path / "nova.json"), SAMPLE_CHAR)

    import core.character as char_mod
    monkeypatch.setattr(char_mod, 'VOCAB_DIR', str(vocab_path))
    monkeypatch.setattr(sl, 'CONFIG_PATH', str(config_path))
    monkeypatch.setattr(sl, 'STATE_PATH', str(state_path))
    monkeypatch.setattr(sl, 'STATS_PATH', str(tmp_path / "no.json"))
    monkeypatch.setattr(sl, 'BASE_DIR', str(tmp_path))
    monkeypatch.setattr(sys, 'argv', ['statusline.py', '--update'])
    monkeypatch.setattr(sys, 'stdin', io.StringIO('{}'))

    sl.main()
    captured = capsys.readouterr()
    assert captured.out == ""  # --update prints nothing

    import json as _json
    with open(str(state_path)) as f:
        saved = _json.load(f)
    assert saved["message"] in ["p1", "p2"]  # post_tool vocab
    assert "last_updated" in saved
```

- [ ] **Step 5: Commit**

```bash
git add statusline.py tests/test_statusline.py
git commit -m "feat: statusline entry point with integration tests"
```

---

## Task 7: Nova Vocab

**Files:**
- Create: `vocab/nova.json`

- [ ] **Step 1: Create `vocab/nova.json`**

```json
{
  "meta": {
    "name": "Nova",
    "ascii": "(*>ω<)",
    "style": "元气满满，感叹号连发，运动系加油风"
  },
  "triggers": {
    "random": [
      "今天也要全力以赴，冲冲冲！！",
      "每一行代码都是胜利！GO！！",
      "你就是最强的那个人！！",
      "没有 bug 是永远解决不了的！冲！",
      "代码写起来！状态满分！！",
      "燃起来了吗！今天也要破纪录！！",
      "你的努力终将发光！！继续冲！",
      "全力输出！今天也是最强的一天！！",
      "挑战困难！这才是成长！GO GO！！",
      "不要停下来，胜利就在前方！！",
      "每次 commit 都是新的起点！冲！！",
      "今天的你比昨天更强！！燃起来！"
    ],
    "time": {
      "morning": [
        "早安！新的一天，全力冲刺从现在开始！！",
        "早！状态调整好了吗！今天也要拼！！",
        "早起的鸟儿有代码！冲冲冲！！",
        "新的一天！昨天的 bug 今天全部干掉！！"
      ],
      "afternoon": [
        "下午也要保持这个状态！别松懈！！",
        "午后时光，代码继续燃起来！！",
        "下午茶？不，是下午冲冲冲！！",
        "状态最佳时段，现在就是！全力输出！！"
      ],
      "evening": [
        "晚上了还在敲代码，你太燃了！！",
        "夜晚的代码有魔力！继续冲！！",
        "晚上的专注力给满分！GO！！",
        "日落了但你没有停，这就是差距！！"
      ],
      "midnight": [
        "深夜还在战斗！你是最燃的夜猫子！！",
        "凌晨了！但代码还在等你！冲！！",
        "深夜 coding 俱乐部，你是会员！！",
        "没人能阻止你，连睡意也不行！！"
      ]
    },
    "usage": {
      "warning": [
        "额度用了 80%！最后冲刺，GO GO GO！！",
        "80% 了！把剩下的用在刀刃上！冲！！",
        "快到限额！这是决赛圈，全力以赴！！"
      ],
      "critical": [
        "快撑不住了！但你已经超厉害了！！",
        "额度告急！把最重要的事做完！冲！！",
        "最后冲刺！用最后的额度创造奇迹！！"
      ]
    },
    "post_tool": [
      "命令跑完啦！下一个目标，冲！！",
      "✓ 成功！继续保持这个势头！！",
      "又一个完成！积小胜为大胜！！",
      "跑完了！不停歇，继续下一关！！",
      "执行成功！你的节奏太稳了！！",
      "干净利落！这就是你的风格！！",
      "✓ 又拿下一个！势不可挡！！",
      "继续冲！今天的成就等着你！！"
    ]
  }
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -c "import json; json.load(open('vocab/nova.json')); print('OK')"
```

Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add vocab/nova.json
git commit -m "feat: Nova vocab (nova.json)"
```

---

## Task 8: Luna Vocab

**Files:**
- Create: `vocab/luna.json`

- [ ] **Step 1: Create `vocab/luna.json`**

```json
{
  "meta": {
    "name": "Luna",
    "ascii": "(´• ω •`)",
    "style": "温柔治愈，陪伴系，轻声细语"
  },
  "triggers": {
    "random": [
      "今天也在认真工作呢～",
      "有什么难的地方，慢慢来哦～",
      "写代码很累吧，你真的很努力～",
      "不用着急，一步一步就好呢～",
      "记得偶尔抬头看看窗外哦～",
      "每一行代码都有你的心血呢～",
      "不管结果怎样，过程你很棒哦～",
      "有我在呢，不用一个人扛着哦～",
      "写到这里已经很厉害了呀～",
      "今天辛苦了，要好好休息哦～",
      "你写的每一行我都看到了呢～",
      "累了就歇一歇，代码不会跑掉的～"
    ],
    "time": {
      "morning": [
        "早上好呀～ 新的一天，慢慢来哦～",
        "清晨的代码最清醒呢，加油哦～",
        "早安～ 今天也要照顾好自己呢～",
        "新的一天开始了，不急不急，稳稳来～"
      ],
      "afternoon": [
        "下午了，记得喝水哦～",
        "午后有点犯困吧，没关系的呢～",
        "下午的阳光很好呢，写代码心情也好～",
        "慢慢来，不用赶的哦～"
      ],
      "evening": [
        "晚上了，吃饭了吗～",
        "夜晚来了，注意保暖哦～",
        "今天写了好多呢，要好好吃饭哦～",
        "晚上的你也很努力呢，辛苦了～"
      ],
      "midnight": [
        "这么晚了还在写代码… 辛苦了，记得喝水哦～",
        "深夜了呢，身体是最重要的哦～",
        "夜深了，写完这段就休息一下好吗～",
        "Luna 陪着你呢，但也要保重身体哦～"
      ]
    },
    "usage": {
      "warning": [
        "额度用了 80% 了… 要注意节奏哦～",
        "快到限额了，慢下来好好规划一下呢～",
        "80% 了，剩下的留给最重要的事情哦～"
      ],
      "critical": [
        "额度快用完了… 先把最重要的做完哦～",
        "快到极限了，保存好你的成果呢～",
        "最后一段路了，你已经做了很多了哦～"
      ]
    },
    "post_tool": [
      "跑完了呢，辛苦啦～",
      "完成了哦，你真的很细心呢～",
      "一步一步来，你做到了呢～",
      "慢慢积累，成果都在的哦～",
      "完成一件就少一件，加油哦～",
      "每个完成的步骤都值得珍惜呢～",
      "不知不觉做了好多呢，厉害哦～",
      "休息一下再继续也可以哦～"
    ]
  }
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -c "import json; json.load(open('vocab/luna.json')); print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add vocab/luna.json
git commit -m "feat: Luna vocab (luna.json)"
```

---

## Task 9: Mochi Vocab

**Files:**
- Create: `vocab/mochi.json`

- [ ] **Step 1: Create `vocab/mochi.json`**

```json
{
  "meta": {
    "name": "Mochi",
    "ascii": "(=^･ω･^=)",
    "style": "软萌奶凶，傲娇猫系，第三人称自称"
  },
  "triggers": {
    "random": [
      "Mochi 看了一眼… 勉强还行啦",
      "Mochi 才不是在关注你呢哼",
      "呜… 你还在啊，Mochi 随便看看",
      "这个代码嘛… Mochi 觉得凑合啦",
      "哼，你终于开始了，Mochi 等好久了",
      "Mochi 帮你盯着，你放心写吧啦",
      "呜呜这个问题好难… 但你能解决啦",
      "Mochi 觉得你今天… 还可以啦哼",
      "哼，Mochi 才不担心你呢，才不是",
      "Mochi 观察了一下… 表现尚可啦",
      "呜，这个 bug 好烦… 但 Mochi 陪你",
      "Mochi 勉强承认你今天有进步啦"
    ],
    "time": {
      "morning": [
        "Mochi 早上不太清醒啦… 但你加油嘛",
        "哼，这么早就开始了，Mochi 刚醒啦",
        "早上好嘛… Mochi 打个哈欠，你继续啦",
        "呜，清晨的代码 Mochi 陪你盯着啦"
      ],
      "afternoon": [
        "下午了嘛… Mochi 看看你在干什么啦",
        "午后时光，Mochi 也勉强来陪你啦",
        "哼，Mochi 下午才不是专门来找你的",
        "呜，Mochi 下午有点困… 但你继续啦"
      ],
      "evening": [
        "晚上了嘛，Mochi 陪着你啦，才不是特意的",
        "哼，晚上还在写，Mochi 就勉强多陪一会儿",
        "呜，晚上的代码好难… 但 Mochi 见证了啦",
        "Mochi 晚上比较有精神啦，你也是吗哼"
      ],
      "midnight": [
        "Mochi 也困了… 但你还在所以 Mochi 陪着啦哼",
        "深夜了嘛… Mochi 才不是担心你，只是正好在",
        "呜呜 Mochi 眼睛睁不开了啦… 你也快结束吧",
        "深夜 coding Mochi 见证了，哼，记住哦"
      ]
    },
    "usage": {
      "warning": [
        "呜呜额度要没了啦… 省着点用嘛",
        "哼，用了 80% 了，Mochi 觉得要悠着点啦",
        "额度告急啦… Mochi 帮你盯着，快用完了哼"
      ],
      "critical": [
        "呜呜呜快没了啦！！Mochi 好紧张啦！",
        "哼，剩下一点点了，Mochi 说要留着用的！",
        "额度快归零了啦… Mochi 已经尽力提醒你了哼"
      ]
    },
    "post_tool": [
      "跑完了嘛… Mochi 看着呢，继续啦",
      "呜，终于跑完了啦哼",
      "Mochi 见证了这一步啦，记住哦",
      "嗯… 可以吧，Mochi 勉强认可啦",
      "Mochi 帮你记录了，这步完成啦",
      "哼，Mochi 早就知道你能搞定啦",
      "呜呜 Mochi 也想帮忙… 加油吧啦",
      "跑完这个 Mochi 就去休息… 才不是"
    ]
  }
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -c "import json; json.load(open('vocab/mochi.json')); print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add vocab/mochi.json
git commit -m "feat: Mochi vocab (mochi.json)"
```

---

## Task 10: Iris Vocab

**Files:**
- Create: `vocab/iris.json`

- [ ] **Step 1: Create `vocab/iris.json`**

```json
{
  "meta": {
    "name": "Iris",
    "ascii": "(￣ω￣)",
    "style": "女王御姐，冷静挑逗，激将法"
  },
  "triggers": {
    "random": [
      "哦？又来了。",
      "今天状态怎么样，值得期待吗。",
      "还在坚持。倒也出乎意料。",
      "进展如何，别让我失望。",
      "还没放弃，有点意思。",
      "坐下来就能干活，这点不错。",
      "遇到麻烦了？有意思。",
      "代码不会骗人，你的会。",
      "这个点还在写，目的是什么。",
      "继续。别自满。",
      "还差得远，但方向对了。",
      "哦，学会这个了。够用。"
    ],
    "time": {
      "morning": [
        "早。今天打算做到什么程度。",
        "哦，起这么早。有目标了？",
        "新的一天，拿出点成绩来看看。",
        "早上的状态决定全天，别浪费。"
      ],
      "afternoon": [
        "下午了，上午的成果呢。",
        "哦？还在继续，没想到。",
        "午后效率最低的时候，你还在写，有意思。",
        "进度符合预期吗，还是只是在消磨时间。"
      ],
      "evening": [
        "晚上了，今天的产出值得吗。",
        "哦，吃完饭还回来了，认真的。",
        "夜晚是检验意志力的时候，撑住。",
        "今天写了多少，对得起这一天吗。"
      ],
      "midnight": [
        "凌晨了还没走？说说看，是什么在驱动你。",
        "哦，深夜了。有意思，说明你在乎这件事。",
        "这个点还在写，让我刮目相看了一点点。",
        "深夜的代码质量往往很差，但你在写，不错。"
      ]
    },
    "usage": {
      "warning": [
        "额度用了 80%，紧张吗。",
        "哦，快到限额了，这才开始提高效率？",
        "80% 了，剩下的你打算怎么用，想好了吗。"
      ],
      "critical": [
        "快撑不住了，紧张吗？",
        "哦，额度见底了，把最值得做的事做完吧。",
        "最后一点额度，这是你证明效率的时候。"
      ]
    },
    "post_tool": [
      "执行完毕。下一项。",
      "通过了。别太得意。",
      "这个结果在预期内，继续。",
      "哦，没出错。难得。",
      "效率还行。保持。",
      "完成。继续证明你不是运气。",
      "符合预期。偶尔让我惊喜一次。",
      "工具用对了，不代表思路对了。"
    ]
  }
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -c "import json; json.load(open('vocab/iris.json')); print('OK')"
```

- [ ] **Step 3: Run full test suite to confirm all vocab loads correctly**

```bash
python3 -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add vocab/iris.json
git commit -m "feat: Iris vocab (iris.json)"
```

---

## Task 11: `/cheer` Slash Command

**Files:**
- Create: `commands/cheer.md`

- [ ] **Step 1: Create `commands/cheer.md`**

Write the following content to `commands/cheer.md` (note: the file itself uses plain markdown — the bash block inside uses 4-space indentation to avoid fence collisions):

~~~markdown
Switch the Code Cheer companion character.

Available characters: nova, luna, mochi, iris

The user typed: $ARGUMENTS

**Instructions:**

If $ARGUMENTS is empty:
  Use the AskUserQuestion tool to present the 4 characters as options. Each option label should be the character name, and the description should include their ASCII face and style summary:
  - Nova (*>ω<): 元气满满，运动系啦啦队
  - Luna (´• ω •`): 温柔治愈，陪伴系
  - Mochi (=^･ω･^=): 软萌奶凶，傲娇猫系
  - Iris (￣ω￣): 女王御姐，冷静挑逗

If $ARGUMENTS is one of [nova, luna, mochi, iris]:
  Switch to that character directly.

If $ARGUMENTS is anything else:
  Reply: "可用角色：nova / luna / mochi / iris\n用法：/cheer nova"

**To switch a character, use the Bash tool to run these two commands**
(replace CHOSEN_NAME with the selected character name in lowercase):

    echo '{"character": "CHOSEN_NAME"}' > $HOME/.claude/code-cheer/config.json
    echo '{"message":"","last_updated":"","last_rate_tier":"normal","last_slot":null}' > $HOME/.claude/code-cheer/state.json

**After switching, reply with the character's confirmation message:**
- nova: 已切换到 Nova！(*>ω<) 准备好了吗！冲冲冲！！
- luna: 已切换到 Luna～ (´• ω •`) 我会一直陪着你哦～
- mochi: 哼… Mochi 来了啦 (=^･ω･^=) 才不是很期待呢
- iris: (￣ω￣) 换我了。希望你不会让我失望。
~~~

- [ ] **Step 2: Verify the file renders correctly**

```bash
cat commands/cheer.md
```

Expected: clean markdown with no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add commands/cheer.md
git commit -m "feat: /cheer slash command"
```

---

## Task 12: `install.sh`

**Files:**
- Create: `install.sh`

- [ ] **Step 1: Create `install.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/.claude/code-cheer"
SETTINGS="$HOME/.claude/settings.json"
COMMANDS_DIR="$HOME/.claude/commands"
SCRIPT_PATH="$INSTALL_DIR/statusline.py"
UPDATE_CMD="python3 $SCRIPT_PATH --update"
STATUS_CMD="python3 $SCRIPT_PATH"

# ── helpers ──────────────────────────────────────────────────────────────────
info()  { echo "  $*"; }
ok()    { echo "✓ $*"; }
warn()  { echo "⚠ $*"; }
die()   { echo "✗ $*" >&2; exit 1; }

# ── uninstall ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
  echo "Uninstalling Code Cheer…"

  if [[ -f "$SETTINGS" ]]; then
    python3 - "$SETTINGS" "$SCRIPT_PATH" <<'PYEOF'
import json, sys
path, script = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
# Remove statusLine only if it points to our script
sl = data.get("statusLine", {})
if isinstance(sl, dict) and script in sl.get("command", ""):
    del data["statusLine"]
# Remove our PostToolUse hook entry
hooks = data.get("hooks", {})
ptu = hooks.get("PostToolUse", [])
new_ptu = [h for h in ptu if script not in h.get("command", "")]
if new_ptu != ptu:
    hooks["PostToolUse"] = new_ptu
    if not new_ptu:
        del hooks["PostToolUse"]
if not hooks:
    data.pop("hooks", None)
with open(path, "w") as f:
    json.dump(data, f, indent=2)
PYEOF
    ok "settings.json cleaned"
  fi

  rm -f "$COMMANDS_DIR/cheer.md" && ok "Removed cheer.md"
  rm -rf "$INSTALL_DIR" && ok "Removed $INSTALL_DIR"

  if [[ -f "$SETTINGS.bak" ]]; then
    warn "Backup exists at $SETTINGS.bak — restore manually if needed"
  fi

  echo ""
  echo "(*>ω<) Nova: 再见啦！有空再来冲冲冲！！"
  exit 0
fi

# ── install ───────────────────────────────────────────────────────────────────
echo "Installing Code Cheer…"
echo ""

# 1. Check Python 3
python3 --version > /dev/null 2>&1 || die "Python 3 is required but not found"
ok "Python 3 found"

# 2. Create install dir
mkdir -p "$INSTALL_DIR"
ok "Created $INSTALL_DIR"

# 3. Copy files
cp "$REPO_DIR/statusline.py" "$INSTALL_DIR/"
cp -r "$REPO_DIR/core" "$INSTALL_DIR/"
cp -r "$REPO_DIR/vocab" "$INSTALL_DIR/"
ok "Copied scripts and vocab"

# 4. Write default config (skip if exists)
if [[ ! -f "$INSTALL_DIR/config.json" ]]; then
  echo '{"character": "nova"}' > "$INSTALL_DIR/config.json"
  ok "Created default config (Nova)"
else
  info "Config already exists, skipping"
fi

# 5. Write empty state
echo '{"message":"","last_updated":"","last_rate_tier":"normal","last_slot":null}' \
  > "$INSTALL_DIR/state.json"
ok "Initialized state"

# 6. Merge settings.json
mkdir -p "$(dirname "$SETTINGS")"
python3 - "$SETTINGS" "$STATUS_CMD" "$UPDATE_CMD" <<'PYEOF'
import json, os, sys, shutil

settings_path = sys.argv[1]
status_cmd    = sys.argv[2]
update_cmd    = sys.argv[3]

# Load or create
if os.path.exists(settings_path):
    shutil.copy2(settings_path, settings_path + ".bak")
    with open(settings_path) as f:
        data = json.load(f)
    print(f"  Backed up settings.json → settings.json.bak")
else:
    data = {}

# statusLine
if "statusLine" in data:
    print(f"⚠ statusLine already configured — skipping (won't overwrite)")
else:
    data["statusLine"] = {"type": "command", "command": status_cmd}
    print(f"✓ Added statusLine")

# hooks.PostToolUse
hooks = data.setdefault("hooks", {})
ptu   = hooks.setdefault("PostToolUse", [])
if not any(update_cmd in h.get("command", "") for h in ptu):
    ptu.append({"command": update_cmd})
    print(f"✓ Added PostToolUse hook")
else:
    print(f"  PostToolUse hook already present, skipping")

with open(settings_path, "w") as f:
    json.dump(data, f, indent=2)
PYEOF

# 7. Copy cheer command
mkdir -p "$COMMANDS_DIR"
cp "$REPO_DIR/commands/cheer.md" "$COMMANDS_DIR/cheer.md"
ok "Installed /cheer command"

# 8. Done
echo ""
echo "(*>ω<) Nova: 安装完成！准备好了吗！冲冲冲！！"
echo ""
echo "  Restart Claude Code to activate the statusline."
echo "  Switch characters with: /cheer"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x install.sh
```

- [ ] **Step 3: Dry-run syntax check**

```bash
bash -n install.sh && echo "Syntax OK"
```

Expected: `Syntax OK`.

- [ ] **Step 4: Commit**

```bash
git add install.sh
git commit -m "feat: install.sh with safe settings merge and --uninstall"
```

---

## Task 13: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# Code Cheer

A Claude Code statusline companion — shows encouragement + usage info while you code.

## What it looks like

```
(*>ω<) Nova: 命令跑完啦！下一个目标，冲！！
sonnet-4-6 | 47k tokens | 用量 32% | resets in 3h20m
```

## Install

```bash
git clone https://github.com/your-username/code-cheer
cd code-cheer
./install.sh
```

Restart Claude Code. The statusline activates immediately.

## Switch characters

```
/cheer          # interactive picker
/cheer nova     # switch directly
/cheer luna
/cheer mochi
/cheer iris
```

## Characters

| Character | Style |
|-----------|-------|
| **Nova 星野** `(*>ω<)` | 元气满满，运动系啦啦队 |
| **Luna 月野** `(´• ω •`)` | 温柔治愈，陪伴系 |
| **Mochi 年糕** `(=^･ω･^=)` | 软萌奶凶，傲娇猫系 |
| **Iris 晴** `(￣ω￣)` | 女王御姐，冷静挑逗 |

## Customize vocab

Edit `~/.claude/code-cheer/vocab/nova.json` (or any character) to add your own messages.

## Uninstall

```bash
./install.sh --uninstall
```

## Requirements

- Python 3 (pre-installed on macOS/Linux)
- Claude Code v2.1.80+
```

- [ ] **Step 2: Run full test suite one final time**

```bash
python3 -m pytest tests/ -v
```

Expected: all tests pass.

- [ ] **Step 3: Final commit**

```bash
git add README.md
git commit -m "docs: README with install and usage guide"
```

---

## Final Verification

- [ ] **Run complete test suite**

```bash
python3 -m pytest tests/ -v --tb=short
```

Expected: all tests pass, 0 failures.

- [ ] **Smoke test the script directly**

```bash
echo '{"model":"claude-sonnet-4-6","rate_limits":{"used_percentage":10}}' \
  | python3 statusline.py
```

Expected: 2-line output with a character name and stats.

- [ ] **Verify all vocab files are valid JSON**

```bash
for f in vocab/*.json; do
  python3 -c "import json; json.load(open('$f'))" && echo "OK: $f"
done
```

Expected: `OK` for all 4 files.
