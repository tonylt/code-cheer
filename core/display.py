# core/display.py
from datetime import datetime, timezone


def format_tokens(token_count) -> str:
    """Format token count: 47768 → '47k', 500 → '500', None → 'N/A'."""
    if token_count is None or token_count == "N/A":
        return "N/A"
    try:
        n = int(token_count)
    except (ValueError, TypeError):
        return "N/A"
    if n >= 1000:
        return f"{n // 1000}k"
    return str(n)


def format_resets(resets_at: str):
    """Format ISO UTC timestamp into relative '3h20m' or '45m'. Returns None if past or invalid."""
    if not resets_at:
        return None
    try:
        reset_dt = datetime.fromisoformat(resets_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta_secs = (reset_dt - now).total_seconds()
        if delta_secs <= 0:
            return None
        total_minutes = round(delta_secs / 60)
        hours, minutes = divmod(total_minutes, 60)
        if hours > 0:
            return f"{hours}h{minutes:02d}m"
        return f"{minutes}m"
    except (ValueError, TypeError, AttributeError):
        return None


def render(character: dict, message: str, cc_data: dict, stats: dict) -> str:
    """Format the 2-line statusline output."""
    ascii_face = character["meta"]["ascii"]
    name = character["meta"]["name"]
    line1 = f"{ascii_face} {name}: {message}"

    model = cc_data.get("model", "unknown").replace("claude-", "")
    tokens = format_tokens(stats.get("today_tokens"))
    rate_limits = cc_data.get("rate_limits", {})
    pct = rate_limits.get("used_percentage")
    resets = format_resets(rate_limits.get("resets_at"))

    parts = [model, f"{tokens} tokens"]
    if pct is not None:
        parts.append(f"用量 {pct}%")
    if resets:
        parts.append(f"resets in {resets}")
    line2 = " | ".join(parts)

    return f"{line1}\n{line2}"
