'use strict'
// scripts/uninstall.js
// Node.js uninstall script for code-pal v3.0.
// Usage: npm run unsetup
// Exports unpatchSettings for testing.

const fs = require('fs')
const path = require('path')
const os = require('os')

const INSTALL_DIR = path.join(os.homedir(), '.claude', 'code-pal')
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')

// ── helpers ──────────────────────────────────────────────────────────────────
function ok(msg)   { console.log('✓ ' + msg) }
function warn(msg) { console.log('⚠ ' + msg) }

// ── unpatchSettings ───────────────────────────────────────────────────────────
// Accepts optional overrides for testing.
// opts: { settingsPath, installDir }
function unpatchSettings(opts) {
  const settingsPath = (opts && opts.settingsPath) || SETTINGS_PATH
  const installDir   = (opts && opts.installDir)   || INSTALL_DIR

  if (!fs.existsSync(settingsPath)) return

  const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  fs.copyFileSync(settingsPath, settingsPath + '.bak')

  // Restore statusLine from backup or remove if ours
  const backupFile = path.join(installDir, 'statusline-backup.json')
  if (fs.existsSync(backupFile)) {
    const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
    if (backup.statusLine) {
      data.statusLine = backup.statusLine
    }
    fs.rmSync(backupFile)
    ok('Restored previous statusLine from backup')
  } else {
    const sl = data.statusLine || {}
    if (sl.command && (sl.command.includes('statusline.js') || sl.command.includes('statusline.py'))) {
      delete data.statusLine
    }
  }

  // Remove Stop hooks referencing statusline.js (not .py — uninstall only removes Node entries)
  const hooks = data.hooks || {}
  const stop = Array.isArray(hooks.Stop) ? hooks.Stop : []

  const cleaned = stop.filter(function (h) {
    if (!h || typeof h !== 'object') return true
    const topCmd = (h.command) || ''
    const innerCmds = Array.isArray(h.hooks)
      ? h.hooks.map(function (ih) { return (ih && ih.command) || '' })
      : []
    const allCmds = [topCmd].concat(innerCmds)
    return !allCmds.some(function (c) { return c.includes('statusline.js') })
  })

  // Clean empty Stop array
  if (cleaned.length === 0) {
    delete hooks.Stop
  } else {
    hooks.Stop = cleaned
  }

  // Clean empty hooks object
  if (Object.keys(hooks).length === 0) {
    delete data.hooks
  } else {
    data.hooks = hooks
  }

  // Atomic write
  const tmp = settingsPath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, settingsPath)
  ok('settings.json cleaned')

  // Remove dist/
  const distDir = path.join(installDir, 'dist')
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true })
    ok('Removed dist/')
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('Uninstalling code-pal…')
  console.log()

  unpatchSettings()

  console.log()
  console.log('(*>ω<) Nova: 再见啦！有空再来冲冲冲！！')
  console.log()
  if (fs.existsSync(SETTINGS_PATH + '.bak')) {
    warn('Backup exists at ' + SETTINGS_PATH + '.bak — restore manually if needed')
  }
}

// ── exports (for testing) ─────────────────────────────────────────────────────
module.exports = { unpatchSettings }

if (require.main === module) {
  main()
}
