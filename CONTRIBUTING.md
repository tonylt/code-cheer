# Contributing to code-cheer

Thank you for your interest in contributing!

> **Install path note**: Only the Node.js path (`npm run setup`) is supported for development and contribution. `install.sh` is `@deprecated` and will be removed in a future version.

---

## Adding a new character

Characters are defined by a vocab JSON file + a registration in the TypeScript config. Follow all 5 steps:

### Step 1 — Create `vocab/<name>.json`

Use `vocab/nova.json` as a reference. The structure is:

```json
{
  "meta": {
    "name": "CharacterName",
    "ascii": "(ascii face here)",
    "style": "one-line personality description",
    "color": "93"
  },
  "triggers": {
    "random": ["...", "..."],
    "post_tool": ["...", "..."],
    "time": {
      "morning": ["..."],
      "afternoon": ["..."],
      "evening": ["..."],
      "midnight": ["..."]
    },
    "usage": {
      "warning": ["..."],
      "critical": ["..."]
    }
  },
  "git_events": {
    "first_commit_today": ["..."],
    "milestone_5": ["..."],
    "milestone_10": ["..."],
    "milestone_20": ["..."],
    "late_night_commit": ["..."],
    "big_diff": ["..."],
    "big_session": ["..."],
    "long_day": ["..."]
  }
}
```

**Required fields** (throws if missing):
- `meta.name` — display name
- `meta.ascii` — ASCII face, e.g. `(*>ω<)`
- `meta.style` — personality description (used for selection display)
- `meta.color` — ANSI color code as string, e.g. `"93"` (yellow), `"96"` (cyan)

**Optional fields** (falls back to `random` if absent):
- All `triggers.*` and `git_events.*` keys

Minimum viable file:
```json
{
  "meta": { "name": "Kai", "ascii": "(^_^)", "style": "chill", "color": "96" },
  "triggers": { "random": ["Keep going!", "You got this."] }
}
```

### Step 2 — Register in `src/schemas/config.ts`

Open `src/schemas/config.ts` and add your character's name to the `CHARACTER_NAMES` array:

```typescript
// Before
export const CHARACTER_NAMES = ['nova', 'luna', 'mochi', 'iris', 'leijun'] as const

// After (example adding 'kai')
export const CHARACTER_NAMES = ['nova', 'luna', 'mochi', 'iris', 'leijun', 'kai'] as const
```

Use the lowercase filename (without `.json`) as the identifier.

### Step 3 — Build

```bash
npm run build
```

### Step 4 — Add to `/cheer` command

Open `commands/cheer.md` and add your character to:
- The options list at the top
- The reply text section at the bottom

Follow the existing format for the other characters.

### Step 5 — Run tests

```bash
npm test
```

All 167 existing tests must pass. Add tests for your character in `tests/character.test.ts` if it has unusual vocab structure.

### Validate your character

After step 3, you can verify the character loads correctly:

```bash
# Check vocab parses without error
node -e "const s = require('./dist/statusline.js')" && echo "OK"

# Or run in debug mode to see full output
CHARACTER=kai node dist/statusline.js
```

If `meta.*` fields are missing or mistyped, you'll see a `[code-cheer] schema validation failed` error in stderr.

---

## TypeScript test requirements

- **Framework**: Jest with ts-jest
- **Coverage threshold**: 80% line coverage (enforced by `jest.config.ts`)
- **Run**: `npm test`
- **Watch mode**: `npm run test:watch`

The CI `test-node` job runs on Node.js 20 and 22. Both must pass.

---

## Python code

All Python files (`core/`, `statusline.py`, `install.sh`, `tests/test_*.py`) are `@deprecated`. The v3.0 migration to TypeScript is complete. **We do not accept Python contributions.**

---

## Pull request checklist

- [ ] `npm run build` succeeds
- [ ] `npm run typecheck` passes with no errors
- [ ] `npm test` passes with coverage above 80%
- [ ] New vocab JSON has all required `meta.*` fields
- [ ] Character is registered in `src/schemas/config.ts`
- [ ] Character is added to `commands/cheer.md`

---

> One character in this repo is intentionally undocumented. We don't accept external PRs for it.
