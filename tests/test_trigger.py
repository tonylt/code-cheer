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
