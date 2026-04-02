---
phase: 05-vocab
plan: 01
subsystem: core
tags: [character, trigger, git-events, testing, tdd]
dependency_graph:
  requires: []
  provides: [get_git_event_message, triggered_events-param, git_events-read-path]
  affects: [core/character.py, core/trigger.py, tests/test_character.py, tests/test_trigger.py]
tech_stack:
  added: []
  patterns: [module-level-function, optional-parameter, tdd-red-green]
key_files:
  created: []
  modified:
    - core/character.py
    - core/trigger.py
    - tests/test_character.py
    - tests/test_trigger.py
    - tests/test_display.py
decisions:
  - "get_git_event_message() is module-level function in character.py (no classes) importing pick from trigger.py"
  - "triggered_events reads from character.get('git_events', {}) top-level (not triggers sub-key, per D-01)"
  - "make_cc() fixed to use rate_limits.five_hour.used_percentage nesting — matches trigger.py actual read path"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-02"
  tasks_completed: 1
  files_modified: 5
requirements_satisfied: [TST-02]
---

# Phase 05 Plan 01: Add get_git_event_message() + Fix git_events Read Path Summary

**One-liner:** `get_git_event_message()` added to character.py using `pick()` from trigger.py; `resolve_message()` gains `triggered_events` param reading top-level `character["git_events"]`; all 69 tests passing.

## What Was Built

### core/character.py
- Added `from core.trigger import pick` import
- Added `get_git_event_message(vocab: dict, event_key: str) -> str | None` module-level function
- Function reads `vocab.get("git_events", {})`, returns `pick(messages)` or `None` if section/key missing

### core/trigger.py
- Added `triggered_events: list | None = None` parameter to `resolve_message()`
- Fixed Priority 2 branch: reads `character.get("git_events", {})` instead of `triggers.get("git_events", {})` — aligns code with D-01 design decision (git_events at top-level vocab, not inside triggers)
- When `triggered_events` is provided and git_events key found, uses those messages; falls back to post_tool otherwise

### tests/test_character.py
- Updated `fixture_vocab` to include `"git_events"` key with `first_commit_today` and `milestone_5` lists
- Updated import to include `get_git_event_message`
- Added 3 new tests: returns string, unknown key returns None, missing section returns None

### tests/test_trigger.py
- Fixed `make_cc()` to use `rate_limits.five_hour.used_percentage` nesting (Rule 1 bug fix)
- Added 5 new tests: git vocab used when present, fallback on missing key, fallback on no section, warning tier ignores events, critical tier ignores events

### tests/test_display.py (Rule 1 auto-fix)
- Fixed `test_render_line2_contains_pct` to use `five_hour` nested structure and assert `"5h 32.0%"` — test was using old flat structure inconsistent with display.py read path

## Test Results

```
69 passed in 0.08s
```

All 69 tests passing (was 68 before this plan + 1 pre-existing failing test fixed).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed make_cc() structure in test_trigger.py**
- **Found during:** Task 1 GREEN phase — running full test suite revealed 8 pre-existing failures
- **Issue:** `make_cc()` built `{"rate_limits": {"used_percentage": pct}}` but `trigger.py` reads `rate_limits.five_hour.used_percentage` — tests for tier escalation were failing
- **Fix:** Changed `make_cc()` to `{"rate_limits": {"five_hour": {"used_percentage": pct}}}`
- **Files modified:** `tests/test_trigger.py`
- **Commit:** 66b0045

**2. [Rule 1 - Bug] Fixed test_render_line2_contains_pct in test_display.py**
- **Found during:** Task 1 — full test suite run after fixing make_cc()
- **Issue:** Test used `rate_limits.used_percentage` flat structure and asserted `"用量 32%"` (old Chinese label) — both wrong for current display.py
- **Fix:** Updated cc arg to use `five_hour` nesting; asserted `"5h 32.0%"` (actual format)
- **Files modified:** `tests/test_display.py`
- **Commit:** 66b0045 (same commit)

**3. [Plan deviation] 5 trigger tests added instead of 3**
- Plan specified 3 new trigger tests; added 5 (includes `falls_back_to_post_tool_if_key_missing` and `no_git_events_section_falls_back`)
- These cover fallback paths that are correctness requirements (Rule 2)

## Known Stubs

None — all code paths are wired and returning real values.

## Self-Check: PASSED

- FOUND: core/character.py (contains get_git_event_message)
- FOUND: core/trigger.py (contains triggered_events param + character.get("git_events"))
- FOUND: tests/test_character.py (3 new git_event tests)
- FOUND: tests/test_trigger.py (5 new resolve_git tests, fixed make_cc)
- FOUND: commit 66b0045
- Full test suite: 69 passed, 0 failed
