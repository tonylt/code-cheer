#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="$HOME/.claude/code-cheer"
SETTINGS="$HOME/.claude/settings.json"
COMMANDS_DIR="$HOME/.claude/commands"
SCRIPT_PATH="$INSTALL_DIR/statusline.py"

# Resolve a Python 3.10+ interpreter (python3 may point to an older version)
_resolve_python() {
  for _bin in python3 python3.13 python3.12 python3.11 python3.10; do
    if command -v "$_bin" > /dev/null 2>&1; then
      if "$_bin" -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)" 2>/dev/null; then
        echo "$_bin"
        return 0
      fi
    fi
  done
  return 1
}
PYTHON3_BIN=$(_resolve_python) \
  || die "Python 3.10+ is required but not found. Install from https://python.org (macOS: brew install python3)"

UPDATE_CMD="$PYTHON3_BIN $SCRIPT_PATH --update"
STATUS_CMD="$PYTHON3_BIN $SCRIPT_PATH"

# ── helpers ──────────────────────────────────────────────────────────────────
info()  { echo "  $*"; }
ok()    { echo "✓ $*"; }
warn()  { echo "⚠ $*"; }
die()   { echo "✗ $*" >&2; exit 1; }

# ── uninstall ─────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
  echo "Uninstalling code-cheer…"

  if [[ -f "$SETTINGS" ]]; then
    "$PYTHON3_BIN" - "$SETTINGS" "$SCRIPT_PATH" <<'PYEOF'
import json, sys, shutil, os
path, script = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
shutil.copy2(path, path + ".bak")
# Restore previous statusLine from backup, or remove if we owned it
backup_file = os.path.expanduser("~/.claude/code-cheer/statusline-backup.json")
if os.path.exists(backup_file):
    with open(backup_file, "r") as bf:
        backup = json.load(bf)
    if "statusLine" in backup:
        data["statusLine"] = backup["statusLine"]
        print("restored previous statusLine from backup", file=sys.stderr)
    os.remove(backup_file)
else:
    # No backup, remove statusLine only if it points to our script
    sl = data.get("statusLine", {})
    if isinstance(sl, dict) and script in sl.get("command", ""):
        del data["statusLine"]
# Remove our Stop hook entry
hooks = data.get("hooks", {})
stop = hooks.get("Stop", [])
def has_script(h):
    if not isinstance(h, dict): return False
    if script in h.get("command", ""): return True
    return any(script in hook.get("command", "") for hook in h.get("hooks", []))
new_stop = [h for h in stop if not has_script(h)]
if new_stop != stop:
    hooks["Stop"] = new_stop
    if not new_stop:
        del hooks["Stop"]
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
echo "Installing code-cheer…"
echo ""

# 1. Check Python 3.10+ (already resolved above) and git
ok "$($PYTHON3_BIN --version) found"
command -v git > /dev/null 2>&1 || die "git is required but not found. Install git first."
ok "git found"

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

# statusLine - backup existing and set code-cheer
backup_file = os.path.expanduser("~/.claude/code-cheer/statusline-backup.json")
if "statusLine" in data and data["statusLine"]:
    # 备份现有配置
    with open(backup_file, "w") as bf:
        json.dump({"statusLine": data["statusLine"]}, bf, indent=2)
    print(f"⚠ Existing statusLine backed up to: {backup_file}")
    print(f"  code-cheer requires exclusive statusLine access to function")
    print(f"  Previous config will be restored on uninstall")

data["statusLine"] = {"type": "command", "command": status_cmd}
print(f"✓ Set code-cheer statusLine")

# hooks.Stop
hooks = data.setdefault("hooks", {})
stop  = hooks.setdefault("Stop", [])
def has_update_cmd(h):
    if not isinstance(h, dict): return False
    if update_cmd in h.get("command", ""): return True
    return any(update_cmd in hook.get("command", "") for hook in h.get("hooks", []))
if not any(has_update_cmd(h) for h in stop):
    stop.append({"hooks": [{"type": "command", "command": update_cmd}]})
    print(f"✓ Added Stop hook")
else:
    print(f"  Stop hook already present, skipping")

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
