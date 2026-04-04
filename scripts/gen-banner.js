'use strict'
// scripts/gen-banner.js
// Generates assets/banner.svg — README hero banner for code-cheer.
// Usage: node scripts/gen-banner.js
// Zero npm dependencies — pure Node.js string template.

const fs   = require('fs')
const path = require('path')

const ROOT       = path.join(__dirname, '..')
const ASSETS_DIR = path.join(ROOT, 'assets')
const OUT_FILE   = path.join(ASSETS_DIR, 'banner.svg')

// Ensure assets/ exists
fs.mkdirSync(ASSETS_DIR, { recursive: true })

// ── SVG template ──────────────────────────────────────────────────────────────
// All styles are inline attributes (no <style> block, no @font-face, no external links).
// GitHub strips <style> from SVG rendered in README — inline attributes are required.
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg"
     width="1280" height="240" viewBox="0 0 1280 240"
     font-family="'Courier New', 'Lucida Console', monospace">

  <!-- Background -->
  <rect width="1280" height="240" fill="#111111"/>

  <!-- Left — Nova kaomoji -->
  <text x="60" y="130"
        font-size="48"
        fill="#f4a900"
        text-anchor="start">(*&gt;&#969;&lt;)</text>

  <!-- Centre — project name -->
  <text x="360" y="100"
        font-size="28"
        fill="#f4a900"
        font-weight="bold">code-cheer</text>

  <!-- Centre — subtitle -->
  <text x="360" y="130"
        font-size="14"
        fill="#666666">reactive anime companion for Claude Code</text>

  <!-- Centre — feature line -->
  <text x="360" y="160"
        font-size="12"
        fill="#555555">* watches your commits * token usage * late-night sessions</text>

  <!-- Right — character selector -->
  <text x="980" y="90"
        font-size="11"
        fill="#888888">characters</text>
  <text x="980" y="110"
        font-size="11"
        fill="#f4a900"
        font-weight="bold">v nova</text>
  <text x="980" y="128"
        font-size="11"
        fill="#555555">o luna</text>
  <text x="980" y="146"
        font-size="11"
        fill="#555555">o mochi</text>
  <text x="980" y="164"
        font-size="11"
        fill="#555555">o iris</text>

</svg>
`

fs.writeFileSync(OUT_FILE, svgContent)
console.log('Generated assets/banner.svg (1280x240)')
