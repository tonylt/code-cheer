# @deprecated: use src/ TypeScript version
import os, sys, json, pytest
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.character import load_character, get_git_event_message

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
        },
        "git_events": {
            "first_commit_today": ["gc1", "gc2", "gc3"],
            "milestone_5": ["m5a", "m5b", "m5c"]
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


def test_get_git_event_message_returns_string():
    c = load_character("nova")
    result = get_git_event_message(c, "first_commit_today")
    assert isinstance(result, str)
    assert result in ["gc1", "gc2", "gc3"]


def test_get_git_event_message_unknown_key_returns_none():
    c = load_character("nova")
    assert get_git_event_message(c, "nonexistent_event") is None


def test_get_git_event_message_no_git_events_section():
    vocab_no_git = {"meta": {}, "triggers": {"post_tool": ["p1"]}}
    assert get_git_event_message(vocab_no_git, "first_commit_today") is None
