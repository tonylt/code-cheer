'use strict'
// scripts/install.js
// Node.js install script for code-cheer v3.0 TypeScript build.
// Usage: npm run setup
// Exports patchSettings for testing.

const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawnSync } = require('child_process')

const REPO_DIR = path.join(__dirname, '..')
const INSTALL_DIR = path.join(os.homedir(), '.claude', 'code-cheer')
const SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json')

// ── helpers ──────────────────────────────────────────────────────────────────
function info(msg) { console.log('  ' + msg) }
function ok(msg)   { console.log('✓ ' + msg) }
function warn(msg) { console.log('⚠ ' + msg) }
function die(msg)  { console.error('✗ ' + msg); process.exit(1) }

// ── checkDeps ─────────────────────────────────────────────────────────────────
function checkDeps() {
  // Node >= 20
  const ver = process.version.slice(1).split('.').map(Number)
  if (ver[0] < 20) {
    die('Node.js 20+ required, found ' + process.version + '. Install from https://nodejs.org')
  }

  // git available
  const git = spawnSync('git', ['--version'], { encoding: 'utf8' })
  if (git.status !== 0 || git.error) {
    die('git is required but not found. Install git first.')
  }
}

// ── runBuild ──────────────────────────────────────────────────────────────────
function runBuild() {
  const result = spawnSync('npm', ['run', 'build'], {
    stdio: 'inherit',
    cwd: REPO_DIR,
    shell: true,
  })
  if (result.status !== 0 || result.error) {
    die('Build failed. Run `npm run build` manually to see errors.')
  }
}

// ── migrateFromLegacy ────────────────────────────────────────────────────────
// Copies config.json + state.json from old code-pal dir to new code-cheer dir.
// Accepts optional overrides for testing.
// opts: { oldDir, newDir }
function migrateFromLegacy(opts) {
  const oldDir = (opts && opts.oldDir) || path.join(os.homedir(), '.claude', 'code-pal')
  const newDir = (opts && opts.newDir) || INSTALL_DIR

  // Skip if old dir doesn't exist
  if (!fs.existsSync(oldDir)) return

  // D-02: new dir already exists — skip migration (don't overwrite)
  if (fs.existsSync(newDir)) {
    info('~/.claude/code-cheer/ already exists — skipping migration')
    return
  }

  // Create new dir and copy state files
  fs.mkdirSync(newDir, { recursive: true })
  const filesToMigrate = ['config.json', 'state.json']
  let migrated = 0
  for (const f of filesToMigrate) {
    const src = path.join(oldDir, f)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(newDir, f))
      migrated++
    }
  }
  if (migrated > 0) {
    ok('Migrated ' + migrated + ' file(s) from ~/.claude/code-pal/')
    info('Old directory preserved at ~/.claude/code-pal/ — remove manually when ready')
  }
}

// ── copyFiles ─────────────────────────────────────────────────────────────────
function copyFiles() {
  fs.mkdirSync(INSTALL_DIR, { recursive: true })
  ok('Created ' + INSTALL_DIR)

  // Copy entire dist/ directory (D-07: copy whole dir, future-proof)
  fs.cpSync(path.join(REPO_DIR, 'dist'), path.join(INSTALL_DIR, 'dist'), {
    recursive: true,
    force: true,
  })

  // Copy vocab/
  fs.cpSync(path.join(REPO_DIR, 'vocab'), path.join(INSTALL_DIR, 'vocab'), {
    recursive: true,
    force: true,
  })
  // Copy package.json (required by CI smoke test)
  fs.copyFileSync(path.join(REPO_DIR, 'package.json'), path.join(INSTALL_DIR, 'package.json'))
  ok('Copied dist/, vocab/, and package.json')

  // Write default config.json if not exists
  const configPath = path.join(INSTALL_DIR, 'config.json')
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ character: 'nova', version: '3.0.1' }, null, 2))
    ok('Created default config (Nova)')
  } else {
    info('Config already exists, skipping')
  }

  // Initialize state.json only if not exists (preserves migrated or existing state)
  const statePath = path.join(INSTALL_DIR, 'state.json')
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(
      statePath,
      JSON.stringify(
        { message: '', last_updated: '', last_rate_tier: 'normal', last_slot: null },
        null,
        2
      )
    )
    ok('Initialized state')
  } else {
    info('State already exists, skipping')
  }
}

