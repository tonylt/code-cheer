import json
import os

from core.trigger import pick

VOCAB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vocab')


def load_character(name: str) -> dict:
    """Load character meta and vocab from vocab/{name}.json."""
    path = os.path.join(VOCAB_DIR, f'{name}.json')
    if not os.path.exists(path):
        raise FileNotFoundError(f"Character '{name}' not found at {path}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_git_event_message(vocab: dict, event_key: str) -> str | None:
    """Get a random git event message for event_key, or None if not found.

    Args:
        vocab: Character vocab dict (from load_character())
        event_key: Git event key (e.g. 'first_commit_today', 'milestone_5')

    Returns:
        Random message string, or None if git_events section missing or key not found.
    """
    events = vocab.get("git_events", {})
    messages = events.get(event_key, [])
    return pick(messages) if messages else None
