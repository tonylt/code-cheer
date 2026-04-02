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
    assert "sonnet-4-6" in lines[1]

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


# --- save_state with git fields ---

def test_save_state_git_fields(tmp_path, monkeypatch):
    monkeypatch.setattr(sl, 'STATE_PATH', str(tmp_path / "state.json"))
    monkeypatch.setattr(sl, 'BASE_DIR', str(tmp_path))
    sl.save_state("hello", "normal", "afternoon",
                  last_git_events=["milestone_5", "first_commit_today"],
                  last_repo="/path/to/repo",
                  commits_today=5)
    with open(str(tmp_path / "state.json")) as f:
        s = json.load(f)
    assert s["last_git_events"] == ["milestone_5", "first_commit_today"]
    assert s["last_repo"] == "/path/to/repo"
    assert s["commits_today"] == 5


def test_save_state_git_fields_none_omitted(tmp_path, monkeypatch):
    monkeypatch.setattr(sl, 'STATE_PATH', str(tmp_path / "state.json"))
    monkeypatch.setattr(sl, 'BASE_DIR', str(tmp_path))
    sl.save_state("hello", "normal", "afternoon")
    with open(str(tmp_path / "state.json")) as f:
        s = json.load(f)
    assert "last_git_events" not in s
    assert "last_repo" not in s
    assert "commits_today" not in s


# --- Phase 4 新测试: render 只读、session_start、--debug-events ---

def _setup_main_env(tmp_path, monkeypatch, argv=None, stdin_data='{}'):
    """共用 helper：设置 main() 所需的所有 monkeypatch。"""
    import io
    import core.character as char_mod

    config_path = tmp_path / "config.json"
    state_path = tmp_path / "state.json"
    vocab_path = tmp_path / "vocab"
    vocab_path.mkdir(exist_ok=True)

    write_json(str(config_path), {"character": "nova"})
    write_json(str(vocab_path / "nova.json"), SAMPLE_CHAR)

    monkeypatch.setattr(char_mod, 'VOCAB_DIR', str(vocab_path))
    monkeypatch.setattr(sl, 'CONFIG_PATH', str(config_path))
    monkeypatch.setattr(sl, 'STATE_PATH', str(state_path))
    monkeypatch.setattr(sl, 'STATS_PATH', str(tmp_path / "no.json"))
    monkeypatch.setattr(sl, 'BASE_DIR', str(tmp_path))
    monkeypatch.setattr(sys, 'argv', argv or ['statusline.py'])
    monkeypatch.setattr(sys, 'stdin', io.StringIO(stdin_data))

    # load_git_context 默认 mock（避免真实 subprocess）
    monkeypatch.setattr('statusline.load_git_context', lambda cwd: None)

    return state_path


def test_render_mode_does_not_write_state(tmp_path, monkeypatch):
    """STA-02: render 路径（无 --update）不调用 save_state，state.json 内容保持原样。"""
    state_path = _setup_main_env(tmp_path, monkeypatch, argv=['statusline.py'])
    initial_state = {
        "message": "old_msg",
        "last_updated": "old",
        "last_rate_tier": "normal",
        "last_slot": None,
    }
    write_json(str(state_path), initial_state)

    sl.main()

    with open(str(state_path)) as f:
        saved = json.load(f)
    assert saved["message"] == "old_msg", "render 模式不应修改 state.json 中的 message"


def test_save_state_session_start(tmp_path, monkeypatch):
    """D-03: save_state() 支持 session_start 参数并持久化到 state.json。"""
    monkeypatch.setattr(sl, 'STATE_PATH', str(tmp_path / "state.json"))
    monkeypatch.setattr(sl, 'BASE_DIR', str(tmp_path))
    sl.save_state("msg", "normal", "morning", session_start="2026-04-02T10:00:00")
    with open(str(tmp_path / "state.json")) as f:
        s = json.load(f)
    assert s["session_start"] == "2026-04-02T10:00:00"


