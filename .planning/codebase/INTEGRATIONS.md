# External Integrations

**Analysis Date:** 2026-04-01

## APIs & External Services

**None** — the project makes no outbound network calls and uses no external APIs or third-party services.

## Claude Code Host Integration

**Primary integration point — Claude Code application:**

The project integrates with Claude Code via two mechanisms patched into `~/.claude/settings.json` by `install.sh`:

**statusLine command** — Claude Code polls this to render the status bar:
- Command registered: `python3 ~/.claude/code-pal/statusline.py`
- Claude Code passes session context as JSON on stdin
- Script reads the JSON, formats a 2-line string, and prints to stdout
- Render path in `statusline.py:main()` (render mode, no `--update` arg)

**Stop hook** — fires after each Claude response completes:
- Command registered: `python3 ~/.claude/code-pal/statusline.py --update`
- Claude Code passes the same session JSON on stdin
- Script picks a new message, writes `~/.claude/code-pal/state.json`, produces no stdout
- Update path in `statusline.py:main()` (`--update` mode)

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

Consumed in `statusline.py:read_stdin_json()` and threaded through to `core/trigger.py:resolve_message()` and `core/display.py:render()`.

**settings.json structure written by install.sh:**
```json
{
  "statusLine": {
    "type": "command",
    "command": "python3 ~/.claude/code-pal/statusline.py"
  },
  "hooks": {
    "Stop": [{"hooks": [{"type": "command", "command": "python3 ~/.claude/code-pal/statusline.py --update"}]}]
  }
}
```

## Data Sources

**Local filesystem (read):**
- `~/.claude/code-pal/config.json` — active character name; read by `statusline.py:load_config()`
- `~/.claude/code-pal/state.json` — last message, tier, slot, timestamp; read by `statusline.py:load_state()`
- `~/.claude/stats-cache.json` — daily token totals written by Claude Code; read by `statusline.py:load_stats()`; path into structure: `dailyModelTokens[*].tokensByModel` (summed per day)
- `~/.claude/code-pal/vocab/*.json` — character dialogue files (`nova.json`, `luna.json`, `mochi.json`, `iris.json`); read by `core/character.py:load_character()`

**Local filesystem (write):**
- `~/.claude/code-pal/state.json` — updated by `statusline.py:save_state()` on every `--update` invocation

**No databases, no remote data sources.**

## Authentication

**None** — no auth providers, tokens, API keys, or credentials. All data is local files only.

## Messaging & Events

**Event source: Claude Code Stop hook**
- Claude Code fires the Stop hook after each response; the only external event trigger.
- No message queues, pub/sub, or webhooks.
- Communication is one-directional: Claude Code → `statusline.py --update` via subprocess stdin.

**statusLine polling:**
- Claude Code polls `statusline.py` (render mode) on its own schedule to refresh the status bar.
- Script reads `state.json` written by the Stop hook and formats output for display.

## Monitoring & Observability

**Logging:** None — no logging framework. Errors are silently swallowed via broad `except Exception: pass` guards in `statusline.py:read_stdin_json()` and all three loader functions (`load_config`, `load_state`, `load_stats`).

**Error tracking:** None.

**Metrics:** None beyond what Claude Code itself tracks in `~/.claude/stats-cache.json`.

## CI/CD & Deployment

**Hosting:** Local machine only — installed to `~/.claude/code-pal/` via `install.sh`.

**CI Pipeline:** None detected — no GitHub Actions workflows, CI config files, or test automation scripts beyond running `pytest` manually.

**Deployment mechanism:**
1. `./install.sh` — copies `statusline.py`, `core/`, `vocab/` to `~/.claude/code-pal/`; writes default `config.json` and blank `state.json`; patches `~/.claude/settings.json` non-destructively; copies `commands/cheer.md` to `~/.claude/commands/`
2. `./install.sh --uninstall` — reverses all changes; backs up `settings.json` to `settings.json.bak` before modification

## Slash Command Integration

**`/cheer` custom command:**
- Installed to `~/.claude/commands/cheer.md` by `install.sh`
- Source: `commands/cheer.md` in repo
- Allows users to switch active character from within Claude Code

---

*Integration audit: 2026-04-01*
