# @deprecated: use src/ TypeScript version
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


def _ctx_bar(pct: int, width: int = 10) -> str:
    """Build a block-character progress bar for the given percentage."""
    filled = max(0, min(width, round(pct / 100 * width)))
    return "█" * filled + "░" * (width - filled)


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
    """Format the 2-line statusline output (both lines left-aligned)."""
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

    cwd_name = stats.get("cwd_name", "")
    tokens = format_tokens(stats.get("today_tokens"))

    ctx = cc_data.get("context_window", {})
    ctx_pct = ctx.get("used_percentage")

    parts = [model]
    if cwd_name:
        parts.append(cwd_name)
    parts.append(f"{tokens} tokens")
    if ctx_pct is not None:
        bar = _ctx_bar(int(ctx_pct))
        parts.append(f"[{bar}] {ctx_pct}%")

    line2 = " | ".join(parts)
    return f"{line1}\n{line2}"