def test_update_writes_session_start(tmp_path, monkeypatch):
    """D-02: --update 模式在 state.json 无 session_start 时写入今天的 ISO 时间戳。"""
    from datetime import datetime
    state_path = _setup_main_env(
        tmp_path, monkeypatch,
        argv=['statusline.py', '--update'],
        stdin_data='{}',
    )
    # state.json 无 session_start 字段
    write_json(str(state_path), {
        "message": "", "last_updated": "", "last_rate_tier": "normal", "last_slot": None,
    })
    monkeypatch.setattr(
        'statusline.load_git_context',
        lambda cwd: {"commits_today": 0, "diff_lines": 0, "repo_path": "/tmp/repo", "first_commit_time": None},
    )

    sl.main()

    with open(str(state_path)) as f:
        saved = json.load(f)
    assert "session_start" in saved
    today_str = datetime.now().strftime("%Y-%m-%d")
    assert today_str in saved["session_start"], f"session_start 应包含今天日期 {today_str}"


def test_update_preserves_session_start_same_day(tmp_path, monkeypatch):
    """D-02: 同天 session_start 不被覆盖。"""
    from datetime import datetime
    state_path = _setup_main_env(
        tmp_path, monkeypatch,
        argv=['statusline.py', '--update'],
        stdin_data='{}',
    )
    today_8am = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0).isoformat()
    write_json(str(state_path), {
        "message": "", "last_updated": "", "last_rate_tier": "normal", "last_slot": None,
        "session_start": today_8am,
    })
    monkeypatch.setattr(
        'statusline.load_git_context',
        lambda cwd: {"commits_today": 0, "diff_lines": 0, "repo_path": "/tmp/repo", "first_commit_time": None},
    )

    sl.main()

    with open(str(state_path)) as f:
        saved = json.load(f)
    assert saved["session_start"] == today_8am, "同天 session_start 不应被覆盖"


def test_update_resets_session_start_cross_day(tmp_path, monkeypatch):
    """D-02: 跨天时 session_start 被重置为今天的值。"""
    from datetime import datetime, timedelta
    state_path = _setup_main_env(
        tmp_path, monkeypatch,
        argv=['statusline.py', '--update'],
        stdin_data='{}',
    )
    yesterday = (datetime.now() - timedelta(days=1)).isoformat()
    write_json(str(state_path), {
        "message": "", "last_updated": "", "last_rate_tier": "normal", "last_slot": None,
        "session_start": yesterday,
    })
    monkeypatch.setattr(
        'statusline.load_git_context',
        lambda cwd: {"commits_today": 0, "diff_lines": 0, "repo_path": "/tmp/repo", "first_commit_time": None},
    )

    sl.main()

    with open(str(state_path)) as f:
        saved = json.load(f)
    today_str = datetime.now().strftime("%Y-%m-%d")
    assert today_str in saved["session_start"], "跨天后 session_start 应被重置为今天"


def test_debug_events_stderr_output(tmp_path, monkeypatch, capsys):
    """CFG-02: --debug-events 向 stderr 输出 GIT_CONTEXT / EVENTS_WOULD_FIRE / STATE_SNAPSHOT 三行。"""
    state_path = _setup_main_env(
        tmp_path, monkeypatch,
        argv=['statusline.py', '--debug-events'],
        stdin_data='{}',
    )
    write_json(str(state_path), {
        "message": "", "last_updated": "", "last_rate_tier": "normal", "last_slot": None,
    })
    monkeypatch.setattr(
        'statusline.load_git_context',
        lambda cwd: {"commits_today": 3, "diff_lines": 50, "repo_path": "/tmp/repo", "first_commit_time": None},
    )

    sl.main()

    captured = capsys.readouterr()
    assert "GIT_CONTEXT:" in captured.err
    assert "EVENTS_WOULD_FIRE:" in captured.err
    assert "STATE_SNAPSHOT:" in captured.err


def test_debug_events_no_stdout(tmp_path, monkeypatch, capsys):
    """CFG-02: --debug-events 不向 stdout 输出任何内容。"""
    state_path = _setup_main_env(
        tmp_path, monkeypatch,
        argv=['statusline.py', '--debug-events'],
        stdin_data='{}',
    )
    write_json(str(state_path), {
        "message": "", "last_updated": "", "last_rate_tier": "normal", "last_slot": None,
    })
    monkeypatch.setattr(
        'statusline.load_git_context',
        lambda cwd: {"commits_today": 3, "diff_lines": 50, "repo_path": "/tmp/repo", "first_commit_time": None},
    )

    sl.main()

    captured = capsys.readouterr()
    assert captured.out == "", "--debug-events 不应向 stdout 输出任何内容"
