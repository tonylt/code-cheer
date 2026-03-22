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


def format_resets(resets_at):
    """Format Unix timestamp or ISO string into relative '3h20m' or '45m'. Returns None if past or invalid."""
    if not resets_at:
        return None
    try:
        # Unix timestamp (int or float)
        ts = float(resets_at)
        now = datetime.now(timezone.utc).timestamp()
        delta_secs = ts - now
    except (ValueError, TypeError):
        # ISO string fallback
        try:
            reset_dt = datetime.fromisoformat(str(resets_at).replace("Z", "+00:00"))
            now_dt = datetime.now(timezone.utc)
            delta_secs = (reset_dt - now_dt).total_seconds()
        except (ValueError, TypeError, AttributeError):
            return None
    if delta_secs <= 0:
        return None
    total_minutes = round(delta_secs / 60)
    hours, minutes = divmod(total_minutes, 60)
    if hours > 0:
        return f"{hours}h{minutes:02d}m"
    return f"{minutes}m"


def render(character: dict, message: str, cc_data: dict, stats: dict) -> str:
    """Format the 2-line statusline output."""
    ascii_face = character["meta"]["ascii"]
    name = character["meta"]["name"]
    color = character["meta"].get("color", "")
    raw_line1 = f"{ascii_face} {name}: {message}"
    line1 = f"\033[{color}m{raw_line1}\033[0m" if color else raw_line1

    model_raw = cc_data.get("model", "unknown")
    if isinstance(model_raw, dict):
        model = model_raw.get("display_name", model_raw.get("id", "unknown"))
    else:
        model = str(model_raw)
    model = model.replace("claude-", "")

    tokens = format_tokens(stats.get("today_tokens"))

    rate_limits = cc_data.get("rate_limits", {})
    five_hour = rate_limits.get("five_hour", {})
    seven_day = rate_limits.get("seven_day", {})
    five_pct = five_hour.get("used_percentage")
    seven_pct = seven_day.get("used_percentage")
    five_resets = format_resets(five_hour.get("resets_at"))

    ctx = cc_data.get("context_window", {})
    ctx_pct = ctx.get("used_percentage")

    parts = [model, f"{tokens} tokens"]
    if five_pct is not None:
        five_str = f"5h {five_pct:.1f}%"
        if five_resets:
            five_str += f" ↺{five_resets}"
        parts.append(five_str)
    if seven_pct is not None:
        parts.append(f"7d {seven_pct:.1f}%")
    if ctx_pct is not None:
        parts.append(f"ctx {ctx_pct}%")

    line2 = " | ".join(parts)
    return f"{line1}\n{line2}"
