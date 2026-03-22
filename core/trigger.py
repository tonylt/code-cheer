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
