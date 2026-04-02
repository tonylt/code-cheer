import random
from datetime import datetime


def get_tier(used_pct: float) -> str:
    """Return rate limit tier based on usage percentage."""
    if used_pct >= 95:
        return "critical"
    elif used_pct >= 80:
        return "warning"
    return "normal"


def get_time_slot() -> str:
    """Return current time slot: morning/afternoon/evening/midnight."""
    hour = datetime.now().hour
    if 6 <= hour <= 11:
        return "morning"
    elif 12 <= hour <= 17:
        return "afternoon"
    elif 18 <= hour <= 22:
        return "evening"
    return "midnight"


def pick(options: list) -> str:
    """Pick a random item from a list."""
    return random.choice(options)


def pick_different(options: list, last: str) -> str:
    """Pick a random item that differs from last. Falls back to any item if only one."""
    if len(options) <= 1:
        return options[0] if options else ""
    filtered = [o for o in options if o != last]
    return random.choice(filtered) if filtered else random.choice(options)


def cache_expired(last_updated: str, minutes: int = 5) -> bool:
    """Return True if last_updated is older than `minutes` ago, or missing."""
    if not last_updated:
        return True
    try:
        dt = datetime.fromisoformat(last_updated)
        delta = (datetime.now() - dt).total_seconds()
        return delta > minutes * 60
    except (ValueError, TypeError):
        return True


def detect_git_events(git_context: dict, state: dict, config: dict) -> list[str]:
    """Detect triggered git events and return sorted by priority (highest first).

    Args:
        git_context: dict from load_git_context() with commits_today, diff_lines, repo_path
        state: dict from state.json with last_git_events, last_repo, session_start
        config: dict from config.json with optional event_thresholds

    Returns:
        List of triggered event keys, e.g. ["milestone_10", "big_diff"].
        Empty list if no events triggered.
    """
    thresholds = config.get("event_thresholds", {})
    big_diff_threshold = thresholds.get("big_diff", 200)
    milestone_counts = thresholds.get("milestone_counts", [5, 10, 20])
    big_session_minutes = thresholds.get("big_session_minutes", 120)
    long_day_commits = thresholds.get("long_day_commits", 15)
    late_night_hour = thresholds.get("late_night_hour_start", 22)

    # Per-repo isolation (D-05): logical reset when repo changes
    current_repo = git_context.get("repo_path")
    last_repo = state.get("last_repo")
    if current_repo is not None and current_repo != last_repo:
        effective_last_events: list = []
    else:
        raw = state.get("last_git_events", [])
        effective_last_events = raw if isinstance(raw, list) else []

    commits_today: int = git_context.get("commits_today", 0)
    diff_lines: int = git_context.get("diff_lines", 0)

    events: list[str] = []

    # Priority 1: milestones — highest to lowest, independent dedup (D-08)
    for count in sorted(milestone_counts, reverse=True):
        key = f"milestone_{count}"
        if commits_today >= count and key not in effective_last_events:
            events.append(key)

    # Priority 2: late_night_commit (D-03, D-07)
    if commits_today > 0 and datetime.now().hour >= late_night_hour:
        if "late_night_commit" not in effective_last_events:
            events.append("late_night_commit")

    # Priority 3: big_diff (D-07)
    if diff_lines >= big_diff_threshold and "big_diff" not in effective_last_events:
        events.append("big_diff")

    # Priority 4: big_session — safe skip if session_start missing (D-07)
    session_start = state.get("session_start")
    if session_start:
        try:
            start_dt = datetime.fromisoformat(session_start)
            elapsed_minutes = (datetime.now() - start_dt).total_seconds() / 60
            if elapsed_minutes >= big_session_minutes and "big_session" not in effective_last_events:
                events.append("big_session")
        except (ValueError, TypeError):
            pass

    # Priority 5: long_day (D-07)
    if commits_today >= long_day_commits and "long_day" not in effective_last_events:
        events.append("long_day")

    # Priority 6: first_commit_today (D-06)
    if commits_today > 0 and "first_commit_today" not in effective_last_events:
        events.append("first_commit_today")

    return events


def resolve_message(
    character: dict,
    state: dict,
    stats: dict,
    cc_data: dict,
    force_post_tool: bool = False,
    triggered_events: list | None = None
) -> tuple:
    """Select the appropriate message and return (message, tier)."""
    rate_limits = cc_data.get("rate_limits", {})
    used_pct = rate_limits.get("five_hour", {}).get("used_percentage", 0)
    tier = get_tier(used_pct)

    triggers = character["triggers"]
    last_tier = state.get("last_rate_tier", "normal")

    # Priority 1: usage tier change
    if tier != last_tier:
        if tier != "normal":
            return pick(triggers["usage"][tier]), tier
        # Dropped back to normal — fall through to normal priorities

    # Alert persistence: same non-normal tier → keep current alert message
    if tier != "normal" and tier == last_tier:
        return state.get("message", ""), tier

    # Priority 2: post_tool forced (--update mode)
    if force_post_tool:
        if triggered_events:
            event_key = triggered_events[0]
            git_events_vocab = character.get("git_events", {})
            options = git_events_vocab.get(event_key, triggers["post_tool"])
            return pick_different(options, state.get("message", "")), tier
        return pick_different(triggers["post_tool"], state.get("message", "")), tier

    # Priority 3: cache still fresh
    if not cache_expired(state.get("last_updated", ""), minutes=5):
        return state.get("message", ""), tier

    # Priority 4: time slot changed
    slot = get_time_slot()
    if slot != state.get("last_slot"):
        return pick(triggers["time"][slot]), tier

    # Priority 5: random fallback (avoid repeating last)
    return pick_different(triggers["random"], state.get("message", "")), tier
