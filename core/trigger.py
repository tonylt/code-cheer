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


def resolve_message(
    character: dict,
    state: dict,
    stats: dict,
    cc_data: dict,
    force_post_tool: bool = False
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
