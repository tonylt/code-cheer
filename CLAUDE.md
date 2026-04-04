# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

**code-cheer** — Claude Code statusline companion. Anime-style characters show encouragement + token usage in the status bar after each response.

Installs to `~/.claude/code-cheer/`. Hooks into Claude Code via `settings.json` (Stop hook + statusLine command).

## v3.0 Migration (in progress)

Python → TypeScript/Node.js migration. Python files remain `@deprecated` until full cutover.

- **Build**: `esbuild` bundles `src/` → `dist/statusline.js` (single CJS file, ~40ms cold start)
- **Typecheck**: `tsc --noEmit` (esbuild skips type checking)
- **Runtime**: `node dist/statusline.js` — NEVER use `npx tsx` (1.5s startup, too slow for statusline)
- **Zero runtime deps**: Zod is devDependency only (compile-time schema validation)
- **State writes**: atomic via `writeFileSync(tmp) + renameSync` to prevent half-read corruption

## Commands

```bash
# Build TypeScript → dist/statusline.js
npm run build

# Type check (no emit)
npm run typecheck

# Run TypeScript tests (Jest)
npm test

# Run tests (Python, legacy)
python3 -m pytest tests/

# Run a specific test file
python3 -m pytest tests/test_trigger.py -v

# Manual statusline test (reads state.json, prints render output)
python3 statusline.py

# Force a message update (simulates Stop hook)
python3 statusline.py --update

# Install (Node.js path — v3.0)
npm run setup

# Uninstall (Node.js path — v3.0)
npm run unsetup

# Install (Python legacy path)
./install.sh

# Uninstall (Python legacy path)
./install.sh --uninstall
```

## Architecture

```
statusline.py           Python entry point (legacy, @deprecated)
core/                   Python modules (legacy, @deprecated)
  character.py          load + validate vocab JSON
  trigger.py            message selection logic
  display.py            format output string
src/                    TypeScript source (v3.0)
  statusline.ts         TS entry point (renderMode/updateMode/debugMode)
  core/
    character.ts        vocab loading + validation
    display.ts          statusline formatting
    trigger.ts          message selection
    gitContext.ts       git subprocess context (parallel with Promise.allSettled)
  schemas/              Zod schemas (config, state, vocab)
dist/                   esbuild bundle output (gitignored)
scripts/                Node.js install/uninstall pipeline (v3.0)
  install.js            patchSettings — wires statusline into settings.json
  uninstall.js          unpatchSettings — restores settings.json
vocab/
  nova.json             character vocab (post_tool, time, usage, random)
  luna.json
  mochi.json
  iris.json
  leijun.json           Lei Jun character
commands/
  cheer.md              /cheer slash command (Claude Code custom command)
install.sh              Python legacy installer (still functional, @deprecated)
jest.config.ts          Jest configuration (ts-jest, 80% line coverage threshold)
tests/                  test suite
  *.test.ts             Jest TypeScript tests (176 tests)
  test_*.py             pytest Python tests (126 tests, legacy)
```

## Key files

- `src/core/trigger.ts` — message selection priority logic; edit here to change when/how messages update
- `src/core/display.ts` — output format for the statusline string
- `vocab/*.json` — all character dialogue; safe to edit without touching code
- `scripts/install.js` — install path; patches `~/.claude/settings.json` non-destructively
- `scripts/uninstall.js` — uninstall path; restores `~/.claude/settings.json`

## Hook wiring

scripts/install.js registers two entries in `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/code-cheer/dist/statusline.js"
  },
  "hooks": {
    "Stop": [{
      "hooks": [{"type": "command", "command": "node ~/.claude/code-cheer/dist/statusline.js --update"}]
    }]
  }
}
```

- **statusLine** — polled by Claude Code to render the status bar; reads `state.json`
- **Stop hook** — fires after each Claude response; calls `--update` to pick new message and write `state.json`

## State files (runtime, not in repo)

```
~/.claude/code-cheer/config.json   # {"character": "nova", "version": "3.0.1"}
~/.claude/code-cheer/state.json    # last message, tier, slot, timestamp
~/.claude/stats-cache.json         # token usage by day (written by Claude Code)
```

## Adding a new character

1. Create `vocab/<name>.json` following the structure of an existing vocab file
2. Add the character to `commands/cheer.md` (options list + reply text)
3. Add a test in `tests/character.test.ts`

## Pitfalls

- Production must use `node dist/statusline.js` (~40ms), never `npx tsx` (~1.5s)
- Git subprocesses: use `Promise.allSettled`, check `.status === 'fulfilled'` individually
- TypeScript strict: `if (x)` is false when x=0; use `!== undefined` for existence checks
- install.sh uses `$(which node)` absolute path for nvm/fnm compatibility

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
