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
