# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**None** — the project makes no outbound network calls and uses no external APIs or third-party services.

## Claude Code Host Integration

**Primary integration point — Claude Code application:**

The project integrates with Claude Code via two mechanisms patched into `~/.claude/settings.json` by `install.sh`:

- **statusLine command**: Claude Code polls this to render the status bar.
  - Command: `python3 ~/.claude/code-cheer/statusline.py`
  - Claude Code passes session context as JSON on stdin (model name, `rate_limits`, `context_window`).
  - Script reads the JSON, renders output, and prints two lines to stdout.

- **Stop hook**: Fires after each Claude response completes.
  - Command: `python3 ~/.claude/code-cheer/statusline.py --update`
  - Claude Code passes the same session JSON on stdin.
  - Script picks a new message and writes `state.json`; produces no stdout output.

**Inbound data schema from Claude Code (stdin JSON):**
```json
{
  "model": "claude-sonnet-4-6",
  "rate_limits": {
    "five_hour": {
      "used_percentage": 32.5,
      "resets_at": 1712345678
    },
    "seven_day": {
      "used_percentage": 10.1
    }
  },
  "context_window": {
    "used_percentage": 45,
    "total_input_tokens": 12000,
    "total_output_tokens": 3000
  }
}
```

Consumed in `statusline.py:read_stdin_json()` and threaded through to `core/trigger.py` and `core/display.py`.

## Data Sources

**Local filesystem (read):**
- `~/.claude/code-cheer/config.json` — active character name; read by `statusline.py:load_config()`
- `~/.claude/code-cheer/state.json` — last message, tier, slot, timestamp; read by `statusline.py:load_state()`
- `~/.claude/stats-cache.json` — daily token totals written by Claude Code; read by `statusline.py:load_stats()`; field path: `dailyModelTokens[*].tokensByModel`
- `~/.claude/code-cheer/vocab/*.json` — character dialogue JSON files; read by `core/character.py:load_character()`

**Local filesystem (write):**
- `~/.claude/code-cheer/state.json` — updated by `statusline.py:save_state()` on every `--update` invocation

**No databases, no remote data sources.**

## Authentication

**None** — no auth providers, tokens, or credentials. All data is local files.

## Messaging & Events

**Event source: Claude Code Stop hook**
- Claude Code fires the Stop hook after each response; this is the only event trigger.
- No message queues, pub/sub, or webhooks involved.
- Communication is one-directional: Claude Code → `statusline.py --update` via subprocess stdin.

**statusLine polling**
- Claude Code polls `statusline.py` (render mode) on its own schedule to refresh the status bar.
- Script reads `state.json` written by the Stop hook and formats output for display.

## Monitoring & Observability

**Logging:** None — no logging framework used. Errors are silently swallowed via broad `except Exception: pass` guards in `statusline.py:read_stdin_json()` and the stats/config/state loaders.

**Error tracking:** None.

**Metrics:** None beyond what Claude Code itself tracks in `~/.claude/stats-cache.json`.

## CI/CD & Deployment

**Hosting:** Local machine only — installed to `~/.claude/code-cheer/` via `install.sh`.

**CI Pipeline:** Not detected — no GitHub Actions, CI config files, or test automation beyond `pytest`.

**Deployment mechanism:**
1. `./install.sh` — copies `statusline.py`, `core/`, `vocab/` to `~/.claude/code-cheer/`; patches `~/.claude/settings.json`; installs `/cheer` slash command to `~/.claude/commands/cheer.md`
2. `./install.sh --uninstall` — reverses all changes; backs up `settings.json` before modification

---

*Integration audit: 2026-04-01*
