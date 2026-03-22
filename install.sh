#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/.claude/code-cheer"
SETTINGS="$HOME/.claude/settings.json"
COMMANDS_DIR="$HOME/.claude/commands"
SCRIPT_PATH="$INSTALL_DIR/statusline.py"
UPDATE_CMD="python3 $SCRIPT_PATH --update"
STATUS_CMD="python3 $SCRIPT_PATH"

# ── helpers ──────────────────────────────────────────────────────────────────
info()  { echo "  $*"; }
ok()    { echo "✓ $*"; }
warn()  { echo "⚠ $*"; }
die()   { echo "✗ $*" >&2; exit 1; }

# ── uninstall ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
  echo "Uninstalling Code Cheer…"

  if [[ -f "$SETTINGS" ]]; then
    python3 - "$SETTINGS" "$SCRIPT_PATH" <<'PYEOF'
import json, sys, shutil, os
path, script = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
shutil.copy2(path, path + ".bak")
# Remove statusLine only if it points to our script
sl = data.get("statusLine", {})
if isinstance(sl, dict) and script in sl.get("command", ""):
    del data["statusLine"]
# Remove our PostToolUse hook entry
hooks = data.get("hooks", {})
ptu = hooks.get("PostToolUse", [])
new_ptu = [h for h in ptu if not (isinstance(h, dict) and script in h.get("command", ""))]
if new_ptu != ptu:
    hooks["PostToolUse"] = new_ptu
    if not new_ptu:
        del hooks["PostToolUse"]
if not hooks:
    data.pop("hooks", None)
tmp = path + ".tmp"
with open(tmp, "w") as f:
    json.dump(data, f, indent=2)
os.replace(tmp, path)
PYEOF
    ok "settings.json cleaned"
  fi

  rm -f "$COMMANDS_DIR/cheer.md" && ok "Removed cheer.md"
  rm -rf "$INSTALL_DIR" && ok "Removed $INSTALL_DIR"

  if [[ -f "$SETTINGS.bak" ]]; then
    warn "Backup exists at $SETTINGS.bak — restore manually if needed"
  fi

  echo ""
  echo "(*>ω<) Nova: 再见啦！有空再来冲冲冲！！"
  exit 0
fi

# ── install ───────────────────────────────────────────────────────────────────
echo "Installing Code Cheer…"
echo ""

# 1. Check Python 3
python3 --version > /dev/null 2>&1 || die "Python 3 is required but not found"
ok "Python 3 found"

# 2. Create install dir
mkdir -p "$INSTALL_DIR"
ok "Created $INSTALL_DIR"

# 3. Copy files
cp "$REPO_DIR/statusline.py" "$INSTALL_DIR/"
cp -r "$REPO_DIR/core" "$INSTALL_DIR/"
cp -r "$REPO_DIR/vocab" "$INSTALL_DIR/"
ok "Copied scripts and vocab"

# 4. Write default config (skip if exists)
if [[ ! -f "$INSTALL_DIR/config.json" ]]; then
  echo '{"character": "nova"}' > "$INSTALL_DIR/config.json"
  ok "Created default config (Nova)"
else
  info "Config already exists, skipping"
fi

# 5. Write empty state (always reset — clears stale message/tier on upgrade)
echo '{"message":"","last_updated":"","last_rate_tier":"normal","last_slot":null}' \
  > "$INSTALL_DIR/state.json"
ok "Initialized state"

# 6. Merge settings.json
mkdir -p "$(dirname "$SETTINGS")"
python3 - "$SETTINGS" "$STATUS_CMD" "$UPDATE_CMD" <<'PYEOF'
import json, os, sys, shutil

settings_path = sys.argv[1]
status_cmd    = sys.argv[2]
update_cmd    = sys.argv[3]

# Load or create
if os.path.exists(settings_path):
    shutil.copy2(settings_path, settings_path + ".bak")
    with open(settings_path) as f:
        data = json.load(f)
    print(f"  Backed up settings.json → settings.json.bak")
else:
    data = {}

# statusLine
if "statusLine" in data:
    print(f"⚠ statusLine already configured — skipping (won't overwrite)")
else:
    data["statusLine"] = {"type": "command", "command": status_cmd}
    print(f"✓ Added statusLine")

# hooks.PostToolUse
hooks = data.setdefault("hooks", {})
ptu   = hooks.setdefault("PostToolUse", [])
if not any(isinstance(h, dict) and update_cmd in h.get("command", "") for h in ptu):
    ptu.append({"command": update_cmd})
    print(f"✓ Added PostToolUse hook")
else:
    print(f"  PostToolUse hook already present, skipping")

tmp = settings_path + ".tmp"
with open(tmp, "w") as f:
    json.dump(data, f, indent=2)
os.replace(tmp, settings_path)
PYEOF

# 7. Copy cheer command
mkdir -p "$COMMANDS_DIR"
cp "$REPO_DIR/commands/cheer.md" "$COMMANDS_DIR/cheer.md"
ok "Installed /cheer command"

# 8. Done
echo ""
echo "(*>ω<) Nova: 安装完成！准备好了吗！冲冲冲！！"
echo ""
echo "  Restart Claude Code to activate the statusline."
echo "  Switch characters with: /cheer"
