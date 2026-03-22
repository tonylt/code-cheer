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
