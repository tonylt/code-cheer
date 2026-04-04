# Design System — code-cheer

## Product Context
- **What this is:** A Claude Code statusline companion featuring 4 anime characters that react to git events and token usage in real-time
- **Who it's for:** Developers using Claude Code who want personality and warmth in their workflow
- **Space/industry:** Developer tooling — open source CLI companions
- **Project type:** Open source project; primary entry point is GitHub repo; potential future landing page

## Aesthetic Direction
- **Direction:** Warm Pixel-Editorial
- **Decoration level:** intentional — pixel texture as background detail, character colors as design accents, no decorative blobs or gradients
- **Mood:** The warmth of a late-night coding session with someone rooting for you. Every other dev tool signals "serious" with cold darks. code-cheer runs warm, on purpose — because that's what the characters are.
- **Reference sites:** Starship (starship.rs), Warp (warp.dev), Zellij (zellij.dev) — all cold-dark; the deliberate contrast is the differentiator

## Typography
- **Display/Hero:** [Fraunces](https://fonts.google.com/specimen/Fraunces) — warm editorial serif with optical size variation. No other developer tool uses a serif. This is a stance: craft, storytelling, and warmth over corporate geometry. Use for project name, hero headings, character names.
- **Body:** [Geist](https://vercel.com/font) — clean, developer-friendly sans-serif. Readable at small sizes, credible for technical content. Use for all prose, UI labels, navigation.
- **UI/Labels:** Geist (same as body, weight 500 for emphasis)
- **Data/Tables:** Geist with `font-variant-numeric: tabular-nums`
- **Code:** [JetBrains Mono](https://www.jetbrains.com/lp/mono/) — best-in-class monospace for code blocks, terminal commands, statusline output, install instructions
- **Loading:** Google Fonts CDN (`fonts.googleapis.com`) for web; system fallbacks for non-web contexts
- **Scale:**
  | Level | Size | Usage |
  |-------|------|-------|
  | hero  | 64–80px | Project name, hero heading |
  | h1    | 42px | Section headers |
  | h2    | 28px | Subsection headers |
  | h3    | 20px | Card titles, character names |
  | body  | 15–16px | All prose |
  | small | 13px | Labels, badges, captions |
  | mono  | 13–14px | Code, commands, statusline |
  | label | 11px | Section eyebrows (uppercase, tracked) |

## Color
- **Approach:** balanced — Nova amber as primary, character colors as a celebration of the cast (not just functional accents)
- **Background:** `#1a1410` — warm dark (not cold black; the warmth is deliberate and distinguishes from every competitor)
- **Surface:** `#252018` — card backgrounds, code blocks, modals
- **Surface 2:** `#2e2820` — topbars, secondary surfaces
- **Border:** `#3a3228` — all dividers and borders
- **Primary text:** `#f5f0e8` — warm white (not pure white; reduces eye strain on warm bg)
- **Muted text:** `#9a8f7a` — secondary content, labels, timestamps
- **Nova (primary accent):** `#f4a900` — amber; the anchor color confirmed by prior visual identity work
- **Luna:** `#e05c7a` — rose
- **Iris:** `#7ab8f5` — ice blue
- **Mochi:** `#a8d8a8` — mint
- **Semantic:**
  - success `#6abf7a`
  - warning `#f4a900` (reuses Nova amber — "heads up" = Nova's energy)
  - error `#e05c7a` (reuses Luna rose)
  - info `#7ab8f5` (reuses Iris blue)
- **Dark mode:** This IS dark mode. Light mode inverts to warm paper tones — `#fdf8f0` background, `#1a1410` text — for consistency.

## Spacing
- **Base unit:** 8px
- **Density:** comfortable
- **Scale:**
  | Token | Value | Use |
  |-------|-------|-----|
  | 2xs   | 4px   | tight grouping within components |
  | xs    | 8px   | inner padding for badges, tight rows |
  | sm    | 16px  | component internal padding |
  | md    | 24px  | card padding, section gaps |
  | lg    | 40px  | between content blocks |
  | xl    | 64px  | major section spacing |
  | 2xl   | 80–100px | page-level vertical rhythm |

## Layout
- **Approach:** hybrid — editorial/asymmetric for hero/marketing, clean grid for docs and content
- **Grid:** 12 columns; max content width 960px; 24px gutters
- **Max content width:** 960px
- **Border radius:**
  | Token | Value | Use |
  |-------|-------|-----|
  | sm    | 4px   | badges, tight chips |
  | md    | 8px   | inputs, code blocks |
  | lg    | 12px  | cards, panels |
  | xl    | 16px  | large containers, modals |
  | full  | 9999px | pills, avatars |
- **Pixel note:** For hero sections, consider subtle pixel-grid texture (`opacity: 0.015`) as a background — evokes the terminal/pixel art character aesthetic without dominating

## Motion
- **Approach:** intentional — transitions that aid comprehension, character state changes with personality
- **Easing:** enter `ease-out`, exit `ease-in`, move `ease-in-out`
- **Duration:**
  | Token | Range | Use |
  |-------|-------|-----|
  | micro | 50–100ms | hover states, button feedback |
  | short | 150–250ms | card hover lift, focus rings |
  | medium | 250–350ms | page transitions, panel open |
  | long | 400–600ms | character entrance, onboarding |
- **Character motion note:** Character-related transitions (switching characters, reaction appearances) should use `medium` duration with a slight bounce — `cubic-bezier(0.34, 1.56, 0.64, 1)` — to match the playful personality

## Character Color System
Each of the 4 characters has an assigned color used consistently across all visual surfaces:

| Character | Color | Hex | Personality |
|-----------|-------|-----|-------------|
| Nova      | Amber | `#f4a900` | Warm, reliable, observant |
| Luna      | Rose  | `#e05c7a` | Gentle, encouraging, soft |
| Iris      | Ice Blue | `#7ab8f5` | Calm, analytical, precise |
| Mochi     | Mint  | `#a8d8a8` | Playful, spontaneous, cheerful |

Character colors appear in: character name headings, card border accents on hover, badge backgrounds (12% opacity), alert semantic colors, and the `--nova` primary accent role.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-05 | Warm dark background `#1a1410` instead of cold `#1a1a1a` | Every competitor uses cold dark. code-cheer's core value is warmth — palette must match personality |
| 2026-04-05 | Fraunces serif for display/hero | No developer tool in this category uses a serif. Signals craft and narrative; pairs with the character storytelling angle |
| 2026-04-05 | Four-character color system | Characters are the product, not features. The design system celebrates them rather than treating character colors as decorative accents |
| 2026-04-05 | Nova amber `#f4a900` as primary accent | Confirmed anchor from prior visual identity work. Reused as semantic warning color (same energy: "heads up") |
| 2026-04-05 | Initial design system created | Created by /design-consultation after competitive research (Starship, Warp, Zellij) |
