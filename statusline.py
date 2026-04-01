#!/usr/bin/env python3
# statusline.py
import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.character import load_character
from core.git_context import load_git_context
from core.trigger import resolve_message, get_time_slot, detect_git_events
from core.display import render

BASE_DIR = os.path.join(os.path.expanduser("~"), ".claude", "code-pal")
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


def save_state(
    message: str,
    tier: str,
    slot: str,
    last_git_events: list | None = None,
    last_repo: str | None = None,
    commits_today: int | None = None,
) -> None:
    os.makedirs(BASE_DIR, exist_ok=True)
    state = {
        "message": message,
        "last_updated": datetime.now().isoformat(),
        "last_rate_tier": tier,
        "last_slot": slot,
    }
    if last_git_events is not None:
        state["last_git_events"] = last_git_events
    if last_repo is not None:
        state["last_repo"] = last_repo
    if commits_today is not None:
        state["commits_today"] = commits_today
    tmp_path = STATE_PATH + ".tmp"
    with open(tmp_path, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, STATE_PATH)


def main():
    update_only = "--update" in sys.argv

    config = load_config()
    state = load_state()
    stats = load_stats()
    cc_data = read_stdin_json()

    # Supplement missing token data from cc_data when stats-cache has no entry for today
    if stats.get("today_tokens") in (None, "N/A"):
        ctx = cc_data.get("context_window", {})
        total = ctx.get("total_input_tokens", 0) + ctx.get("total_output_tokens", 0)
        if total > 0:
            stats["today_tokens"] = total

    git_context = None
    triggered_events = None
    if update_only:
        git_context = load_git_context(os.getcwd())
        triggered_events = detect_git_events(git_context, state, config)

    try:
        character = load_character(config.get("character", "nova"))
    except FileNotFoundError:
        try:
            character = load_character("nova")
        except FileNotFoundError:
            print("(*>ω<) Nova: 加油！今天也要好好编程！\nunknown | N/A tokens")
            return

    slot = get_time_slot()
    message, tier = resolve_message(
        character, state, stats, cc_data,
        force_post_tool=update_only,
        triggered_events=triggered_events,
    )

    # Compute git state for persistence (update mode only)
    new_last_git_events = None
    new_last_repo = None
    new_commits_today = None
    if update_only and git_context is not None:
        current_repo = git_context.get("repo_path")
        # Recompute effective_last_events (symmetric with detect_git_events logic)
        if current_repo is not None and current_repo != state.get("last_repo"):
            base_events: list = []
        else:
            raw = state.get("last_git_events", [])
            base_events = raw if isinstance(raw, list) else []
        # Append newly triggered events to base (avoid duplicates)
        new_last_git_events = list(base_events) + [
            e for e in (triggered_events or []) if e not in base_events
        ]
        new_last_repo = current_repo if current_repo is not None else state.get("last_repo")
        new_commits_today = git_context.get("commits_today", 0)

    if update_only and new_last_git_events is not None:
        # Always persist git state in update mode (git events accumulate)
        if message != state.get("message") or tier != state.get("last_rate_tier"):
            save_state(
                message, tier, slot=slot,
                last_git_events=new_last_git_events,
                last_repo=new_last_repo,
                commits_today=new_commits_today,
            )
        else:
            save_state(
                state.get("message", ""), state.get("last_rate_tier", "normal"), slot=slot,
                last_git_events=new_last_git_events,
                last_repo=new_last_repo,
                commits_today=new_commits_today,
            )
    elif message != state.get("message") or tier != state.get("last_rate_tier"):
        save_state(message, tier, slot=slot)

    if update_only:
        return

    print(render(character, message, cc_data, stats))


if __name__ == "__main__":
    main()
