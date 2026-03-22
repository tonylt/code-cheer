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
    future = (datetime.now(timezone.utc) + timedelta(hours=3, minutes=20, seconds=30)).isoformat()
    result = format_resets(future)
    assert result == "3h20m"

def test_format_resets_minutes_only():
    from datetime import datetime, timezone, timedelta
    future = (datetime.now(timezone.utc) + timedelta(minutes=45, seconds=30)).isoformat()
    result = format_resets(future)
    assert result == "45m"

def test_format_resets_zero_pads_minutes():
    from datetime import datetime, timezone, timedelta
    future = (datetime.now(timezone.utc) + timedelta(hours=1, minutes=5, seconds=30)).isoformat()
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