// ── patchSettings ─────────────────────────────────────────────────────────────
// Accepts optional overrides for testing.
// opts: { settingsPath, installDir, nodeBin }
function patchSettings(nodeBin, opts) {
  const settingsPath = (opts && opts.settingsPath) || SETTINGS_PATH
  const installDir   = (opts && opts.installDir)   || INSTALL_DIR
  const node         = nodeBin || process.execPath

  const statusCmd = '"' + node + '" "' + installDir + '/dist/statusline.js"'
  const updateCmd = '"' + node + '" "' + installDir + '/dist/statusline.js" --update'

  // Load or create
  let data = {}
  if (fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, settingsPath + '.bak')
    try {
      data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
    } catch {
      process.stderr.write('[code-cheer] settings.json is malformed — starting fresh\n')
    }
  } else {
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true })
  }

  // Backup existing statusLine if it is third-party (not statusline.js or statusline.py)
  const backupFile = path.join(installDir, 'statusline-backup.json')
  const existingCmd = (data.statusLine && data.statusLine.command) || ''
  if (
    existingCmd &&
    !existingCmd.includes('statusline.js') &&
    !existingCmd.includes('statusline.py')
  ) {
    fs.mkdirSync(installDir, { recursive: true })
    fs.writeFileSync(backupFile, JSON.stringify({ statusLine: data.statusLine }, null, 2))
    warn('Existing statusLine backed up to: ' + backupFile)
    info('code-cheer requires exclusive statusLine access to function')
    info('Previous config will be restored on uninstall')
  }

  // Set statusLine (replaces Python and Node entries alike)
  data.statusLine = { type: 'command', command: statusCmd }

  // Non-destructive hooks patch — NEVER replace entire hooks object (Pitfall 2)
  data.hooks = data.hooks != null ? data.hooks : {}

  const stop = Array.isArray(data.hooks.Stop) ? data.hooks.Stop : []

  // Remove entries referencing statusline.py OR statusline.js (D-05: upgrade cleanup)
  const cleaned = stop.filter(function (h) {
    if (!h || typeof h !== 'object') return true
    const topCmd = (h.command) || ''
    const innerCmds = Array.isArray(h.hooks)
      ? h.hooks.map(function (ih) { return (ih && ih.command) || '' })
      : []
    const allCmds = [topCmd].concat(innerCmds)
    return !allCmds.some(function (c) {
      return c.includes('statusline.py') || c.includes('statusline.js')
    })
  })

  // Append new Node.js hook
  cleaned.push({ hooks: [{ type: 'command', command: updateCmd }] })
  data.hooks.Stop = cleaned

  // Atomic write: writeFileSync(tmp) + renameSync (per CLAUDE.md pattern)
  const tmp = settingsPath + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, settingsPath)

  ok('Set code-cheer statusLine')
  ok('Patched Stop hook')
}

// ── installCheer ──────────────────────────────────────────────────────────────
function installCheer() {
  const commandsDir = path.join(os.homedir(), '.claude', 'commands')
  fs.mkdirSync(commandsDir, { recursive: true })
  fs.copyFileSync(
    path.join(REPO_DIR, 'commands', 'cheer.md'),
    path.join(commandsDir, 'cheer.md')
  )
  ok('Installed /cheer command')
}

// ── main ──────────────────────────────────────────────────────────────────────
function main() {
  console.log('Installing code-cheer…')
  console.log()

  checkDeps()
  ok(process.version + ' found')
  ok('git found')

  runBuild()
  migrateFromLegacy()
  copyFiles()
  patchSettings(process.execPath)
  installCheer()

  console.log()
  console.log('(*>ω<) Nova: 安装完成！准备好了吗！冲冲冲！！')
  console.log()
  console.log('  Restart Claude Code to activate the statusline.')
  console.log('  Switch characters with: /cheer')
}

// ── exports (for testing) ─────────────────────────────────────────────────────
module.exports = { patchSettings, migrateFromLegacy }

if (require.main === module) {
  main()
}
