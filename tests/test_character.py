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
