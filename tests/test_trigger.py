# @deprecated: use src/ TypeScript version
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
    five_hour = {"used_percentage": pct}
    if resets_at:
        five_hour["resets_at"] = resets_at
    return {"model": model, "rate_limits": {"five_hour": five_hour}}

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


# =============================================================================
# detect_git_events() tests
# =============================================================================

from core.trigger import detect_git_events


def make_git_ctx(commits=0, diff=0, repo="/repo/a"):
    return {"commits_today": commits, "diff_lines": diff,
            "first_commit_time": None, "repo_path": repo}


def make_det_state(last_events=None, last_repo="/repo/a", session_start=None):
    s = {"last_git_events": last_events or [], "last_repo": last_repo}
    if session_start:
        s["session_start"] = session_start
    return s


# --- GIT-01: first_commit_today ---

def test_detect_first_commit_today():
    events = detect_git_events(make_git_ctx(commits=1), make_det_state(), {})
    assert "first_commit_today" in events


def test_detect_first_commit_today_dedup():
    events = detect_git_events(
        make_git_ctx(commits=3),
        make_det_state(last_events=["first_commit_today"]),
        {}
    )
    assert "first_commit_today" not in events


def test_detect_first_commit_today_no_commits():
    events = detect_git_events(make_git_ctx(commits=0), make_det_state(), {})
    assert "first_commit_today" not in events


# --- GIT-02: milestones ---

def test_detect_milestone_5():
    events = detect_git_events(make_git_ctx(commits=5), make_det_state(), {})
    assert "milestone_5" in events


def test_detect_milestone_10():
    events = detect_git_events(make_git_ctx(commits=10), make_det_state(), {})
    assert "milestone_10" in events


def test_detect_milestone_20():
    events = detect_git_events(make_git_ctx(commits=20), make_det_state(), {})
    assert "milestone_20" in events


def test_detect_milestone_independent_dedup():
    events = detect_git_events(
        make_git_ctx(commits=10),
        make_det_state(last_events=["milestone_5"]),
        {}
    )
    assert "milestone_5" not in events
    assert "milestone_10" in events


def test_detect_milestone_priority_order():
    events = detect_git_events(make_git_ctx(commits=20), make_det_state(), {})
    assert events.index("milestone_20") < events.index("milestone_10") < events.index("milestone_5")


# --- GIT-03: late_night_commit ---

