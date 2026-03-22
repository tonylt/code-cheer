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
