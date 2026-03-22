#!/usr/bin/env python3
# statusline.py
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.character import load_character
from core.trigger import resolve_message, get_time_slot
from core.display import render

BASE_DIR = os.path.join(os.path.expanduser("~"), ".claude", "code-cheer")
CONFIG_PATH = os.path.join(BASE_DIR, "config.json")
STATE_PATH = os.path.join(BASE_DIR, "state.json")
STATS_PATH = os.path.join(os.path.expanduser("~"), ".claude", "stats-cache.json")

_EMPTY_STATE = {
    "message": "",
    "last_updated": "",
    "last_rate_tier": "normal",
    "last_slot": None,
}


def load_config() -> dict:
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"character": "nova"}


def load_state() -> dict:
    try:
        with open(STATE_PATH, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return dict(_EMPTY_STATE)


def load_stats() -> dict:
    try:
        with open(STATS_PATH, "r") as f:
            data = json.load(f)
        today = datetime.now().strftime("%Y-%m-%d")
        for entry in data.get("dailyModelTokens", []):
            if entry.get("date") == today:
                total = sum(entry.get("tokensByModel", {}).values())
                return {"today_tokens": total}
        return {"today_tokens": "N/A"}  # today not in file yet
    except (FileNotFoundError, json.JSONDecodeError):
        return {"today_tokens": "N/A"}


def read_stdin_json() -> dict:
    try:
        raw = sys.stdin.read().strip()
        if raw:
            return json.loads(raw)
    except Exception:
        pass
    return {}


def save_state(message: str, tier: str, slot: str) -> None:
    os.makedirs(BASE_DIR, exist_ok=True)
    state = {
        "message": message,
        "last_updated": datetime.now().isoformat(),
        "last_rate_tier": tier,
        "last_slot": slot,
    }
    with open(STATE_PATH, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def main():
    update_only = "--update" in sys.argv

    config = load_config()
    state = load_state()
    stats = load_stats()
    cc_data = read_stdin_json()

    try:
        character = load_character(config.get("character", "nova"))
    except FileNotFoundError:
        character = load_character("nova")

    message, tier = resolve_message(
        character, state, stats, cc_data, force_post_tool=update_only
    )

    if message != state.get("message") or tier != state.get("last_rate_tier"):
        save_state(message, tier, slot=get_time_slot())

    if update_only:
        return

    print(render(character, message, cc_data, stats))


if __name__ == "__main__":
    main()