@patch('core.trigger.datetime')
def test_detect_late_night_commit(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 22, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    events = detect_git_events(make_git_ctx(commits=1), make_det_state(), {})
    assert "late_night_commit" in events


@patch('core.trigger.datetime')
def test_detect_late_night_not_triggered_before_hour(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 21, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    events = detect_git_events(make_git_ctx(commits=1), make_det_state(), {})
    assert "late_night_commit" not in events


@patch('core.trigger.datetime')
def test_detect_late_night_no_commits(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 23, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    events = detect_git_events(make_git_ctx(commits=0), make_det_state(), {})
    assert "late_night_commit" not in events


@patch('core.trigger.datetime')
def test_detect_late_night_dedup(mock_dt):
    mock_dt.now.return_value = datetime(2026, 3, 22, 22, 0)
    mock_dt.fromisoformat = datetime.fromisoformat
    events = detect_git_events(
        make_git_ctx(commits=1),
        make_det_state(last_events=["late_night_commit"]),
        {}
    )
    assert "late_night_commit" not in events


# --- GIT-04: big_diff ---

def test_detect_big_diff_exact_boundary():
    events = detect_git_events(make_git_ctx(diff=200), make_det_state(), {})
    assert "big_diff" in events


def test_detect_big_diff_below():
    events = detect_git_events(make_git_ctx(diff=199), make_det_state(), {})
    assert "big_diff" not in events


def test_detect_big_diff_custom_threshold():
    events = detect_git_events(
        make_git_ctx(diff=100),
        make_det_state(),
        {"event_thresholds": {"big_diff": 50}}
    )
    assert "big_diff" in events


# --- GIT-05: big_session ---

@patch('core.trigger.datetime')
def test_detect_big_session(mock_dt):
    now = datetime(2026, 3, 22, 14, 0, 0)
    mock_dt.now.return_value = now
    mock_dt.fromisoformat = datetime.fromisoformat
    start = (now - timedelta(minutes=120)).isoformat()
    events = detect_git_events(
        make_git_ctx(),
        make_det_state(session_start=start),
        {}
    )
    assert "big_session" in events


@patch('core.trigger.datetime')
def test_detect_big_session_below(mock_dt):
    now = datetime(2026, 3, 22, 14, 0, 0)
    mock_dt.now.return_value = now
    mock_dt.fromisoformat = datetime.fromisoformat
    start = (now - timedelta(minutes=119)).isoformat()
    events = detect_git_events(
        make_git_ctx(),
        make_det_state(session_start=start),
        {}
    )
    assert "big_session" not in events


def test_detect_big_session_no_start():
    events = detect_git_events(make_git_ctx(), make_det_state(), {})
    assert "big_session" not in events


def test_detect_big_session_invalid_start():
    state = make_det_state()
    state["session_start"] = "not-a-date"
    events = detect_git_events(make_git_ctx(), state, {})
    assert "big_session" not in events


# --- GIT-06: long_day ---

def test_detect_long_day():
    events = detect_git_events(make_git_ctx(commits=15), make_det_state(), {})
    assert "long_day" in events


def test_detect_long_day_below():
    events = detect_git_events(make_git_ctx(commits=14), make_det_state(), {})
    assert "long_day" not in events


# --- CFG-01: config fallback ---

def test_detect_empty_config_uses_defaults():
    events = detect_git_events(make_git_ctx(commits=5, diff=200), make_det_state(), {})
    assert "milestone_5" in events
    assert "big_diff" in events


def test_detect_partial_config_merges():
    events = detect_git_events(
        make_git_ctx(commits=5, diff=150),
        make_det_state(),
        {"event_thresholds": {"big_diff": 100}}
    )
    assert "big_diff" in events       # custom threshold 100 < 150
    assert "milestone_5" in events    # default [5,10,20] still applies


def test_detect_custom_milestone_counts():
    events = detect_git_events(
        make_git_ctx(commits=3),
        make_det_state(),
        {"event_thresholds": {"milestone_counts": [3, 7]}}
    )
    assert "milestone_3" in events


# --- STA-01: per-repo isolation ---

def test_detect_repo_switch_resets_events():
    events = detect_git_events(
        make_git_ctx(commits=3, repo="/repo/b"),
        make_det_state(last_events=["milestone_5", "first_commit_today"], last_repo="/repo/a"),
        {}
    )
    # After repo switch, last_git_events is effectively [], so first_commit_today can retrigger
    assert "first_commit_today" in events


def test_detect_repo_none_no_reset():
    events = detect_git_events(
        make_git_ctx(commits=3, repo=None),
        make_det_state(last_events=["first_commit_today"], last_repo="/repo/a"),
        {}
    )
    # repo_path is None -> no reset -> dedup still in effect
    assert "first_commit_today" not in events


def test_detect_same_repo_no_reset():
    events = detect_git_events(
        make_git_ctx(commits=3, repo="/repo/a"),
        make_det_state(last_events=["first_commit_today"], last_repo="/repo/a"),
        {}
    )
    assert "first_commit_today" not in events


# --- Edge cases ---

def test_detect_corrupted_last_events_string():
    state = make_det_state()
    state["last_git_events"] = "not_a_list"
    # Should treat as [], events returned normally
    events = detect_git_events(make_git_ctx(commits=1), state, {})
    assert "first_commit_today" in events


def test_detect_no_events_returns_empty():
    events = detect_git_events(make_git_ctx(commits=0, diff=0), make_det_state(), {})
    assert events == []


# --- Priority order ---

@patch('core.trigger.datetime')
def test_detect_priority_order_full(mock_dt):
    now = datetime(2026, 3, 22, 23, 0, 0)
    mock_dt.now.return_value = now
    mock_dt.fromisoformat = datetime.fromisoformat
    start = (now - timedelta(hours=3)).isoformat()
    events = detect_git_events(
        make_git_ctx(commits=20, diff=200, repo="/repo/a"),
        make_det_state(session_start=start),
        {}
    )
    # milestone_20 should be first, first_commit_today should be last
    assert len(events) > 0
    assert events[0] == "milestone_20"
    assert events[-1] == "first_commit_today"


# =============================================================================
# resolve_message() with triggered_events integration tests
# =============================================================================

# --- resolve_message with triggered_events ---

def test_resolve_git_event_uses_post_tool_fallback():
    """When git_events vocab missing, falls back to post_tool."""
    state = make_state(message="r1")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(),
                                force_post_tool=True,
                                triggered_events=["milestone_5"])
    assert msg in ["p1", "p2", "p3"]  # falls back to post_tool (no git_events in CHAR)


def test_resolve_git_event_uses_git_vocab_when_present():
    """When triggered_events passed and character has top-level git_events, use git vocab."""
    char = dict(CHAR)
    char["git_events"] = {"milestone_5": ["git_m5_a", "git_m5_b"]}
    state = make_state(message="r1")
    msg, tier = resolve_message(char, state, {}, make_cc(),
                                force_post_tool=True,
                                triggered_events=["milestone_5"])
    assert msg in ["git_m5_a", "git_m5_b"]


def test_resolve_no_triggered_events_uses_post_tool():
    """When triggered_events is empty list, normal post_tool behavior."""
    state = make_state(message="r1")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(),
                                force_post_tool=True,
                                triggered_events=[])
    assert msg in ["p1", "p2", "p3"]


def test_resolve_triggered_events_none_backward_compat():
    """When triggered_events=None (default), identical to current behavior."""
    state = make_state(message="r1")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(),
                                force_post_tool=True)
    assert msg in ["p1", "p2", "p3"]


def test_resolve_git_event_warning_tier_ignores_events():
    """warning tier should return usage message, not git event message."""
    state = make_state(tier="normal")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(pct=85),
                                force_post_tool=True,
                                triggered_events=["first_commit_today"])
    assert msg == "w1"
    assert tier == "warning"


def test_resolve_git_event_critical_tier_ignores_events():
    """critical tier should return usage message, not git event message."""
    state = make_state(tier="normal")
    msg, tier = resolve_message(CHAR, state, {}, make_cc(pct=97),
                                force_post_tool=True,
                                triggered_events=["first_commit_today"])
    assert msg == "c1"
    assert tier == "critical"
